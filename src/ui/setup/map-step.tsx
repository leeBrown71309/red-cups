import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useMapAuditionStore } from "../../audio/soundtrack-theme";
import { MAP_CHOICES, MAP_ORDER, getBoardMap, type MapChoice } from "../../game/maps/map-registry";
import { BoardMap } from "../components/board-map";
import { FlowFooter } from "../components/flow-shell";
import { UiIcon } from "../icons/ui-icon";
import { drawChosenMap, useMapChoiceStore } from "../lobby/map-choice-store";

/** Horizontal drag, in pixels, that turns a touch into a swipe to the next map. */
const SWIPE_THRESHOLD_PX = 40;

interface MapStepProps {
  playerCount: number;
  onBack: () => void;
  onLaunch: (mapId: ReturnType<typeof drawChosenMap>) => void;
}

function describeChoice(choice: MapChoice): { name: string; tagline: string; highlights: string[] } {
  if (choice === "random") {
    return {
      name: "Aléatoire",
      tagline: `Le jeu tire la carte au sort au lancement de la partie, parmi ${MAP_ORDER.length} plateaux.`,
      highlights: MAP_ORDER.map((mapId) => getBoardMap(mapId).name),
    };
  }
  const map = getBoardMap(choice);
  return { name: map.name, tagline: map.tagline, highlights: map.highlights };
}

/**
 * Step 2 of the setup: the board, as a level select. The maps are listed on the left (a row of chips on a
 * phone), and the one in focus is shown large on the right with its plan and what makes it special.
 * The focused option is the one that starts: there is nothing to confirm but the launch itself.
 */
export function MapStep({ playerCount, onBack, onLaunch }: MapStepProps) {
  const choice = useMapChoiceStore((state) => state.choice);
  const setChoice = useMapChoiceStore((state) => state.setChoice);
  const swipeStartX = useRef<number | null>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const currentIndex = Math.max(0, MAP_CHOICES.indexOf(choice));

  // The music follows the option on show, and hands back to the game's once the page closes.
  useEffect(() => useMapAuditionStore.setState({ choice }), [choice]);
  useEffect(() => () => useMapAuditionStore.setState({ choice: null }), []);

  // On a phone the options are a row that scrolls: keep the one in focus in view.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    optionRefs.current[currentIndex]?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: reduced ? "auto" : "smooth",
    });
  }, [currentIndex]);

  const go = (offset: number, focus = false) => {
    const next = (currentIndex + offset + MAP_CHOICES.length) % MAP_CHOICES.length;
    setChoice(MAP_CHOICES[next]);
    if (focus) optionRefs.current[next]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") go(-1, true);
    else if (event.key === "ArrowRight" || event.key === "ArrowDown") go(1, true);
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
    <section className="mapstep" aria-labelledby="setup-map-title">
      <div className="mapstep__intro">
        <h1 id="setup-map-title">
          Sur quelle <br />
          carte&nbsp;?
        </h1>
        <p className="mapstep__lead">La carte en vue est celle qui sera jouée. Glisse pour en changer.</p>
      </div>

      <div
        className="mapstep__list"
        role="radiogroup"
        aria-label="Carte de la partie"
        style={{ "--index": currentIndex, "--count": MAP_CHOICES.length } as CSSProperties}
        onKeyDown={handleKeyDown}
      >
        <span className="mapstep__marker" aria-hidden="true" />
        {MAP_CHOICES.map((option, index) => {
          const info = describeChoice(option);
          const isCurrent = index === currentIndex;
          return (
            <button
              key={option}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={isCurrent}
              tabIndex={isCurrent ? 0 : -1}
              className={`mapopt${isCurrent ? " is-current" : ""}`}
              style={{ "--order": index } as CSSProperties}
              onClick={() => setChoice(option)}
            >
              <span
                className={`mapopt__thumb${option === "random" ? " mapopt__thumb--random" : ""}`}
                aria-hidden="true"
              >
                {option === "random" ? <UiIcon name="dice" size={26} /> : <BoardMap mapId={option} />}
              </span>
              <span className="mapopt__text">
                <strong>{info.name}</strong>
                <small>{option === "random" ? `${MAP_ORDER.length} plateaux` : info.tagline}</small>
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="mapstep__stage"
        aria-live="polite"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => (swipeStartX.current = null)}
      >
        {/* Every option stays mounted in the same cell: the one in focus rises, the others sink away. */}
        {MAP_CHOICES.map((option, index) => {
          const info = describeChoice(option);
          const isCurrent = index === currentIndex;
          return (
            <article
              key={option}
              className={`mapshow${isCurrent ? " is-current" : ""}${index < currentIndex ? " is-before" : ""}`}
              aria-hidden={!isCurrent}
            >
              <div className="mapshow__plan">
                {option === "random" ? (
                  <span className="mapshow__fan">
                    {MAP_ORDER.map((mapId, fanIndex) => (
                      <span
                        key={mapId}
                        className="mapshow__fan-card"
                        style={{ "--f": fanIndex - (MAP_ORDER.length - 1) / 2 } as CSSProperties}
                      >
                        <BoardMap mapId={mapId} />
                      </span>
                    ))}
                    <span className="mapshow__dice">
                      <UiIcon name="dice" size={44} strokeWidth={2.2} />
                    </span>
                  </span>
                ) : (
                  <BoardMap mapId={option} />
                )}
              </div>
              <div className="mapshow__text">
                <h2>{info.name}</h2>
                <p>{info.tagline}</p>
                <ul className="mapshow__chips">
                  {info.highlights.map((highlight, chip) => (
                    <li key={highlight} style={{ "--c": chip } as CSSProperties}>
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      <FlowFooter>
        <button type="button" className="btn btn--cream" onClick={onBack}>
          <UiIcon name="arrowLeft" size={20} />
          <span>Joueurs</span>
        </button>
        <p className="flow-foot__count">
          <UiIcon name="users" size={18} />
          <span>
            <strong>{playerCount}</strong> joueurs
          </span>
        </p>
        <button
          type="button"
          className="btn btn--cup btn--large flow-foot__next"
          onClick={() => onLaunch(drawChosenMap())}
          data-autofocus
        >
          <UiIcon name="hand" size={22} />
          Distribuer les cartes
        </button>
      </FlowFooter>
    </section>
  );
}
