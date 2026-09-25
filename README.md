# Red Cups

MVP navigateur du jeu de plateau Red Cups. La première version est conçue pour être pilotée par un hôte sur un seul écran puis partagée en visioconférence.

## Démarrage

Prérequis : Bun.

```sh
bun install
bun run dev
```

## Vérifications

```sh
bun run test
bun x tsc -p tsconfig.json --noEmit
bun run build
```

## Technologies

- React et TypeScript pour l’interface.
- Three.js pour le plateau interactif.
- Zustand pour l’état client de la partie.
- Vite pour le serveur de développement et le build.

Les règles, décisions confirmées, effets d’objets, passifs et roues provisoires sont consignés dans [`red-cups-game-spec.md`](./red-cups-game-spec.md).
