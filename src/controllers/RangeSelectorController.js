import { AppConfig } from '../config/AppConfig.js';
import { Events } from '../core/EventBus.js';

/**
 * RangeSelectorController - Manages range selector drag interactions
 * Single Responsibility: Range selector mouse/touch interactions
 */
export class RangeSelectorController {
    constructor(eventBus, overlayElement) {
        this.eventBus = eventBus;
        this.overlay = overlayElement;

        this.selectorStart = 0;
        this.selectorEnd = 100;
        this.isDragging = false;
        this.dragMode = null; // 'move', 'left', 'right'
        this.dragStartX = 0;
        this.dragStartValues = { start: 0, end: 0 };
        this.domain = { min: null, max: null };
    }

    /**
     * Initialize event listeners
     */
    initialize() {
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());

        this.eventBus.on(Events.DOMAIN_UPDATED, (domain) => {
            this.domain = domain;
        });

        return this;
    }

    /**
     * Handle mouse down on range selector
     * @private
     */
    handleMouseDown(event) {
        if (!this.overlay || !this.domain.min || !this.domain.max) return;

        const wrapRect = this.overlay.parentElement.getBoundingClientRect();

        // Only handle clicks within the range selector area
        if (event.clientX < wrapRect.left || event.clientX > wrapRect.right ||
            event.clientY < wrapRect.top || event.clientY > wrapRect.bottom) {
            return;
        }

        const x = event.clientX - wrapRect.left;
        const percentX = (x / wrapRect.width) * 100;

        this.dragStartX = event.clientX;
        this.dragStartValues = {
            start: this.selectorStart,
            end: this.selectorEnd
        };

        // Determine drag mode based on click position
        const distToStart = Math.abs(percentX - this.selectorStart);
        const distToEnd = Math.abs(percentX - this.selectorEnd);
        const edgeThreshold = 1;

        if (distToStart <= edgeThreshold) {
            this.dragMode = 'left';
        } else if (distToEnd <= edgeThreshold) {
            this.dragMode = 'right';
        } else if (percentX >= this.selectorStart && percentX <= this.selectorEnd) {
            this.dragMode = 'move';
        }

        if (this.dragMode) {
            this.isDragging = true;
            this.overlay.classList.add('dragging');
        }
    }

    /**
     * Handle mouse move during drag
     * @private
     */
    handleMouseMove(event) {
        if (!this.isDragging || !this.dragMode) return;

        const rect = this.overlay.parentElement.getBoundingClientRect();
        const deltaX = event.clientX - this.dragStartX;
        const deltaPercent = (deltaX / rect.width) * 100;

        if (this.dragMode === 'move') {
            const width = this.dragStartValues.end - this.dragStartValues.start;
            let newStart = this.dragStartValues.start + deltaPercent;
            let newEnd = this.dragStartValues.end + deltaPercent;

            newStart = Math.max(0, Math.min(newStart, 100 - width));
            newEnd = newStart + width;

            this.selectorStart = newStart;
            this.selectorEnd = newEnd;
        } else if (this.dragMode === 'left') {
            let newStart = this.dragStartValues.start + deltaPercent;
            newStart = Math.max(0, Math.min(newStart, this.selectorEnd));
            this.selectorStart = newStart;
        } else if (this.dragMode === 'right') {
            let newEnd = this.dragStartValues.end + deltaPercent;
            newEnd = Math.min(100, Math.max(newEnd, this.selectorStart));
            this.selectorEnd = newEnd;
        }

        this.updateOverlay();
        this.emitSelection();
    }

    /**
     * Handle mouse up
     * @private
     */
    handleMouseUp() {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragMode = null;
            this.overlay.classList.remove('dragging');
        }
    }

    /**
     * Update overlay position
     * @private
     */
    updateOverlay() {
        if (!this.overlay) return;

        const width = this.selectorEnd - this.selectorStart;
        this.overlay.style.left = `${this.selectorStart}%`;
        this.overlay.style.width = `${width}%`;
    }

    /**
     * Emit selection change event
     * @private
     */
    emitSelection() {
        if (!this.domain.min || !this.domain.max) return;

        const timeSpan = this.domain.max.getTime() - this.domain.min.getTime();
        const selectedStart = new Date(
            this.domain.min.getTime() + (timeSpan * this.selectorStart / 100)
        );
        const selectedEnd = new Date(
            this.domain.min.getTime() + (timeSpan * this.selectorEnd / 100)
        );

        this.eventBus.emit(Events.RANGE_SELECTION_CHANGED, {
            start: this.selectorStart,
            end: this.selectorEnd,
            startDate: selectedStart,
            endDate: selectedEnd
        });
    }

    /**
     * Set selector position from window bounds
     * @param {Date} startBound
     * @param {Date} endBound
     */
    setFromBounds(startBound, endBound) {
        if (!this.domain.min || !this.domain.max) return;

        const totalTimeSpan = this.domain.max.getTime() - this.domain.min.getTime();
        this.selectorStart = ((startBound.getTime() - this.domain.min.getTime()) / totalTimeSpan) * 100;
        this.selectorEnd = ((endBound.getTime() - this.domain.min.getTime()) / totalTimeSpan) * 100;

        this.updateOverlay();
    }

    /**
     * Get current selection
     * @returns {Object}
     */
    getSelection() {
        return {
            start: this.selectorStart,
            end: this.selectorEnd
        };
    }

    /**
     * Check if currently dragging
     * @returns {boolean}
     */
    isDraggingActive() {
        return this.isDragging;
    }

    /**
     * Reset selector to full range
     */
    reset() {
        this.selectorStart = 0;
        this.selectorEnd = 100;
        this.updateOverlay();
    }
}
