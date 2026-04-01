/**
 * Chess ELO Tracker - Module Index
 *
 * This file exports all modules for convenient importing.
 * The application follows SOLID principles:
 *
 * - Single Responsibility: Each class has one job
 * - Open/Closed: Classes are open for extension via EventBus
 * - Liskov Substitution: Services implement consistent interfaces
 * - Interface Segregation: Small, focused interfaces
 * - Dependency Inversion: Components depend on EventBus abstraction
 *
 * @module chess-elo-tracker
 */

// Core
export { EventBus, Events } from './core/EventBus.js';

// Configuration
export { AppConfig, DOMIds } from './config/AppConfig.js';

// Services
export { StorageService } from './services/StorageService.js';
export { ChessComApiService } from './services/ChessComApiService.js';
export { StockfishService } from './services/StockfishService.js';

// Managers
export { PlayerManager } from './managers/PlayerManager.js';
export { ChartManager } from './managers/ChartManager.js';
export { RangeChartManager } from './managers/RangeChartManager.js';
export { WeeklyGamesManager } from './managers/WeeklyGamesManager.js';

// Controllers
export { StatusController } from './controllers/StatusController.js';
export { ColorPickerController } from './controllers/ColorPickerController.js';
export { WindowController } from './controllers/WindowController.js';
export { RangeSelectorController } from './controllers/RangeSelectorController.js';
export { PlayerListController } from './controllers/PlayerListController.js';
export { CollapsibleController } from './controllers/CollapsibleController.js';
export { WeeklyGamesController } from './controllers/WeeklyGamesController.js';
export { GameModalController } from './controllers/GameModalController.js';

// Main Application
export { App } from './App.js';
