import { CARD_KINDS } from "../game/cards";
import { PASSIVE_ORDER } from "../game/catalog";
import { CardBack } from "../ui/cards/card-art";
import { PassiveCard } from "../ui/components/passive-card";
import { PassiveTalisman } from "../ui/components/passive-talisman";

/**
 * Dev only (`?preview=cards`): every card of the game, face then back, to judge the designs side by side. The
 * actifs are tarot cards and the passifs talismans, as in the game. `&only=actif|passif` filters, `&view=back` shows
 * the backs alone, small, to compare them at a glance.
 */
export function CardGallery() {
  const params = new URLSearchParams(window.location.search);
  const only = params.get("only");
  const backsOnly = params.get("view") === "back";
  const ids = PASSIVE_ORDER.filter((id) => !only || CARD_KINDS[id] === only);
  const backStyle = {
    height: 300,
    position: "relative",
    border: "3px solid #3a2530",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 4px 0 #3a2530",
  } as const;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 18, padding: 18, background: "#fdeedb", minHeight: "100vh" }}>
      {ids.map((id) => (
        <div key={id} style={{ display: "grid", gap: 8, width: 210, zoom: backsOnly ? 0.55 : 1 }}>
          {!backsOnly && (
            <div style={{ height: 330, position: "relative" }}>
              {CARD_KINDS[id] === "actif" ? <PassiveCard passiveId={id} /> : <PassiveTalisman passiveId={id} />}
            </div>
          )}
          <div style={backStyle}>
            <CardBack passiveId={id} />
          </div>
        </div>
      ))}
    </div>
  );
}
