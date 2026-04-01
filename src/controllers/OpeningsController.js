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
     * @returns {OpeningsController} this
     */
    initialize() {
        this._bindWindowBtns();
        this._bindPlayerSelect();
        this._bindSortHeaders();
        this._setupEventBusListeners();
        return this;
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
        const isEmpty = !openings.white.length && !openings.black.length;
        if (isEmpty) {
            this._setStatus('No games found for this player and time window.', 'info');
        } else {
            this._setStatus('', 'info');
        }
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
                        labels: {
                            color: '#B8B2A7',
                            font: { family: 'Space Grotesk, Segoe UI, sans-serif' }
                        }
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
