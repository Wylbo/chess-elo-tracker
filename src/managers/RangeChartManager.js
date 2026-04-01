import { AppConfig } from '../config/AppConfig.js';
import { Events } from '../core/EventBus.js';

/**
 * RangeChartManager - Manages the range selector mini-chart
 * Single Responsibility: Range chart rendering
 */
export class RangeChartManager {
    constructor(eventBus, canvasElement, overlayElement) {
        this.eventBus = eventBus;
        this.canvas = canvasElement;
        this.overlay = overlayElement;
        this.chart = null;
        this.selectorStart = 0;
        this.selectorEnd = 100;
    }

    /**
     * Initialize the range chart
     */
    initialize() {
        this.chart = new Chart(this.canvas, {
            type: 'line',
            data: { datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                scales: {
                    x: { type: 'time', display: false },
                    y: { display: false }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                interaction: { mode: 'nearest', intersect: false }
            }
        });

        return this;
    }

    /**
     * Update range chart with player data
     * @param {Array} players - Player data
     * @param {Object} domain - Data domain
     */
    update(players, domain) {
        if (!this.chart) return;

        if (!players.length || !domain.min || !domain.max) {
            this.clear();
            return;
        }

        const config = AppConfig.RANGE_CHART;
        const datasets = [];

        players.forEach(player => {
            if (!player.visible || player.disabled || !player.data?.length) return;

            const data = player.data.map(p => ({ x: p.date, y: p.rating }));
            datasets.push({
                label: player.displayName,
                data,
                borderColor: player.color,
                backgroundColor: player.color + '33',
                tension: AppConfig.CHART.LINE_TENSION,
                borderWidth: config.LINE_WIDTH,
                pointRadius: config.POINT_RADIUS,
                pointHoverRadius: config.POINT_RADIUS,
                fill: false,
                spanGaps: true
            });
        });

        this.chart.options.scales.x.min = domain.min;
        this.chart.options.scales.x.max = domain.max;
        this.chart.data.datasets = datasets;
        this.chart.update('none');
        // Note: Overlay is managed by RangeSelectorController
    }

    /**
     * Update selector position
     * @param {number} start - Start percentage (0-100)
     * @param {number} end - End percentage (0-100)
     */
    setSelector(start, end) {
        this.selectorStart = start;
        this.selectorEnd = end;
        this.updateOverlay();
    }

    /**
     * Update the range overlay position
     */
    updateOverlay() {
        if (!this.overlay) return;

        const width = this.selectorEnd - this.selectorStart;
        this.overlay.style.left = `${this.selectorStart}%`;
        this.overlay.style.width = `${width}%`;
    }

    /**
     * Get selector bounds
     * @returns {Object}
     */
    getSelector() {
        return {
            start: this.selectorStart,
            end: this.selectorEnd
        };
    }

    /**
     * Clear the range chart
     */
    clear() {
        if (this.chart) {
            this.chart.data.datasets = [];
            this.chart.update('none');
        }
        // Note: Overlay is managed by RangeSelectorController
    }

    /**
     * Resize the chart
     */
    resize() {
        this.chart?.resize();
    }

    /**
     * Destroy the chart
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}
