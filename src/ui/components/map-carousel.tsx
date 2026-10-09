import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useMapAuditionStore } from "../../audio/soundtrack-theme";
import {
  MAP_CHOICES,
  getBoardMap,
  getPlayableMapIds,
  isChoicePlayable,
  type MapChoice,
} from "../../game/maps/map-registry";
import { UiIcon } from "../icons/ui-icon";
import { BoardMap } from "./board-map";

/** Horizontal drag, in pixels, that turns a touch into a swipe to the next map. */
const SWIPE_THRESHOLD_PX = 40;

interface MapCarouselProps {
  /** The choice on show, which is also the one selected. */
  value: MapChoice;
  onChange: (choice: MapChoice) => void;
  /** Tighter slide for a modal, where the flat plan shares the card with other content. */
  compact?: boolean;
  /** How many players will play: a map that needs more is marked as such (the caller keeps it from starting). */
  playerCount?: number;
}

/**
 * Board choice as a carousel: one option at a time, the draw first and then
 * every map with its flat plan and what makes it special. The arrows, a swipe
 * or the arrow keys move to the next option, and the option on show is the
 * one picked, so there is nothing else to confirm. Its music plays meanwhile.
 */
export function MapCarousel({ value, onChange, compact = false, playerCount }: MapCarouselProps) {
  const swipeStartX = useRef<number | null>(null);
  const currentIndex = Math.max(0, MAP_CHOICES.indexOf(value));
  const current = MAP_CHOICES[currentIndex];
  // The music follows the option on show, and hands back to the game's once the picker closes.
  useEffect(() => useMapAuditionStore.setState({ choice: current }), [current]);
  useEffect(() => () => useMapAuditionStore.setState({ choice: null }), []);

  const go = (offset: number) =>
    onChange(MAP_CHOICES[(currentIndex + offset + MAP_CHOICES.length) % MAP_CHOICES.length]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") go(-1);
    else if (event.key === "ArrowRight") go(1);
    else return;
    event.preventDefault();
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swipeStartX.current = event.pointerType === "mouse" ? null : event.clientX;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (swipeStartX.current === null) return;
    const deltaX = event.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX) go(deltaX < 0 ? 1 : -1);
  };

  return (
    <div
      className={`map-carousel ${compact ? "map-carousel--compact" : ""}`}
      role="group"
      aria-roledescription="carrousel"
      aria-label="Carte de la partie"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <button type="button" className="map-carousel__arrow" onClick={() => go(-1)} aria-label="Carte précédente">
        ‹
      </button>
      <div
        className="map-carousel__slide"
        aria-live="polite"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => (swipeStartX.current = null)}
      >
        {/* Every option stays stacked in the same cell, so the carousel keeps the height of the tallest. */}
        {MAP_CHOICES.map((choice) => (
          <MapSlide key={choice} choice={choice} current={choice === current} playerCount={playerCount} />
        ))}
      </div>
      <button type="button" className="map-carousel__arrow" onClick={() => go(1)} aria-label="Carte suivante">
        ›
      </button>
      <div className="map-carousel__dots" role="tablist" aria-label="Choisir une carte">
        {MAP_CHOICES.map((choice, index) => (
          <button
            key={choice}
            type="button"
            role="tab"
            aria-selected={index === currentIndex}
            aria-label={choice === "random" ? "Aléatoire" : getBoardMap(choice).name}
            className={index === currentIndex ? "is-active" : ""}
            onClick={() => onChange(choice)}
          />
        ))}
      </div>
    </div>
  );
}

/** One option of the carousel: the flat plan (or the dice) beside the name and the specialities. */
function MapSlide({ choice, current, playerCount }: { choice: MapChoice; current: boolean; playerCount?: number }) {
  const className = `map-slide ${current ? "is-current" : ""}`;
  if (choice === "random") {
    return (
      <div className={className} aria-hidden={!current}>
        <span className="map-slide__preview map-slide__preview--random" aria-hidden="true">
          <UiIcon name="dice" size={40} />
        </span>
        <span className="map-slide__text">
          <strong>Aléatoire</strong>
          <small>
            Le jeu tire la carte au sort au lancement de la partie, parmi {getPlayableMapIds(playerCount ?? 8).length}{" "}
            plateaux.
          </small>
          <span className="map-slide__highlights">
            {getPlayableMapIds(playerCount ?? 8).map((mapId) => (
              <span key={mapId}>{getBoardMap(mapId).name}</span>
            ))}
          </span>
        </span>
      </div>
    );
  }

  const map = getBoardMap(choice);
  return (
    <div className={className} aria-hidden={!current}>
      <span className="map-slide__preview">
        <BoardMap mapId={choice} />
      </span>
      <span className="map-slide__text">
        <strong>{map.name}</strong>
        <small>{map.tagline}</small>
        {playerCount !== undefined && !isChoicePlayable(choice, playerCount) && (
          <small className="map-slide__lock">
            Il faut {map.minPlayers} joueurs au moins ({playerCount} à table).
          </small>
        )}
        <span className="map-slide__highlights">
          {map.highlights.map((highlight) => (
            <span key={highlight}>{highlight}</span>
          ))}
        </span>
      </span>
    </div>
  );
}
