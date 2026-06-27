/**
 * ============================================================
 * Fikr Timer · Particle Engine
 * Canvas-based particle system for breathing visualization,
 * ambient effects, and timer celebrations.
 * ============================================================
 *
 * Features:
 *  - Breathing sync (particles rise on inhale, fall on exhale)
 *  - Multiple particle shapes (circle, star, heart, custom)
 *  - Color themes (match app accent or custom)
 *  - Mouse/touch interaction (particles follow/repel)
 *  - Performance optimization (adaptive particle count)
 *  - Session completion celebration burst
 *  - Smooth animation with requestAnimationFrame
 *  - Configurable density, speed, and behavior
 *
 * Usage:
 *   import { ParticleEngine } from './particles.js';
 *   const engine = new ParticleEngine(canvas);
 *   engine.start();
 *   engine.setDirection('up');  // for inhale
 *   engine.burst();             // celebration effect
 *   engine.stop();
 */

// ---------- CONFIGURATION ----------
const DEFAULT_CONFIG = {
    particleCount: 60,
    minSize: 1,
    maxSize: 4,
    minSpeed: 0.3,
    maxSpeed: 2,
    colors: ['#7c5ce7', '#a78bfa', '#c084fc', '#e9d5ff'],
    opacity: { min: 0.2, max: 0.7 },
    shapes: ['circle'],
    trailLength: 0,
    glowEffect: true,
    interactive: true,
    adaptiveQuality: true, // Reduce particles on low-end devices
};

// ---------- PARTICLE SHAPES ----------
const SHAPES = {
    circle(ctx, x, y, size) {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    },
    star(ctx, x, y, size) {
        const spikes = 5;
        const outerRadius = size;
        const innerRadius = size / 2;
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(x, y - outerRadius);
        for (let i = 0; i < spikes; i++) {
            ctx.lineTo(
                x + Math.cos(rot) * outerRadius,
                y + Math.sin(rot) * outerRadius
            );
            rot += step;
            ctx.lineTo(
                x + Math.cos(rot) * innerRadius,
                y + Math.sin(rot) * innerRadius
            );
            rot += step;
        }
        ctx.lineTo(x, y - outerRadius);
        ctx.closePath();
        ctx.fill();
    },
    heart(ctx, x, y, size) {
        const s = size * 0.7;
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.3);
        ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.3);
        ctx.bezierCurveTo(x - s, y + s * 0.7, x, y + s * 1.2, x, y + s * 1.5);
        ctx.bezierCurveTo(x, y + s * 1.2, x + s, y + s * 0.7, x + s, y + s * 0.3);
        ctx.bezierCurveTo(x + s, y, x, y, x, y + s * 0.3);
        ctx.fill();
    },
    diamond(ctx, x, y, size) {
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size * 0.7, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size * 0.7, y);
        ctx.closePath();
        ctx.fill();
    },
    ring(ctx, x, y, size) {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = size * 0.3;
    },
};

// ---------- PARTICLE ENGINE CLASS ----------
export class ParticleEngine {
    constructor(canvas, config = {}) {
        if (!canvas) {
            throw new Error('ParticleEngine requires a canvas element');
        }

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Adjust quality for low-end devices
        if (this.config.adaptiveQuality) {
            this._adaptQuality();
        }

        // Particle array
        this.particles = [];

        // Animation state
        this.animationId = null;
        this.isRunning = false;

        // Behavior
        this.direction = 'still'; // 'up' | 'down' | 'still' | 'burst'
        this.mousePosition = null;

        // Trail canvas for motion blur effect
        this.trailCanvas = null;
        this.trailCtx = null;
        if (this.config.trailLength > 0) {
            this._setupTrailCanvas();
        }

        // Resize handling
        this._resizeHandler = this._handleResize.bind(this);
        window.addEventListener('resize', this._resizeHandler);

        // Mouse/touch interaction
        if (this.config.interactive) {
            this._setupInteraction();
        }

        // Initialize
        this._resizeCanvas();
        this._createParticles();
    }

    // ---------- PUBLIC API ----------

    /**
     * Start the particle animation.
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._animate();
        return this;
    }

    /**
     * Stop the animation.
     */
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        return this;
    }

    /**
     * Set particle flow direction.
     * @param {'up'|'down'|'still'|'burst'} direction
     */
    setDirection(direction) {
        this.direction = direction;

        switch (direction) {
            case 'up':
                this.particles.forEach(p => {
                    p.targetVy = -(Math.random() * this.config.maxSpeed + this.config.minSpeed);
                    p.targetVx = p.baseVx;
                });
                break;
            case 'down':
                this.particles.forEach(p => {
                    p.targetVy = Math.random() * this.config.maxSpeed + this.config.minSpeed;
                    p.targetVx = p.baseVx;
                });
                break;
            case 'burst':
                this._burst();
                break;
            case 'still':
            default:
                this.particles.forEach(p => {
                    p.targetVy = 0;
                    p.targetVx = 0;
                });
                break;
        }
        return this;
    }

    /**
     * Trigger celebration burst.
     */
    celebrate() {
        this._burst(1.5); // More intense burst
        setTimeout(() => this.setDirection('still'), 2000);
        return this;
    }

    /**
     * Change particle colors.
     */
    setColors(colors) {
        this.config.colors = Array.isArray(colors) ? colors : [colors];
        // Update existing particles
        this.particles.forEach(p => {
            p.color = this._randomColor();
        });
        return this;
    }

    /**
     * Change particle shape.
     */
    setShape(shape) {
        if (SHAPES[shape]) {
            this.config.shapes = [shape];
        }
        return this;
    }

    /**
     * Change particle count.
     */
    setCount(count) {
        this.config.particleCount = Math.max(10, Math.min(200, count));
        this._createParticles();
        return this;
    }

    /**
     * Set opacity range.
     */
    setOpacity(min, max) {
        this.config.opacity = { min, max };
        return this;
    }

    /**
     * Clean up and destroy.
     */
    destroy() {
        this.stop();
        window.removeEventListener('resize', this._resizeHandler);
        if (this._mouseMoveHandler) {
            this.canvas.removeEventListener('mousemove', this._mouseMoveHandler);
            this.canvas.removeEventListener('touchmove', this._touchMoveHandler);
        }
        this.particles = [];
        this.ctx = null;
        this.canvas = null;
    }

    // ---------- PRIVATE METHODS ----------

    _adaptQuality() {
        // Reduce particles on mobile/low-memory devices
        const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
        const memory = navigator.deviceMemory || 4; // GB

        if (isMobile || memory < 4) {
            this.config.particleCount = Math.floor(this.config.particleCount * 0.5);
        }
        if (memory < 2) {
            this.config.particleCount = Math.floor(this.config.particleCount * 0.5);
            this.config.glowEffect = false;
        }
    }

    _resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';

        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;

        if (this.trailCtx) {
            this.trailCanvas.width = this.canvas.width;
            this.trailCanvas.height = this.canvas.height;
        }
    }

    _handleResize() {
        this._resizeCanvas();
        this._createParticles();
    }

    _setupTrailCanvas() {
        this.trailCanvas = document.createElement('canvas');
        this.trailCanvas.style.position = 'absolute';
        this.trailCanvas.style.top = '0';
        this.trailCanvas.style.left = '0';
        this.trailCanvas.style.pointerEvents = 'none';
        this.trailCanvas.style.zIndex = '0';
        this.canvas.parentElement.appendChild(this.trailCanvas);
        this.trailCtx = this.trailCanvas.getContext('2d');
    }

    _setupInteraction() {
        this._mouseMoveHandler = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePosition = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        };

        this._touchMoveHandler = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            if (touch) {
                this.mousePosition = {
                    x: touch.clientX - rect.left,
                    y: touch.clientY - rect.top,
                };
            }
        };

        this.canvas.addEventListener('mousemove', this._mouseMoveHandler);
        this.canvas.addEventListener('touchmove', this._touchMoveHandler, { passive: true });

        // Clear mouse position when leaving
        this.canvas.addEventListener('mouseleave', () => {
            this.mousePosition = null;
        });
    }

    _createParticles() {
        this.particles = [];

        for (let i = 0; i < this.config.particleCount; i++) {
            this.particles.push(this._createParticle());
        }
    }

    _createParticle(x, y) {
        const width = this.width || this.canvas.width;
        const height = this.height || this.canvas.height;

        return {
            // Position
            x: x !== undefined ? x : Math.random() * width,
            y: y !== undefined ? y : Math.random() * height,

            // Size
            size: Math.random() * (this.config.maxSize - this.config.minSize) + this.config.minSize,

            // Velocity
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            targetVx: 0,
            targetVy: 0,
            baseVx: (Math.random() - 0.5) * 0.5,
            baseVy: Math.random() * this.config.maxSpeed + this.config.minSpeed,

            // Appearance
            color: this._randomColor(),
            opacity: Math.random() * (this.config.opacity.max - this.config.opacity.min) + this.config.opacity.min,
            shape: this.config.shapes[Math.floor(Math.random() * this.config.shapes.length)] || 'circle',

            // Behavior
            life: 1,
            decay: 0.001 + Math.random() * 0.002,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.01 + Math.random() * 0.03,
        };
    }

    _randomColor() {
        const colors = this.config.colors;
        return colors[Math.floor(Math.random() * colors.length)];
    }

    _burst(intensity = 1) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        // Add burst particles
        const burstCount = Math.floor(this.config.particleCount * 0.5 * intensity);
        for (let i = 0; i < burstCount; i++) {
            const p = this._createParticle(centerX, centerY);
            const angle = (Math.PI * 2 * i) / burstCount;
            const speed = (2 + Math.random() * 4) * intensity;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.targetVx = p.vx;
            p.targetVy = p.vy;
            p.life = 1;
            p.decay = 0.008 + Math.random() * 0.015;
            p.size = Math.random() * this.config.maxSize + 2;
            p.opacity = 0.8 + Math.random() * 0.2;
            this.particles.push(p);
        }

        // Clean up old particles after burst
        setTimeout(() => {
            this.particles = this.particles.filter(p => p.life > 0);
            // Refill to maintain count
            while (this.particles.length < this.config.particleCount) {
                this.particles.push(this._createParticle());
            }
        }, 3000);
    }

    _animate() {
        if (!this.isRunning) return;

        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;

        // Clear canvas with fade effect
        if (this.config.trailLength > 0 && this.trailCtx) {
            // Trail effect
            this.trailCtx.fillStyle = `rgba(0, 0, 0, ${1 - this.config.trailLength})`;
            this.trailCtx.fillRect(0, 0, this.trailCanvas.width, this.trailCanvas.height);
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(this.trailCanvas, 0, 0);
        } else {
            ctx.clearRect(0, 0, width, height);
        }

        // Update and draw particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Smooth velocity transition
            p.vx += (p.targetVx - p.vx) * 0.08;
            p.vy += (p.targetVy - p.vy) * 0.08;

            // Add wobble
            p.wobble += p.wobbleSpeed;
            p.x += Math.sin(p.wobble) * 0.3;

            // Mouse interaction
            if (this.mousePosition) {
                const dx = p.x - this.mousePosition.x;
                const dy = p.y - this.mousePosition.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 80) {
                    const force = (80 - dist) / 80;
                    p.vx += (dx / dist) * force * 0.5;
                    p.vy += (dy / dist) * force * 0.5;
                    p.opacity = Math.min(1, p.opacity + 0.02);
                }
            }

            // Update position
            p.x += p.vx;
            p.y += p.vy;

            // Life decay
            p.life -= p.decay;

            // Wrap around edges
            if (p.x < -20) p.x = width + 20;
            if (p.x > width + 20) p.x = -20;
            if (p.y < -20) p.y = height + 20;
            if (p.y > height + 20) p.y = -20;

            // Remove dead particles
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                // Respawn
                this.particles.push(this._createParticle());
                continue;
            }

            // Draw particle
            ctx.save();
            ctx.globalAlpha = p.opacity * p.life;

            // Glow effect
            if (this.config.glowEffect) {
                ctx.shadowBlur = p.size * 3;
                ctx.shadowColor = p.color;
            }

            ctx.fillStyle = p.color;
            ctx.strokeStyle = p.color;

            const drawShape = SHAPES[p.shape] || SHAPES.circle;
            drawShape(ctx, p.x, p.y, p.size);

            ctx.restore();
        }

        // Maintain particle count
        while (this.particles.length < this.config.particleCount) {
            this.particles.push(this._createParticle());
        }

        this.animationId = requestAnimationFrame(() => this._animate());
    }

    /**
     * Get particle count (for debugging).
     */
    getParticleCount() {
        return this.particles.length;
    }

    /**
     * Get current FPS estimate.
     */
    getFPS() {
        if (!this._lastFrameTime) return 60;
        const now = performance.now();
        const fps = 1000 / (now - this._lastFrameTime);
        this._lastFrameTime = now;
        return Math.round(fps);
    }
}

// ---------- HELPER: Initialize particles on a canvas ----------
export function initParticles(canvas, config = {}) {
    const engine = new ParticleEngine(canvas, config);
    engine.start();
    return engine;
}

// ---------- HELPER: Breathing particle controller ----------
export function createBreathingParticles(canvas) {
    const engine = new ParticleEngine(canvas, {
        particleCount: 50,
        colors: ['#7c5ce7', '#a78bfa', '#c084fc'],
        minSize: 1,
        maxSize: 3,
        glowEffect: true,
        interactive: false,
    });

    return {
        engine,
        onInhale() {
            engine.setDirection('up');
        },
        onExhale() {
            engine.setDirection('down');
        },
        onHold() {
            engine.setDirection('still');
        },
        celebrate() {
            engine.celebrate();
        },
        start() {
            engine.start();
        },
        stop() {
            engine.stop();
        },
        destroy() {
            engine.destroy();
        },
    };
}

export default ParticleEngine;
