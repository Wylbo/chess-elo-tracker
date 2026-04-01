/**
 * EventBus - Centralized event communication system
 * Implements Observer pattern for loose coupling between components
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler to remove
     */
    off(event, callback) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.delete(callback);
        }
    }

    /**
     * Emit an event with optional data
     * @param {string} event - Event name
     * @param {*} data - Event payload
     */
    emit(event, data) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for "${event}":`, error);
                }
            });
        }
    }

    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     */
    once(event, callback) {
        const wrapper = (data) => {
            this.off(event, wrapper);
            callback(data);
        };
        this.on(event, wrapper);
    }
}

// Event name constants for type safety
export const Events = {
    // Player events
    PLAYER_ADDED: 'player:added',
    PLAYER_REMOVED: 'player:removed',
    PLAYER_UPDATED: 'player:updated',
    PLAYER_VISIBILITY_CHANGED: 'player:visibilityChanged',
    PLAYER_COLOR_CHANGED: 'player:colorChanged',
    PLAYERS_REFRESHED: 'players:refreshed',

    // Chart events
    CHART_UPDATE_REQUESTED: 'chart:updateRequested',
    WINDOW_CHANGED: 'window:changed',
    RANGE_SELECTION_CHANGED: 'range:selectionChanged',
    DOMAIN_UPDATED: 'domain:updated',

    // UI events
    STATUS_CHANGED: 'status:changed',
    PLAYERS_SECTION_TOGGLED: 'ui:playersSectionToggled',
    WEEKLY_SECTION_TOGGLED: 'ui:weeklySectionToggled',

    // Weekly games events
    WEEKLY_GAMES_UPDATED: 'weekly:gamesUpdated',
    ANALYSIS_PROGRESS: 'analysis:progress',
    ANALYSIS_COMPLETE: 'analysis:complete',

    // Modal events
    GAME_MODAL_OPENED: 'modal:gameOpened',
    GAME_MODAL_CLOSED: 'modal:gameClosed',

    // State events
    STATE_PERSISTED: 'state:persisted',
    STATE_RESTORED: 'state:restored',

    // Openings events
    OPENINGS_FETCH_REQUESTED: 'openings:fetchRequested',
    OPENINGS_STATS_READY: 'openings:statsReady',
    OPENINGS_ERROR: 'openings:error',
};
