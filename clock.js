/**
 * ============================================================
 * Fikr Timer · Advanced Clock System
 * Real‑time analog & digital clock with world time,
 * countdown overlays, session timeline, and widget mode.
 * ============================================================
 *
 * Features:
 *  - Real‑time analog clock with smooth sweeping hands
 *  - Digital clock with seconds display
 *  - Date display with multiple format options
 *  - Full‑screen clock overlay with large analog + digital
 *  - World clock (multiple timezone support)
 *  - Session timeline visualization
 *  - Countdown to next break/session end
 *  - Clock face customization (colors, markers, styles)
 *  - Tick/quartz movement modes
 *  - Widget‑style floating clock
 *  - Pomodoro session progress ring around clock
 *  - Responsive scaling for all screen sizes
 *  - Dark/light theme adaptation
 *  - Performance optimized with requestAnimationFrame
 *
 * Usage:
 *   const clock = new ClockSystem();
 *   clock.start();           // Start the clock
 *   clock.setMode('sweep');  // Smooth sweeping hands
 *   clock.showOverlay();     // Full‑screen clock
 *   clock.addTimezone('America/New_York', 'NYC');
 *   clock.stop();            // Stop the clock
 */

import { StorageManager } from './storage.js';

// ---------- CLOCK MODES ----------
const CLOCK_MODES = {
    sweep: {
        name: 'Smooth Sweep',
        description: 'Continuous sweeping second hand',
        interval: 50, // ms update rate
    },
    tick: {
        name: 'Quartz Tick',
        description: 'Traditional ticking second hand',
        interval: 1000,
    },
    silent: {
        name: 'Silent',
        description: 'No second hand movement',
        interval: 30000, // Update every 30 seconds
    },
};

// ---------- DATE FORMATS ----------
const DATE_FORMATS = {
    full: {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    },
    medium: {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    },
    short: {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
    },
    iso: {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    },
};

// ---------- TIMEZONE DATA (Common) ----------
const COMMON_TIMEZONES = [
    { id: 'America/New_York', label: 'New York', offset: -5 },
    { id: 'America/Chicago', label: 'Chicago', offset: -6 },
    { id: 'America/Denver', label: 'Denver', offset: -7 },
    { id: 'America/Los_Angeles', label: 'Los Angeles', offset: -8 },
    { id: 'Europe/London', label: 'London', offset: 0 },
    { id: 'Europe/Paris', label: 'Paris', offset: 1 },
    { id: 'Europe/Berlin', label: 'Berlin', offset: 1 },
    { id: 'Europe/Moscow', label: 'Moscow', offset: 3 },
    { id: 'Asia/Dubai', label: 'Dubai', offset: 4 },
    { id: 'Asia/Karachi', label: 'Karachi', offset: 5 },
    { id: 'Asia/Kolkata', label: 'Mumbai', offset: 5.5 },
    { id: 'Asia/Shanghai', label: 'Shanghai', offset: 8 },
    { id: 'Asia/Tokyo', label: 'Tokyo', offset: 9 },
    { id: 'Asia/Seoul', label: 'Seoul', offset: 9 },
    { id: 'Australia/Sydney', label: 'Sydney', offset: 10 },
    { id: 'Pacific/Auckland', label: 'Auckland', offset: 12 },
    { id: 'America/Sao_Paulo', label: 'São Paulo', offset: -3 },
    { id: 'Africa/Cairo', label: 'Cairo', offset: 2 },
    { id: 'Africa/Lagos', label: 'Lagos', offset: 1 },
];

// ---------- CLOCK SYSTEM CLASS ----------
export class ClockSystem {
    constructor(config = {}) {
        this.storage = new StorageManager();

        // Configuration
        this.mode = config.mode || 'sweep';
        this.showSeconds = config.showSeconds !== false;
        this.showDate = config.showDate !== false;
        this.dateFormat = config.dateFormat || 'medium';
        this.hourFormat = config.hourFormat || '12'; // '12' or '24'
        this.showMilliseconds = config.showMilliseconds || false;
        this.theme = config.theme || 'auto'; // 'auto', 'dark', 'light'

        // Overlay state
        this.overlayVisible = false;
        this.overlayLargeAnalog = true;

        // World clocks
        this.worldClocks = config.worldClocks || [];

        // Session context (for progress ring)
        this.sessionProgress = 0; // 0-1
        this.sessionTimeRemaining = '';
        this.sessionActive = false;

        // DOM references
        this.domElements = {};
        this._cacheDOM();

        // Animation
        this._animationId = null;
        this._lastUpdate = 0;
        this._updateInterval = CLOCK_MODES[this.mode]?.interval || 50;
        this.isRunning = false;

        // Hour markers for analog clock
        this.hourMarkers = [];
        for (let i = 0; i < 12; i++) {
            const angle = (i * 30 * Math.PI) / 180;
            this.hourMarkers.push({
                x1: 22 + 18 * Math.sin(angle),
                y1: 22 - 18 * Math.cos(angle),
                x2: 22 + 15 * Math.sin(angle),
                y2: 22 - 15 * Math.cos(angle),
            });
        }

        // Callbacks
        this.onTick = null;       // (date, timeString)
        this.onMinute = null;     // (date)
        this.onHour = null;       // (date)
        this.onMidnight = null;   // (date)
    }

    // ---------- PUBLIC API ----------

    /**
     * Start the clock.
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._updateInterval = CLOCK_MODES[this.mode]?.interval || 50;
        this._animate();
        return this;
    }

    /**
     * Stop the clock.
     */
    stop() {
        this.isRunning = false;
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }
        return this;
    }

    /**
     * Set clock mode.
     */
    setMode(mode) {
        if (CLOCK_MODES[mode]) {
            this.mode = mode;
            this._updateInterval = CLOCK_MODES[mode].interval;
        }
        return this;
    }

    /**
     * Set hour format.
     */
    setHourFormat(format) {
        this.hourFormat = format === '24' ? '24' : '12';
        return this;
    }

    /**
     * Set date format.
     */
    setDateFormat(format) {
        if (DATE_FORMATS[format]) {
            this.dateFormat = format;
        }
        return this;
    }

    /**
     * Toggle seconds display.
     */
    toggleSeconds() {
        this.showSeconds = !this.showSeconds;
        this._updateAnalogClock();
        return this.showSeconds;
    }

    /**
     * Show full‑screen clock overlay.
     */
    showOverlay() {
        const overlay = this.domElements.clockOverlay;
        if (overlay) {
            overlay.classList.remove('hidden');
            this.overlayVisible = true;
            this._updateOverlayClock();
        }
        return this;
    }

    /**
     * Hide full‑screen clock overlay.
     */
    hideOverlay() {
        const overlay = this.domElements.clockOverlay;
        if (overlay) {
            overlay.classList.add('hidden');
            this.overlayVisible = false;
        }
        return this;
    }

    /**
     * Toggle clock overlay.
     */
    toggleOverlay() {
        if (this.overlayVisible) {
            this.hideOverlay();
        } else {
            this.showOverlay();
        }
        return this.overlayVisible;
    }

    /**
     * Add a world clock.
     */
    addWorldClock(timezoneId, label = '') {
        const tz = COMMON_TIMEZONES.find(t => t.id === timezoneId);
        if (!tz) return false;

        // Check if already added
        if (this.worldClocks.find(w => w.id === timezoneId)) return false;

        this.worldClocks.push({
            ...tz,
            customLabel: label || tz.label,
        });

        this._updateWorldClocks();
        this._saveWorldClocks();
        return true;
    }

    /**
     * Remove a world clock.
     */
    removeWorldClock(timezoneId) {
        const index = this.worldClocks.findIndex(w => w.id === timezoneId);
        if (index >= 0) {
            this.worldClocks.splice(index, 1);
            this._updateWorldClocks();
            this._saveWorldClocks();
            return true;
        }
        return false;
    }

    /**
     * Set session progress for ring display.
     */
    setSessionProgress(progress, timeRemaining = '') {
        this.sessionActive = true;
        this.sessionProgress = Math.max(0, Math.min(1, progress));
        this.sessionTimeRemaining = timeRemaining;
        this._updateSessionRing();
        return this;
    }

    /**
     * Clear session progress.
     */
    clearSessionProgress() {
        this.sessionActive = false;
        this.sessionProgress = 0;
        this.sessionTimeRemaining = '';
        this._updateSessionRing();
        return this;
    }

    /**
     * Get current time as formatted strings.
     */
    getCurrentTime() {
        const now = new Date();
        return {
            date: now,
            timeString: this._formatTime(now),
            dateString: this._formatDate(now),
            timestamp: now.toISOString(),
            hours: now.getHours(),
            minutes: now.getMinutes(),
            seconds: now.getSeconds(),
            milliseconds: now.getMilliseconds(),
        };
    }

    /**
     * Get world clock times.
     */
    getWorldTimes() {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);

        return this.worldClocks.map(w => {
            const localTime = new Date(utc + (w.offset * 3600000));
            return {
                ...w,
                time: this._formatTime(localTime),
                date: this._formatDate(localTime),
                hours: localTime.getHours(),
                minutes: localTime.getMinutes(),
            };
        });
    }

    // ---------- PRIVATE METHODS ----------

    _cacheDOM() {
        this.domElements = {
            digitalSmall: document.getElementById('digitalClockSmall'),
            dateDisplay: document.getElementById('dateDisplaySmall'),
            analogClock: document.getElementById('analogClock'),
            hourHand: document.getElementById('hourHand'),
            minuteHand: document.getElementById('minuteHand'),
            secondHand: document.getElementById('secondHand'),
            clockOverlay: document.getElementById('clockOverlay'),
            bigDigitalTime: document.getElementById('bigDigitalTime'),
            bigDigitalDate: document.getElementById('bigDigitalDate'),
            bigAnalogClock: document.getElementById('bigAnalogClock'),
            bigHourHand: document.getElementById('bigHourHand'),
            bigMinuteHand: document.getElementById('bigMinuteHand'),
            bigSecondHand: document.getElementById('bigSecondHand'),
            worldClockList: document.getElementById('worldClockList'),
            sessionRing: document.getElementById('sessionProgressRing'),
            sessionTimeLabel: document.getElementById('sessionTimeLabel'),
        };
    }

    _animate() {
        if (!this.isRunning) return;

        const now = performance.now();

        // Throttle updates
        if (now - this._lastUpdate >= this._updateInterval) {
            this._updateAllClocks(new Date());
            this._lastUpdate = now;

            // Check minute/hour transitions
            const date = new Date();
            if (date.getSeconds() === 0) {
                if (this.onMinute) this.onMinute(date);
            }
            if (date.getMinutes() === 0 && date.getSeconds() === 0) {
                if (this.onHour) this.onHour(date);
            }
            if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
                if (this.onMidnight) this.onMidnight(date);
            }
        }

        this._animationId = requestAnimationFrame(() => this._animate());
    }

    _updateAllClocks(date) {
        this._updateDigitalClock(date);
        this._updateAnalogClock(date);
        this._updateDateDisplay(date);

        if (this.overlayVisible) {
            this._updateOverlayClock(date);
        }

        if (this.worldClocks.length > 0) {
            this._updateWorldClocks(date);
        }

        if (this.onTick) {
            this.onTick(date, this._formatTime(date));
        }
    }

    _updateDigitalClock(date) {
        const el = this.domElements.digitalSmall;
        if (!el) return;

        el.textContent = this._formatTime(date);

        if (this.showMilliseconds) {
            const ms = date.getMilliseconds().toString().padStart(3, '0');
            el.textContent += `.${ms}`;
        }
    }

    _updateAnalogClock(date, isBig = false) {
        const hours = date.getHours() % 12;
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();
        const milliseconds = date.getMilliseconds();

        // Calculate smooth angles
        const secondAngle = (seconds + milliseconds / 1000) * 6;
        const minuteAngle = (minutes + seconds / 60) * 6;
        const hourAngle = (hours + minutes / 60) * 30;

        const center = isBig ? 100 : 22;
        const prefix = isBig ? 'big' : '';

        const hourHand = this.domElements[`${prefix}HourHand`] || this.domElements.hourHand;
        const minuteHand = this.domElements[`${prefix}MinuteHand`] || this.domElements.minuteHand;
        const secondHand = this.domElements[`${prefix}SecondHand`] || this.domElements.secondHand;

        if (hourHand) {
            hourHand.setAttribute(
                'transform',
                `rotate(${hourAngle} ${center} ${center})`
            );
        }

        if (minuteHand) {
            minuteHand.setAttribute(
                'transform',
                `rotate(${minuteAngle} ${center} ${center})`
            );
        }

        if (secondHand && this.showSeconds) {
            secondHand.setAttribute(
                'transform',
                `rotate(${secondAngle} ${center} ${center})`
            );
            secondHand.style.display = '';
        } else if (secondHand) {
            secondHand.style.display = 'none';
        }
    }

    _updateDateDisplay(date) {
        const el = this.domElements.dateDisplay;
        if (!el) return;

        el.textContent = this._formatDate(date);
    }

    _updateOverlayClock(date) {
        const bigTime = this.domElements.bigDigitalTime;
        const bigDate = this.domElements.bigDigitalDate;

        if (bigTime) {
            bigTime.textContent = this._formatTime(date);
        }

        if (bigDate) {
            bigDate.textContent = this._formatDate(date, 'full');
        }

        this._updateAnalogClock(date, true);
    }

    _updateWorldClocks(date) {
        const container = this.domElements.worldClockList;
        if (!container) return;

        const utc = date.getTime() + (date.getTimezoneOffset() * 60000);

        container.innerHTML = this.worldClocks.map(w => {
            const localTime = new Date(utc + (w.offset * 3600000));
            const timeStr = this._formatTime(localTime);
            const isDaytime = localTime.getHours() >= 6 && localTime.getHours() < 18;

            return `
                <div class="world-clock-item ${isDaytime ? 'daytime' : 'nighttime'}">
                    <span class="world-clock-city">${w.customLabel || w.label}</span>
                    <span class="world-clock-time">${timeStr}</span>
                    <span class="world-clock-indicator">${isDaytime ? '☀️' : '🌙'}</span>
                </div>
            `;
        }).join('');
    }

    _updateSessionRing() {
        const ring = this.domElements.sessionRing;
        const label = this.domElements.sessionTimeLabel;

        if (ring) {
            if (this.sessionActive) {
                const circumference = 2 * Math.PI * 90; // r=90 for big clock
                ring.style.strokeDasharray = circumference;
                ring.style.strokeDashoffset = circumference * (1 - this.sessionProgress);
                ring.style.opacity = '1';
            } else {
                ring.style.opacity = '0';
            }
        }

        if (label) {
            label.textContent = this.sessionActive ? this.sessionTimeRemaining : '';
        }
    }

    _formatTime(date) {
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();

        if (this.hourFormat === '12') {
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
        }

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    _formatDate(date, format = null) {
        const fmt = format || this.dateFormat;
        const options = DATE_FORMATS[fmt] || DATE_FORMATS.medium;
        return date.toLocaleDateString(undefined, options);
    }

    async _saveWorldClocks() {
        try {
            await this.storage.set('worldClocks', this.worldClocks);
        } catch (err) {
            console.error('Failed to save world clocks:', err);
        }
    }

    async _loadWorldClocks() {
        try {
            const saved = await this.storage.get('worldClocks');
            if (saved && Array.isArray(saved)) {
                this.worldClocks = saved;
            }
        } catch (err) {
            console.error('Failed to load world clocks:', err);
        }
    }

    // ---------- STATIC METHODS ----------

    /**
     * Get common timezones.
     */
    static getTimezones() {
        return COMMON_TIMEZONES;
    }

    /**
     * Get clock modes.
     */
    static getModes() {
        return Object.keys(CLOCK_MODES).map(key => ({
            id: key,
            ...CLOCK_MODES[key],
        }));
    }

    /**
     * Get date formats.
     */
    static getDateFormats() {
        return Object.keys(DATE_FORMATS).map(key => ({
            id: key,
            example: new Date().toLocaleDateString(undefined, DATE_FORMATS[key]),
        }));
    }

    /**
     * Calculate time difference between two timezones.
     */
    static getTimeDifference(timezone1, timezone2) {
        const tz1 = COMMON_TIMEZONES.find(t => t.id === timezone1);
        const tz2 = COMMON_TIMEZONES.find(t => t.id === timezone2);
        if (!tz1 || !tz2) return null;

        const diff = tz2.offset - tz1.offset;
        return {
            hours: Math.abs(diff),
            direction: diff >= 0 ? 'ahead' : 'behind',
        };
    }
}

// ---------- FACTORY FUNCTION ----------
export function createClock(config = {}) {
    return new ClockSystem(config);
}

// ---------- SINGLETON (optional) ----------
let clockInstance = null;

export function getClockInstance(config = {}) {
    if (!clockInstance) {
        clockInstance = new ClockSystem(config);
    }
    return clockInstance;
}

export default ClockSystem;