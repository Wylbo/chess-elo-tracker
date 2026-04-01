# Opening Repertoire Stats — Design Spec

**Date:** 2026-04-02  
**Status:** Approved

---

## 1. Overview

Add an **Opening Repertoire Stats** feature to the Chess ELO Tracker. The feature fetches a player's recent games, extracts ECO codes and opening names from PGN headers, aggregates per-opening statistics, and displays them in two sortable tables (White and Black) plus a stacked horizontal bar chart — all within a new **Openings** tab that replaces the current single-panel Weekly Games section with a tab switcher.

---

## 2. Architecture

### New files

| File | Role |
|---|---|
| `src/services/OpeningsService.js` | Chess.com API fetching, PGN header parsing, localStorage caching |
| `src/managers/OpeningsManager.js` | Aggregation, performance rating computation, event wiring |
| `src/controllers/OpeningsController.js` | Player dropdown, White/Black sub-tables, bar chart, error display |
| `src/controllers/TabController.js` | Thin tab show/hide manager (data-tab attribute pattern) |

### Existing file changes (minimal)

| File | Change |
|---|---|
| `src/core/EventBus.js` | Add 3 event constants: `OPENINGS_FETCH_REQUESTED`, `OPENINGS_STATS_READY`, `OPENINGS_ERROR` |
| `src/config/AppConfig.js` | Add `OPENINGS_MAX_MONTHS: 24`, `OPENINGS_CACHE_PREFIX: 'openings:'` |
| `src/App.js` | Instantiate `OpeningsManager`, `OpeningsController`, `TabController`; wire `PLAYER_REMOVED` to clear opening cache |
| `index.html` | Add tab bar + Openings section HTML; wrap Weekly section in a tab panel div |
| `styles.css` | Add tab bar + openings table/chart styles |

### Layer rules (unchanged from existing app)

- Controllers never import Services directly.
- All cross-module communication goes through `EventBus`.
- `App.js` is the only place that wires components together.

---

## 3. Data Flow

```
User picks player or time window changes
  → OpeningsController emits OPENINGS_FETCH_REQUESTED
      { username, timeWindowDays }

  → OpeningsManager.handleFetchRequested()
      → calls OpeningsService.fetchGamesForPeriod(username, timeClass, months)
          → fetchArchives(username)  — GET /player/{username}/games/archives
          → determine months to fetch based on timeWindowDays (cap at 24)
          → for each month:
              - check localStorage key `openings:{username}:{YYYY/MM}`
              - skip if cached AND not the current month
              - otherwise GET /player/{username}/games/{YYYY}/{MM}
          → fetch in parallel batches of 5 (Promise.all with concurrency cap)
          → for each game: parseOpeningFromPGN(game.pgn) → { eco, name }
          → return flat array of ParsedGame objects
      → filter to games within timeWindowDays cutoff
      → aggregate per (eco + name + color) composite key
      → compute stats per opening (see §4)
      → emit OPENINGS_STATS_READY
          { username, openings: { white: OpeningStat[], black: OpeningStat[] } }

  → OpeningsController.handleStatsReady()
      → renders White sub-table
      → renders Black sub-table
      → renders top-10-by-games stacked horizontal bar chart
      → updates player dropdown selection state
```

---

## 4. Data Model

### ParsedGame (internal to OpeningsService)

```js
{
  eco: string,           // e.g. "B90"
  name: string,          // e.g. "Sicilian Defense: Najdorf Variation"
  color: 'white'|'black', // player's color in this game
  result: 'win'|'draw'|'loss',
  opponentRating: number,
  endTime: number        // Unix ms timestamp
}
```

### OpeningStat (emitted in OPENINGS_STATS_READY payload)

```js
{
  eco: string,
  name: string,
  color: 'white'|'black',
  games: number,
  wins: number,
  draws: number,
  losses: number,
  winRate: number,        // wins / games
  drawRate: number,       // draws / games
  lossRate: number,       // losses / games
  perfRating: number      // see §5
}
```

---

## 5. Performance Rating Formula

Standard chess approximation applied across all games (not wins-only):

```
perfRating = avgOpponentRating + 400 × (wins − losses) / totalGames
```

Where `avgOpponentRating` is the mean opponent rating across all games for that opening/color combination.

---

## 6. Caching Strategy

- Cache key: `openings:{username}:{YYYY/MM}` (e.g. `openings:hikaru:2026/03`)
- Cache value: JSON array of `ParsedGame` objects for that month
- **Past months** are cached indefinitely (their data never changes)
- **Current month** is always re-fetched (games are still being played)
- Cache lives in `localStorage` — no TTL for past months, fresh every load for current month
- On `PLAYER_REMOVED`: clear all `openings:{username}:*` keys from localStorage

---

## 7. API Concurrency

Fetching is batched in groups of 5 concurrent requests to avoid rate-limiting:

```js
async function fetchInBatches(urls, batchSize = 5) {
  const results = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    results.push(...await Promise.all(batch.map(fetch)));
  }
  return results;
}
```

Maximum months fetched: `OPENINGS_MAX_MONTHS = 24`. If the "all time" window is selected, a notice is shown: *"Showing data from the last 24 months."*

---

## 8. UI — Tab Bar

`TabController` manages a tab bar that replaces the current single Weekly Games section:

```
[ Weekly Games ]  [ Openings ]
─────────────────────────────────
  (active panel content)
```

- Tabs are plain `<button>` elements with `data-tab="weekly"` / `data-tab="openings"`
- The active tab panel div has `class="tab-panel active"`, inactive has `class="tab-panel hidden"`
- `TabController` exposes `setActiveTab(name)` and listens for `click` on each tab button
- No EventBus events needed — tab switching is purely local UI state

---

## 9. UI — Filter Bar (Openings tab)

```
Player: [ dropdown ▼ ]    Time window: [ 30d | 90d | 365d | All time ]
```

- **Player dropdown**: populated from `PlayerManager.getAllPlayers()` — passed in at init time via a callback, not direct import
- **Time window**: independent buttons within the Openings panel (not shared with the ELO chart window selector)
- **Time control**: reuses the global `#time-class` select — no separate control in Openings
- Any filter change triggers a new `OPENINGS_FETCH_REQUESTED` emit

---

## 10. UI — Stats Tables

Two identical sub-tables, one for White openings and one for Black:

| Column | Default sort |
|---|---|
| Opening Name | — |
| ECO | — |
| Games | ✓ descending |
| Win % | — |
| Draw % | — |
| Loss % | — |
| Perf Rating | — |

- Click any column header to sort ascending; click again to toggle descending
- Minimum 3 games to appear as its own row (design decision: avoids noise from one-off openings); openings with fewer games are aggregated into an "Other" row at the bottom
- Win%/Draw%/Loss% displayed as percentage with one decimal place
- Perf Rating displayed as integer

---

## 11. UI — Bar Chart

- **Type**: stacked horizontal bar (Chart.js)
- **Data**: top 10 openings by total game count (white + black combined). Each bar represents one opening regardless of color side.
- **Segments**: Win (green `#98C379`) / Draw (muted `#B8B2A7`) / Loss (red `#E06C75`) — matching existing app palette
- **Labels**: `{eco} — {name truncated to 35 chars}`
- Chart instance is destroyed and recreated on each data update

---

## 12. Error Handling

| Scenario | Behavior |
|---|---|
| Username not found / 404 | Show error in Openings status element |
| Rate-limited (429) | Show "Chess.com rate limit hit, try again in a moment" |
| No games for filter | Show "No games found for this player/time window" |
| localStorage quota exceeded | Silently skip caching, log warning to console |
| Stockfish not relevant | N/A — Openings feature has no Stockfish dependency |

---

## 13. Integration Checklist

1. Add event constants to `src/core/EventBus.js`
2. Add config constants to `src/config/AppConfig.js`
3. Add DOM IDs to `DOMIds` in `src/config/AppConfig.js`
4. Create `src/services/OpeningsService.js`
5. Create `src/managers/OpeningsManager.js`
6. Create `src/controllers/TabController.js`
7. Create `src/controllers/OpeningsController.js`
8. Update `index.html`: wrap Weekly section in tab panel, add tab bar, add Openings tab panel
9. Update `styles.css`: tab bar, openings tables, bar chart container
10. Update `src/App.js`: import and wire all new components; add `PLAYER_REMOVED` cache-clear handler

---

## 14. Out of Scope

- Filtering by specific opening tree / ECO letter prefix
- Move-sequence-based opening detection (PGN header only — no move parsing)
- Comparison across multiple players simultaneously
- Export / share functionality
