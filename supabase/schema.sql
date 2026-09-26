-- Red Cups — the whole online backend.
--
-- There is no game server: a room is a row, a private Realtime channel and a
-- set of functions. Every device runs the same engine on the same actions
-- from the same seed; the database only keeps the latest snapshot, checks who
-- sits where, and settles races. This file is idempotent: running it again is
-- safe.
--
-- Security model in one paragraph: the tables cannot be read or written
-- directly. Row level security is on with no policies, and every path goes
-- through a `security definer` function that takes the caller from
-- `auth.uid()`, never from the request body. There are no spectators: only a
-- player seated in a room may read its game or join its Realtime channel.

-- ------------------------------------------------------------------ tables

create table if not exists public.rooms (
  code         text primary key check (code ~ '^[A-Z0-9]{6}$'),
  status       text not null default 'lobby' check (status in ('lobby', 'playing', 'over')),
  host_id      uuid not null,
  state        jsonb,                          -- GameState snapshot
  version      integer not null default 0,     -- compare-and-set counter
  seat_order   jsonb not null default '[]',    -- user ids in turn order, frozen at kickoff
  -- How long the room outlives its last active player, in seconds.
  idle_seconds integer not null default 600 check (idle_seconds between 30 and 3600),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.room_players (
  room_code text not null references public.rooms(code) on delete cascade,
  user_id   uuid not null,
  -- The engine's seat, set at kickoff from `seat_order`; null in the lobby.
  seat      smallint check (seat >= 0 and seat < 8),
  name      text not null check (char_length(name) between 1 and 16),
  -- Index into the game's avatar palette (PLAYER_COLORS). Every row is a
  -- player, so every row has one.
  avatar    smallint not null check (avatar >= 0 and avatar < 8),
  joined_at timestamptz not null default now(),
  -- "Still there" must be a fact the database can check, not a device's word.
  last_seen timestamptz not null default now(),
  primary key (room_code, user_id)
);

-- Two players grabbing the same avatar at the same moment are settled here:
-- the second one gets a constraint violation, the one outcome that cannot go wrong.
create unique index if not exists room_players_avatar_unique on public.room_players (room_code, avatar);
create unique index if not exists room_players_seat_unique
  on public.room_players (room_code, seat) where seat is not null;
create index if not exists room_players_last_seen on public.room_players (room_code, last_seen);
create index if not exists rooms_stale on public.rooms (updated_at);

-- A Google account and the name the table calls it. A guest has no row here.
-- Only the name for now; the game history will hang off this table later.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_display_name_shape check (
    char_length(display_name) between 2 and 16 and display_name = btrim(display_name)
  )
);

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.profiles enable row level security;

-- --------------------------------------------------------------- functions
--
-- SEAT_TIMEOUT is 75 seconds, written inline below. Devices report in every
-- 20 seconds through `touch_seat`, so a player survives three missed beats
-- (a tunnel, a locked phone, a reload) before being shown as away.

-- A room lives while somebody plays at it. One where every player has been
-- quiet for its idle timeout is deleted, and the cascade takes the roster.
-- There is no scheduler: every read and heartbeat runs this sweep. `skip
-- locked` lets two sweeps pass each other instead of deadlocking.
create or replace function public.release_empty_rooms()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rooms
   where code in (
     select r.code from public.rooms r
      where r.updated_at < now() - interval '30 seconds'
        and r.updated_at < now() - make_interval(secs => r.idle_seconds)
        and not exists (
          select 1 from public.room_players p
           where p.room_code = r.code
             and p.last_seen > now() - make_interval(secs => r.idle_seconds)
        )
      for update skip locked
   );
$$;

create or replace function public.is_room_player(p_code text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.room_players where room_code = p_code and user_id = p_user);
$$;

-- The only way to see a room. A player gets everything. Anybody else only
-- gets what they need to sit down: the lobby's roster, or the fact that the
-- game has started without them. They never get the board.
create or replace function public.get_room(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  member boolean;
begin
  if me is null then
    raise exception 'Identité manquante' using errcode = '28000';
  end if;
  perform public.release_empty_rooms();
  member := public.is_room_player(p_code, me);

  return (
    select jsonb_build_object(
      'code', r.code,
      'status', r.status,
      'host_id', r.host_id,
      'is_player', member,
      'state', case when member then r.state end,
      'version', case when member then r.version end,
      'seat_order', case when member then r.seat_order else '[]'::jsonb end,
      'players', case when member or r.status = 'lobby' then coalesce((
        select jsonb_agg(jsonb_build_object(
          'user_id', p.user_id, 'seat', p.seat, 'name', p.name, 'avatar', p.avatar,
          'absent', p.last_seen < now() - interval '75 seconds'
        ) order by p.joined_at)
        from public.room_players p where p.room_code = r.code
      ), '[]'::jsonb) else '[]'::jsonb end
    )
    from public.rooms r where r.code = p_code
  );
end;
$$;

-- Creates a room. The host still sits down with `claim_seat`, like everybody.
create or replace function public.create_room(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Identité manquante' using errcode = '28000';
  end if;
  perform public.release_empty_rooms();
  insert into public.rooms (code, host_id) values (p_code, me);
end;
$$;

-- Sitting down in a lobby, or changing name or avatar while still in it.
-- Only while the lobby is open and has a free chair: there is no standing at
-- the back. An account sits under its profile name, read here rather than
-- from the request.
create or replace function public.claim_seat(p_code text, p_name text, p_avatar smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me        uuid := auth.uid();
  room      public.rooms%rowtype;
  seat_name text;
begin
  if me is null then
    raise exception 'Identité manquante' using errcode = '28000';
  end if;

  -- Locked for the rest of the call, so two late arrivals cannot both take the last chair.
  select * into room from public.rooms where code = p_code for update;
  if not found then
    raise exception 'Aucun salon avec ce code' using errcode = 'P0002';
  end if;
  if room.status <> 'lobby' then
    raise exception 'La partie a déjà commencé' using errcode = '42501';
  end if;
  if not public.is_room_player(p_code, me)
     and (select count(*) from public.room_players where room_code = p_code) >= 8 then
    raise exception 'Le salon est complet' using errcode = '53400';
  end if;

  select pr.display_name into seat_name from public.profiles pr where pr.id = me;
  seat_name := left(btrim(coalesce(seat_name, p_name, '')), 16);
  if seat_name = '' then
    raise exception 'Il faut un nom' using errcode = '22023';
  end if;

  begin
    insert into public.room_players (room_code, user_id, name, avatar, last_seen)
    values (p_code, me, seat_name, p_avatar, now())
    on conflict (room_code, user_id)
    do update set name = excluded.name, avatar = excluded.avatar, last_seen = now();
  exception
    when unique_violation then
      raise exception 'Cet avatar vient d''être pris' using errcode = '23505';
    when check_violation then
      raise exception 'Nom ou avatar invalide' using errcode = '23514';
  end;

  update public.rooms set updated_at = now() where code = p_code;
end;
$$;

-- Still here. Returns the room's version, or null once the room is gone: a
-- device learns from it that it missed a move (a lost broadcast) or that its
-- room expired while it slept.
drop function if exists public.touch_seat(text);
create function public.touch_seat(p_code text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.release_empty_rooms();
  update public.room_players set last_seen = now() where room_code = p_code and user_id = auth.uid();
  return (select version from public.rooms where code = p_code);
end;
$$;

-- Leaving. A lobby whose host walks out closes; a game under way goes on.
create or replace function public.leave_room(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Identité manquante' using errcode = '28000';
  end if;
  delete from public.room_players where room_code = p_code and user_id = me;
  delete from public.rooms where code = p_code and host_id = me and status = 'lobby';
end;
$$;

-- Kickoff, by the host only. The seat order must list exactly the players in
-- the lobby: the engine numbers players by their position in it.
create or replace function public.open_room(p_code text, p_state jsonb, p_seat_order jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  listed   integer := jsonb_array_length(p_seat_order);
  seated   integer;
  matching integer;
begin
  if not exists (select 1 from public.rooms where code = p_code and host_id = me and status = 'lobby') then
    raise exception 'Seul l''hôte peut lancer la partie' using errcode = '42501';
  end if;

  select count(*) into seated from public.room_players where room_code = p_code;
  select count(distinct o.client) into matching
    from jsonb_array_elements_text(p_seat_order) as o(client)
    join public.room_players p on p.room_code = p_code and p.user_id::text = o.client;
  if listed < 2 or listed <> seated or matching <> seated then
    raise exception 'La liste des joueurs a changé : relance la partie' using errcode = '22023';
  end if;

  update public.rooms
     set status = 'playing', state = p_state, version = 1, seat_order = p_seat_order, updated_at = now()
   where code = p_code;

  update public.room_players p
     set seat = (o.idx - 1)::smallint
    from jsonb_array_elements_text(p_seat_order) with ordinality as o(client, idx)
   where p.room_code = p_code and p.user_id::text = o.client;
end;
$$;

-- One action's worth of progress, written by the device that played it
-- *before* it tells anyone. Compare-and-set on `version` makes this the one
-- place where simultaneous moves (two duellists picking a hand at once) are
-- put in order: the loser is refused, reloads the room and tries again.
create or replace function public.advance_room(p_code text, p_state jsonb, p_from integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hit integer;
begin
  if not public.is_room_player(p_code, auth.uid()) then
    raise exception 'Tu ne joues pas dans ce salon' using errcode = '42501';
  end if;

  update public.room_players set last_seen = now() where room_code = p_code and user_id = auth.uid();

  update public.rooms
     set state = p_state,
         version = p_from + 1,
         status = case when p_state->>'phase' = 'finished' then 'over' else 'playing' end,
         updated_at = now()
   where code = p_code and version = p_from and status = 'playing';
  get diagnostics hit = row_count;
  return hit = 1;
end;
$$;

-- ---------------------------------------------------------------- accounts

-- This session's profile, or null: a guest, or an account without a name yet.
create or replace function public.get_my_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('display_name', pr.display_name) from public.profiles pr where pr.id = auth.uid();
$$;

-- Only a Google session may save a profile, asked of `auth.users` rather
-- than of a claim in the request.
create or replace function public.save_profile(p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Identité manquante' using errcode = '28000';
  end if;
  if not exists (select 1 from auth.users where id = me and is_anonymous is not true) then
    raise exception 'Connecte-toi avec Google pour créer un profil' using errcode = '42501';
  end if;

  begin
    insert into public.profiles (id, display_name)
    values (me, btrim(p_display_name))
    on conflict (id) do update set display_name = excluded.display_name, updated_at = now();
  exception
    when check_violation then
      raise exception 'Le nom doit faire entre 2 et 16 caractères' using errcode = '23514';
  end;
end;
$$;

-- --------------------------------------------------------------- realtime
--
-- Rooms talk on private channels named `room:<CODE>`. Realtime checks these
-- policies when a device joins: only a seated player may listen or speak.
-- (In the dashboard, Realtime settings must refuse public channels.)
-- The check goes through `is_room_player`, a definer function: a plain
-- subquery on `room_players` would be filtered to nothing by its own RLS.

drop policy if exists "room players listen" on realtime.messages;
create policy "room players listen" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select realtime.topic()) like 'room:%'
    and public.is_room_player(substr((select realtime.topic()), 6), (select auth.uid()))
  );

drop policy if exists "room players speak" on realtime.messages;
create policy "room players speak" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select realtime.topic()) like 'room:%'
    and public.is_room_player(substr((select realtime.topic()), 6), (select auth.uid()))
  );

-- ------------------------------------------------------------------ grants
--
-- Every new function is executable by `public`, which `anon` belongs to, so
-- the revoke names both. A guest signs in anonymously and is `authenticated`.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.get_room(text)',
    'public.release_empty_rooms()',
    'public.create_room(text)',
    'public.claim_seat(text, text, smallint)',
    'public.touch_seat(text)',
    'public.leave_room(text)',
    'public.open_room(text, jsonb, jsonb)',
    'public.advance_room(text, jsonb, integer)',
    'public.get_my_profile()',
    'public.save_profile(text)',
    'public.is_room_player(text, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
