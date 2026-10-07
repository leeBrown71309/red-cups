import type { ContentSection } from "../types";

/**
 * Les trois roues, leurs secteurs (poids réels du moteur), leurs variantes,
 * et ce que les cartes changent à leur tirage. Sources : `catalog.ts`
 * (WHEEL_RESULTS, valeurs), `game-actions.ts` (résolutions), `passive-rules.ts`.
 */
export const WHEEL_SECTIONS: Record<string, ContentSection[]> = {
  fortune: [
    {
      title: "Quand elle tourne",
      body: [
        "• S'arrêter sur une case verte en FINISSANT un déplacement ou une pose de roue.",
        "• « Tourne la roue du bonheur » sur la roue du malheur (enchaînement immédiat).",
        "• Le Tour de Bénédiction : chaque joueur en faillite la tourne à la fin du tour.",
        "• Jamais en Enfer (c'est sa roue à elle).",
      ],
    },
    {
      title: "À savoir",
      body: [
        "• « Objet gratuit à 400 pièces ou moins » : tiré parmi la liste fixe du [[hub:shop|panier gratuit]] (Ndoye, Corde, Botte, Boue, Tomate, Gomme, Middle Finger, Casque). Une Tomate offerte arrive en pile de 5 ; sac plein, ce sont 200 pièces qui remplacent l'objet. L'[[card:guardian-angel|Ange]] ne reçoit jamais d'objet nuisible : à la place il garde l'objet si son sac le permet, sinon rien ne l'atteint.",
        "• « Avance d'une case » : le joueur CHOISIT la case (règle de marche normale) ; l'arrivée compte comme une fin de marche (roue, Boue, Cup, bonus du Départ). À [[map:banquise|Banquise]], marcher sur la glace déclenche la glissade.",
        "• « Va au Départ et gagne 200 » : pose au Départ, bonus payé, arrivée normale (Boue, Portails, Cup…).",
        "• [[card:green-hand|Main verte]] : deux secteurs tirés, le meilleur gardé.",
        "• [[card:angelic-touch|Touché angélique]] : deux roues qui s'appliquent TOUS les deux.",
        "• Annulable par la [[item:eraser|Gomme]] ou [[card:no-thanks|Non merci]] après le résultat.",
      ],
    },
  ],
  misfortune: [
    {
      title: "Quand elle tourne",
      body: [
        "• S'arrêter sur une case rouge.",
        "• [[item:ndoye|Ndoye]] : elle tourne POUR la cible.",
        "• « Tourne la roue du malheur » depuis le bonheur.",
        "• [[item:doomsday|Doomsday]] : pendant un tour de table, TOUTES les cases la font tourner, Départ et boutiques compris (l'Enfer garde sa roue).",
      ],
    },
    {
      title: "À savoir",
      body: [
        "• « Retourne d'où tu viens » : la case occupée avant la DERNIÈRE action (pas d'aller-retour en Enfer, et « nulle part où retourner » si on vient d'y être posé).",
        "• « Perds un objet au hasard » : un emplacement part (une pile de Tomates entière !), sac vide : −200 pièces à la place.",
        "• [[card:red-hand|Main rouge]] : deux secteurs tirés, le moins mauvais gardé.",
        "• [[card:devils-hand|Main du diable]] : les DEUX résultats s'appliquent.",
        "• Version Ange-Gardien : deux secteurs seulement (« Passe ton prochain tour » / « Rien du tout »), 50/50.",
        "• La cible d'un Ndoye peut la gommer/annuler elle-même.",
      ],
    },
  ],
  hell: [
    {
      title: "Quand elle tourne",
      body: ["• En Enfer, à la place de la marche : elle prend toute l'énergie restante et finit le tour."],
    },
    {
      title: "À savoir",
      body: [
        "• « Libération » (deux fois plus probable) : sortie immédiate en case 0 avec le bonus du Départ, sans péage.",
        "• « Choisis un joueur à affronter » : le DÉFI tire une victime en Enfer avec vous et lance un duel. Ni l'[[card:guardian-angel|Ange]] (jamais en Enfer), ni [[card:blind-luck|Chance aveugle]] (rien ne peut le toucher) ne peuvent être tirés — sans cible possible, le duel tombe.",
        "• « Perds un objet (sinon −100) » : sac vide = 100 pièces, pas 200.",
        "• « Tu sautes ton prochain tour » : classique, Réveil peut annuler.",
        "• Pas de « Direction l'Enfer » ici, évidemment : on y est déjà.",
        "• [[card:devils-hand|Main du diable]] : deux résultats qui s'appliquent.",
        "• Annulable Gomme / Non merci.",
      ],
    },
  ],
};
