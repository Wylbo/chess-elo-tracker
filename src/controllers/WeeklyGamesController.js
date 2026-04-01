import { Events } from '../core/EventBus.js';

/**
 * WeeklyGamesController - Manages weekly games table UI
 * Single Responsibility: Weekly games table rendering
 */
export class WeeklyGamesController {
    constructor(eventBus, elements) {
        this.eventBus = eventBus;
        this.tableBody = elements.tableBody;
        this.statusEl = elements.status;
        this.progressEl = elements.progress;
        this.progressBarEl = elements.progressBar;

        this.onGameClick = null;
        this.setupEventListeners();
    }

    /**
     * Initialize callbacks
     * @param {Object} callbacks
     */
    initialize(callbacks) {
        this.onGameClick = callbacks.onGameClick;
        return this;
    }

    /**
     * Setup event listeners
     * @private
     */
    setupEventListeners() {
        this.eventBus.on(Events.ANALYSIS_PROGRESS, (progress) => {
            this.updateProgress(progress);
        });
    }

    /**
     * Render the weekly games table
     * @param {Array} players
     * @param {Function} getGames - Function to get games for a player
     * @param {Function} findBestWorst - Function to find best/worst games
     * @param {Object} analysisStatus
     */
    render(players, getGames, findBestWorst, analysisStatus) {
        if (!this.tableBody) return;

        if (!players.length) {
            this.tableBody.innerHTML = '';
            this.setStatus('Add players to see their best and worst games from the last 7 days.', 'info');
            this.hideProgress();
            return;
        }

        let hasAnyGames = false;
        this.tableBody.innerHTML = '';

        for (const player of players) {
            const games = getGames(player.username);
            const { best, worst } = findBestWorst(games);

            if (games.length > 0) hasAnyGames = true;

            const row = this.createPlayerRow(player, games, best, worst);
            this.tableBody.appendChild(row);
        }

        this.updateStatusFromAnalysis(hasAnyGames, analysisStatus);
    }

    /**
     * Create a table row for a player
     * @private
     */
    createPlayerRow(player, games, best, worst) {
        const row = document.createElement('tr');

        // Player cell
        const playerCell = document.createElement('td');
        const playerContent = document.createElement('div');
        playerContent.className = 'player-cell';

        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.style.background = player.color;
        playerContent.appendChild(dot);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${player.displayName} (${games.length})`;
        playerContent.appendChild(nameSpan);

        playerCell.appendChild(playerContent);
        row.appendChild(playerCell);

        // Best game cell
        const bestCell = document.createElement('td');
        if (best) {
            bestCell.appendChild(this.createGameCell(best, 'best'));
        } else if (games.length === 0) {
            bestCell.innerHTML = '<span class="no-games-cell">No games this week</span>';
        } else {
            bestCell.innerHTML = '<span class="no-games-cell">No accuracy data</span>';
        }
        row.appendChild(bestCell);

        // Worst game cell
        const worstCell = document.createElement('td');
        if (worst) {
            worstCell.appendChild(this.createGameCell(worst, 'worst'));
        } else if (games.length === 0) {
            worstCell.innerHTML = '<span class="no-games-cell">No games this week</span>';
        } else if (best && games.filter(g => g.accuracy != null).length <= 1) {
            worstCell.innerHTML = '<span class="no-games-cell">Only one game with data</span>';
        } else {
            worstCell.innerHTML = '<span class="no-games-cell">No accuracy data</span>';
        }
        row.appendChild(worstCell);

        // Random game cell (test)
        const randomCell = document.createElement('td');
        const gamesWithAccuracy = games.filter(g => g.accuracy != null);
        if (gamesWithAccuracy.length > 0) {
            const randomGame = gamesWithAccuracy[Math.floor(Math.random() * gamesWithAccuracy.length)];
            randomCell.appendChild(this.createGameCell(randomGame, 'random'));
        } else {
            randomCell.innerHTML = '<span class="no-games-cell">No accuracy data</span>';
        }
        row.appendChild(randomCell);

        return row;
    }

    /**
     * Create a game cell element
     * @private
     */
    createGameCell(game, type) {
        const cell = document.createElement('div');
        cell.className = `game-cell ${type}`;
        cell.addEventListener('click', () => this.onGameClick?.(game));

        const content = document.createElement('div');
        content.className = 'game-cell-content';

        // Accuracy badge
        const badge = document.createElement('span');
        badge.className = 'game-accuracy-badge';

        if (game.accuracy != null) {
            // Show accuracy with source indicator for Stockfish-analyzed games
            const sourceIndicator = game.accuracySource === 'stockfish' ? ' (SF)' : '';
            badge.textContent = `${game.accuracy.toFixed(1)}%${sourceIndicator}`;
            if (game.accuracy >= 90) badge.classList.add('high');
            else if (game.accuracy >= 70) badge.classList.add('medium');
            else badge.classList.add('low');
            if (game.accuracySource === 'stockfish') {
                badge.title = 'Analyzed locally with Stockfish';
            } else {
                badge.title = 'Accuracy from Chess.com';
            }
        } else if (game.analysisStatus === 'analyzing') {
            badge.textContent = 'Stockfish...';
            badge.classList.add('analyzing');
            badge.title = 'Being analyzed by Stockfish';
        } else if (game.analysisStatus === 'failed') {
            badge.textContent = 'Failed';
            badge.classList.add('failed');
            badge.title = 'Analysis failed';
        } else {
            badge.textContent = 'Pending...';
            badge.classList.add('pending');
            badge.title = 'Waiting for Stockfish analysis';
        }
        content.appendChild(badge);

        // Result
        const resultSpan = document.createElement('span');
        resultSpan.className = `game-result ${game.result}`;
        resultSpan.textContent = game.result.charAt(0).toUpperCase() + game.result.slice(1);
        content.appendChild(resultSpan);

        // Opponent
        const opponent = document.createElement('span');
        opponent.className = 'game-opponent';
        opponent.textContent = `vs ${game.opponentUsername} (${game.opponentRating})`;
        content.appendChild(opponent);

        cell.appendChild(content);
        return cell;
    }

    /**
     * Set status message
     * @private
     */
    setStatus(message, tone) {
        if (this.statusEl) {
            this.statusEl.textContent = message;
            this.statusEl.setAttribute('data-tone', tone);
        }
    }

    /**
     * Update status based on analysis state
     * @private
     */
    updateStatusFromAnalysis(hasGames, status) {
        if (!hasGames) {
            this.setStatus('No games found in the last 7 days for tracked players.', 'warn');
            this.hideProgress();
        } else if (status.queueLength > 0 || status.isAnalyzing) {
            const remaining = status.total > 0
                ? Math.max(0, status.total - status.completed)
                : status.queueLength + (status.isAnalyzing ? 1 : 0);

            let statusText = `Analyzing with Stockfish... (${remaining} remaining)`;
            if (status.currentGame) {
                const { game, username } = status.currentGame;
                const opponent = game.opponentUsername || 'unknown';
                statusText = `Stockfish analyzing: ${username} vs ${opponent} (${remaining} remaining)`;
            }
            this.setStatus(statusText, 'info');
        } else {
            this.setStatus('Showing best and worst games from the last 7 days.', 'success');
            this.hideProgress();
        }
    }

    /**
     * Update progress bar and status message
     * @private
     */
    updateProgress(progress) {
        if (this.progressEl && this.progressBarEl && progress.total > 0) {
            this.progressEl.classList.remove('hidden');
            const percent = (progress.completed / progress.total) * 100;
            this.progressBarEl.style.width = `${percent}%`;

            // Update status message with current game info
            if (progress.remaining > 0) {
                let statusText = `Analyzing with Stockfish... (${progress.remaining} remaining)`;
                if (progress.currentGame) {
                    const { game, username } = progress.currentGame;
                    const opponent = game.opponentUsername || 'unknown';
                    statusText = `Stockfish analyzing: ${username} vs ${opponent} (${progress.remaining} remaining)`;
                }
                this.setStatus(statusText, 'info');
            }
        }
    }

    /**
     * Hide progress bar
     * @private
     */
    hideProgress() {
        if (this.progressEl) {
            this.progressEl.classList.add('hidden');
        }
    }
}
