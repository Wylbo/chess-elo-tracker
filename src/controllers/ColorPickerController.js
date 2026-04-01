import { AppConfig } from '../config/AppConfig.js';
import { Events } from '../core/EventBus.js';

/**
 * ColorPickerController - Manages color picker popup
 * Single Responsibility: Color picker UI and interactions
 */
export class ColorPickerController {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.element = null;
        this.currentPlayer = null;
        this.anchorElement = null;
        this.onColorSelect = null;
    }

    /**
     * Initialize the color picker
     */
    initialize() {
        this.element = document.createElement('div');
        this.element.className = 'color-picker hidden';

        AppConfig.PALETTE.forEach(color => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'color-swatch';
            button.style.background = color;
            button.dataset.color = color;
            button.title = `Use ${color}`;

            button.addEventListener('click', (event) => {
                event.stopPropagation();
                this.selectColor(color);
            });

            this.element.appendChild(button);
        });

        document.body.appendChild(this.element);
        this.bindDismissEvents();

        return this;
    }

    /**
     * Bind events for dismissing picker
     * @private
     */
    bindDismissEvents() {
        document.addEventListener('click', (event) => {
            this.handleDismiss(event);
        });

        window.addEventListener('resize', () => this.close());
        window.addEventListener('scroll', () => this.close(), true);
    }

    /**
     * Handle click outside to dismiss
     * @private
     */
    handleDismiss(event) {
        if (!this.element || this.element.classList.contains('hidden')) return;
        if (this.element.contains(event.target)) return;
        if (this.anchorElement?.contains(event.target)) return;
        this.close();
    }

    /**
     * Open color picker for a player
     * @param {Object} player - Player object
     * @param {HTMLElement} anchor - Element to position near
     * @param {Function} onSelect - Callback when color selected
     */
    open(player, anchor, onSelect) {
        if (!this.element) return;

        this.currentPlayer = player;
        this.anchorElement = anchor;
        this.onColorSelect = onSelect;

        const rect = anchor.getBoundingClientRect();
        this.element.style.left = `${rect.left + window.scrollX}px`;
        this.element.style.top = `${rect.bottom + window.scrollY + 8}px`;

        // Highlight current color
        this.element.querySelectorAll('.color-swatch').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === player.color);
        });

        this.element.classList.remove('hidden');
    }

    /**
     * Close the color picker
     */
    close() {
        if (!this.element) return;
        this.element.classList.add('hidden');
        this.currentPlayer = null;
        this.anchorElement = null;
        this.onColorSelect = null;
    }

    /**
     * Handle color selection
     * @private
     */
    selectColor(color) {
        if (this.currentPlayer && this.onColorSelect) {
            this.onColorSelect(this.currentPlayer.username, color);
        }
        this.close();
    }

    /**
     * Check if picker is open
     * @returns {boolean}
     */
    isOpen() {
        return this.element && !this.element.classList.contains('hidden');
    }

    /**
     * Destroy the color picker
     */
    destroy() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}
