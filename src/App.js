import { AppConfig, DOMIds } from './config/AppConfig.js';
import { EventBus, Events } from './core/EventBus.js';

// Services
import { StorageService } from './services/StorageService.js';
import { ChessComApiService } from './services/ChessComApiService.js';
import { StockfishService } from './services/StockfishService.js';

// Managers
import { PlayerManager } from './managers/PlayerManager.js';
import { ChartManager } from './managers/ChartManager.js';
import { RangeChartManager } from './managers/RangeChartManager.js';
import { WeeklyGamesManager } from './managers/WeeklyGamesManager.js';

// Controllers
import { StatusController } from './controllers/StatusController.js';
import { ColorPickerController } from './controllers/ColorPickerController.js';
import { WindowController } from './controllers/WindowController.js';
import { RangeSelectorController } from './controllers/RangeSelectorController.js';
import { PlayerListController } from './controllers/PlayerListController.js';
import { CollapsibleController } from './controllers/CollapsibleController.js';
import { WeeklyGamesController } from './controllers/WeeklyGamesController.js';
import { GameModalController } from './controllers/GameModalController.js';
import { OpeningsService } from './services/OpeningsService.js';
import { OpeningsManager } from './managers/OpeningsManager.js';
import { TabController } from './controllers/TabController.js';
import { OpeningsController } from './controllers/OpeningsController.js';

/**
 * App - Main application orchestrator
 * Follows Dependency Inversion: High-level module depends on abstractions
 * Coordinates all components through the EventBus
 */
export class App {
    constructor() {
        // Core infrastructure
        this.eventBus = new EventBus();

        // Services (dependency injection ready)
        this.storageService = new StorageService();
        this.apiService = new ChessComApiService();
        this.stockfishService = new StockfishService();

        // Managers
        this.playerManager = new PlayerManager(this.eventBus, this.apiService);
        this.chartManager = null;
        this.rangeChartManager = null;
        this.weeklyGamesManager = null;
        this.openingsService = new OpeningsService();
        this.openingsManager = null;

        // Controllers
        this.statusController = null;
        this.colorPickerController = null;
        this.windowController = null;
        this.rangeSelectorController = null;
        this.playerListController = null;
        this.playersSectionController = null;
        this.weeklySectionController = null;
        this.weeklyGamesController = null;
        this.gameModalController = null;
        this.tabController = null;
        this.openingsController = null;

        // DOM references
        this.formEl = null;
        this.usernameEl = null;
        this.timeClassEl = null;
        this.refreshBtn = null;

        // State
        this.isRefreshing = false;
    }

    /**
     * Initialize the application
     */
    async initialize() {
        this.cacheDOMElements();
        await this.initializeServices();
        this.initializeManagers();
        this.initializeControllers();
        this.bindFormEvents();
        this.setupEventSubscriptions();

        // Initial render of empty player list
        this.renderPlayerList();

        // Resize charts after layout
        requestAnimationFrame(() => {
            this.chartManager?.resize();
            this.rangeChartManager?.resize();
        });

        // Restore saved state
        await this.restoreState();
    }

    /**
     * Cache DOM element references
     * @private
     */
    cacheDOMElements() {
        this.formEl = document.getElementById(DOMIds.ADD_FORM);
        this.usernameEl = document.getElementById(DOMIds.USERNAME_INPUT);
        this.timeClassEl = document.getElementById(DOMIds.TIME_CLASS_SELECT);
        this.refreshBtn = document.getElementById(DOMIds.REFRESH_BTN);
    }

    /**
     * Initialize services
     * @private
     */
    async initializeServices() {
        const stockfishReady = await this.stockfishService.initialize();
        if (!stockfishReady) {
            console.warn('Stockfish failed to initialize - game analysis will not be available');
        }
    }

    /**
     * Initialize managers
     * @private
     */
    initializeManagers() {
        // Chart manager
        const chartCanvas = document.getElementById(DOMIds.ELO_CHART);
        if (chartCanvas) {
            this.chartManager = new ChartManager(this.eventBus, chartCanvas);
            this.chartManager.initialize();
        }

        // Range chart manager
        const rangeCanvas = document.getElementById(DOMIds.RANGE_CHART);
        const rangeOverlay = document.getElementById(DOMIds.RANGE_OVERLAY);
        if (rangeCanvas && rangeOverlay) {
            this.rangeChartManager = new RangeChartManager(
                this.eventBus,
                rangeCanvas,
                rangeOverlay
            );
            this.rangeChartManager.initialize();
        }

        // Weekly games manager
        this.weeklyGamesManager = new WeeklyGamesManager(
            this.eventBus,
            this.apiService,
            this.stockfishService
        );

        // Openings manager
        this.openingsManager = new OpeningsManager(this.eventBus, this.openingsService);
        this.openingsManager.initialize();
    }

    /**
     * Initialize controllers
     * @private
     */
    initializeControllers() {
        // Tab controller
        const tabButtons = document.querySelectorAll('[data-tab]');
        const tabPanels = document.querySelectorAll('.tab-panel');
        this.tabController = new TabController(tabButtons, tabPanels);
        this.tabController.initialize('weekly');

        // Status controller
        const statusEl = document.getElementById(DOMIds.STATUS);
        this.statusController = new StatusController(this.eventBus, statusEl);

        // Color picker
        this.colorPickerController = new ColorPickerController(this.eventBus);
        this.colorPickerController.initialize();

        // Window controller
        const windowValueEl = document.getElementById(DOMIds.WINDOW_VALUE);
        const windowButtons = document.querySelectorAll('.range-buttons [data-window]');
        this.windowController = new WindowController(this.eventBus, windowValueEl);
        this.windowController.initialize(windowButtons);

        // Range selector controller
        const rangeOverlay = document.getElementById(DOMIds.RANGE_OVERLAY);
        this.rangeSelectorController = new RangeSelectorController(this.eventBus, rangeOverlay);
        this.rangeSelectorController.initialize();

        // Player list controller
        const playerListEl = document.getElementById(DOMIds.PLAYER_LIST);
        const playerCountEl = document.getElementById(DOMIds.PLAYER_COUNT);
        this.playerListController = new PlayerListController(
            this.eventBus,
            playerListEl,
            playerCountEl,
            this.timeClassEl
        );
        this.playerListController.initialize({
            onColorPickerOpen: (player, anchor) => {
                this.colorPickerController.open(player, anchor, (username, color) => {
                    this.playerManager.setPlayerColor(username, color);
                    this.renderPlayerList();
                    this.updateChart();
                    this.persistState();
                });
            },
            onVisibilityChange: (username, visible) => {
                this.playerManager.setPlayerVisibility(username, visible);
                this.updateChart();
                this.persistState();
            },
            onRemovePlayer: (username) => {
                this.playerManager.removePlayer(username);
                this.weeklyGamesManager.clearPlayerCache(username);
                this.openingsService.clearUserCache(username);
                this.renderPlayerList();
                this.updateChart();
                this.persistState();
                this.updateWeeklyGames();
            }
        });

        // Players section collapsible
        const playersToggle = document.getElementById(DOMIds.PLAYERS_TOGGLE);
        const playersBody = document.getElementById(DOMIds.PLAYERS_BODY);
        this.playersSectionController = new CollapsibleController(playersToggle, playersBody);
        this.playersSectionController.initialize(true);

        // Weekly section collapsible
        const weeklyToggle = document.getElementById(DOMIds.WEEKLY_TOGGLE);
        const weeklyBody = document.getElementById(DOMIds.WEEKLY_BODY);
        this.weeklySectionController = new CollapsibleController(weeklyToggle, weeklyBody);
        this.weeklySectionController.initialize(true);

        // Weekly games controller
        this.weeklyGamesController = new WeeklyGamesController(this.eventBus, {
            tableBody: document.getElementById(DOMIds.WEEKLY_TABLE_BODY),
            status: document.getElementById(DOMIds.WEEKLY_STATUS),
            progress: document.getElementById(DOMIds.ANALYSIS_PROGRESS),
            progressBar: document.getElementById(DOMIds.ANALYSIS_PROGRESS_BAR)
        });
        this.weeklyGamesController.initialize({
            onGameClick: (game) => this.gameModalController?.open(game)
        });

        // Game modal controller
        this.gameModalController = new GameModalController(this.eventBus, {
            overlay: document.getElementById(DOMIds.GAME_MODAL_OVERLAY),
            closeBtn: document.getElementById(DOMIds.MODAL_CLOSE),
            players: document.getElementById(DOMIds.MODAL_PLAYERS),
            result: document.getElementById(DOMIds.MODAL_RESULT),
            accuracy: document.getElementById(DOMIds.MODAL_ACCURACY),
            board: document.getElementById(DOMIds.CHESS_BOARD),
            moveCounter: document.getElementById(DOMIds.MOVE_COUNTER),
            moveList: document.getElementById(DOMIds.MOVE_LIST),
            viewLink: document.getElementById(DOMIds.VIEW_ON_CHESSCOM)
        });
        this.gameModalController.initialize((username) => {
            const player = this.playerManager.getPlayer(username);
            return player?.displayName || username;
        });

        // Openings controller
        this.openingsController = new OpeningsController(
            this.eventBus,
            {
                statusEl: document.getElementById(DOMIds.OPENINGS_STATUS),
                playerSelect: document.getElementById(DOMIds.OPENINGS_PLAYER_SELECT),
                allTimeNote: document.getElementById(DOMIds.OPENINGS_ALL_TIME_NOTE),
                windowBtns: document.querySelectorAll('.openings-window-btn'),
                whiteTableBody: document.getElementById(DOMIds.OPENINGS_TBODY_WHITE),
                blackTableBody: document.getElementById(DOMIds.OPENINGS_TBODY_BLACK),
                whiteTableHead: document.querySelector(`#${DOMIds.OPENINGS_TABLE_WHITE} thead`),
                blackTableHead: document.querySelector(`#${DOMIds.OPENINGS_TABLE_BLACK} thead`),
                chartCanvas: document.getElementById(DOMIds.OPENINGS_CHART)
            },
            () => this.playerManager.getAllPlayers(),
            () => this.timeClassEl?.value || 'blitz'
        );
        this.openingsController.initialize();
    }

    /**
     * Bind form event handlers
     * @private
     */
    bindFormEvents() {
        if (!this.formEl) {
            console.error('Form element not found');
            return;
        }

        this.formEl.addEventListener('submit', (event) => {
            event.preventDefault();
            const username = this.usernameEl?.value?.trim();
            if (!username) {
                this.setStatus('Enter a Chess.com username to track.', 'warn');
                return;
            }
            this.addPlayer(username);
            if (this.usernameEl) {
                this.usernameEl.value = '';
            }
        });

        this.timeClassEl?.addEventListener('change', () => {
            this.setStatus(`Reloading data for ${this.timeClassEl.value}...`, 'info');
            this.refreshAllPlayers();
            this.openingsController?.refreshPlayerDropdown();
        });

        this.refreshBtn?.addEventListener('click', () => this.handleRefreshClick());
    }

    /**
     * Setup event bus subscriptions
     * @private
     */
    setupEventSubscriptions() {
        this.eventBus.on(Events.WINDOW_CHANGED, () => {
            this.updateChart();
            this.persistState();
        });

        this.eventBus.on(Events.RANGE_SELECTION_CHANGED, ({ startDate, endDate }) => {
            this.windowController.setWindowDays(AppConfig.CUSTOM_WINDOW);
            this.updateChartWithBounds(startDate, endDate);
            this.persistState();
        });

        this.eventBus.on(Events.WEEKLY_GAMES_UPDATED, () => {
            this.renderWeeklyTable();
        });

        this.eventBus.on(Events.ANALYSIS_COMPLETE, () => {
            this.renderWeeklyTable();
        });
    }

    /**
     * Add a player
     * @param {string} username
     * @param {Object} options
     */
    async addPlayer(username, options = {}) {
        console.log('Adding player:', username, options);
        try {
            if (!options.silent) {
                this.setStatus(`Fetching ${username} ${this.timeClassEl?.value || 'blitz'} games...`, 'info');
            }

            const player = await this.playerManager.addPlayer(username, {
                ...options,
                timeClass: this.timeClassEl?.value || 'blitz'
            });

            console.log('Player added:', player);

            if (player) {
                this.renderPlayerList();
                this.updateChart();
                this.persistState();

                if (!options.silent) {
                    if (player.disabled) {
                        this.setStatus(
                            `${player.displayName} has no ${this.timeClassEl?.value || 'blitz'} games recently. Disabled for this time control.`,
                            'warn'
                        );
                    } else {
                        this.setStatus(`Added ${player.displayName}`, 'success');
                    }
                }

                // Update weekly games
                setTimeout(() => this.updateWeeklyGames(), 100);
            }
        } catch (error) {
            console.error('Failed to add player:', error);
            this.setStatus(error.message || `Unable to fetch data for ${username}.`, 'error');
        }
    }

    /**
     * Refresh all players
     */
    async refreshAllPlayers(options = {}) {
        const snapshots = this.playerManager.getSnapshot();
        this.playerManager.clear();

        if (options.resetWindow !== false) {
            this.windowController.setWindowDays(AppConfig.DEFAULT_WINDOW);
        }

        this.playerManager.resetPendingPlayers(snapshots.map(s => s.username));
        this.updateChart();
        this.persistState();

        for (const entry of snapshots) {
            await this.addPlayer(entry.displayName || entry.username, {
                silent: true,
                forceRefresh: true,
                preferredColor: entry.color,
                visible: entry.visible
            });
        }

        if (snapshots.length) {
            this.setStatus(
                `Updated ${snapshots.length} players for ${this.timeClassEl?.value || 'blitz'}.`,
                'success'
            );
        }

        this.playerManager.computeDomain();
        this.windowController.syncUI();

        // Refresh weekly games
        this.weeklyGamesManager.clearCache();
        setTimeout(() => this.updateWeeklyGames(), 100);
    }

    /**
     * Handle refresh button click
     * @private
     */
    async handleRefreshClick() {
        if (this.isRefreshing) return;

        if (!this.playerManager.hasPlayers()) {
            this.setStatus('Add players to refresh their data.', 'warn');
            return;
        }

        this.isRefreshing = true;
        this.refreshBtn.disabled = true;
        const originalText = this.refreshBtn.textContent;
        this.refreshBtn.textContent = 'Refreshing...';
        this.setStatus('Refreshing tracked players...', 'info');

        try {
            await this.refreshAllPlayers({ resetWindow: false });
            this.setStatus('Player data refreshed.', 'success');
        } finally {
            this.refreshBtn.disabled = false;
            this.refreshBtn.textContent = originalText;
            this.isRefreshing = false;
        }
    }

    /**
     * Update the main chart
     */
    updateChart() {
        const players = Array.from(this.playerManager.getAllPlayers().values());
        const domain = this.playerManager.getDomain();

        if (!players.length || !domain.min || !domain.max) {
            this.chartManager?.clear();
            this.rangeChartManager?.clear();
            this.rangeSelectorController?.reset();
            this.windowController.syncUI();
            return;
        }

        // Ensure controllers have the latest domain
        this.windowController.domain = domain;
        this.rangeSelectorController.domain = domain;

        const { startBound, endBound } = this.windowController.calculateBounds();

        // Fallback to domain bounds if calculation returns null
        const effectiveStart = startBound || domain.min;
        const effectiveEnd = endBound || domain.max;

        this.chartManager?.update({ players, startBound: effectiveStart, endBound: effectiveEnd });

        // Update range selector overlay
        if (!this.rangeSelectorController.isDraggingActive()) {
            this.rangeSelectorController.setFromBounds(effectiveStart, effectiveEnd);
        }

        // Update range chart
        this.rangeChartManager?.update(players, domain);
        this.windowController.syncUI();
    }

    /**
     * Update chart with specific bounds (for range selection)
     * @param {Date} startBound
     * @param {Date} endBound
     */
    updateChartWithBounds(startBound, endBound) {
        const players = Array.from(this.playerManager.getAllPlayers().values());

        this.chartManager?.update({ players, startBound, endBound });
        this.windowController.syncUI();
    }

    /**
     * Render the player list
     */
    renderPlayerList() {
        this.playerListController?.render(
            this.playerManager.getAllPlayers(),
            this.playerManager.getPendingPlayers(),
            (player) => this.playerManager.summarizePlayer(player)
        );
    }

    /**
     * Update weekly games
     */
    async updateWeeklyGames() {
        const players = Array.from(this.playerManager.getAllPlayers().values());
        const timeClass = this.timeClassEl?.value || 'blitz';

        await this.weeklyGamesManager.updateForPlayers(players, timeClass);
    }

    /**
     * Render the weekly games table
     */
    renderWeeklyTable() {
        const players = Array.from(this.playerManager.getAllPlayers().values());

        this.weeklyGamesController?.render(
            players,
            (username) => this.weeklyGamesManager.getCachedGames(username),
            (games) => this.weeklyGamesManager.findBestWorstGames(games),
            this.weeklyGamesManager.getAnalysisStatus()
        );
    }

    /**
     * Set status message
     * @param {string} message
     * @param {string} tone
     */
    setStatus(message, tone = 'info') {
        this.eventBus.emit(Events.STATUS_CHANGED, { message, tone });
    }

    /**
     * Persist state to storage
     */
    persistState() {
        this.storageService.save({
            timeClass: this.timeClassEl?.value || 'blitz',
            playersExpanded: this.playersSectionController?.isExpanded() ?? true,
            windowDays: this.windowController.getWindowDays(),
            players: this.playerManager.getSnapshot()
        });
    }

    /**
     * Restore state from storage
     */
    async restoreState() {
        const saved = this.storageService.load();
        if (!saved) {
            this.playersSectionController?.setExpanded(true, { animate: false });
            return;
        }

        if (saved.timeClass && this.timeClassEl) {
            this.timeClassEl.value = saved.timeClass;
        }

        if (saved.windowDays !== undefined) {
            this.windowController.setWindowDays(saved.windowDays);
        }

        if (typeof saved.playersExpanded === 'boolean') {
            this.playersSectionController?.setExpanded(saved.playersExpanded, { animate: false });
        }

        if (saved.players?.length) {
            this.setStatus(`Restoring ${saved.players.length} saved players...`, 'info');
            this.playerManager.resetPendingPlayers(saved.players.map(p => p.username));

            for (const entry of saved.players) {
                await this.addPlayer(entry.username, {
                    silent: true,
                    visible: entry.visible !== false,
                    preferredColor: entry.color,
                    forceRefresh: true
                });
            }

            this.setStatus('Restored saved players.', 'success');
            this.openingsController?.refreshPlayerDropdown();
        } else {
            this.playersSectionController?.setExpanded(true, { animate: false });
            this.openingsController?.refreshPlayerDropdown();
        }
    }
}

// Bootstrap the application
async function bootstrap() {
    // Verify required globals are available
    if (typeof Chart === 'undefined') {
        console.error('Chart.js not loaded');
        return;
    }

    try {
        const app = new App();
        await app.initialize();

        // Expose for debugging
        window.__eloTrackerApp = app;
        console.log('Chess ELO Tracker initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Chess ELO Tracker:', error);
    }
}

// Handle both cases: DOM already ready or not yet ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
