import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { PLAYER_COLORS } from "../../game/types";
import { FlowFooter } from "../components/flow-shell";
import { PlayerAvatar } from "../components/player-avatar";
import { UiIcon } from "../icons/ui-icon";
import { PlayersTable } from "./players-table";

export interface TableEntry {
  /** Stable identity so the FLIP animations can follow a seat across reorders. */
  id: number;
  name: string;
}

interface PlayersStepProps {
  entries: TableEntry[];
  onChange: (entries: TableEntry[]) => void;
  minPlayers: number;
  maxPlayers: number;
  nameMaxLength: number;
  onNext: () => void;
}

/** How long the seats keep their staggered glide after the dice are thrown. */
const SHUFFLE_FLOURISH_MS = 900;
const FLIP_ANIMATION_ID = "seat-flip";

function readTranslate(node: HTMLElement): { x: number; y: number } {
  const value = getComputedStyle(node).translate;
  if (!value || value === "none") return { x: 0, y: 0 };
  const [x, y = "0px"] = value.split(" ");
  return { x: Number.parseFloat(x) || 0, y: Number.parseFloat(y) || 0 };
}

/**
 * Step 1 of the setup: who sits at the table. The seating is the playing order, so it is drawn as a
 * table seen from above, the pawns sitting around it clockwise. Reorder the seats in the list (drag
 * a card by its grip, or use the arrow keys) and the pawns glide round the table at the same time;
 * "Mélanger l'ordre" tosses everyone into new seats.
 */
export function PlayersStep({ entries, onChange, minPlayers, maxPlayers, nameMaxLength, onNext }: PlayersStepProps) {
  const listRef = useRef<HTMLDivElement>(null);
  /** Layout slot of every seat (offsets inside the roster), blind to animations and to scrolling. */
  const slotsBefore = useRef(new Map<string, { x: number; y: number }>());
  const dragId = useRef<number | null>(null);
  /** Where inside the seat the pointer took hold of it. */
  const grabOffset = useRef({ x: 0, y: 0 });
  const latestHandlers = useRef<{ move: (x: number, y: number, id: number) => void; end: (id: number) => void }>({
    move: () => undefined,
    end: () => undefined,
  });
  const lastPointer = useRef({ x: 0, y: 0 });
  const focusAfterAdd = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [shuffles, setShuffles] = useState(0);
  const [flourish, setFlourish] = useState(false);

  // FLIP: remember where every seat card sat; when it moves, play the difference backwards. A slide already
  // running hands its remaining offset to the next one, so rapid drags keep gliding without jumping. It uses
  // the `translate` property so the card's own `transform` stays free for the drag lift and the entrance.
  useLayoutEffect(() => {
    const nodes = listRef.current?.querySelectorAll<HTMLElement>("[data-flip]") ?? [];
    nodes.forEach((node) => {
      const key = node.dataset.flip;
      if (!key) return;
      const residual = readTranslate(node);
      node.getAnimations().forEach((animation) => {
        if (animation.id === FLIP_ANIMATION_ID) animation.cancel();
      });
      const after = { x: node.offsetLeft, y: node.offsetTop };
      const before = slotsBefore.current.get(key);
      slotsBefore.current.set(key, after);
      if (Number(key) === dragId.current) {
        // The slot moved under the finger: the card is re-glued to the pointer from its new slot.
        applyDragTransform(node);
        return;
      }
      const dx = (before ? before.x - after.x : 0) + residual.x;
      const dy = (before ? before.y - after.y : 0) + residual.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      node.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0px 0px" }], {
        id: FLIP_ANIMATION_ID,
        duration: 300,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      });
    });
    const focusId = focusAfterAdd.current;
    if (focusId !== null) {
      focusAfterAdd.current = null;
      const input = listRef.current?.querySelector<HTMLInputElement>(`[data-flip="${focusId}"] input`);
      input?.focus();
      input?.select();
    }
  }, [entries]);

  // The staggered glide only lasts a moment, so that a plain drag stays snappy.
  useLayoutEffect(() => {
    if (!flourish) return undefined;
    const timer = window.setTimeout(() => setFlourish(false), SHUFFLE_FLOURISH_MS);
    return () => window.clearTimeout(timer);
  }, [flourish]);

  const seatOf = (id: number) => listRef.current?.querySelector<HTMLElement>(`[data-flip="${id}"]`) ?? null;

  /** Where the seat's slot really is on screen, whatever animation or scroll is going on. */
  const slotOnScreen = (node: HTMLElement) => {
    const list = listRef.current;
    if (!list) return { x: 0, y: 0 };
    const box = list.getBoundingClientRect();
    return { x: box.left - list.scrollLeft + node.offsetLeft, y: box.top - list.scrollTop + node.offsetTop };
  };

  /** The dragged card follows the pointer exactly: its offset is the pointer minus its slot minus the grab point. */
  const applyDragTransform = (node: HTMLElement) => {
    const slot = slotOnScreen(node);
    const dx = lastPointer.current.x - grabOffset.current.x - slot.x;
    const dy = lastPointer.current.y - grabOffset.current.y - slot.y;
    node.style.transform = `translate(${dx}px, ${dy}px) rotate(1.5deg) scale(1.03)`;
  };

  /** Move the dragged seat to the slot the pointer hovers; the others slide away as it goes. */
  const reorderByPointer = (id: number, clientX: number, clientY: number) => {
    const index = entries.findIndex((entry) => entry.id === id);
    let target: { id: number; distance: number; reach: number } | null = null;
    for (const entry of entries) {
      const node = seatOf(entry.id);
      if (!node || entry.id === id) continue;
      // Slots, not the animated boxes: a seat still gliding must not be hit where it is passing through.
      const slot = slotOnScreen(node);
      const distance = Math.hypot(slot.x + node.offsetWidth / 2 - clientX, slot.y + node.offsetHeight / 2 - clientY);
      if (!target || distance < target.distance) {
        target = { id: entry.id, distance, reach: Math.max(node.offsetWidth, node.offsetHeight) * 0.5 };
      }
    }
    if (!target || target.distance > target.reach) return;
    const to = entries.findIndex((entry) => entry.id === target.id);
    if (to === index) return;
    const next = [...entries];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  /** Near the top or bottom edge of the roster, the list scrolls so a seat can travel further than the screen shows. */
  const scrollNearEdges = (clientY: number) => {
    const list = listRef.current;
    if (!list) return;
    const box = list.getBoundingClientRect();
    const zone = 48;
    if (clientY < box.top + zone) list.scrollTop -= 14;
    else if (clientY > box.bottom - zone) list.scrollTop += 14;
  };

  const moveDrag = (clientX: number, clientY: number, id: number) => {
    if (dragId.current !== id) return;
    const seat = seatOf(id);
    if (!seat) return;
    lastPointer.current = { x: clientX, y: clientY };
    scrollNearEdges(clientY);
    applyDragTransform(seat);
    reorderByPointer(id, clientX, clientY);
  };

  /**
   * The drag listens on the window, not on the grip: reordering moves the grip's element in the DOM, and the
   * browser drops a pointer capture held by a moved element, so the release would never reach it.
   */
  const startDrag = (event: PointerEvent<HTMLSpanElement>, id: number) => {
    if (entries.length < 2 || dragId.current !== null) return;
    const seat = seatOf(id);
    if (!seat) return;
    event.preventDefault();
    const slot = slotOnScreen(seat);
    dragId.current = id;
    grabOffset.current = { x: event.clientX - slot.x, y: event.clientY - slot.y };
    lastPointer.current = { x: event.clientX, y: event.clientY };
    setDragging(id);
    const pointerId = event.pointerId;
    const onMove = (move: globalThis.PointerEvent) => {
      if (move.pointerId === pointerId) latestHandlers.current.move(move.clientX, move.clientY, id);
    };
    const onRelease = (release: globalThis.PointerEvent) => {
      if (release.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
      latestHandlers.current.end(id);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
  };

  const endDrag = (id: number) => {
    if (dragId.current !== id) return;
    dragId.current = null;
    setDragging(null);
    const seat = seatOf(id);
    if (!seat) return;
    // Snap home from where the finger let go to where the table put it, with the same glide as the others.
    const visual = seat.getBoundingClientRect();
    seat.style.transform = "";
    const final = seat.getBoundingClientRect();
    const dx = visual.left - final.left;
    const dy = visual.top - final.top;
    if (dx !== 0 || dy !== 0) {
      seat.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0px 0px" }], {
        id: FLIP_ANIMATION_ID,
        duration: 220,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      });
    }
  };

  // The window listeners outlive a render: they always call the freshest handlers.
  latestHandlers.current = { move: moveDrag, end: endDrag };

  /** The grip answers to the keyboard too: arrows swap the seat with its neighbours. */
  const moveByKeys = (id: number, offset: number) => {
    const index = entries.findIndex((entry) => entry.id === id);
    const to = index + offset;
    if (index === -1 || to < 0 || to >= entries.length) return;
    const next = [...entries];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const updateName = (id: number, value: string) =>
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, name: value } : entry)));

  const remove = (id: number) => onChange(entries.filter((entry) => entry.id !== id));

  const add = () => {
    if (entries.length >= maxPlayers) return;
    const nextId = Math.max(0, ...entries.map((entry) => entry.id)) + 1;
    slotsBefore.current.delete(String(nextId));
    focusAfterAdd.current = nextId;
    onChange([...entries, { id: nextId, name: `Joueur ${entries.length + 1}` }]);
  };

  const shuffle = () => {
    const next = [...entries];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    setShuffles((count) => count + 1);
    setFlourish(true);
    onChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>, id: number) => {
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      moveByKeys(id, -1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      moveByKeys(id, 1);
    }
  };

  const freeSeats = Math.max(0, maxPlayers - entries.length);

  return (
    <section className="players" aria-labelledby="setup-players-title">
      <div className="players__intro">
        <h1 id="setup-players-title">
          Qui joue <br />
          ce soir&nbsp;?
        </h1>
        <p className="players__lead">
          Les places forment l’ordre de jeu, dans le sens des aiguilles d’une montre. Glisse une carte par sa poignée
          pour changer l’ordre.
        </p>
      </div>

      <div className="players__stage">
        <PlayersTable
          seats={entries.map((entry, index) => ({
            key: entry.id,
            name: entry.name.trim() || `Joueur ${index + 1}`,
            color: PLAYER_COLORS[index],
          }))}
          shuffles={shuffles}
          flourish={flourish}
        />
      </div>

      <div className="players__roster" ref={listRef}>
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            data-flip={entry.id}
            className={`seat${dragging === entry.id ? " is-dragging" : ""}`}
            style={{ "--seat-color": PLAYER_COLORS[index], "--order": index } as CSSProperties}
          >
            <span className="seat__rank">{index + 1}</span>
            <span
              className="seat__grip"
              role="button"
              tabIndex={0}
              aria-label={`Déplacer ${entry.name || `le joueur ${index + 1}`} : flèches haut et bas pour changer d’ordre`}
              onPointerDown={(event) => startDrag(event, entry.id)}
              onKeyDown={(event) => handleKeyDown(event, entry.id)}
            >
              <UiIcon name="menu" size={20} />
            </span>
            <span className="seat__avatar">
              <PlayerAvatar color={PLAYER_COLORS[index]} size={52} />
            </span>
            <label className="seat__field">
              <span className="seat__label">{index === 0 ? "Premier à jouer" : `Joueur ${index + 1}`}</span>
              <input
                className="seat__input"
                value={entry.name}
                maxLength={nameMaxLength}
                onChange={(event) => updateName(entry.id, event.target.value)}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <button
              type="button"
              className="icon-button icon-button--small seat__remove"
              onClick={() => remove(entry.id)}
              disabled={entries.length <= minPlayers}
              aria-label={`Retirer ${entry.name || `le joueur ${index + 1}`}`}
            >
              <UiIcon name="close" size={16} />
            </button>
          </div>
        ))}

        {Array.from({ length: freeSeats }, (_, offset) => {
          const index = entries.length + offset;
          return (
            <button
              key={`free-${index}`}
              type="button"
              className="seat seat--free"
              style={{ "--order": index } as CSSProperties}
              onClick={add}
              aria-label="Ajouter un joueur"
            >
              <span className="seat__rank">{index + 1}</span>
              <span className="seat__plus">
                <UiIcon name="plus" size={22} />
              </span>
              <span className="seat__free-label">Place libre</span>
            </button>
          );
        })}
      </div>

      <FlowFooter>
        <button type="button" className="btn btn--gold" onClick={shuffle} disabled={entries.length < 2}>
          <UiIcon name="dice" size={20} />
          <span>
            Mélanger<span className="flow-foot__wide"> l’ordre</span>
          </span>
        </button>
        <p className="flow-foot__count" aria-live="polite">
          <span className="flow-foot__pips" aria-hidden="true">
            {Array.from({ length: maxPlayers }, (_, index) => (
              <span key={index} className={index < entries.length ? "is-filled" : ""} />
            ))}
          </span>
          <span>
            <strong>{entries.length}</strong> / {maxPlayers}
            <span className="flow-foot__wide"> joueurs</span>
          </span>
        </p>
        <button type="button" className="btn btn--cup btn--large flow-foot__next" onClick={onNext} data-autofocus>
          Choisir la carte
          <UiIcon name="arrowRight" size={22} />
        </button>
      </FlowFooter>
    </section>
  );
}
