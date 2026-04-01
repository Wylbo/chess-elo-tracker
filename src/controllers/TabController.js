/**
 * TabController - Manages a tab bar switching between named panels.
 * Purely local UI state — no EventBus involvement.
 */
export class TabController {
    /**
     * @param {NodeList|Element[]} tabButtons - Buttons with data-tab attribute
     * @param {NodeList|Element[]} tabPanels  - Divs with data-tab attribute
     */
    constructor(tabButtons, tabPanels) {
        this.tabButtons = Array.from(tabButtons);
        this.tabPanels = Array.from(tabPanels);
        this.activeTab = null;
    }

    /**
     * Bind click handlers and activate the default tab.
     * @param {string} [defaultTab] - data-tab value to activate first; defaults to first button
     */
    initialize(defaultTab = null) {
        this.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => this.setActiveTab(btn.dataset.tab));
        });
        const first = defaultTab ?? this.tabButtons[0]?.dataset.tab;
        if (first) this.setActiveTab(first);
        return this;
    }

    /**
     * Activate a tab by name.
     * @param {string} name - data-tab value
     */
    setActiveTab(name) {
        this.activeTab = name;
        this.tabButtons.forEach(btn => {
            btn.classList.toggle('tab-btn-active', btn.dataset.tab === name);
        });
        this.tabPanels.forEach(panel => {
            panel.classList.toggle('hidden', panel.dataset.tab !== name);
        });
    }
}
