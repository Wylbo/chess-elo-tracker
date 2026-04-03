import { AppConfig } from '../config/AppConfig.js';
import { Events } from '../core/EventBus.js';

/**
 * ChartManager - Manages the main ELO chart
 * Single Responsibility: Chart rendering and updates
 */
export class ChartManager {
    constructor(eventBus, canvasElement) {
        this.eventBus = eventBus;
        this.canvas = canvasElement;
        this.chart = null;
        this.setupEventListeners();
    }

    /**
     * Initialize the Chart.js instance
     */
    initialize() {
        const config = AppConfig.CHART;

        const lineGlowPlugin = {
            id: 'lineGlow',
            beforeDatasetDraw(chart, args) {
                const color = chart.data.datasets[args.index]?.borderColor ?? 'transparent';
                chart.ctx.save();
                chart.ctx.shadowBlur = 8;
                chart.ctx.shadowColor = color;
            },
            afterDatasetDraw(chart) {
                chart.ctx.restore();
            }
        };

        this.chart = new Chart(this.canvas, {
            type: 'line',
            data: { datasets: [] },
            plugins: [lineGlowPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: config.ANIMATION_DURATION },
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'week', tooltipFormat: 'MMM d, yyyy' },
                        grid: { color: config.GRID_COLOR },
                        ticks: { color: config.TICK_COLOR }
                    },
                    y: {
                        grid: { color: config.GRID_COLOR },
                        ticks: { color: config.TICK_COLOR }
                    }
                },
                plugins: {
                    legend: { display: true },
                    tooltip: {
                        backgroundColor: config.TOOLTIP_BG,
                        borderColor: config.TOOLTIP_BORDER,
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue}`
                        }
                    }
                },
                interaction: { mode: 'nearest', intersect: false }
            }
        });

        return this;
    }

    /**
     * Setup event listeners
     * @private
     */
    setupEventListeners() {
        this.eventBus.on(Events.CHART_UPDATE_REQUESTED, (data) => {
            this.update(data);
        });
    }

    /**
     * Update chart with new data
     * @param {Object} params - Update parameters
     */
    update({ players, startBound, endBound }) {
        if (!this.chart) return;

        const datasets = [];
        const config = AppConfig.CHART;

        players.forEach(player => {
            if (!player.visible || player.disabled || !player.data?.length) return;

            const data = this.buildWindowedSeries(player.data, startBound, endBound);
            if (!data.length) return;

            const chartArea = this.chart.chartArea;
            let fill;
            if (chartArea) {
                const gradient = this.canvas.getContext('2d').createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                gradient.addColorStop(0, player.color + '40');
                gradient.addColorStop(1, player.color + '00');
                fill = gradient;
            } else {
                fill = player.color + '22';
            }

            datasets.push({
                label: player.displayName,
                data,
                borderColor: player.color,
                backgroundColor: fill,
                tension: config.LINE_TENSION,
                borderWidth: config.LINE_WIDTH,
                pointRadius: config.POINT_RADIUS,
                pointHoverRadius: config.POINT_HOVER_RADIUS,
                fill: true,
                spanGaps: true
            });
        });

        this.chart.options.scales.x.min = startBound || undefined;
        this.chart.options.scales.x.max = endBound || undefined;
        this.chart.data.datasets = datasets;
        this.chart.update('active');
    }

    /**
     * Build windowed data series for chart
     * @param {Array} points - All data points
     * @param {Date} startBound - Window start
     * @param {Date} endBound - Window end
     * @returns {Array} Windowed data points
     */
    buildWindowedSeries(points, startBound, endBound) {
        if (!points?.length) return [];

        const inRange = [];
        let carry = null;
        let nextPoint = null;

        for (const point of points) {
            if (point.date < startBound) {
                carry = point;
                continue;
            }
            if (point.date > endBound) {
                nextPoint = point;
                break;
            }
            inRange.push(point);
        }

        // If no points in range but we have points before and after, draw a line
        if (inRange.length === 0 && carry && nextPoint) {
            return [
                { x: new Date(startBound), y: carry.rating },
                { x: new Date(endBound), y: nextPoint.rating }
            ];
        }

        // Anchor line to window start if player has earlier data
        if (carry && inRange.length) {
            inRange.unshift({ date: new Date(startBound), rating: carry.rating });
        }

        // Anchor line to window end if player has later data
        if (nextPoint && inRange.length) {
            inRange.push({ date: new Date(endBound), rating: nextPoint.rating });
        }

        return inRange.map(p => ({ x: p.date, y: p.rating }));
    }

    /**
     * Clear the chart
     */
    clear() {
        if (this.chart) {
            this.chart.options.scales.x.min = undefined;
            this.chart.options.scales.x.max = undefined;
            this.chart.data.datasets = [];
            this.chart.update('none');
        }
    }

    /**
     * Resize the chart
     */
    resize() {
        this.chart?.resize();
    }

    /**
     * Destroy the chart instance
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}
