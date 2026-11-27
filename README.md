# Kitchen Master

Kitchen Master is a browser based restaurant management game. Choose a Western or Chinese restaurant, manage ingredient deliveries, cook orders, and grow your restaurant's popularity.

The Chinese restaurant uses a compact ingredient menu and six recipes. Stove construction and cookware purchases have separate costs. Woks, boiling pots, and pressure cookers are bought from the cookware shop, then placed from the horizontal inventory shelf by clicking or dragging onto an empty stove. Pressure cookers cost $120, work as boiling pots, and halve boiling recipe cook times.

## Run locally

Prerequisite: Node.js.

```sh
npm install
npm run dev
```

Open [http://localhost:3000/KitchenMaster/](http://localhost:3000/KitchenMaster/) in your browser. Vite serves the game locally; no push or deployment is needed. The selected restaurant's leaderboard and high score are stored separately in this browser. Existing Western restaurant records continue to use their original storage keys.

Create a production build with `npm run build`.
