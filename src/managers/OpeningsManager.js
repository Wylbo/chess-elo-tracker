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
        return this;
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
                this.eventBus.emit(Events.OPENINGS_STATS_READY, {
                    username,
                    openings: { white: [], black: [] }
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
            // Standard chess performance rating approximation:
            // perfRating = avgOpponentRating + 400 * (wins - losses) / totalGames
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
