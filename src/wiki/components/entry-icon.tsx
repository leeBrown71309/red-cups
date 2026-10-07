import type { ReactNode } from "react";
import { WHEEL_THEMES } from "../../ui/display/game-display";
import { GhostAvatar } from "../../ui/components/ghost-avatar";
import { UiIcon } from "../../ui/icons/ui-icon";
import { ItemIcon } from "../../ui/icons/item-icon";
import { PassiveIcon } from "../../ui/icons/passive-icon";
import type { ItemId, PassiveId, WheelId } from "../../game/types";
import type { WikiEntry } from "../types";

/** The visual identity of an entry, drawn with the game's own icons. */
export function EntryIcon({ entry, size = 44 }: { entry: WikiEntry; size?: number }): ReactNode {
  const id = entry.ref.slice(entry.ref.indexOf(":") + 1);
  switch (entry.kind) {
    case "item":
      return <ItemIcon itemId={id as ItemId} size={size} />;
    case "card":
      return <PassiveIcon passiveId={id as PassiveId} size={size} />;
    case "map":
      if (id === "luna-park") return <GhostAvatar size={size} />;
      return <UiIcon name="globe" size={size * 0.7} />;
    case "wheel": {
      const theme = WHEEL_THEMES[id as WheelId];
      return (
        <span
          className="wiki-wheel-dot"
          style={{
            width: size * 0.8,
            height: size * 0.8,
            background: `conic-gradient(${theme.segments.join(",")}, ${theme.segments[0]})`,
            borderColor: theme.rim,
          }}
        />
      );
    }
    case "hub":
      return <UiIcon name={id === "shop" ? "shop" : "swords"} size={size * 0.7} />;
    default:
      return <UiIcon name="info" size={size * 0.7} />;
  }
}
