import { AppConfig } from '../config/AppConfig.js';

/**
 * @typedef {Object} ParsedGame
 * @property {string} eco - ECO code (e.g. 'B90')
 * @property {string} name - Opening name (e.g. 'Sicilian Defense: Najdorf Variation')
 * @property {'white'|'black'} color - Player's color in this game
 * @property {'win'|'draw'|'loss'} result - Outcome for the tracked player
 * @property {string} timeClass - 'blitz'|'bullet'|'rapid'|'daily'
 * @property {number} opponentRating - Opponent's rating (0 if unknown)
 * @property {number} endTime - Unix timestamp in ms
 */

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
            if (response.status === 429) {
                throw new Error('Chess.com rate limit reached. Please wait a moment and try again.');
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

        // Use 28-day divisor (shortest month) to ensure we never under-fetch;
        // the cutoff filter below enforces the actual time window precisely.
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
                    this.fetchMonthGames(username, url).catch(e => {
                        if (e.message?.includes('rate limit')) throw e;
                        return [];
                    })
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
