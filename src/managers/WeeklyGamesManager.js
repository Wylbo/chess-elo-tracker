import { AppConfig } from '../config/AppConfig.js';
import { Events } from '../core/EventBus.js';

/**
 * WeeklyGamesManager - Manages weekly best/worst games analysis
 * Single Responsibility: Weekly games data and analysis coordination
 */
export class WeeklyGamesManager {
    constructor(eventBus, apiService, stockfishService) {
        this.eventBus = eventBus;
        this.apiService = apiService;
        this.stockfishService = stockfishService;

        this.gamesStore = new Map(); // username -> { games, timeClass, lastFetched }
        this.analysisQueue = [];
        this.isAnalyzing = false;
        this.totalToAnalyze = 0;
        this.analyzed = 0;
        this.currentGame = null; // Currently analyzing game
    }

    /**
     * Fetch weekly games for a player
     * @param {string} username
     * @param {string} timeClass
     * @returns {Promise<Array>}
     */
    async fetchGamesForPlayer(username, timeClass) {
        const cached = this.gamesStore.get(username);

        // Return cached if valid
        if (cached &&
            cached.timeClass === timeClass &&
            Date.now() - cached.lastFetched < AppConfig.GAMES_CACHE_TTL) {
            return cached.games;
        }

        const games = await this.apiService.fetchRecentGames(username, timeClass, 7);

        this.gamesStore.set(username, {
            games,
            timeClass,
            lastFetched: Date.now()
        });

        return games;
    }

    /**
     * Get cached games for a player
     * @param {string} username
     * @returns {Array}
     */
    getCachedGames(username) {
        const cached = this.gamesStore.get(username);
        return cached?.games || [];
    }

    /**
     * Find best and worst games by accuracy
     * @param {Array} games
     * @returns {Object}
     */
    findBestWorstGames(games) {
        const gamesWithAccuracy = games.filter(g => g.accuracy != null);

        if (gamesWithAccuracy.length === 0) {
            return { best: null, worst: null };
        }

        let best = gamesWithAccuracy[0];
        let worst = gamesWithAccuracy[0];

        for (const game of gamesWithAccuracy) {
            if (game.accuracy > best.accuracy) best = game;
            if (game.accuracy < worst.accuracy) worst = game;
        }

        // Don't return same game for both if only one
        if (gamesWithAccuracy.length === 1) {
            return { best, worst: null };
        }

        return { best, worst };
    }

    /**
     * Queue a game for Stockfish analysis
     * @param {Object} game
     * @param {string} username
     */
    queueForAnalysis(game, username) {
        if (this.analysisQueue.some(q => q.game.url === game.url)) return;
        this.analysisQueue.push({ game, username });
    }

    /**
     * Start processing analysis queue
     */
    async processAnalysisQueue() {
        if (this.isAnalyzing || this.analysisQueue.length === 0) return;

        if (!this.stockfishService.isReady()) {
            setTimeout(() => this.processAnalysisQueue(), 1000);
            return;
        }

        this.isAnalyzing = true;

        while (this.analysisQueue.length > 0) {
            const { game, username } = this.analysisQueue.shift();

            // Skip if already has accuracy (from Chess.com)
            if (game.accuracy != null || game.analysisStatus === 'complete') {
                this.analyzed++;
                this.currentGame = null;
                this.emitProgress();
                continue;
            }

            // Track current game being analyzed
            this.currentGame = { game, username };
            game.analysisStatus = 'analyzing';
            this.emitProgress();
            this.eventBus.emit(Events.WEEKLY_GAMES_UPDATED);

            try {
                const result = await this.stockfishService.analyzeGame(
                    game.pgn,
                    game.userColor
                );

                if (result != null) {
                    game.accuracy = result.accuracy;
                    game.moveResults = result.moveResults;
                    game.avgWinPercentLoss = result.avgWinPercentLoss;
                    game.accuracySource = 'stockfish';
                    game.analysisStatus = 'complete';
                } else {
                    game.analysisStatus = 'failed';
                }
            } catch (error) {
                console.warn('Analysis failed for game:', game.url, error);
                game.analysisStatus = 'failed';
            }

            this.analyzed++;
            this.currentGame = null;
            this.emitProgress();
            this.eventBus.emit(Events.WEEKLY_GAMES_UPDATED);
        }

        this.isAnalyzing = false;
        this.eventBus.emit(Events.ANALYSIS_COMPLETE);
    }

    /**
     * Emit analysis progress event
     * @private
     */
    emitProgress() {
        this.eventBus.emit(Events.ANALYSIS_PROGRESS, {
            total: this.totalToAnalyze,
            completed: this.analyzed,
            remaining: Math.max(0, this.totalToAnalyze - this.analyzed),
            currentGame: this.currentGame
        });
    }

    /**
     * Update weekly games for all players
     * @param {Array} players
     * @param {string} timeClass
     */
    async updateForPlayers(players, timeClass) {
        if (!players.length) return;

        this.analyzed = 0;
        this.totalToAnalyze = 0;

        // Fetch games for all players
        for (const player of players) {
            await this.fetchGamesForPlayer(player.username, timeClass);
        }

        // Queue games needing analysis
        for (const player of players) {
            const games = this.getCachedGames(player.username);
            for (const game of games) {
                if (game.accuracy == null &&
                    game.analysisStatus !== 'analyzing' &&
                    game.analysisStatus !== 'failed') {
                    this.queueForAnalysis(game, player.username);
                    this.totalToAnalyze++;
                }
            }
        }

        this.eventBus.emit(Events.WEEKLY_GAMES_UPDATED);

        // Start analysis
        this.processAnalysisQueue();
    }

    /**
     * Clear cache for a player
     * @param {string} username
     */
    clearPlayerCache(username) {
        this.gamesStore.delete(username);
    }

    /**
     * Clear all cached games
     */
    clearCache() {
        this.gamesStore.clear();
    }

    /**
     * Get analysis status
     * @returns {Object}
     */
    getAnalysisStatus() {
        return {
            isAnalyzing: this.isAnalyzing,
            queueLength: this.analysisQueue.length,
            total: this.totalToAnalyze,
            completed: this.analyzed,
            currentGame: this.currentGame
        };
    }
}
