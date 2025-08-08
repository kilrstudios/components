/**
 * Marquee.js
 * A lightweight marquee scrolling implementation
 * @version 1.1.4
 * @author Your Name
 * @license MIT
 */

class MarqueeInstance {
    constructor(container) {
        this.container = container;
        this.position = 0;
        this.animationFrame = null;
        this.init();
    }

    init() {
        // Find or create the track element
        this.track = this.container.querySelector('[kilr-marquee="track"]');
        if (!this.track) {
            this.track = document.createElement('div');
            this.track.setAttribute('kilr-marquee', 'track');
            // Move all direct children into the track
            while (this.container.firstChild) {
                this.track.appendChild(this.container.firstChild);
            }
            this.container.appendChild(this.track);
        }

        // Get all items and ensure proper styling
        const items = this.track.querySelectorAll('[kilr-marquee="item"]');
        if (items.length === 0) {
            // If no items are explicitly marked, wrap content in items
            const content = this.track.innerHTML;
            this.track.innerHTML = `<div kilr-marquee="item">${content}</div>`;
        }

        // Set up styles
        this.container.style.overflow = 'hidden';
        this.container.style.display = 'flex';
        this.container.style.width = '100%';
        
        this.track.style.display = 'flex';
        this.track.style.flexShrink = '0';
        this.track.style.gap = '1rem';
        this.track.style.whiteSpace = 'nowrap';

        // Style all items
        this.track.querySelectorAll('[kilr-marquee="item"]').forEach(item => {
            item.style.display = 'flex';
            item.style.flexShrink = '0';
            item.style.alignItems = 'center';
        });

        // Clone items for seamless scrolling
        const originalContent = this.track.innerHTML;
        this.track.innerHTML = `${originalContent}${originalContent}${originalContent}`;

        // Get scroll direction and speed
        this.direction = this.container.dataset.direction || 'left';
        this.speed = this.parseSpeed();
        
        // Calculate the width of one set of items
        this.itemSetWidth = this.track.scrollWidth / 3;
        
        // Start animation
        this.animate();
    }

    parseSpeed() {
        const baseSpeed = parseFloat(this.container.dataset.speed);
        if (isNaN(baseSpeed)) return 1;
        return Math.max(0.1, Math.min(baseSpeed, 5));
    }

    animate() {
        if (this.direction === 'left') {
            this.position -= this.speed;
            if (Math.abs(this.position) >= this.itemSetWidth) {
                this.position = 0;
            }
        } else {
            this.position += this.speed;
            if (this.position >= this.itemSetWidth) {
                this.position = 0;
            }
        }
        
        this.track.style.transform = `translateX(${this.position}px)`;
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }

    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }
}

class Marquee {
    static VERSION = '1.1.4';
    
    constructor() {
        this.version = Marquee.VERSION;
        this.instances = new Map();
        this.init();
    }

    /**
     * Get current version
     * @returns {string} Current version number
     */
    getVersion() {
        return this.version;
    }

    /**
     * Check if version meets minimum requirement
     * @param {string} minVersion - Minimum version required
     * @returns {boolean} Whether current version meets requirement
     */
    static checkVersion(minVersion) {
        const current = Marquee.VERSION.split('.').map(Number);
        const required = minVersion.split('.').map(Number);
        
        for (let i = 0; i < 3; i++) {
            if (current[i] > required[i]) return true;
            if (current[i] < required[i]) return false;
        }
        return true;
    }

    init() {
        // Clean up any existing instances
        this.destroy();

        // Initialize new instances
        const containers = document.querySelectorAll('[kilr-marquee="container"]');
        containers.forEach(container => {
            const instance = new MarqueeInstance(container);
            this.instances.set(container, instance);
        });
    }

    destroy() {
        this.instances.forEach(instance => instance.destroy());
        this.instances.clear();
    }
}

// Initialize marquee when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Marquee();
});
