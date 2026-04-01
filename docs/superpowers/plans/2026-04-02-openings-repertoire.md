# Opening Repertoire Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Opening Repertoire Stats tab that fetches Chess.com game archives, parses ECO codes and opening names from PGN headers, aggregates per-opening stats (games, win/draw/loss rates, performance rating), and displays them in two sortable tables (White / Black) and a stacked horizontal bar chart — all in a new "Openings" tab that shares a tab bar with the existing Weekly Games section.

**Architecture:** Services → Managers → Controllers via EventBus. A new `OpeningsService` fetches and caches archive data; `OpeningsManager` aggregates and emits results; `OpeningsController` renders tables and chart. A new `TabController` manages show/hide of the Weekly vs Openings panels. Nothing talks to anything else directly — only through EventBus or constructor-injected callbacks.

**Tech Stack:** Vanilla ES6 modules, Chart.js (already loaded globally as `Chart`), `localStorage` for per-month caching, Chess.com public API.

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `src/controllers/TabController.js` | Tab bar button click → show/hide tab panels |
| `src/services/OpeningsService.js` | Chess.com archive fetching, PGN header parsing, localStorage caching |
| `src/managers/OpeningsManager.js` | Stats aggregation, performance rating, EventBus wiring |
| `src/controllers/OpeningsController.js` | Player dropdown, time window buttons, White/Black tables, bar chart |

### Modified files
| Path | What changes |
|---|---|
| `src/core/EventBus.js` | Add 3 event name constants |
| `src/config/AppConfig.js` | Add `OPENINGS_MAX_MONTHS`, `OPENINGS_CACHE_PREFIX`, new `DOMIds` |
| `index.html` | Wrap existing Weekly section in tab panel; add tab bar + Openings tab panel |
| `styles.css` | Tab bar + openings section styles |
| `src/App.js` | Instantiate and wire all new components |

---

## Task 1: Infrastructure — EventBus constants, AppConfig, DOMIds

**Files:**
- Modify: `src/core/EventBus.js`
- Modify: `src/config/AppConfig.js`

- [ ] **Step 1.1: Add event constants to EventBus.js**

Open `src/core/EventBus.js`. Inside the `Events` export object, append after `STATE_RESTORED`:

```js
// Openings events
OPENINGS_FETCH_REQUESTED: 'openings:fetchRequested',
OPENINGS_STATS_READY: 'openings:statsReady',
OPENINGS_ERROR: 'openings:error',
```

- [ ] **Step 1.2: Add config constants to AppConfig.js**

In `src/config/AppConfig.js`, inside the `AppConfig` export object, append after `WINDOW_LABELS`:

```js
// Openings feature
OPENINGS_MAX_MONTHS: 24,
OPENINGS_CACHE_PREFIX: 'openings:',
OPENINGS_TIME_WINDOWS: [
    { days: 30,  label: '30d' },
    { days: 90,  label: '90d' },
    { days: 365, label: '365d' },
    { days: 0,   label: 'All time' }  // 0 = all time, capped at OPENINGS_MAX_MONTHS
],
OPENINGS_DEFAULT_WINDOW: 90,
OPENINGS_MIN_GAMES: 3,
```

- [ ] **Step 1.3: Add DOM IDs to DOMIds in AppConfig.js**

In `src/config/AppConfig.js`, inside the `DOMIds` export object, append after `BTN_END`:

```js
// Tab bar
BOTTOM_PANEL: 'bottom-panel',

// Openings
OPENINGS_STATUS: 'openings-status',
OPENINGS_PLAYER_SELECT: 'openings-player',
OPENINGS_ALL_TIME_NOTE: 'openings-all-time-note',
OPENINGS_CHART: 'openings-chart',
OPENINGS_TABLE_WHITE: 'openings-table-white',
OPENINGS_TABLE_BLACK: 'openings-table-black',
OPENINGS_TBODY_WHITE: 'openings-tbody-white',
OPENINGS_TBODY_BLACK: 'openings-tbody-black',
```

- [ ] **Step 1.4: Commit**

```bash
git add src/core/EventBus.js src/config/AppConfig.js
git commit -m "feat(openings): add event constants, config, and DOM IDs"
```

---

## Task 2: TabController

**Files:**
- Create: `src/controllers/TabController.js`

- [ ] **Step 2.1: Create TabController**

Create `src/controllers/TabController.js`:

```js
/**
 * TabController - Manages a tab bar switching between named panels.
 * Purely local UI state — no EventBus involvement.
 */
export class TabController {
    /**
     * @param {NodeList|Element[]} tabButtons - Buttons with data-tab attribute
     * @param {NodeList|Element[]} tabPanels  - Divs with data-tab attribute
     */
    constructor(tabButtons, tabPanels) {
        this.tabButtons = Array.from(tabButtons);
        this.tabPanels = Array.from(tabPanels);
        this.activeTab = null;
    }

    /**
     * Bind click handlers and activate the default tab.
     * @param {string} [defaultTab] - data-tab value to activate first; defaults to first button
     */
    initialize(defaultTab = null) {
        this.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => this.setActiveTab(btn.dataset.tab));
        });
        const first = defaultTab ?? this.tabButtons[0]?.dataset.tab;
        if (first) this.setActiveTab(first);
    }

    /**
     * Activate a tab by name.
     * @param {string} name - data-tab value
     */
    setActiveTab(name) {
        this.activeTab = name;
        this.tabButtons.forEach(btn => {
            btn.classList.toggle('tab-btn-active', btn.dataset.tab === name);
        });
        this.tabPanels.forEach(panel => {
            panel.classList.toggle('hidden', panel.dataset.tab !== name);
        });
    }
}
```

- [ ] **Step 2.2: Commit**

```bash
git add src/controllers/TabController.js
git commit -m "feat(openings): add TabController"
```

---

## Task 3: HTML — Tab bar + Openings panel

**Files:**
- Modify: `index.html`

- [ ] **Step 3.1: Replace the Weekly Games section with a tabbed bottom panel**

In `index.html`, find and **replace** the entire `<!-- Weekly Best/Worst Games Section -->` block (from `<div class="weekly-games-section panel">` to its closing `</div>`) with the following:

```html
<!-- Tabbed bottom panel: Weekly Games + Openings -->
<div class="bottom-panel panel" id="bottom-panel">
    <div class="tab-bar">
        <button class="tab-btn tab-btn-active" data-tab="weekly">Weekly Games</button>
        <button class="tab-btn" data-tab="openings">Openings</button>
    </div>

    <!-- Weekly tab panel (existing content) -->
    <div class="tab-panel" data-tab="weekly">
        <div class="collapsible">
            <button class="collapsible-trigger" type="button" id="weekly-toggle" aria-expanded="true">
                <span>Best/Worst Games</span>
                <span class="chevron" aria-hidden="true">v</span>
            </button>
            <div class="collapsible-body" id="weekly-body">
                <div class="collapsible-inner">
                    <div id="weekly-status" class="status" data-tone="info">
                        Add players to see their best and worst games from the last 7 days.
                    </div>
                    <div class="analysis-progress hidden" id="analysis-progress">
                        <div class="analysis-progress-bar" id="analysis-progress-bar"></div>
                    </div>
                    <table class="weekly-table" id="weekly-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Best Game</th>
                                <th>Worst Game</th>
                                <th>Random Game</th>
                            </tr>
                        </thead>
                        <tbody id="weekly-table-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- Openings tab panel -->
    <div class="tab-panel hidden" data-tab="openings">
        <div id="openings-status" class="status" data-tone="info">
            Select a player to view opening stats.
        </div>

        <div class="openings-filters">
            <div class="field openings-player-field">
                <label for="openings-player">Player</label>
                <select id="openings-player"></select>
            </div>
            <div class="openings-window-group">
                <label>Time window</label>
                <div class="openings-window-btns">
                    <button class="openings-window-btn" data-window="30">30d</button>
                    <button class="openings-window-btn openings-window-btn-active" data-window="90">90d</button>
                    <button class="openings-window-btn" data-window="365">365d</button>
                    <button class="openings-window-btn" data-window="0">All time</button>
                </div>
            </div>
        </div>

        <div id="openings-all-time-note" class="hint hidden">
            Showing data from the last 24 months.
        </div>

        <div class="openings-chart-wrap">
            <canvas id="openings-chart"></canvas>
        </div>

        <div class="openings-tables">
            <div class="openings-sub-table">
                <h4 class="openings-color-heading">White</h4>
                <table class="openings-table" id="openings-table-white">
                    <thead>
                        <tr>
                            <th data-sort="name">Opening</th>
                            <th data-sort="eco">ECO</th>
                            <th data-sort="games" class="sort-active sort-desc">Games</th>
                            <th data-sort="winRate">Win%</th>
                            <th data-sort="drawRate">Draw%</th>
                            <th data-sort="lossRate">Loss%</th>
                            <th data-sort="perfRating">Perf</th>
                        </tr>
                    </thead>
                    <tbody id="openings-tbody-white"></tbody>
                </table>
            </div>
            <div class="openings-sub-table">
                <h4 class="openings-color-heading">Black</h4>
                <table class="openings-table" id="openings-table-black">
                    <thead>
                        <tr>
                            <th data-sort="name">Opening</th>
                            <th data-sort="eco">ECO</th>
                            <th data-sort="games" class="sort-active sort-desc">Games</th>
                            <th data-sort="winRate">Win%</th>
                            <th data-sort="drawRate">Draw%</th>
                            <th data-sort="lossRate">Loss%</th>
                            <th data-sort="perfRating">Perf</th>
                        </tr>
                    </thead>
                    <tbody id="openings-tbody-black"></tbody>
                </table>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 3.2: Verify HTML loads without errors**

Open `index.html` in a browser. The page should load normally with a "Weekly Games | Openings" tab bar visible at the bottom. Clicking "Openings" should show the empty Openings panel; clicking "Weekly Games" returns to the weekly table. No JS errors in console (TabController is not wired yet — that's Task 9).

- [ ] **Step 3.3: Commit**

```bash
git add index.html
git commit -m "feat(openings): add tab bar and openings panel HTML"
```

---

## Task 4: CSS — Tab bar and Openings styles

**Files:**
- Modify: `styles.css`

- [ ] **Step 4.1: Append styles to styles.css**

Open `styles.css` and append the following at the end of the file:

```css
/* ─── Tab bar ──────────────────────────────────────────────── */

.bottom-panel {
    margin-top: 14px;
}

.tab-bar {
    display: flex;
    gap: 4px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 10px;
}

.tab-btn {
    background: none;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    padding: 6px 14px;
    transition: color 0.15s, background 0.15s, border-color 0.15s;
}

.tab-btn:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
}

.tab-btn-active {
    background: var(--bg-elevated);
    border-color: var(--border);
    color: var(--accent);
}

/* ─── Openings filters ─────────────────────────────────────── */

.openings-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-end;
    margin-bottom: 14px;
}

.openings-player-field {
    min-width: 180px;
    max-width: 260px;
}

.openings-window-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.openings-window-btns {
    display: flex;
    gap: 4px;
}

.openings-window-btn {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    padding: 4px 10px;
    transition: color 0.15s, border-color 0.15s;
}

.openings-window-btn:hover {
    color: var(--text-primary);
    border-color: var(--text-muted);
}

.openings-window-btn-active {
    border-color: var(--accent);
    color: var(--accent);
}

/* ─── Openings chart ───────────────────────────────────────── */

.openings-chart-wrap {
    margin-bottom: 20px;
    max-height: 320px;
}

.openings-chart-wrap canvas {
    max-height: 320px;
}

/* ─── Openings tables ──────────────────────────────────────── */

.openings-tables {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

@media (max-width: 720px) {
    .openings-tables {
        grid-template-columns: 1fr;
    }
}

.openings-color-heading {
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.06em;
    margin: 0 0 8px;
    text-transform: uppercase;
}

.openings-table {
    border-collapse: collapse;
    font-size: 13px;
    width: 100%;
}

.openings-table th {
    color: var(--text-muted);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    padding: 6px 8px;
    text-align: left;
    user-select: none;
    white-space: nowrap;
}

.openings-table th:hover {
    color: var(--text-secondary);
}

.openings-table th.sort-active {
    color: var(--accent);
}

.openings-table th.sort-active::after {
    content: ' ↓';
}

.openings-table th.sort-active.sort-asc::after {
    content: ' ↑';
}

.openings-table td {
    border-top: 1px solid var(--border);
    color: var(--text-primary);
    padding: 6px 8px;
}

.openings-table tr:hover td {
    background: var(--bg-elevated);
}

.openings-table .cell-eco {
    color: var(--accent);
    font-family: monospace;
    font-size: 12px;
}

.openings-table .cell-name {
    color: var(--text-secondary);
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.openings-table .cell-other {
    color: var(--text-muted);
    font-style: italic;
}

.openings-table .cell-win {
    color: var(--success);
}

.openings-table .cell-loss {
    color: var(--error);
}

.openings-table .cell-draw {
    color: var(--text-secondary);
}
```

- [ ] **Step 4.2: Verify styles**

Reload `index.html`. The tab bar should look styled. The Openings panel should have readable filter controls and table headers when visible.

- [ ] **Step 4.3: Commit**

```bash
git add styles.css
git commit -m "feat(openings): add tab bar and openings section styles"
```

---

## Task 5: OpeningsService

**Files:**
- Create: `src/services/OpeningsService.js`

- [ ] **Step 5.1: Create OpeningsService.js**

Create `src/services/OpeningsService.js`:

```js
import { AppConfig } from '../config/AppConfig.js';

/**
 * OpeningsService - Chess.com archive fetching, PGN parsing, and localStorage caching.
 * Each past month is cached indefinitely; the current month is always re-fetched.
 */
export class OpeningsService {
    constructor() {
        this.baseUrl = AppConfig.CHESS_COM_API_BASE;
        this.cachePrefix = AppConfig.OPENINGS_CACHE_PREFIX;
        this.maxMonths = AppConfig.OPENINGS_MAX_MONTHS;
    }

    /**
     * Parse ECO code and opening name from a PGN string.
     * @param {string} pgn
     * @returns {{ eco: string, name: string }}
     */
    parseOpeningFromPGN(pgn) {
        const ecoMatch = pgn.match(/\[ECO\s+"([^"]+)"\]/);
        const nameMatch = pgn.match(/\[Opening\s+"([^"]+)"\]/);
        return {
            eco: ecoMatch?.[1] ?? 'Unknown',
            name: nameMatch?.[1] ?? 'Unknown Opening'
        };
    }

    /**
     * Fetch the list of monthly archive URLs for a player.
     * @param {string} username
     * @returns {Promise<string[]>}
     */
    async fetchArchives(username) {
        const response = await fetch(`${this.baseUrl}/${username}/games/archives`);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Player "${username}" not found on Chess.com.`);
            }
            throw new Error(`Chess.com returned ${response.status} for ${username}.`);
        }
        const data = await response.json();
        return data.archives || [];
    }

    /**
     * Fetch and parse one month of games. Caches past months to localStorage.
     * @param {string} username
     * @param {string} archiveUrl - e.g. https://api.chess.com/pub/player/hikaru/games/2026/03
     * @returns {Promise<ParsedGame[]>}
     */
    async fetchMonthGames(username, archiveUrl) {
        const match = archiveUrl.match(/\/(\d{4})\/(\d{2})$/);
        if (!match) return [];

        const year = match[1];
        const month = match[2];
        const cacheKey = `${this.cachePrefix}${username.toLowerCase()}:${year}/${month}`;
        const isCurrentMonth = this._isCurrentMonth(year, month);

        if (!isCurrentMonth) {
            const cached = this._loadCache(cacheKey);
            if (cached) return cached;
        }

        let response;
        try {
            response = await fetch(archiveUrl);
        } catch {
            return [];
        }

        if (response.status === 429) {
            throw new Error('Chess.com rate limit reached. Please wait a moment and try again.');
        }
        if (!response.ok) return [];

        const data = await response.json();
        const parsed = this._parseGames(data.games || [], username);

        if (!isCurrentMonth) {
            this._saveCache(cacheKey, parsed);
        }

        return parsed;
    }

    /**
     * Fetch all games for a player within a time window.
     * @param {string} username
     * @param {string} timeClass - 'blitz' | 'bullet' | 'rapid' | 'daily'
     * @param {number} timeWindowDays - 0 means all time (capped at OPENINGS_MAX_MONTHS)
     * @returns {Promise<ParsedGame[]>}
     */
    async fetchGamesForPeriod(username, timeClass, timeWindowDays) {
        const archives = await this.fetchArchives(username);

        const monthsNeeded = timeWindowDays === 0
            ? this.maxMonths
            : Math.min(Math.ceil(timeWindowDays / 28) + 1, this.maxMonths);

        const recentArchives = archives.slice(-monthsNeeded);
        const allGames = [];
        const BATCH_SIZE = 5;

        for (let i = 0; i < recentArchives.length; i += BATCH_SIZE) {
            const batch = recentArchives.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(url =>
                    this.fetchMonthGames(username, url).catch(() => [])
                )
            );
            results.forEach(games => allGames.push(...games));
        }

        const cutoff = timeWindowDays === 0
            ? 0
            : Date.now() - timeWindowDays * 24 * 60 * 60 * 1000;

        return allGames.filter(g => g.timeClass === timeClass && g.endTime >= cutoff);
    }

    /**
     * Remove all cached entries for a player from localStorage.
     * @param {string} username
     */
    clearUserCache(username) {
        const prefix = `${this.cachePrefix}${username.toLowerCase()}:`;
        const keysToDelete = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(prefix)) keysToDelete.push(key);
        }
        keysToDelete.forEach(key => localStorage.removeItem(key));
    }

    // ─── Private ────────────────────────────────────────────────

    /**
     * @private
     * Parse raw game objects into ParsedGame format for one player.
     * @param {Object[]} games
     * @param {string} username
     * @returns {ParsedGame[]}
     */
    _parseGames(games, username) {
        const lowerUsername = username.toLowerCase();
        const parsed = [];

        for (const game of games) {
            if (!game.pgn) continue;

            const lowerWhite = game.white?.username?.toLowerCase();
            const lowerBlack = game.black?.username?.toLowerCase();
            const isWhite = lowerWhite === lowerUsername;
            const isBlack = lowerBlack === lowerUsername;
            if (!isWhite && !isBlack) continue;

            const { eco, name } = this.parseOpeningFromPGN(game.pgn);
            const color = isWhite ? 'white' : 'black';
            const userSide = isWhite ? game.white : game.black;
            const opponent = isWhite ? game.black : game.white;

            let result = 'draw';
            if (userSide?.result === 'win') result = 'win';
            else if (opponent?.result === 'win') result = 'loss';

            parsed.push({
                eco,
                name,
                color,
                result,
                timeClass: game.time_class,
                opponentRating: opponent?.rating ?? 0,
                endTime: (game.end_time || game.start_time) * 1000
            });
        }

        return parsed;
    }

    /** @private */
    _isCurrentMonth(year, month) {
        const now = new Date();
        return parseInt(year) === now.getFullYear()
            && parseInt(month) === (now.getMonth() + 1);
    }

    /** @private */
    _loadCache(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    /** @private */
    _saveCache(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn('OpeningsService: localStorage write failed', e);
        }
    }
}
```

- [ ] **Step 5.2: Verify PGN parsing in browser console**

Open `index.html` in a browser. In the console run:

```js
const { OpeningsService } = await import('./src/services/OpeningsService.js');
const svc = new OpeningsService();

const pgn = '[Event "Live Chess"]\n[ECO "B90"]\n[Opening "Sicilian Defense: Najdorf Variation"]';
const result = svc.parseOpeningFromPGN(pgn);
console.assert(result.eco === 'B90', 'ECO wrong: ' + result.eco);
console.assert(result.name === 'Sicilian Defense: Najdorf Variation', 'Name wrong: ' + result.name);

const missing = svc.parseOpeningFromPGN('[Event "Live Chess"]');
console.assert(missing.eco === 'Unknown', 'Should fall back to Unknown');
console.assert(missing.name === 'Unknown Opening', 'Should fall back to Unknown Opening');

console.log('parseOpeningFromPGN: all assertions passed');
```

Expected output: `parseOpeningFromPGN: all assertions passed`

- [ ] **Step 5.3: Commit**

```bash
git add src/services/OpeningsService.js
git commit -m "feat(openings): add OpeningsService with PGN parsing and caching"
```

---

## Task 6: OpeningsManager

**Files:**
- Create: `src/managers/OpeningsManager.js`

- [ ] **Step 6.1: Create OpeningsManager.js**

Create `src/managers/OpeningsManager.js`:

```js
import { Events } from '../core/EventBus.js';

/**
 * OpeningsManager - Listens for fetch requests, calls OpeningsService,
 * aggregates per-opening stats, emits results.
 */
export class OpeningsManager {
    /**
     * @param {EventBus} eventBus
     * @param {OpeningsService} openingsService
     */
    constructor(eventBus, openingsService) {
        this.eventBus = eventBus;
        this.service = openingsService;
    }

    /**
     * Subscribe to OPENINGS_FETCH_REQUESTED.
     */
    initialize() {
        this.eventBus.on(Events.OPENINGS_FETCH_REQUESTED, payload =>
            this._handleFetchRequested(payload)
        );
    }

    /**
     * Clear cached data for a player (call when player is removed).
     * @param {string} username
     */
    clearUserCache(username) {
        this.service.clearUserCache(username);
    }

    // ─── Private ────────────────────────────────────────────────

    /** @private */
    async _handleFetchRequested({ username, timeWindowDays, timeClass }) {
        try {
            const games = await this.service.fetchGamesForPeriod(
                username, timeClass, timeWindowDays
            );

            if (!games.length) {
                this.eventBus.emit(Events.OPENINGS_ERROR, {
                    message: `No ${timeClass} games found for ${username} in this time window.`
                });
                return;
            }

            const openings = this._aggregate(games);
            this.eventBus.emit(Events.OPENINGS_STATS_READY, { username, openings });
        } catch (error) {
            this.eventBus.emit(Events.OPENINGS_ERROR, { message: error.message });
        }
    }

    /**
     * Aggregate flat game array into per-opening stats, split by color.
     * @private
     * @param {ParsedGame[]} games
     * @returns {{ white: OpeningStat[], black: OpeningStat[] }}
     */
    _aggregate(games) {
        const byKey = new Map();

        for (const game of games) {
            const key = `${game.color}::${game.eco}::${game.name}`;
            if (!byKey.has(key)) {
                byKey.set(key, {
                    eco: game.eco,
                    name: game.name,
                    color: game.color,
                    games: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    opponentRatings: []
                });
            }
            const entry = byKey.get(key);
            entry.games++;
            if (game.result === 'win') entry.wins++;
            else if (game.result === 'draw') entry.draws++;
            else entry.losses++;
            if (game.opponentRating) entry.opponentRatings.push(game.opponentRating);
        }

        const toStat = entry => {
            const avg = entry.opponentRatings.length
                ? Math.round(
                    entry.opponentRatings.reduce((a, b) => a + b, 0) /
                    entry.opponentRatings.length
                  )
                : 0;
            // Standard chess performance rating approximation
            const perfRating = avg
                ? Math.round(avg + 400 * (entry.wins - entry.losses) / entry.games)
                : 0;

            return {
                eco: entry.eco,
                name: entry.name,
                color: entry.color,
                games: entry.games,
                wins: entry.wins,
                draws: entry.draws,
                losses: entry.losses,
                winRate: entry.wins / entry.games,
                drawRate: entry.draws / entry.games,
                lossRate: entry.losses / entry.games,
                perfRating
            };
        };

        const allStats = Array.from(byKey.values()).map(toStat);
        return {
            white: allStats.filter(s => s.color === 'white'),
            black: allStats.filter(s => s.color === 'black')
        };
    }
}
```

- [ ] **Step 6.2: Verify aggregation logic in browser console**

Open `index.html` in a browser. In the console:

```js
const { OpeningsManager } = await import('./src/managers/OpeningsManager.js');
const { EventBus } = await import('./src/core/EventBus.js');

const bus = new EventBus();

// Stub service that returns known games
const stubService = {
    fetchGamesForPeriod: async () => ([
        { eco: 'B90', name: 'Sicilian', color: 'white', result: 'win',  timeClass: 'blitz', opponentRating: 1800, endTime: Date.now() },
        { eco: 'B90', name: 'Sicilian', color: 'white', result: 'loss', timeClass: 'blitz', opponentRating: 1900, endTime: Date.now() },
        { eco: 'B90', name: 'Sicilian', color: 'white', result: 'win',  timeClass: 'blitz', opponentRating: 2000, endTime: Date.now() }
    ])
};

const mgr = new OpeningsManager(bus, stubService);
mgr.initialize();

bus.on('openings:statsReady', ({ openings }) => {
    const s = openings.white[0];
    console.assert(s.eco === 'B90', 'eco');
    console.assert(s.games === 3, 'games: ' + s.games);
    console.assert(s.wins === 2, 'wins: ' + s.wins);
    console.assert(s.losses === 1, 'losses: ' + s.losses);
    console.assert(Math.abs(s.winRate - 2/3) < 0.001, 'winRate');
    // avgOpponent = (1800+1900+2000)/3 = 1900; perf = 1900 + 400*(2-1)/3 = 2033
    console.assert(s.perfRating === 2033, 'perfRating: ' + s.perfRating);
    console.log('OpeningsManager aggregation: all assertions passed');
});

bus.emit('openings:fetchRequested', { username: 'test', timeWindowDays: 90, timeClass: 'blitz' });
```

Expected output: `OpeningsManager aggregation: all assertions passed`

- [ ] **Step 6.3: Commit**

```bash
git add src/managers/OpeningsManager.js
git commit -m "feat(openings): add OpeningsManager with aggregation and perf rating"
```

---

## Task 7: OpeningsController — scaffolding, filters, and event wiring

**Files:**
- Create: `src/controllers/OpeningsController.js`

- [ ] **Step 7.1: Create OpeningsController.js (Part 1 — scaffold + filters)**

Create `src/controllers/OpeningsController.js`:

```js
import { Events } from '../core/EventBus.js';
import { AppConfig } from '../config/AppConfig.js';

/**
 * OpeningsController - Renders the Openings tab: player dropdown,
 * time window filter, White/Black stats tables, and bar chart.
 */
export class OpeningsController {
    /**
     * @param {EventBus} eventBus
     * @param {Object} elements - DOM element references
     * @param {Function} getPlayers  - () => Map<string, Player> of currently tracked players
     * @param {Function} getTimeClass - () => string ('blitz'|'bullet'|'rapid'|'daily')
     */
    constructor(eventBus, elements, getPlayers, getTimeClass) {
        this.eventBus = eventBus;
        this.statusEl = elements.statusEl;
        this.playerSelect = elements.playerSelect;
        this.allTimeNote = elements.allTimeNote;
        this.windowBtns = Array.from(elements.windowBtns);
        this.whiteTableBody = elements.whiteTableBody;
        this.blackTableBody = elements.blackTableBody;
        this.whiteTableHead = elements.whiteTableHead;
        this.blackTableHead = elements.blackTableHead;
        this.chartCanvas = elements.chartCanvas;

        this.getPlayers = getPlayers;
        this.getTimeClass = getTimeClass;

        this.selectedWindow = AppConfig.OPENINGS_DEFAULT_WINDOW;
        this.chart = null;
        this.currentStats = null;

        // Sort state per color: { col: string, dir: 'asc'|'desc' }
        this.sortState = {
            white: { col: 'games', dir: 'desc' },
            black: { col: 'games', dir: 'desc' }
        };
    }

    /**
     * Bind all event listeners and EventBus subscriptions.
     */
    initialize() {
        this._bindWindowBtns();
        this._bindPlayerSelect();
        this._bindSortHeaders();
        this._setupEventBusListeners();
    }

    /**
     * Refresh the player dropdown from currently tracked players.
     * Call this whenever a player is added or removed.
     */
    refreshPlayerDropdown() {
        const players = this.getPlayers();
        const current = this.playerSelect.value;

        this.playerSelect.innerHTML = '';

        if (!players || players.size === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No players tracked';
            this.playerSelect.appendChild(opt);
            this.playerSelect.disabled = true;
            return;
        }

        this.playerSelect.disabled = false;
        for (const [username, player] of players) {
            const opt = document.createElement('option');
            opt.value = username;
            opt.textContent = player.displayName || username;
            this.playerSelect.appendChild(opt);
        }

        // Restore previous selection if still valid, otherwise pick first
        if (current && players.has(current)) {
            this.playerSelect.value = current;
        }
    }

    // ─── Private: setup ─────────────────────────────────────────

    /** @private */
    _bindWindowBtns() {
        this.windowBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.windowBtns.forEach(b => b.classList.remove('openings-window-btn-active'));
                btn.classList.add('openings-window-btn-active');
                this.selectedWindow = parseInt(btn.dataset.window, 10);
                this._requestFetch();
            });
        });
    }

    /** @private */
    _bindPlayerSelect() {
        this.playerSelect.addEventListener('change', () => this._requestFetch());
    }

    /** @private */
    _bindSortHeaders() {
        const bindHead = (thead, color) => {
            if (!thead) return;
            thead.querySelectorAll('th[data-sort]').forEach(th => {
                th.addEventListener('click', () => {
                    const col = th.dataset.sort;
                    const state = this.sortState[color];
                    if (state.col === col) {
                        state.dir = state.dir === 'desc' ? 'asc' : 'desc';
                    } else {
                        state.col = col;
                        state.dir = 'desc';
                    }
                    this._updateSortIndicators(thead, color);
                    if (this.currentStats) {
                        this._renderTable(color, this.currentStats[color]);
                    }
                });
            });
        };
        bindHead(this.whiteTableHead, 'white');
        bindHead(this.blackTableHead, 'black');
    }

    /** @private */
    _setupEventBusListeners() {
        this.eventBus.on(Events.OPENINGS_STATS_READY, payload => this._handleStatsReady(payload));
        this.eventBus.on(Events.OPENINGS_ERROR, ({ message }) => this._setStatus(message, 'error'));
        this.eventBus.on(Events.PLAYER_ADDED, () => this.refreshPlayerDropdown());
        this.eventBus.on(Events.PLAYER_REMOVED, () => this.refreshPlayerDropdown());
    }

    /** @private */
    _requestFetch() {
        const username = this.playerSelect.value;
        if (!username) return;

        const timeClass = this.getTimeClass();
        this._setStatus(`Loading ${timeClass} openings for ${username}...`, 'info');

        const isAllTime = this.selectedWindow === 0;
        this.allTimeNote.classList.toggle('hidden', !isAllTime);

        this.eventBus.emit(Events.OPENINGS_FETCH_REQUESTED, {
            username,
            timeWindowDays: this.selectedWindow,
            timeClass
        });
    }

    /** @private */
    _setStatus(message, tone = 'info') {
        if (!this.statusEl) return;
        this.statusEl.textContent = message;
        this.statusEl.dataset.tone = tone;
    }

    /** @private */
    _updateSortIndicators(thead, color) {
        const { col, dir } = this.sortState[color];
        thead.querySelectorAll('th[data-sort]').forEach(th => {
            th.classList.toggle('sort-active', th.dataset.sort === col);
            th.classList.toggle('sort-asc', th.dataset.sort === col && dir === 'asc');
            th.classList.toggle('sort-desc', th.dataset.sort === col && dir === 'desc');
        });
    }

    // ─── Private: rendering ─────────────────────────────────────

    /** @private */
    _handleStatsReady({ openings }) {
        this.currentStats = openings;
        this._setStatus('', 'info');
        this._renderTable('white', openings.white);
        this._renderTable('black', openings.black);
        this._renderChart(openings);
    }

    /**
     * Render one color sub-table.
     * @private
     * @param {'white'|'black'} color
     * @param {OpeningStat[]} stats
     */
    _renderTable(color, stats) {
        const tbody = color === 'white' ? this.whiteTableBody : this.blackTableBody;
        if (!tbody) return;

        const { col, dir } = this.sortState[color];

        // Split into main rows (>= OPENINGS_MIN_GAMES) and "Other"
        const minGames = AppConfig.OPENINGS_MIN_GAMES;
        const main = stats.filter(s => s.games >= minGames);
        const otherStats = stats.filter(s => s.games < minGames);

        // Sort main rows
        main.sort((a, b) => {
            let av = a[col], bv = b[col];
            if (typeof av === 'string') av = av.toLowerCase();
            if (typeof bv === 'string') bv = bv.toLowerCase();
            if (av < bv) return dir === 'asc' ? -1 : 1;
            if (av > bv) return dir === 'asc' ? 1 : -1;
            return 0;
        });

        tbody.innerHTML = '';

        if (!main.length && !otherStats.length) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="7" class="cell-other">No games found.</td>`;
            tbody.appendChild(tr);
            return;
        }

        main.forEach(s => tbody.appendChild(this._buildRow(s)));

        // Aggregate "Other" row
        if (otherStats.length > 0) {
            const other = otherStats.reduce(
                (acc, s) => {
                    acc.games += s.games;
                    acc.wins += s.wins;
                    acc.draws += s.draws;
                    acc.losses += s.losses;
                    return acc;
                },
                { games: 0, wins: 0, draws: 0, losses: 0 }
            );
            const tr = document.createElement('tr');
            const wr = other.games ? (other.wins / other.games * 100).toFixed(1) : '—';
            const dr = other.games ? (other.draws / other.games * 100).toFixed(1) : '—';
            const lr = other.games ? (other.losses / other.games * 100).toFixed(1) : '—';
            tr.innerHTML = `
                <td class="cell-name cell-other">Other (${otherStats.length} openings)</td>
                <td class="cell-eco">—</td>
                <td>${other.games}</td>
                <td class="cell-win">${wr}%</td>
                <td class="cell-draw">${dr}%</td>
                <td class="cell-loss">${lr}%</td>
                <td>—</td>
            `;
            tbody.appendChild(tr);
        }
    }

    /** @private */
    _buildRow(s) {
        const tr = document.createElement('tr');
        const wr = (s.winRate * 100).toFixed(1);
        const dr = (s.drawRate * 100).toFixed(1);
        const lr = (s.lossRate * 100).toFixed(1);
        const nameDisplay = s.name.length > 40 ? s.name.slice(0, 40) + '…' : s.name;
        tr.innerHTML = `
            <td class="cell-name" title="${s.name}">${nameDisplay}</td>
            <td class="cell-eco">${s.eco}</td>
            <td>${s.games}</td>
            <td class="cell-win">${wr}%</td>
            <td class="cell-draw">${dr}%</td>
            <td class="cell-loss">${lr}%</td>
            <td>${s.perfRating || '—'}</td>
        `;
        return tr;
    }

    /**
     * Render the stacked horizontal bar chart (top 10 openings by total games).
     * @private
     * @param {{ white: OpeningStat[], black: OpeningStat[] }} openings
     */
    _renderChart(openings) {
        if (!this.chartCanvas) return;

        // Combine white + black, group by opening name, sum games
        const combined = new Map();
        [...openings.white, ...openings.black].forEach(s => {
            const key = `${s.eco}::${s.name}`;
            if (!combined.has(key)) {
                combined.set(key, { eco: s.eco, name: s.name, wins: 0, draws: 0, losses: 0 });
            }
            const entry = combined.get(key);
            entry.wins += s.wins;
            entry.draws += s.draws;
            entry.losses += s.losses;
        });

        const top10 = Array.from(combined.values())
            .map(e => ({ ...e, games: e.wins + e.draws + e.losses }))
            .sort((a, b) => b.games - a.games)
            .slice(0, 10);

        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }

        if (!top10.length) return;

        this.chart = new Chart(this.chartCanvas, {
            type: 'bar',
            data: {
                labels: top10.map(o => {
                    const n = o.name.length > 35 ? o.name.slice(0, 35) + '…' : o.name;
                    return `${o.eco} – ${n}`;
                }),
                datasets: [
                    {
                        label: 'Wins',
                        data: top10.map(o => o.wins),
                        backgroundColor: '#98C379'
                    },
                    {
                        label: 'Draws',
                        data: top10.map(o => o.draws),
                        backgroundColor: '#B8B2A7'
                    },
                    {
                        label: 'Losses',
                        data: top10.map(o => o.losses),
                        backgroundColor: '#E06C75'
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: {
                    legend: {
                        labels: { color: '#B8B2A7', font: { family: 'Space Grotesk, Segoe UI, sans-serif' } }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: '#B8B2A7' },
                        grid: { color: 'rgba(230,225,220,0.08)' }
                    },
                    y: {
                        stacked: true,
                        ticks: { color: '#B8B2A7', font: { size: 11 } },
                        grid: { color: 'rgba(230,225,220,0.08)' }
                    }
                }
            }
        });
    }
}
```

- [ ] **Step 7.2: Commit**

```bash
git add src/controllers/OpeningsController.js
git commit -m "feat(openings): add OpeningsController with tables, chart, and filter bar"
```

---

## Task 8: Wire everything in App.js

**Files:**
- Modify: `src/App.js`

- [ ] **Step 8.1: Add imports to App.js**

In `src/App.js`, after the last existing import (the `GameModalController` line), add:

```js
import { TabController } from './controllers/TabController.js';
import { OpeningsService } from './services/OpeningsService.js';
import { OpeningsManager } from './managers/OpeningsManager.js';
import { OpeningsController } from './controllers/OpeningsController.js';
```

- [ ] **Step 8.2: Add instance fields to the App constructor**

In `src/App.js` inside the `constructor()`, after the `this.gameModalController = null;` line, add:

```js
// Openings
this.openingsService = null;
this.openingsManager = null;
this.openingsController = null;
this.tabController = null;
```

- [ ] **Step 8.3: Instantiate openingsService in initializeServices()**

In `src/App.js` inside `initializeServices()`, after the `stockfishReady` block, add:

```js
this.openingsService = new OpeningsService();
```

- [ ] **Step 8.4: Instantiate OpeningsManager in initializeManagers()**

In `src/App.js` inside `initializeManagers()`, after the `this.weeklyGamesManager = new WeeklyGamesManager(...)` block, add:

```js
this.openingsManager = new OpeningsManager(this.eventBus, this.openingsService);
this.openingsManager.initialize();
```

- [ ] **Step 8.5: Instantiate TabController and OpeningsController in initializeControllers()**

In `src/App.js` inside `initializeControllers()`, after the `this.gameModalController.initialize(...)` block, add:

```js
// Tab controller
const tabButtons = document.querySelectorAll('.tab-bar .tab-btn');
const tabPanels = document.querySelectorAll('#bottom-panel .tab-panel');
this.tabController = new TabController(tabButtons, tabPanels);
this.tabController.initialize('weekly');

// Openings controller
this.openingsController = new OpeningsController(
    this.eventBus,
    {
        statusEl: document.getElementById(DOMIds.OPENINGS_STATUS),
        playerSelect: document.getElementById(DOMIds.OPENINGS_PLAYER_SELECT),
        allTimeNote: document.getElementById(DOMIds.OPENINGS_ALL_TIME_NOTE),
        windowBtns: document.querySelectorAll('.openings-window-btn'),
        whiteTableBody: document.getElementById(DOMIds.OPENINGS_TBODY_WHITE),
        blackTableBody: document.getElementById(DOMIds.OPENINGS_TBODY_BLACK),
        whiteTableHead: document.querySelector('#' + DOMIds.OPENINGS_TABLE_WHITE + ' thead'),
        blackTableHead: document.querySelector('#' + DOMIds.OPENINGS_TABLE_BLACK + ' thead'),
        chartCanvas: document.getElementById(DOMIds.OPENINGS_CHART)
    },
    () => this.playerManager.getAllPlayers(),
    () => this.timeClassEl?.value || 'blitz'
);
this.openingsController.initialize();
```

- [ ] **Step 8.6: Clear openings cache on player remove**

In `src/App.js` inside the `onRemovePlayer` callback (inside `initializeControllers` → `playerListController.initialize`), after `this.weeklyGamesManager.clearPlayerCache(username);`, add:

```js
this.openingsManager.clearUserCache(username);
```

- [ ] **Step 8.7: Refresh player dropdown when a player is added/removed**

In `src/App.js` inside `setupEventSubscriptions()`, after the existing subscriptions, add:

```js
this.eventBus.on(Events.PLAYER_ADDED, () => {
    this.openingsController?.refreshPlayerDropdown();
});
this.eventBus.on(Events.PLAYER_REMOVED, () => {
    this.openingsController?.refreshPlayerDropdown();
});
```

Note: `Events.PLAYER_ADDED` already exists in `EventBus.js`.

- [ ] **Step 8.8: Verify full integration in browser**

Open `index.html` in a browser.
1. Add a Chess.com player (e.g. "hikaru", time class "blitz").
2. Click the **Openings** tab in the tab bar — the Openings panel should appear.
3. The player dropdown should contain "hikaru".
4. Select "hikaru" and choose a time window (e.g. "30d"). The status should show "Loading blitz openings for hikaru…".
5. After loading: the White and Black tables should populate; the chart should show a stacked horizontal bar.
6. Click a column header in either table — rows should re-sort.
7. Check the browser console for zero errors.

- [ ] **Step 8.9: Commit**

```bash
git add src/App.js
git commit -m "feat(openings): wire OpeningsService, OpeningsManager, OpeningsController, TabController in App"
```

---

## Task 9: End-to-end edge case verification

- [ ] **Step 9.1: Verify rate-limit error display**

In the browser console, force an error by patching the service:

```js
const app = window.__eloTrackerApp;
const orig = app.openingsService.fetchArchives.bind(app.openingsService);
app.openingsService.fetchArchives = async () => { throw new Error('Chess.com rate limit reached. Please wait a moment and try again.'); };

app.eventBus.emit('openings:fetchRequested', { username: 'hikaru', timeWindowDays: 30, timeClass: 'blitz' });
// The status element in the Openings tab should show the error message in red.

app.openingsService.fetchArchives = orig; // restore
```

- [ ] **Step 9.2: Verify All time note**

Click "All time" in the Openings time window buttons. The hint "Showing data from the last 24 months." should appear below the filter bar. Switch to any other window — it should disappear.

- [ ] **Step 9.3: Verify cache**

1. Load openings for a player.
2. Open DevTools → Application → Local Storage. Confirm keys like `openings:hikaru:2026/02` are present.
3. Remove the player via the controls panel. Confirm those localStorage keys are gone.

- [ ] **Step 9.4: Verify tab switching preserves weekly table**

1. Add a player. The Weekly tab should still show the weekly games table.
2. Switch to Openings, then back to Weekly. The table should still be populated.

- [ ] **Step 9.5: Commit final verification**

```bash
git add -A
git status  # confirm nothing unexpected is staged
git commit -m "feat(openings): opening repertoire stats feature complete"
```

---

## Spec coverage checklist (self-review)

| Spec section | Covered by task |
|---|---|
| Tab bar (§8) | Task 2, 3, 8 |
| OpeningsService fetch + parse + cache (§3, §6, §7) | Task 5 |
| Concurrency batching max 5 (§7) | Task 5 |
| Max 24 months all-time cap (§7) | Task 5 |
| All-time note in UI (§7) | Tasks 3, 7 |
| OpeningsManager aggregation (§4) | Task 6 |
| Performance rating formula (§5) | Task 6 |
| Win/draw/loss rates (§4) | Task 6 |
| OPENINGS_FETCH_REQUESTED event flow (§3) | Tasks 6, 7, 8 |
| OPENINGS_STATS_READY event flow (§3) | Tasks 6, 7 |
| OPENINGS_ERROR event + display (§12) | Tasks 6, 7 |
| Player dropdown from tracked players (§9) | Task 7 |
| Time window buttons 30d/90d/365d/All time (§9) | Tasks 3, 7 |
| Global time control reused (§9) | Task 7 (getTimeClass callback) |
| White + Black sub-tables (§10) | Task 7 |
| Column sorting ascending/descending (§10) | Task 7 |
| Min 3 games per row + Other row (§10) | Task 7 |
| Bar chart top-10, stacked win/draw/loss (§11) | Task 7 |
| Cache clear on player remove (§6) | Task 8 |
| No direct cross-layer imports (§2) | All tasks |
| Rate-limit error message (§12) | Tasks 5, 9 |
| No-games-found message (§12) | Task 6 |
| localStorage quota failure silenced (§12) | Task 5 |
