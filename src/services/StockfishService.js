import { AppConfig } from '../config/AppConfig.js';

/**
 * CAPS (Computer Aggregated Precision Score) — Chess.com accuracy approximation
 *
 * WHERE THIS WILL DIVERGE FROM CHESS.COM:
 * 1. Depth: We use depth 10–15; Chess.com uses depth 20–27+ on server clusters.
 *    Expect ±5–15% accuracy difference on tactical or complex games.
 * 2. Brilliant moves (!!): Detecting them requires multi-PV analysis to confirm the
 *    move is a sacrifice that is also objectively best. Single-PV cannot do this —
 *    brilliant detection is intentionally omitted.
 * 3. Opening book: Chess.com uses a large proprietary book and excludes those moves
 *    from accuracy scoring. Set BOOK_MOVES_TO_SKIP to approximate (e.g. 5 full moves).
 * 4. Engine build: Chess.com may use a specific Stockfish version or configuration.
 * 5. Depth noise: At low depths, tactical positions can be mis-evaluated, producing
 *    occasional wild per-move swings not present in Chess.com results.
 */

const CAPS_CONFIG = {
    // ── Win probability model ──────────────────────────────────────────────────
    // wp = 100 / (1 + e^(-WIN_PROB_K * cp))  — standard logistic curve
    // K = 0.00368208 ≈ ln(10) / 625, reverse-engineered from Chess.com's CAPS system.
    // Checkpoints: wp(0cp)=50%, wp(100cp)≈59%, wp(300cp)≈74%, wp(1000cp)≈97%
    WIN_PROB_K: 0.00368208,

    // ── Per-move accuracy formula ──────────────────────────────────────────────
    // acc = A · exp(−B · winLoss) − C   (winLoss expressed in win-% points, 0–100)
    // Reference values: loss 0% → 100, loss 5% ≈ 80, loss 10% ≈ 64, loss 40% ≈ 15
    ACCURACY_A: 103.1668,
    ACCURACY_B: 0.04354,
    ACCURACY_C: 3.1669,

    // ── Move classification thresholds (win-% loss) ────────────────────────────
    // Approximate Chess.com thresholds based on community reverse-engineering.
    // "Great move" (!) also requires multi-PV to confirm and is not detected here.
    THRESHOLDS: {
        BEST:       2,   // ≤ 2%  win loss
        EXCELLENT:  5,   // 2–5%
        GOOD:       10,  // 5–10%
        INACCURACY: 20,  // 10–20%
        MISTAKE:    40,  // 20–40%
        // > 40% → blunder
    },

    // ── Opening exclusion ─────────────────────────────────────────────────────
    // Number of FULL moves (white + black = 2 plies) excluded from accuracy at game
    // start. Chess.com uses a large book; 0 includes all moves.
    BOOK_MOVES_TO_SKIP: 0,
};

/**
 * StockfishService - Handles chess engine analysis via Web Worker
 * Single Responsibility: Only deals with Stockfish position evaluation
 */
export class StockfishService {
    constructor() {
        this.worker = null;
        this.ready = false;
        this.pendingResolve = null;
        this.lastEval = null;
        this.depth = AppConfig.STOCKFISH_DEPTH;
        this.timeout = AppConfig.STOCKFISH_TIMEOUT;
    }

    /**
     * Initialize Stockfish Web Worker
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        return new Promise((resolve) => {
            try {
                this.worker = new Worker(AppConfig.STOCKFISH_WORKER_URL);

                this.worker.onmessage = (event) => {
                    this.handleWorkerMessage(event.data);
                };

                this.worker.onerror = (error) => {
                    console.error('Stockfish worker error:', error);
                    this.ready = false;
                    resolve(false);
                };

                // Wait for UCI initialization
                const initTimeout = setTimeout(() => {
                    if (!this.ready) {
                        console.warn('Stockfish initialization timeout');
                        resolve(false);
                    }
                }, 10000); // WASM can take longer to initialize

                this.worker.postMessage('uci');

                // Check ready state periodically
                const checkReady = setInterval(() => {
                    if (this.ready) {
                        clearInterval(checkReady);
                        clearTimeout(initTimeout);
                        console.log('Stockfish ready');
                        resolve(true);
                    }
                }, 100);
            } catch (error) {
                console.error('Failed to initialize Stockfish:', error);
                resolve(false);
            }
        });
    }

    /**
     * Handle messages from Stockfish worker
     * @private
     */
    handleWorkerMessage(line) {
        if (line === 'uciok') {
            this.ready = true;
            return;
        }

        // Store the latest evaluation at any depth
        if (line.includes('score cp')) {
            const cpMatch = line.match(/score cp (-?\d+)/);
            if (cpMatch) {
                this.lastEval = { type: 'cp', value: parseInt(cpMatch[1]) };
            }
        } else if (line.includes('score mate')) {
            const mateMatch = line.match(/score mate (-?\d+)/);
            if (mateMatch) {
                const mateIn = parseInt(mateMatch[1]);
                this.lastEval = { type: 'mate', value: mateIn > 0 ? 10000 : -10000 };
            }
        }

        // Resolve when bestmove is received (analysis complete)
        if (this.pendingResolve && line.startsWith('bestmove')) {
            const result = this.lastEval || { type: 'cp', value: 0 };
            this.pendingResolve(result);
            this.pendingResolve = null;
            this.lastEval = null;
        }
    }

    /**
     * Evaluate a chess position
     * @param {string} fen - Position in FEN notation
     * @returns {Promise<{type: string, value: number}>} Evaluation result
     */
    async evaluatePosition(fen) {
        if (!this.worker || !this.ready) {
            throw new Error('Stockfish not ready');
        }

        return new Promise((resolve) => {
            this.pendingResolve = resolve;
            this.lastEval = null; // Reset before new evaluation

            this.worker.postMessage(`position fen ${fen}`);
            this.worker.postMessage(`go depth ${this.depth}`);

            // On timeout, resolve with whatever we have (or 0)
            setTimeout(() => {
                if (this.pendingResolve) {
                    const result = this.lastEval || { type: 'cp', value: 0 };
                    this.pendingResolve(result);
                    this.pendingResolve = null;
                    this.lastEval = null;
                }
            }, this.timeout);
        });
    }

    /**
     * Convert a centipawn score to win probability (0–100 %) for White.
     * Uses a logistic curve fitted to Chess.com's CAPS model.
     * Mate scores (±10000 cp) naturally map to ≈100% / ≈0%.
     *
     * @param {number} cp - Centipawn score from White's perspective
     * @returns {number} Win probability for White, 0–100
     */
    cpToWinPercent(cp) {
        return 100 / (1 + Math.exp(-CAPS_CONFIG.WIN_PROB_K * cp));
    }

    /**
     * Convert a single move's win-% loss into a per-move accuracy score (0–100).
     * Formula: A · exp(−B · winLoss) − C  (Chess.com's CAPS per-move formula).
     * A loss of 0% → accuracy 100. A loss of 40% → accuracy ≈15.
     *
     * @param {number} winPercentLoss - Win-% points lost by the moving player (≥ 0)
     * @returns {number} Per-move accuracy, clamped to [0, 100]
     */
    moveAccuracyFromLoss(winPercentLoss) {
        const raw = CAPS_CONFIG.ACCURACY_A * Math.exp(-CAPS_CONFIG.ACCURACY_B * winPercentLoss)
                  - CAPS_CONFIG.ACCURACY_C;
        return Math.max(0, Math.min(100, raw));
    }

    /**
     * Classify a move based on win-% loss thresholds.
     * Brilliant (!!) and great (!) moves require multi-PV and are not classified here.
     *
     * @param {number} winPercentLoss
     * @returns {string} 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
     */
    classifyMove(winPercentLoss) {
        const t = CAPS_CONFIG.THRESHOLDS;
        if (winPercentLoss <= t.BEST)       return 'best';
        if (winPercentLoss <= t.EXCELLENT)  return 'excellent';
        if (winPercentLoss <= t.GOOD)       return 'good';
        if (winPercentLoss <= t.INACCURACY) return 'inaccuracy';
        if (winPercentLoss <= t.MISTAKE)    return 'mistake';
        return 'blunder';
    }

    /**
     * Analyze a complete game using the CAPS methodology.
     *
     * Key differences from the old centipawn-average approach:
     * - Loss is measured in win-% points, not raw centipawns. A 300 cp loss when
     *   already winning (+15.0 → +12.0) barely moves win%, so it barely hurts accuracy.
     *   The same 300 cp loss from a balanced position (+1.0 → −2.0) is catastrophic.
     * - Forced moves (≤1 legal reply) are excluded from the accuracy average.
     * - Per-move results are returned so the UI can display move classifications.
     *
     * @param {string} pgn - Game in PGN format
     * @param {string} userColor - 'white' | 'black'
     * @returns {Promise<{accuracy: number, moveResults: Array, avgWinPercentLoss: number}|null>}
     */
    async analyzeGame(pgn, userColor) {
        if (!this.ready) return null;

        try {
            const moves = this.extractMovesFromPgn(pgn);
            if (moves.length === 0) return null;

            const isUserWhite = userColor === 'white';
            const evaluations = [];  // cp from White's perspective, length = moves.length + 1
            const forcedFlags = [];  // true when the player had ≤1 legal move available

            const tempChess = new Chess();

            // Evaluate the starting position
            try {
                const startEval = await this.evaluatePosition(tempChess.fen());
                evaluations.push(startEval.value);
            } catch {
                evaluations.push(0);
            }

            // Evaluate after each move
            for (const move of moves) {
                // Record whether this move was forced BEFORE applying it
                const legalMoves = tempChess.moves();
                forcedFlags.push(legalMoves.length <= 1);

                try {
                    tempChess.move(move);
                    const evalResult = await this.evaluatePosition(tempChess.fen());
                    // Stockfish scores from the side-to-move's perspective after the move.
                    // Flip when it's now Black's turn so the array is always White-relative.
                    const normalized = tempChess.turn() === 'b' ? -evalResult.value : evalResult.value;
                    evaluations.push(normalized);
                } catch {
                    evaluations.push(evaluations[evaluations.length - 1] ?? 0);
                }
            }

            return this.calculateCapsAccuracy(moves, evaluations, forcedFlags, isUserWhite);
        } catch (error) {
            console.error('Stockfish analysis error:', error);
            return null;
        }
    }

    /**
     * Compute CAPS accuracy from the evaluation array using win-% loss per move.
     *
     * Algorithm:
     * 1. Convert each cp eval to win probability via the logistic curve.
     * 2. For each ply, compute win-% loss from the moving player's perspective.
     *    Gains (negative loss) are clamped to 0 — we can't reward without multi-PV.
     * 3. Convert each loss to a per-move accuracy score via the CAPS formula.
     * 4. Average over the user's non-forced, non-book moves.
     *
     * @private
     * @param {string[]} moves
     * @param {number[]} evaluations  - length moves.length + 1, White's perspective
     * @param {boolean[]} forcedFlags - length moves.length
     * @param {boolean} isUserWhite
     * @returns {{accuracy: number, moveResults: Array, avgWinPercentLoss: number}|null}
     */
    calculateCapsAccuracy(moves, evaluations, forcedFlags, isUserWhite) {
        const moveResults = [];
        let totalMoveAccuracy   = 0;
        let totalWinPercentLoss = 0;
        let countedMoves        = 0;

        const bookPlies = CAPS_CONFIG.BOOK_MOVES_TO_SKIP * 2; // full moves → plies

        for (let i = 0; i < moves.length; i++) {
            const isWhiteMove = (i % 2 === 0);
            const isUserMove  = isWhiteMove === isUserWhite;

            const cpBefore = evaluations[i];
            const cpAfter  = evaluations[i + 1];
            if (cpBefore === undefined || cpAfter === undefined) continue;

            // Win probability from White's perspective at each point
            const wpWhiteBefore = this.cpToWinPercent(cpBefore);
            const wpWhiteAfter  = this.cpToWinPercent(cpAfter);

            // Reframe from the moving player's perspective
            // White wants wp high; Black wants wp low (Black's wp = 100 − White's wp)
            const wpPlayerBefore = isWhiteMove ? wpWhiteBefore : 100 - wpWhiteBefore;
            const wpPlayerAfter  = isWhiteMove ? wpWhiteAfter  : 100 - wpWhiteAfter;

            // Win-% loss: positive means the player lost winning chances.
            // Clamp gains to 0 — without multi-PV we cannot confirm a "brilliant" gain.
            const winPercentLoss = Math.max(0, wpPlayerBefore - wpPlayerAfter);

            const isForced   = forcedFlags[i] ?? false;
            const isBookMove = i < bookPlies;
            const moveAcc    = this.moveAccuracyFromLoss(winPercentLoss);

            moveResults.push({
                move:           moves[i],
                evalBefore:     cpBefore,
                evalAfter:      cpAfter,
                wpBefore:       Math.round(wpPlayerBefore * 10) / 10,
                wpAfter:        Math.round(wpPlayerAfter  * 10) / 10,
                winPercentLoss: Math.round(winPercentLoss * 10) / 10,
                moveAccuracy:   Math.round(moveAcc        * 10) / 10,
                classification: this.classifyMove(winPercentLoss),
                isForced,
                isUserMove,
            });

            // Only the user's non-forced, non-book moves count toward accuracy
            if (isUserMove && !isForced && !isBookMove) {
                totalMoveAccuracy   += moveAcc;
                totalWinPercentLoss += winPercentLoss;
                countedMoves++;
            }
        }

        if (countedMoves === 0) return null;

        return {
            accuracy:          Math.round((totalMoveAccuracy   / countedMoves) * 10) / 10,
            avgWinPercentLoss: Math.round((totalWinPercentLoss / countedMoves) * 10) / 10,
            moveResults,
        };
    }

    /**
     * Extract moves from PGN
     * @private
     */
    extractMovesFromPgn(pgn) {
        const moves = [];
        const pgnLines = pgn.split('\n');
        let moveText = '';

        for (const line of pgnLines) {
            if (!line.startsWith('[')) {
                moveText += ' ' + line;
            }
        }

        const moveRegex = /(\d+\.+\s*)?([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O-O|O-O)([+#])?/g;
        let match;
        while ((match = moveRegex.exec(moveText)) !== null) {
            moves.push(match[2]);
        }

        return moves;
    }

    /**
     * Check if Stockfish is ready
     * @returns {boolean}
     */
    isReady() {
        return this.ready;
    }

    /**
     * Terminate the Stockfish worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.ready = false;
        }
    }
}
