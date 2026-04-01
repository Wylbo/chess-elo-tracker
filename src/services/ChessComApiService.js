import { AppConfig } from '../config/AppConfig.js';

/**
 * ChessComApiService - Handles all Chess.com API interactions
 * Single Responsibility: Only deals with fetching data from Chess.com
 */
export class ChessComApiService {
    constructor() {
        this.baseUrl = AppConfig.CHESS_COM_API_BASE;
        this.monthsToFetch = AppConfig.MONTHS_TO_FETCH;
    }

    /**
     * Fetch player archives list
     * @param {string} username - Chess.com username
     * @returns {Promise<string[]>} Array of archive URLs
     */
    async fetchArchives(username) {
        const response = await fetch(`${this.baseUrl}/${username}/games/archives`);
        if (!response.ok) {
            throw new Error(`Could not find ${username} on Chess.com.`);
        }
        const data = await response.json();
        return data.archives || [];
    }

    /**
     * Fetch games from a specific archive
     * @param {string} archiveUrl - Archive URL
     * @returns {Promise<Object[]>} Array of games
     */
    async fetchArchiveGames(archiveUrl) {
        const response = await fetch(archiveUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch archive: ${archiveUrl}`);
        }
        const data = await response.json();
        return data.games || [];
    }

    /**
     * Fetch player statistics
     * @param {string} username - Chess.com username
     * @returns {Promise<Object>} Player stats
     */
    async fetchStats(username) {
        const response = await fetch(`${this.baseUrl}/${username}/stats`);
        if (!response.ok) {
            throw new Error(`Could not fetch stats for ${username}`);
        }
        return response.json();
    }

    /**
     * Fetch ratings for a player in a specific time class
     * @param {string} username - Chess.com username
     * @param {string} timeClass - Time class (blitz, bullet, rapid, daily)
     * @returns {Promise<Array<{date: Date, rating: number}>>} Rating history
     */
    async fetchRatings(username, timeClass) {
        const archives = await this.fetchArchives(username);
        const recentArchives = archives.slice(-this.monthsToFetch);
        const dailyMap = new Map();

        // Process archives in reverse order (most recent first)
        for (const archiveUrl of recentArchives.reverse()) {
            try {
                const games = await this.fetchArchiveGames(archiveUrl);
                this.processGamesForRatings(games, username, timeClass, dailyMap);
            } catch (error) {
                console.warn('Archive fetch failed for', archiveUrl, error);
            }
        }

        // Add current rating from stats
        await this.addCurrentRating(username, timeClass, dailyMap);

        // Convert to sorted array
        return Array.from(dailyMap.values())
            .sort((a, b) => a.date - b.date);
    }

    /**
     * Process games and extract ratings
     * @private
     */
    processGamesForRatings(games, username, timeClass, dailyMap) {
        const lowerUsername = username.toLowerCase();

        games.forEach(game => {
            if (game.time_class !== timeClass) return;

            const lowerWhite = game.white?.username?.toLowerCase();
            const lowerBlack = game.black?.username?.toLowerCase();
            const isWhite = lowerWhite === lowerUsername;
            const isBlack = lowerBlack === lowerUsername;

            if (!isWhite && !isBlack) return;

            const rating = isWhite ? game.white?.rating : game.black?.rating;
            if (!rating) return;

            const timestamp = game.end_time || game.start_time;
            if (!timestamp) return;

            const date = new Date(timestamp * 1000);
            const key = date.toISOString().slice(0, 10);
            dailyMap.set(key, { date: new Date(key), rating });
        });
    }

    /**
     * Add current rating from stats endpoint
     * @private
     */
    async addCurrentRating(username, timeClass, dailyMap) {
        try {
            const stats = await this.fetchStats(username);
            const key = `chess_${timeClass}`;
            const lastRating = stats[key]?.last?.rating;

            if (lastRating) {
                const today = new Date();
                const todayKey = today.toISOString().slice(0, 10);
                dailyMap.set(todayKey, { date: new Date(todayKey), rating: lastRating });
            }
        } catch (error) {
            console.warn('Stats fetch failed for', username, error);
        }
    }

    /**
     * Fetch recent games for weekly analysis
     * @param {string} username - Chess.com username
     * @param {string} timeClass - Time class
     * @param {number} daysPast - Number of days to look back
     * @returns {Promise<Object[]>} Array of game data
     */
    async fetchRecentGames(username, timeClass, daysPast = 7) {
        const cutoffTime = Date.now() - (daysPast * 24 * 60 * 60 * 1000);
        const lowerUsername = username.toLowerCase();

        try {
            const archives = await this.fetchArchives(username);
            const recentArchives = archives.slice(-2); // Last 2 months should cover a week
            const games = [];

            for (const archiveUrl of recentArchives.reverse()) {
                try {
                    const archiveGames = await this.fetchArchiveGames(archiveUrl);

                    for (const game of archiveGames) {
                        if (game.time_class !== timeClass) continue;

                        const timestamp = (game.end_time || game.start_time) * 1000;
                        if (timestamp < cutoffTime) continue;

                        const lowerWhite = game.white?.username?.toLowerCase();
                        const lowerBlack = game.black?.username?.toLowerCase();
                        const isWhite = lowerWhite === lowerUsername;
                        const isBlack = lowerBlack === lowerUsername;

                        if (!isWhite && !isBlack) continue;

                        games.push(this.transformGameData(game, username, isWhite));
                    }
                } catch (error) {
                    console.warn('Failed to fetch archive', archiveUrl, error);
                }
            }

            return games.sort((a, b) => b.endTime - a.endTime);
        } catch (error) {
            console.error('Failed to fetch weekly games for', username, error);
            return [];
        }
    }

    /**
     * Transform raw game data to our format
     * @private
     */
    transformGameData(game, username, isWhite) {
        const userColor = isWhite ? 'white' : 'black';
        const opponent = isWhite ? game.black : game.white;
        const userSide = isWhite ? game.white : game.black;

        let result = 'draw';
        if (userSide?.result === 'win') result = 'win';
        else if (opponent?.result === 'win') result = 'loss';

        const accuracy = game.accuracies?.[userColor] || null;
        const accuracySource = accuracy != null ? 'chesscom' : null;

        return {
            url: game.url,
            pgn: game.pgn,
            endTime: (game.end_time || game.start_time) * 1000,
            timeClass: game.time_class,
            userColor,
            username: username.toLowerCase(),
            userRating: userSide?.rating,
            opponentUsername: opponent?.username,
            opponentRating: opponent?.rating,
            result,
            accuracy,
            accuracySource,
            analysisStatus: accuracy != null ? 'complete' : 'pending'
        };
    }
}
