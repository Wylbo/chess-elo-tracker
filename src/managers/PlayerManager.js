import { AppConfig } from '../config/AppConfig.js';
import { Events } from '../core/EventBus.js';

/**
 * PlayerManager - Manages player data and state
 * Single Responsibility: Player data lifecycle management
 */
export class PlayerManager {
    constructor(eventBus, apiService) {
        this.eventBus = eventBus;
        this.apiService = apiService;
        this.players = new Map();
        this.pendingPlayers = new Set();
        this.colorIndex = 0;
        this.domain = { min: null, max: null };
    }

    /**
     * Add a player to track
     * @param {string} rawName - Username to add
     * @param {Object} options - Configuration options
     * @returns {Promise<Object|null>} Added player or null
     */
    async addPlayer(rawName, options = {}) {
        const username = rawName.trim().toLowerCase();
        if (!username) return null;

        const existing = this.players.get(username);
        if (existing && !options.forceRefresh) {
            existing.visible = options.visible ?? true;
            existing.disabled = options.disabled ?? existing.disabled ?? false;
            this.eventBus.emit(Events.PLAYER_UPDATED, existing);
            return existing;
        }

        const displayName = rawName.trim();
        const color = this.pickColor(options.preferredColor || existing?.color);
        const visible = options.visible !== undefined ? options.visible : true;

        this.queuePendingPlayer(username);

        try {
            const timeClass = options.timeClass || 'blitz';
            const points = await this.apiService.fetchRatings(username, timeClass);

            const player = {
                username,
                displayName,
                color,
                data: points,
                visible: points.length > 0 ? visible : false,
                disabled: points.length === 0
            };

            this.players.set(username, player);
            this.resolvePendingPlayer(username);

            if (points.length > 0) {
                this.updateDomainWith(points);
            }

            this.eventBus.emit(Events.PLAYER_ADDED, { player, silent: options.silent });
            return player;
        } catch (error) {
            console.error('Failed to add player:', error);
            this.resolvePendingPlayer(username);
            throw error;
        }
    }

    /**
     * Remove a player
     * @param {string} username - Username to remove
     */
    removePlayer(username) {
        const player = this.players.get(username);
        if (player) {
            this.players.delete(username);
            this.computeDomain();
            this.eventBus.emit(Events.PLAYER_REMOVED, player);
        }
    }

    /**
     * Get a player by username
     * @param {string} username
     * @returns {Object|undefined}
     */
    getPlayer(username) {
        return this.players.get(username.toLowerCase());
    }

    /**
     * Get all players
     * @returns {Map}
     */
    getAllPlayers() {
        return this.players;
    }

    /**
     * Get visible players
     * @returns {Array}
     */
    getVisiblePlayers() {
        return Array.from(this.players.values())
            .filter(p => p.visible && !p.disabled);
    }

    /**
     * Update player visibility
     * @param {string} username
     * @param {boolean} visible
     */
    setPlayerVisibility(username, visible) {
        const player = this.players.get(username);
        if (player) {
            player.visible = visible;
            this.eventBus.emit(Events.PLAYER_VISIBILITY_CHANGED, player);
        }
    }

    /**
     * Update player color
     * @param {string} username
     * @param {string} color
     */
    setPlayerColor(username, color) {
        const player = this.players.get(username);
        if (player) {
            player.color = color;
            this.eventBus.emit(Events.PLAYER_COLOR_CHANGED, player);
        }
    }

    /**
     * Pick a color for a player
     * @private
     */
    pickColor(preferred) {
        if (preferred) return preferred;
        const color = AppConfig.PALETTE[this.colorIndex % AppConfig.PALETTE.length];
        this.colorIndex++;
        return color;
    }

    /**
     * Update data domain with new points
     * @param {Array} points - Rating data points
     */
    updateDomainWith(points) {
        if (!points?.length) return;

        const first = points[0].date;
        const last = points[points.length - 1].date;

        if (!this.domain.min || first < this.domain.min) {
            this.domain.min = first;
        }
        if (!this.domain.max || last > this.domain.max) {
            this.domain.max = last;
        }

        this.eventBus.emit(Events.DOMAIN_UPDATED, this.domain);
    }

    /**
     * Recompute domain from all players
     */
    computeDomain() {
        let min = null;
        let max = null;

        this.players.forEach(player => {
            if (!player.data?.length) return;
            const first = player.data[0].date;
            const last = player.data[player.data.length - 1].date;
            if (!min || first < min) min = first;
            if (!max || last > max) max = last;
        });

        this.domain = { min, max };
        this.eventBus.emit(Events.DOMAIN_UPDATED, this.domain);
    }

    /**
     * Get current domain
     * @returns {Object}
     */
    getDomain() {
        return this.domain;
    }

    /**
     * Summarize a player's recent performance
     * @param {Object} player
     * @returns {Object}
     */
    summarizePlayer(player) {
        const data = player?.data || [];
        if (!data.length) {
            return { rating: null, delta: null, direction: 'flat' };
        }

        const latest = data[data.length - 1].rating;
        const prev = data.length > 1 ? data[data.length - 2].rating : null;
        const delta = prev !== null ? latest - prev : null;

        let direction = 'flat';
        if (delta > 0) direction = 'up';
        else if (delta < 0) direction = 'down';

        return { rating: latest, delta, direction };
    }

    /**
     * Queue a player as pending
     * @private
     */
    queuePendingPlayer(username) {
        if (!username || this.pendingPlayers.has(username)) return;
        this.pendingPlayers.add(username);
    }

    /**
     * Resolve a pending player
     * @private
     */
    resolvePendingPlayer(username) {
        if (username) {
            this.pendingPlayers.delete(username);
        }
    }

    /**
     * Reset pending players
     * @param {Array} usernames
     */
    resetPendingPlayers(usernames = []) {
        this.pendingPlayers.clear();
        usernames.forEach(username => {
            if (username) this.pendingPlayers.add(username.toLowerCase());
        });
    }

    /**
     * Get pending players
     * @returns {Set}
     */
    getPendingPlayers() {
        return this.pendingPlayers;
    }

    /**
     * Get player count including pending
     * @returns {number}
     */
    getPlayerCount() {
        return this.players.size + this.pendingPlayers.size;
    }

    /**
     * Clear all players
     */
    clear() {
        this.players.clear();
        this.pendingPlayers.clear();
        this.domain = { min: null, max: null };
    }

    /**
     * Get snapshot for persistence
     * @returns {Array}
     */
    getSnapshot() {
        return Array.from(this.players.values()).map(p => ({
            username: p.username,
            displayName: p.displayName,
            visible: p.visible,
            color: p.color
        }));
    }

    /**
     * Check if there are any players
     * @returns {boolean}
     */
    hasPlayers() {
        return this.players.size > 0;
    }
}
