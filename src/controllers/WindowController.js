import { AppConfig } from '../config/AppConfig.js';
import { Events } from '../core/EventBus.js';

/**
 * WindowController - Manages time window selection
 * Single Responsibility: Window selection UI and logic
 */
export class WindowController {
    constructor(eventBus, windowValueElement) {
        this.eventBus = eventBus;
        this.windowValueEl = windowValueElement;
        this.buttons = [];
        this.windowDays = AppConfig.DEFAULT_WINDOW;
        this.domain = { min: null, max: null };

        this.setupEventListeners();
    }

    /**
     * Initialize window buttons
     * @param {NodeList|Array} buttons - Window selection buttons
     */
    initialize(buttons) {
        this.buttons = Array.from(buttons);

        this.buttons.forEach(btn => {
            btn.addEventListener('click', () => this.handleSelect(btn));
        });

        this.syncUI();
        return this;
    }

    /**
     * Setup event listeners
     * @private
     */
    setupEventListeners() {
        this.eventBus.on(Events.DOMAIN_UPDATED, (domain) => {
            this.domain = domain;
            this.syncUI();
        });
    }

    /**
     * Handle window button selection
     * @private
     */
    handleSelect(button) {
        const value = button.dataset.window;

        if (value === 'max') {
            this.windowDays = null; // null = show all
        } else {
            this.windowDays = this.clampWindow(value);
        }

        this.syncUI();
        this.eventBus.emit(Events.WINDOW_CHANGED, { windowDays: this.windowDays });
    }

    /**
     * Set window days programmatically
     * @param {number|null|string} days
     */
    setWindowDays(days) {
        if (days === 'max' || days === null) {
            this.windowDays = null;
        } else if (days === AppConfig.CUSTOM_WINDOW) {
            this.windowDays = AppConfig.CUSTOM_WINDOW;
        } else {
            this.windowDays = this.clampWindow(days);
        }
        this.syncUI();
    }

    /**
     * Get current window days
     * @returns {number|null|string}
     */
    getWindowDays() {
        return this.windowDays;
    }

    /**
     * Clamp window value to valid range
     * @private
     */
    clampWindow(value) {
        const num = parseInt(value, 10);
        if (Number.isNaN(num)) return AppConfig.DEFAULT_WINDOW;
        return Math.min(AppConfig.MAX_WINDOW, Math.max(AppConfig.MIN_WINDOW, num));
    }

    /**
     * Sync UI with current state
     */
    syncUI() {
        // Update label
        if (this.windowValueEl) {
            this.windowValueEl.textContent = this.formatLabel(this.windowDays);
        }

        // Update button states
        const endBound = this.domain.max;

        this.buttons.forEach(btn => {
            const btnWindow = btn.dataset.window;

            // Always enable max button
            if (btnWindow === 'max') {
                btn.disabled = false;
            } else if (this.domain.min && this.domain.max) {
                const daysRequested = parseInt(btnWindow, 10);
                const startBound = new Date(endBound);
                startBound.setDate(startBound.getDate() - daysRequested);
                btn.disabled = startBound < this.domain.min;
            } else {
                btn.disabled = false;
            }

            // Update active state
            if (this.windowDays === AppConfig.CUSTOM_WINDOW) {
                btn.classList.remove('active');
            } else if (this.windowDays === null) {
                btn.classList.toggle('active', btnWindow === 'max');
            } else {
                const val = parseInt(btnWindow, 10);
                btn.classList.toggle('active', val === this.windowDays);
            }
        });
    }

    /**
     * Format window label for display
     * @private
     */
    formatLabel(days) {
        if (days === AppConfig.CUSTOM_WINDOW) return 'custom range';
        if (days === null) return 'all time';

        const labels = AppConfig.WINDOW_LABELS;
        return labels[days] || `${days} days`;
    }

    /**
     * Calculate window bounds
     * @returns {Object} { startBound, endBound }
     */
    calculateBounds() {
        if (!this.domain.min || !this.domain.max) {
            return { startBound: null, endBound: null };
        }

        const endBound = new Date(this.domain.max);
        let startBound;

        if (this.windowDays === null) {
            startBound = this.domain.min;
        } else if (this.windowDays === AppConfig.CUSTOM_WINDOW) {
            // Custom range handled by RangeSelectorController
            startBound = this.domain.min;
        } else {
            startBound = new Date(endBound);
            startBound.setDate(startBound.getDate() - this.windowDays);
        }

        return { startBound, endBound };
    }
}
