import { Events } from '../core/EventBus.js';

/**
 * StatusController - Manages status message display
 * Single Responsibility: Status message UI
 */
export class StatusController {
    constructor(eventBus, statusElement) {
        this.eventBus = eventBus;
        this.element = statusElement;
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     * @private
     */
    setupEventListeners() {
        this.eventBus.on(Events.STATUS_CHANGED, ({ message, tone }) => {
            this.setStatus(message, tone);
        });
    }

    /**
     * Set status message
     * @param {string} message - Status text
     * @param {string} tone - info, warn, error, success
     */
    setStatus(message, tone = 'info') {
        if (!this.element) return;
        this.element.textContent = message;
        this.element.setAttribute('data-tone', tone);
    }

    /**
     * Clear status
     */
    clear() {
        this.setStatus('', 'info');
    }
}
