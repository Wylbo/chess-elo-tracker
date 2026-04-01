/**
 * CollapsibleController - Manages collapsible section animations
 * Single Responsibility: Collapsible section UI behavior
 */
export class CollapsibleController {
    constructor(triggerElement, bodyElement) {
        this.trigger = triggerElement;
        this.body = bodyElement;
        this.expanded = true;
        this.transitionHandler = null;
    }

    /**
     * Initialize the collapsible section
     * @param {boolean} initialExpanded - Initial expanded state
     */
    initialize(initialExpanded = true) {
        this.expanded = initialExpanded;

        if (this.trigger) {
            this.trigger.addEventListener('click', () => this.toggle());
        }

        this.apply({ animate: false });
        return this;
    }

    /**
     * Toggle expanded state
     */
    toggle() {
        this.expanded = !this.expanded;
        this.apply();
    }

    /**
     * Set expanded state
     * @param {boolean} expanded
     * @param {Object} options
     */
    setExpanded(expanded, options = {}) {
        this.expanded = expanded;
        this.apply(options);
    }

    /**
     * Check if expanded
     * @returns {boolean}
     */
    isExpanded() {
        return this.expanded;
    }

    /**
     * Apply collapse/expand animation
     * @param {Object} options
     */
    apply(options = {}) {
        const { animate = true } = options;

        if (!this.trigger || !this.body) return;

        this.trigger.setAttribute('aria-expanded', this.expanded);

        const chevron = this.trigger.querySelector('.chevron');
        if (chevron) {
            chevron.textContent = this.expanded ? 'v' : '>';
        }

        // Clean up previous transition handler
        if (this.transitionHandler) {
            this.body.removeEventListener('transitionend', this.transitionHandler);
            this.transitionHandler = null;
        }

        if (!animate) {
            this.applyInstant();
            return;
        }

        this.applyAnimated();
    }

    /**
     * Apply instant state change without animation
     * @private
     */
    applyInstant() {
        this.body.style.transition = 'none';
        this.body.classList.toggle('collapsed', !this.expanded);
        this.body.style.height = this.expanded ? 'auto' : '0px';
        this.body.style.opacity = this.expanded ? '1' : '0';

        // Force reflow
        this.body.offsetHeight;

        this.body.style.transition = '';
    }

    /**
     * Apply animated state change
     * @private
     */
    applyAnimated() {
        const startHeight = this.body.getBoundingClientRect().height;
        const endHeight = this.expanded ? this.body.scrollHeight : 0;

        if (this.expanded) {
            this.body.classList.remove('collapsed');
        }

        this.body.style.height = `${startHeight}px`;
        this.body.style.opacity = this.expanded ? '0' : '1';

        // Force reflow
        this.body.offsetHeight;

        this.transitionHandler = (event) => {
            if (event.propertyName !== 'height') return;

            this.body.removeEventListener('transitionend', this.transitionHandler);
            this.transitionHandler = null;

            if (this.expanded) {
                this.body.style.height = 'auto';
                this.body.style.opacity = '1';
            } else {
                this.body.classList.add('collapsed');
                this.body.style.height = '0px';
                this.body.style.opacity = '0';
            }
        };

        this.body.addEventListener('transitionend', this.transitionHandler);

        requestAnimationFrame(() => {
            this.body.style.height = `${endHeight}px`;
            this.body.style.opacity = this.expanded ? '1' : '0';
        });
    }
}
