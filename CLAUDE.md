# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build step required. Open `index.html` directly in a browser. All dependencies load from CDN; no npm or package manager is used.

## Architecture

This is a client-side ES6 module app that tracks Chess.com player ELO ratings over time. The refactored source lives in `src/`; `app.js` at the root is the old monolithic version (not loaded by `index.html`).

### Layers

The app uses a **Services → Managers → Controllers** architecture wired together in `src/App.js` via an **EventBus** (`src/core/EventBus.js`). Components never reference each other directly — they communicate only through events.

| Layer | Location | Responsibility |
|---|---|---|
| Services | `src/services/` | Data access: Chess.com API, Stockfish Web Worker, localStorage |
| Managers | `src/managers/` | Business logic: player state, chart rendering, weekly analysis |
| Controllers | `src/controllers/` | UI interactions: form inputs, modals, range selector drag |
| Orchestrator | `src/App.js` | Bootstraps everything, subscribes event handlers |
| Config | `src/config/AppConfig.js` | Single source of truth for constants, storage keys, API base URL |

### Key Data Flow

1. **Add player** → `PlayerManager` fetches Chess.com API → emits event → `ChartManager` + `PlayerListController` re-render
2. **Change time window** → `WindowController` emits `WINDOW_CHANGED` → `ChartManager` updates chart bounds
3. **Drag range selector** → `RangeSelectorController` emits `RANGE_SELECTION_CHANGED` → custom date bounds applied
4. **Weekly games** → `WeeklyGamesManager` fetches last 7 days of games → `StockfishService` (Web Worker) analyzes each → `WeeklyGamesController` renders table
5. **Replay game** → `GameModalController` loads PGN → Chessboard.js renders board, Chess.js manages move state

### External Dependencies (all via CDN)

- **Chart.js** + **chartjs-adapter-date-fns** — ELO rating line charts
- **Chess.js** — Move validation and game state
- **Chessboard.js** + **jQuery** — Interactive board rendering
- **Stockfish.js** (`lib/stockfish/stockfish.js`) — WASM chess engine running as Web Worker

### State Persistence

`StorageService` persists players, colors, visibility, and selected time window to `localStorage`. State is restored on page load in `App.js`.

### Chess.com API

Base URL in `AppConfig.js`. Key endpoints used:
- `/player/{username}/stats` — current ratings by time control
- `/player/{username}/games/{year}/{month}` — game archives
