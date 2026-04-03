import { Events } from '../core/EventBus.js';

/**
 * PlayerListController - Manages player list UI
 * Single Responsibility: Player list rendering and interactions
 */
export class PlayerListController {
    constructor(eventBus, listElement, playerCountElement, timeClassElement) {
        this.eventBus = eventBus;
        this.listEl = listElement;
        this.playerCountEl = playerCountElement;
        this.timeClassEl = timeClassElement;

        this.onColorPickerOpen = null;
        this.onVisibilityChange = null;
        this.onRemovePlayer = null;
    }

    /**
     * Initialize callbacks
     * @param {Object} callbacks
     */
    initialize(callbacks) {
        this.onColorPickerOpen = callbacks.onColorPickerOpen;
        this.onVisibilityChange = callbacks.onVisibilityChange;
        this.onRemovePlayer = callbacks.onRemovePlayer;
        return this;
    }

    /**
     * Render the player list
     * @param {Map} players
     * @param {Set} pendingPlayers
     * @param {Function} summarizePlayer
     */
    render(players, pendingPlayers, summarizePlayer) {
        if (!this.listEl) return;

        this.listEl.innerHTML = '';

        if (!players.size && !pendingPlayers.size) {
            this.listEl.innerHTML = `
                <div class="player-sub">No players yet. Add a Chess.com username to start tracking.</div>
            `;
            this.updateCount(0);
            return;
        }

        players.forEach(player => {
            const row = this.createPlayerRow(player, summarizePlayer);
            this.listEl.appendChild(row);
        });

        // Add placeholders for pending players
        pendingPlayers.forEach(() => {
            const row = document.createElement('div');
            row.className = 'player-row placeholder';
            row.setAttribute('aria-hidden', 'true');
            this.listEl.appendChild(row);
        });

        this.updateCount(players.size + pendingPlayers.size);
    }

    /**
     * Create a player row element
     * @private
     */
    createPlayerRow(player, summarizePlayer) {
        const row = document.createElement('div');
        row.className = 'player-row' + (player.disabled ? ' disabled' : '');

        // Color dot
        const dot = this.createColorDot(player);
        // Set CSS custom property for the left accent bar and dot glow only for enabled players
        if (!player.disabled) {
            row.style.setProperty('--player-color', player.color);
            dot.style.boxShadow = `0 0 8px ${player.color}`;
        }
        row.appendChild(dot);

        // Player meta info
        const meta = this.createPlayerMeta(player, summarizePlayer);
        row.appendChild(meta);

        // Visibility toggle
        const toggle = this.createVisibilityToggle(player);
        row.appendChild(toggle);

        // Remove button
        const removeBtn = this.createRemoveButton(player);
        row.appendChild(removeBtn);

        return row;
    }

    /**
     * Create color dot element
     * @private
     */
    createColorDot(player) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.style.background = player.color;
        dot.title = `Change ${player.displayName} color`;
        dot.setAttribute('role', 'button');
        dot.tabIndex = player.disabled ? -1 : 0;

        dot.addEventListener('click', (event) => {
            event.stopPropagation();
            if (player.disabled) return;
            this.onColorPickerOpen?.(player, dot);
        });

        dot.addEventListener('keydown', (event) => {
            if (player.disabled) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.onColorPickerOpen?.(player, dot);
            }
        });

        return dot;
    }

    /**
     * Create player meta element
     * @private
     */
    createPlayerMeta(player, summarizePlayer) {
        const meta = document.createElement('div');
        meta.className = 'player-meta';

        const name = document.createElement('div');
        name.className = 'player-name';
        name.textContent = player.displayName;

        const sub = document.createElement('div');
        sub.className = 'player-sub';

        if (player.disabled) {
            const timeClass = this.timeClassEl?.value || 'blitz';
            sub.textContent = `No ${timeClass} games (disabled)`;
        } else {
            const { rating, delta, direction } = summarizePlayer(player);

            const trendSpan = document.createElement('span');
            trendSpan.className = `player-trend trend-${direction}`;
            const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
            const deltaText = delta === null ? 'new' : delta === 0 ? '0' : (delta > 0 ? '+' : '') + delta;
            trendSpan.textContent = `${arrow} ${deltaText}`;

            const ratingSpan = document.createElement('span');
            ratingSpan.className = 'player-rating';
            ratingSpan.textContent = rating != null ? `${rating} ELO` : 'No rating yet';

            const timeClassSpan = document.createElement('span');
            timeClassSpan.className = 'player-time-class';
            const timeClass = this.timeClassEl?.value || 'blitz';
            timeClassSpan.textContent = `· ${timeClass}`;

            sub.appendChild(ratingSpan);
            sub.appendChild(trendSpan);
            sub.appendChild(timeClassSpan);
        }

        meta.appendChild(name);
        meta.appendChild(sub);

        return meta;
    }

    /**
     * Create visibility toggle element
     * @private
     */
    createVisibilityToggle(player) {
        const toggle = document.createElement('label');
        toggle.className = 'toggle';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = player.visible && !player.disabled;
        input.disabled = !!player.disabled;

        input.addEventListener('change', () => {
            this.onVisibilityChange?.(player.username, input.checked);
        });

        const slider = document.createElement('span');
        slider.className = 'slider';

        toggle.appendChild(input);
        toggle.appendChild(slider);

        return toggle;
    }

    /**
     * Create remove button element
     * @private
     */
    createRemoveButton(player) {
        const btn = document.createElement('button');
        btn.className = 'ghost-btn';
        btn.type = 'button';
        btn.textContent = 'Remove';

        btn.addEventListener('click', () => {
            this.onRemovePlayer?.(player.username);
        });

        return btn;
    }

    /**
     * Update player count display
     * @private
     */
    updateCount(count) {
        if (this.playerCountEl) {
            this.playerCountEl.textContent = count;
        }
    }
}
