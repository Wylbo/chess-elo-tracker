import { AppConfig } from '../config/AppConfig.js';

/**
 * StorageService - Handles persistence to localStorage
 * Single Responsibility: Only deals with data persistence
 */
export class StorageService {
    constructor(storageKey = AppConfig.STORAGE_KEY) {
        this.storageKey = storageKey;
    }

    /**
     * Save application state to localStorage
     * @param {Object} state - State to persist
     * @returns {boolean} Success status
     */
    save(state) {
        try {
            const snapshot = {
                timeClass: state.timeClass,
                playersExpanded: state.playersExpanded,
                windowDays: state.windowDays,
                players: state.players.map(player => ({
                    username: player.username,
                    visible: player.visible,
                    color: player.color
                }))
            };
            localStorage.setItem(this.storageKey, JSON.stringify(snapshot));
            return true;
        } catch (error) {
            console.warn('Could not persist state:', error);
            return false;
        }
    }

    /**
     * Load application state from localStorage
     * @returns {Object|null} Saved state or null if not found
     */
    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (!data) return null;
            return JSON.parse(data);
        } catch (error) {
            console.warn('Could not load state:', error);
            return null;
        }
    }

    /**
     * Clear saved state
     * @returns {boolean} Success status
     */
    clear() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            console.warn('Could not clear state:', error);
            return false;
        }
    }

    /**
     * Check if there is saved state
     * @returns {boolean}
     */
    hasSavedState() {
        try {
            return localStorage.getItem(this.storageKey) !== null;
        } catch {
            return false;
        }
    }
}
