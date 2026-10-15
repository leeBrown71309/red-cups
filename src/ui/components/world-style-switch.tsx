import type { MapId, WorldStyle } from "../../game/types";
import { hasOpenVersion } from "../../game/maps/world-style";

const OPTIONS: { value: WorldStyle; label: string; hint: string }[] = [
  { value: "boxed", label: "En boîte", hint: "Le plateau d’origine, posé dans son cadre." },
  { value: "open", label: "Ouvert", hint: "Plus d’espace, un autre plan : les mêmes cases, les mêmes règles." },
];

/**
 * The two versions of a map that comes in both: the original board in its tray, or the open one. Same tiles and same
 * rules, so it changes the view and nothing else. Nothing for a map with a single version.
 */
export function WorldStyleSwitch({
  mapId,
  value,
  onChange,
}: {
  mapId: MapId;
  value: WorldStyle;
  onChange: (style: WorldStyle) => void;
}) {
  if (!hasOpenVersion(mapId)) return null;
  return (
    <div className="world-switch" role="radiogroup" aria-label="Version du plateau">
      <span className="world-switch__title">Version du plateau</span>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`world-switch__option${value === option.value ? " is-current" : ""}`}
          title={option.hint}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
