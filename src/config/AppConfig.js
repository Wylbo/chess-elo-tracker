/**
 * AppConfig - Centralized application configuration
 * Single source of truth for constants and settings
 */
export const AppConfig = {
    // Data fetching
    MONTHS_TO_FETCH: 6,

    // Time window settings
    DEFAULT_WINDOW: 180,
    MIN_WINDOW: 7,
    MAX_WINDOW: 1095,
    CUSTOM_WINDOW: 'custom',

    // Storage
    STORAGE_KEY: 'elo-tracker:v1',

    // Color palette for player lines
    PALETTE: [
        '#00FFB4', // cyan
        '#FF64C8', // pink
        '#FFB830', // amber
        '#7C6EFF', // indigo
        '#FF6B6B', // coral
        '#00D4FF', // sky
        '#A8FF3E', // lime
        '#FF9F43', // orange
    ],

    // Stockfish analysis
    STOCKFISH_DEPTH: 10,
    STOCKFISH_TIMEOUT: 2000,  // 2 seconds per position, uses best eval found
    STOCKFISH_WORKER_URL: './lib/stockfish/stockfish.js',

    // Chess.com API
    CHESS_COM_API_BASE: 'https://api.chess.com/pub/player',

    // Chart styling
    CHART: {
        GRID_COLOR: 'rgba(230,225,220,0.08)',
        TICK_COLOR: '#B8B2A7',
        TOOLTIP_BG: '#2B2A28',
        TOOLTIP_BORDER: 'rgba(53,50,47,0.7)',
        LINE_TENSION: 0.32,
        LINE_WIDTH: 2.5,
        POINT_RADIUS: 3,
        POINT_HOVER_RADIUS: 5,
        ANIMATION_DURATION: 300
    },

    // Range chart styling
    RANGE_CHART: {
        LINE_WIDTH: 1.5,
        POINT_RADIUS: 0
    },

    // Cache settings
    GAMES_CACHE_TTL: 300000, // 5 minutes

    // Window labels
    WINDOW_LABELS: {
        7: '1 week',
        30: '1 month',
        90: '3 months',
        180: '6 months',
        365: '1 year'
    },

    // Openings feature
    OPENINGS_MAX_MONTHS: 24,
    OPENINGS_CACHE_PREFIX: 'elo-tracker:openings:',
    OPENINGS_TIME_WINDOWS: [
        { days: 30, label: '30d' },
        { days: 90, label: '90d' },
        { days: 365, label: '365d' },
        { days: 0, label: 'All time' }  // 0 = all time, capped at OPENINGS_MAX_MONTHS
    ],
    OPENINGS_DEFAULT_WINDOW: 90,
    OPENINGS_MIN_GAMES: 3
};

/**
 * DOM element IDs for centralized reference
 */
export const DOMIds = {
    // Form elements
    ADD_FORM: 'add-form',
    USERNAME_INPUT: 'username',
    TIME_CLASS_SELECT: 'time-class',
    REFRESH_BTN: 'refresh-btn',

    // Player list
    PLAYER_LIST: 'player-list',
    PLAYERS_TOGGLE: 'players-toggle',
    PLAYERS_BODY: 'players-body',
    PLAYER_COUNT: 'player-count',

    // Status
    STATUS: 'status',

    // Charts
    ELO_CHART: 'elo-chart',
    RANGE_CHART: 'range-chart',
    RANGE_OVERLAY: 'range-overlay',
    WINDOW_VALUE: 'window-value',

    // Weekly games
    WEEKLY_TABLE_BODY: 'weekly-table-body',
    WEEKLY_STATUS: 'weekly-status',
    WEEKLY_TOGGLE: 'weekly-toggle',
    WEEKLY_BODY: 'weekly-body',
    ANALYSIS_PROGRESS: 'analysis-progress',
    ANALYSIS_PROGRESS_BAR: 'analysis-progress-bar',

    // Game modal
    GAME_MODAL_OVERLAY: 'game-modal-overlay',
    MODAL_CLOSE: 'modal-close',
    MODAL_PLAYERS: 'modal-players',
    MODAL_RESULT: 'modal-result',
    MODAL_ACCURACY: 'modal-accuracy',
    CHESS_BOARD: 'chess-board',
    MOVE_COUNTER: 'move-counter',
    MOVE_LIST: 'move-list',
    VIEW_ON_CHESSCOM: 'view-on-chesscom',

    // Playback controls
    BTN_START: 'btn-start',
    BTN_PREV: 'btn-prev',
    BTN_PLAY: 'btn-play',
    BTN_NEXT: 'btn-next',
    BTN_END: 'btn-end',

    // Tab bar
    BOTTOM_PANEL: 'bottom-panel',

    // Openings
    OPENINGS_STATUS: 'openings-status',
    OPENINGS_PLAYER_SELECT: 'openings-player',
    OPENINGS_ALL_TIME_NOTE: 'openings-all-time-note',
    OPENINGS_CHART: 'openings-chart',
    OPENINGS_TABLE_WHITE: 'openings-table-white',
    OPENINGS_TABLE_BLACK: 'openings-table-black',
    OPENINGS_TBODY_WHITE: 'openings-tbody-white',
    OPENINGS_TBODY_BLACK: 'openings-tbody-black'
};
