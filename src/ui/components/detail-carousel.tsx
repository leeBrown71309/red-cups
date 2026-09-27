import { useState } from "react";

interface DetailCarouselProps {
  /** Every condition of an item or a passive, one per slide. */
  details: string[];
  /** Names the effect for screen readers, e.g. "Botte". */
  label: string;
}

/**
 * One rule at a time with arrows on both sides, so long item and passive
 * descriptions fit in a card without a wall of text. The dots tell how many
 * rules there are and which one is shown.
 */
export function DetailCarousel({ details, label }: DetailCarouselProps) {
  const [index, setIndex] = useState(0);
  if (details.length === 0) return null;
  // A parent may swap the details (another item selected): never point past the end.
  const current = Math.min(index, details.length - 1);
  const single = details.length === 1;
  const go = (offset: number) => setIndex((current + offset + details.length) % details.length);

  return (
    <div className="detail-carousel" role="group" aria-roledescription="carrousel" aria-label={`Effets : ${label}`}>
      <button
        type="button"
        className="detail-carousel__arrow"
        onClick={() => go(-1)}
        disabled={single}
        aria-label="Effet précédent"
      >
        ‹
      </button>
      <div className="detail-carousel__slide" aria-live="polite">
        <p key={current}>{details[current]}</p>
        {!single && (
          <span className="detail-carousel__dots" aria-label={`${current + 1} sur ${details.length}`}>
            {details.map((detail, dotIndex) => (
              <span key={detail} className={dotIndex === current ? "is-active" : ""} />
            ))}
          </span>
        )}
      </div>
      <button
        type="button"
        className="detail-carousel__arrow"
        onClick={() => go(1)}
        disabled={single}
        aria-label="Effet suivant"
      >
        ›
      </button>
    </div>
  );
}
