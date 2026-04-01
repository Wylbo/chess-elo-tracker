import { Events } from '../core/EventBus.js';

/**
 * GameModalController - Manages game replay modal
 * Single Responsibility: Game modal UI and chess board interactions
 */
export class GameModalController {
    constructor(eventBus, elements) {
        this.eventBus = eventBus;
        this.overlay = elements.overlay;
        this.closeBtn = elements.closeBtn;
        this.playersEl = elements.players;
        this.resultEl = elements.result;
        this.accuracyEl = elements.accuracy;
        this.boardEl = elements.board;
        this.moveCounterEl = elements.moveCounter;
        this.moveListEl = elements.moveList;
        this.viewLinkEl = elements.viewLink;

        this.chessBoard = null;
        this.chessGame = null;
        this.gameMoves = [];
        this.gameHistory = [];
        this.currentMoveIndex = 0;
        this.playbackInterval = null;
        this.currentGameData = null;
        this.getPlayerDisplayName = null;
    }

    /**
     * Initialize the modal
     * @param {Function} getPlayerDisplayName - Function to get player display name
     */
    initialize(getPlayerDisplayName) {
        this.getPlayerDisplayName = getPlayerDisplayName;
        this.bindEvents();
        return this;
    }

    /**
     * Bind event listeners
     * @private
     */
    bindEvents() {
        this.closeBtn?.addEventListener('click', () => this.close());

        this.overlay?.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        // Playback controls
        document.getElementById('btn-start')?.addEventListener('click', () => this.goToMove(0));
        document.getElementById('btn-prev')?.addEventListener('click', () => this.goToMove(this.currentMoveIndex - 1));
        document.getElementById('btn-play')?.addEventListener('click', () => this.togglePlayback());
        document.getElementById('btn-next')?.addEventListener('click', () => this.goToMove(this.currentMoveIndex + 1));
        document.getElementById('btn-end')?.addEventListener('click', () => this.goToMove(this.gameMoves.length));

        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    /**
     * Handle keyboard navigation
     * @private
     */
    handleKeydown(e) {
        if (this.overlay?.classList.contains('hidden')) return;

        switch (e.key) {
            case 'Escape':
                this.close();
                break;
            case 'ArrowLeft':
                this.goToMove(this.currentMoveIndex - 1);
                break;
            case 'ArrowRight':
                this.goToMove(this.currentMoveIndex + 1);
                break;
            case 'Home':
                this.goToMove(0);
                break;
            case 'End':
                this.goToMove(this.gameMoves.length);
                break;
            case ' ':
                e.preventDefault();
                this.togglePlayback();
                break;
        }
    }

    /**
     * Open the modal with a game
     * @param {Object} game - Game data
     */
    open(game) {
        if (!this.overlay || !game.pgn) return;

        this.currentGameData = game;
        this.overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Set game info
        const playerName = this.getPlayerDisplayName?.(game.username) || game.username;
        if (this.playersEl) {
            this.playersEl.textContent = game.userColor === 'white'
                ? `${playerName} vs ${game.opponentUsername}`
                : `${game.opponentUsername} vs ${playerName}`;
        }

        if (this.resultEl) {
            this.resultEl.textContent = game.result.charAt(0).toUpperCase() + game.result.slice(1);
            this.resultEl.className = `game-result ${game.result}`;
        }

        if (this.accuracyEl) {
            if (game.accuracy != null) {
                const sourceLabel = game.accuracySource === 'stockfish' ? ' (Stockfish)' : '';
                this.accuracyEl.textContent = `Accuracy: ${game.accuracy.toFixed(1)}%${sourceLabel}`;
            } else {
                this.accuracyEl.textContent = 'Accuracy: N/A';
            }
        }

        if (this.viewLinkEl) {
            this.viewLinkEl.href = game.url;
        }

        this.loadPgn(game.pgn, game.userColor);
        this.eventBus.emit(Events.GAME_MODAL_OPENED, game);
    }

    /**
     * Close the modal
     */
    close() {
        if (!this.overlay) return;

        this.stopPlayback();
        this.overlay.classList.add('hidden');
        document.body.style.overflow = '';
        this.currentGameData = null;

        if (this.chessBoard) {
            this.chessBoard.destroy();
            this.chessBoard = null;
        }

        this.eventBus.emit(Events.GAME_MODAL_CLOSED);
    }

    /**
     * Load PGN into the board
     * @private
     */
    loadPgn(pgn, userColor) {
        this.chessGame = new Chess();
        this.gameMoves = [];
        this.gameHistory = [];
        this.currentMoveIndex = 0;

        // Parse PGN
        const pgnLines = pgn.split('\n');
        let moveText = '';
        for (const line of pgnLines) {
            if (!line.startsWith('[')) {
                moveText += ' ' + line;
            }
        }

        // Extract moves
        const moveRegex = /(\d+\.+\s*)?([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O-O|O-O)([+#])?/g;
        let match;
        while ((match = moveRegex.exec(moveText)) !== null) {
            this.gameMoves.push(match[2]);
        }

        // Build history
        const tempChess = new Chess();
        this.gameHistory.push(tempChess.fen());
        for (const move of this.gameMoves) {
            try {
                tempChess.move(move);
                this.gameHistory.push(tempChess.fen());
            } catch {
                break;
            }
        }

        // Initialize board
        if (this.chessBoard) {
            this.chessBoard.destroy();
        }

        this.chessBoard = Chessboard(this.boardEl, {
            position: 'start',
            orientation: userColor,
            pieceTheme: (piece) => {
                return `https://images.chesscomfiles.com/chess-themes/pieces/neo/150/${piece.toLowerCase()}.png`;
            }
        });

        this.renderMoveList();
        this.updateMoveCounter();
    }

    /**
     * Render the move list
     * @private
     */
    renderMoveList() {
        if (!this.moveListEl) return;

        this.moveListEl.innerHTML = '';

        for (let i = 0; i < this.gameMoves.length; i++) {
            if (i % 2 === 0) {
                const moveNum = document.createElement('span');
                moveNum.textContent = `${Math.floor(i / 2 + 1)}. `;
                this.moveListEl.appendChild(moveNum);
            }

            const moveSpan = document.createElement('span');
            moveSpan.className = 'move';
            moveSpan.textContent = this.gameMoves[i];
            moveSpan.dataset.index = i + 1;
            moveSpan.addEventListener('click', () => this.goToMove(i + 1));
            this.moveListEl.appendChild(moveSpan);
            this.moveListEl.appendChild(document.createTextNode(' '));
        }
    }

    /**
     * Go to a specific move
     * @param {number} index
     */
    goToMove(index) {
        if (!this.chessBoard || !this.gameHistory.length) return;

        index = Math.max(0, Math.min(index, this.gameHistory.length - 1));
        this.currentMoveIndex = index;

        this.chessBoard.position(this.gameHistory[index], false);
        this.updateMoveCounter();
        this.highlightCurrentMove();
    }

    /**
     * Update move counter display
     * @private
     */
    updateMoveCounter() {
        if (this.moveCounterEl) {
            this.moveCounterEl.textContent = `Move ${this.currentMoveIndex} / ${this.gameMoves.length}`;
        }
    }

    /**
     * Highlight current move in list
     * @private
     */
    highlightCurrentMove() {
        if (!this.moveListEl) return;

        this.moveListEl.querySelectorAll('.move').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.index) === this.currentMoveIndex);
        });

        const activeMove = this.moveListEl.querySelector('.move.active');
        if (activeMove) {
            activeMove.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    /**
     * Toggle playback
     */
    togglePlayback() {
        if (this.playbackInterval) {
            this.stopPlayback();
        } else {
            this.startPlayback();
        }
    }

    /**
     * Start playback
     * @private
     */
    startPlayback() {
        if (this.currentMoveIndex >= this.gameMoves.length) {
            this.goToMove(0);
        }

        const playBtn = document.getElementById('btn-play');
        if (playBtn) playBtn.innerHTML = '&#10074;&#10074;';

        this.playbackInterval = setInterval(() => {
            if (this.currentMoveIndex >= this.gameMoves.length) {
                this.stopPlayback();
                return;
            }
            this.goToMove(this.currentMoveIndex + 1);
        }, 1000);
    }

    /**
     * Stop playback
     * @private
     */
    stopPlayback() {
        if (this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = null;
        }

        const playBtn = document.getElementById('btn-play');
        if (playBtn) playBtn.innerHTML = '&#9658;';
    }

    /**
     * Check if modal is open
     * @returns {boolean}
     */
    isOpen() {
        return this.overlay && !this.overlay.classList.contains('hidden');
    }
}
