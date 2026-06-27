/**
 * ============================================================
 * Fikr Timer · Custom Timer Builder Module
 * Fully customizable timer with drag‑and‑drop phase builder,
 * preset saving, sharing, and advanced configuration.
 * ============================================================
 *
 * Features:
 *  - Custom name, icon, and color for each timer
 *  - Multi‑phase builder (Focus, Break, Long Break, Custom Phase)
 *  - Unlimited phases with individual durations
 *  - Phase types: Focus, Short Break, Long Break, Preparation, Cool Down
 *  - Save custom presets to library
 *  - Load, edit, and delete saved presets
 *  - Import/Export presets as JSON
 *  - Share presets via URL or clipboard
 *  - Default presets included (Meditation, Study, Creative Work, etc.)
 *  - Per‑phase sound and notification settings
 *  - Auto‑start and auto‑repeat options
 *  - Phase transition warnings
 *  - Custom color coding per phase
 *
 * Usage:
 *   const customTimer = new CustomTimerEngine();
 *   customTimer.addPhase('Focus', 25, 'focus');
 *   customTimer.addPhase('Short Break', 5, 'break');
 *   customTimer.setName('My Study Timer');
 *   customTimer.savePreset();
 *   customTimer.start();
 */

import { playSound, formatTime, generateId } from '../utils.js';
import { StorageManager } from '../storage.js';

// ---------- PHASE TYPES ----------
const PHASE_TYPES = {
    focus: {
        id: 'focus',
        name: 'Focus',
        icon: '🎯',
        description: 'Deep concentration period',
        defaultColor: '#7c5ce7',
        defaultDuration: 25, // minutes
    },
    shortBreak: {
        id: 'shortBreak',
        name: 'Short Break',
        icon: '☕',
        description: 'Quick rest between focus sessions',
        defaultColor: '#4ade80',
        defaultDuration: 5,
    },
    longBreak: {
        id: 'longBreak',
        name: 'Long Break',
        icon: '🌿',
        description: 'Extended rest period',
        defaultColor: '#10b981',
        defaultDuration: 15,
    },
    preparation: {
        id: 'preparation',
        name: 'Preparation',
        icon: '📋',
        description: 'Get ready and set intentions',
        defaultColor: '#f59e0b',
        defaultDuration: 2,
    },
    coolDown: {
        id: 'coolDown',
        name: 'Cool Down',
        icon: '🧘',
        description: 'Reflect and transition out',
        defaultColor: '#3b82f6',
        defaultDuration: 3,
    },
    custom: {
        id: 'custom',
        name: 'Custom Phase',
        icon: '⚙️',
        description: 'User‑defined phase',
        defaultColor: '#a78bfa',
        defaultDuration: 10,
    },
};

// ---------- DEFAULT PRESETS ----------
const DEFAULT_PRESETS = [
    {
        id: 'meditation',
        name: 'Guided Meditation',
        icon: '🧘',
        color: '#7c5ce7',
        description: '20‑minute meditation with preparation and reflection',
        phases: [
            { type: 'preparation', duration: 2, label: 'Settle In' },
            { type: 'focus', duration: 15, label: 'Meditation' },
            { type: 'coolDown', duration: 3, label: 'Reflection' },
        ],
        repeat: 1,
        autoStart: false,
    },
    {
        id: 'studySession',
        name: 'Study Session',
        icon: '📚',
        color: '#3b82f6',
        description: '50/10 study blocks with a long break after 4 rounds',
        phases: [
            { type: 'focus', duration: 50, label: 'Study' },
            { type: 'shortBreak', duration: 10, label: 'Break' },
        ],
        repeat: 4,
        autoStart: true,
    },
    {
        id: 'creativeFlow',
        name: 'Creative Flow',
        icon: '🎨',
        color: '#ec4899',
        description: '90‑minute creative work with warm‑up',
        phases: [
            { type: 'preparation', duration: 5, label: 'Warm Up' },
            { type: 'focus', duration: 80, label: 'Create' },
            { type: 'coolDown', duration: 5, label: 'Review' },
        ],
        repeat: 1,
        autoStart: false,
    },
    {
        id: 'meetingMarathon',
        name: 'Meeting Marathon',
        icon: '💼',
        color: '#f59e0b',
        description: 'Back‑to‑back meetings with short transitions',
        phases: [
            { type: 'focus', duration: 25, label: 'Meeting' },
            { type: 'shortBreak', duration: 5, label: 'Notes/Break' },
        ],
        repeat: 6,
        autoStart: true,
    },
    {
        id: 'writingSprint',
        name: 'Writing Sprint',
        icon: '✍️',
        color: '#6366f1',
        description: 'Focused writing with brief pauses',
        phases: [
            { type: 'focus', duration: 30, label: 'Write' },
            { type: 'shortBreak', duration: 5, label: 'Stretch' },
            { type: 'focus', duration: 30, label: 'Write' },
            { type: 'longBreak', duration: 15, label: 'Rest & Review' },
        ],
        repeat: 2,
        autoStart: false,
    },
];

// ---------- CUSTOM TIMER ENGINE ----------
export class CustomTimerEngine {
    constructor(config = {}) {
        this.storage = new StorageManager();

        // Timer identity
        this.name = config.name || 'Custom Timer';
        this.icon = config.icon || '⚙️';
        this.color = config.color || '#7c5ce7';
        this.description = config.description || '';

        // Phases configuration
        this.phases = config.phases || [];
        this.currentPhaseIndex = 0;
        this.totalPhases = 0;

        // Repetition
        this.repeat = config.repeat || 1; // How many times to loop through all phases
        this.currentRepeat = 0;

        // Features
        this.autoStart = config.autoStart || false;
        this.soundEnabled = config.soundEnabled !== false;
        this.notificationsEnabled = config.notificationsEnabled !== false;
        this.transitionWarnings = config.transitionWarnings !== false;
        this.warningSeconds = config.warningSeconds || 5; // Warn N seconds before phase ends

        // State
        this.timeLeft = 0;
        this.totalPhaseDuration = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.sessionId = null;
        this.sessionStartTime = null;

        // Tracking
        this.phaseHistory = [];
        this.totalFocusTime = 0;
        this.totalBreakTime = 0;
        this.completedPhases = 0;

        // Preset library
        this.savedPresets = [];

        // Interval
        this._interval = null;

        // Callbacks
        this.onTick = null;                // (timeLeft, phase, phaseIndex)
        this.onPhaseChange = null;         // (newPhase, oldPhase, phaseIndex)
        this.onRepeatComplete = null;      // (currentRepeat, totalRepeats)
        this.onComplete = null;            // (sessionReport)
        this.onWarning = null;             // (secondsRemaining)
        this.onPresetSaved = null;         // (preset)
        this.onPresetLoaded = null;        // (preset)
    }

    // ---------- PHASE BUILDER API ----------

    /**
     * Add a phase to the timer.
     * @param {string} label - Display name for the phase
     * @param {number} duration - Duration in minutes
     * @param {string} type - Phase type (focus, shortBreak, longBreak, preparation, coolDown, custom)
     * @param {string} color - Optional custom color
     */
    addPhase(label, duration, type = 'focus', color = null) {
        const phaseType = PHASE_TYPES[type] || PHASE_TYPES.custom;

        const phase = {
            id: generateId(),
            type,
            label: label || phaseType.name,
            duration: Math.max(1, Math.min(300, duration)), // 1-300 minutes
            color: color || phaseType.defaultColor,
            icon: phaseType.icon,
            phaseType: phaseType,
            soundOnStart: true,
            soundOnEnd: true,
            notificationOnStart: false,
            notificationOnEnd: true,
        };

        this.phases.push(phase);
        this.totalPhases = this.phases.length;

        return phase;
    }

    /**
     * Remove a phase by index.
     */
    removePhase(index) {
        if (index >= 0 && index < this.phases.length) {
            this.phases.splice(index, 1);
            this.totalPhases = this.phases.length;
            return true;
        }
        return false;
    }

    /**
     * Move a phase to a new position.
     */
    movePhase(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.phases.length) return false;
        if (toIndex < 0 || toIndex >= this.phases.length) return false;

        const phase = this.phases.splice(fromIndex, 1)[0];
        this.phases.splice(toIndex, 0, phase);
        return true;
    }

    /**
     * Update a phase's properties.
     */
    updatePhase(index, updates) {
        if (index < 0 || index >= this.phases.length) return false;
        Object.assign(this.phases[index], updates);
        return true;
    }

    /**
     * Clear all phases.
     */
    clearPhases() {
        this.phases = [];
        this.totalPhases = 0;
        return this;
    }

    /**
     * Set timer identity.
     */
    setIdentity(name, icon = '⚙️', color = '#7c5ce7', description = '') {
        this.name = name;
        this.icon = icon;
        this.color = color;
        this.description = description;
        return this;
    }

    /**
     * Set repeat count.
     */
    setRepeat(count) {
        this.repeat = Math.max(1, Math.min(20, count));
        return this;
    }

    // ---------- PRESET MANAGEMENT ----------

    /**
     * Save current configuration as a preset.
     */
    async savePreset(name = null) {
        const presetName = name || this.name;

        const preset = {
            id: generateId(),
            name: presetName,
            icon: this.icon,
            color: this.color,
            description: this.description,
            phases: this.phases.map(p => ({
                type: p.type,
                duration: p.duration,
                label: p.label,
                color: p.color,
            })),
            repeat: this.repeat,
            autoStart: this.autoStart,
            createdAt: new Date().toISOString(),
        };

        try {
            this.savedPresets = await this.storage.get('customTimerPresets') || [];
            // Replace if same name exists
            const existingIndex = this.savedPresets.findIndex(p => p.name === presetName);
            if (existingIndex >= 0) {
                this.savedPresets[existingIndex] = preset;
            } else {
                this.savedPresets.push(preset);
            }
            await this.storage.set('customTimerPresets', this.savedPresets);

            if (this.onPresetSaved) this.onPresetSaved(preset);
            return preset;
        } catch (err) {
            console.error('Failed to save preset:', err);
            return null;
        }
    }

    /**
     * Load a preset by name or ID.
     */
    async loadPreset(presetIdOrName) {
        this.savedPresets = await this.storage.get('customTimerPresets') || [];

        const preset = this.savedPresets.find(
            p => p.id === presetIdOrName || p.name === presetIdOrName
        );

        if (!preset) {
            // Check default presets
            const defaultPreset = DEFAULT_PRESETS.find(
                p => p.id === presetIdOrName || p.name === presetIdOrName
            );
            if (defaultPreset) {
                this._applyPreset(defaultPreset);
                return defaultPreset;
            }
            return null;
        }

        this._applyPreset(preset);

        if (this.onPresetLoaded) this.onPresetLoaded(preset);
        return preset;
    }

    /**
     * Delete a saved preset.
     */
    async deletePreset(presetIdOrName) {
        this.savedPresets = await this.storage.get('customTimerPresets') || [];
        const index = this.savedPresets.findIndex(
            p => p.id === presetIdOrName || p.name === presetIdOrName
        );
        if (index >= 0) {
            this.savedPresets.splice(index, 1);
            await this.storage.set('customTimerPresets', this.savedPresets);
            return true;
        }
        return false;
    }

    /**
     * Get all saved presets.
     */
    async getSavedPresets() {
        this.savedPresets = await this.storage.get('customTimerPresets') || [];
        return [...DEFAULT_PRESETS, ...this.savedPresets];
    }

    /**
     * Export preset as JSON.
     */
    exportPreset() {
        return JSON.stringify({
            name: this.name,
            icon: this.icon,
            color: this.color,
            description: this.description,
            phases: this.phases,
            repeat: this.repeat,
            autoStart: this.autoStart,
        }, null, 2);
    }

    /**
     * Import preset from JSON.
     */
    importPreset(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this._applyPreset(data);
            return true;
        } catch (err) {
            console.error('Invalid preset JSON:', err);
            return false;
        }
    }

    /**
     * Share preset via clipboard.
     */
    async sharePreset() {
        const json = this.exportPreset();
        try {
            await navigator.clipboard.writeText(json);
            return true;
        } catch (err) {
            // Fallback: create a shareable URL
            const encoded = btoa(json);
            const url = `${window.location.origin}?preset=${encoded}`;
            await navigator.clipboard.writeText(url);
            return true;
        }
    }

    _applyPreset(preset) {
        this.name = preset.name || 'Custom Timer';
        this.icon = preset.icon || '⚙️';
        this.color = preset.color || '#7c5ce7';
        this.description = preset.description || '';
        this.repeat = preset.repeat || 1;
        this.autoStart = preset.autoStart || false;

        this.phases = (preset.phases || []).map(p => ({
            id: generateId(),
            type: p.type || 'focus',
            label: p.label || 'Phase',
            duration: p.duration || 25,
            color: p.color || '#7c5ce7',
            icon: PHASE_TYPES[p.type]?.icon || '⏱️',
            phaseType: PHASE_TYPES[p.type] || PHASE_TYPES.custom,
        }));

        this.totalPhases = this.phases.length;
    }

    // ---------- TIMER CONTROLS ----------

    /**
     * Start the custom timer.
     */
    start() {
        if (this.isRunning) return;
        if (this.phases.length === 0) {
            console.warn('No phases configured. Add at least one phase.');
            return false;
        }

        this.sessionId = generateId();
        this.sessionStartTime = Date.now();
        this.currentPhaseIndex = 0;
        this.currentRepeat = 0;
        this.phaseHistory = [];
        this.totalFocusTime = 0;
        this.totalBreakTime = 0;
        this.completedPhases = 0;

        this._loadCurrentPhase();
        this.isRunning = true;
        this.isPaused = false;

        this._startTimer();

        return true;
    }

    /**
     * Pause the timer.
     */
    pause() {
        if (!this.isRunning || this.isPaused) return;
        this.isPaused = true;
        clearInterval(this._interval);
        this._interval = null;
        return this;
    }

    /**
     * Resume from pause.
     */
    resume() {
        if (!this.isPaused) return;
        this.isPaused = false;
        this._startTimer();
        return this;
    }

    /**
     * Skip to the next phase.
     */
    skipPhase() {
        this._advancePhase();
        return this;
    }

    /**
     * Extend current phase by N minutes.
     */
    extendPhase(minutes = 5) {
        if (!this.isRunning) return false;
        this.timeLeft += minutes * 60;
        this.totalPhaseDuration += minutes * 60;
        return true;
    }

    /**
     * End the session.
     */
    endSession() {
        const report = this._generateReport();
        this.isRunning = false;
        this.isPaused = false;
        clearInterval(this._interval);
        this._interval = null;

        this._saveSession(report);

        if (this.onComplete) this.onComplete(report);
        return report;
    }

    /**
     * Get current state.
     */
    getState() {
        const phase = this._getCurrentPhase();
        return {
            name: this.name,
            icon: this.icon,
            color: this.color,
            phase: phase,
            phaseIndex: this.currentPhaseIndex,
            totalPhases: this.totalPhases,
            currentRepeat: this.currentRepeat + 1,
            totalRepeats: this.repeat,
            timeLeft: this.timeLeft,
            totalPhaseDuration: this.totalPhaseDuration,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            progress: this._getPhaseProgress(),
            overallProgress: this._getOverallProgress(),
            timeRemainingFormatted: formatTime(this.timeLeft),
        };
    }

    /**
     * Get phase configuration.
     */
    getPhaseConfig() {
        return {
            phases: [...this.phases],
            totalPhases: this.totalPhases,
            repeat: this.repeat,
            totalEstimatedTime: this._calculateTotalTime(),
        };
    }

    // ---------- PRIVATE METHODS ----------

    _getCurrentPhase() {
        return this.phases[this.currentPhaseIndex] || null;
    }

    _loadCurrentPhase() {
        const phase = this._getCurrentPhase();
        if (!phase) return;

        this.timeLeft = phase.duration * 60;
        this.totalPhaseDuration = this.timeLeft;

        // Sound on phase start
        if (phase.soundOnStart && this.soundEnabled) {
            playSound('phaseStart');
        }

        // Notification on phase start
        if (phase.notificationOnStart && this.notificationsEnabled) {
            this._notify(`${this.name}`, `${phase.label} — ${phase.duration} minutes`);
        }
    }

    _startTimer() {
        clearInterval(this._interval);

        this._interval = setInterval(() => {
            // Transition warning
            if (this.transitionWarnings && this.timeLeft === this.warningSeconds) {
                if (this.onWarning) this.onWarning(this.warningSeconds);
                playSound('warning');
            }

            if (this.timeLeft <= 0) {
                this._advancePhase();
                return;
            }

            this.timeLeft--;

            if (this.onTick) {
                this.onTick(
                    this.timeLeft,
                    this._getCurrentPhase(),
                    this.currentPhaseIndex
                );
            }
        }, 1000);
    }

    _advancePhase() {
        // Record completed phase
        const completedPhase = this._getCurrentPhase();
        if (completedPhase) {
            this.phaseHistory.push({
                phase: { ...completedPhase },
                durationCompleted: this.totalPhaseDuration - this.timeLeft,
                completedAt: Date.now(),
            });
            this.completedPhases++;

            // Track focus vs break time
            if (completedPhase.type === 'focus') {
                this.totalFocusTime += (this.totalPhaseDuration - this.timeLeft);
            } else if (['shortBreak', 'longBreak'].includes(completedPhase.type)) {
                this.totalBreakTime += (this.totalPhaseDuration - this.timeLeft);
            }
        }

        // Move to next phase
        this.currentPhaseIndex++;

        // Check if we've completed all phases
        if (this.currentPhaseIndex >= this.totalPhases) {
            this.currentPhaseIndex = 0;
            this.currentRepeat++;

            if (this.onRepeatComplete) {
                this.onRepeatComplete(this.currentRepeat, this.repeat);
            }

            // Check if all repeats are done
            if (this.currentRepeat >= this.repeat) {
                this.endSession();
                return;
            }
        }

        // Load the next phase
        this._loadCurrentPhase();

        if (this.onPhaseChange) {
            this.onPhaseChange(
                this._getCurrentPhase(),
                completedPhase,
                this.currentPhaseIndex
            );
        }
    }

    _getPhaseProgress() {
        if (this.totalPhaseDuration <= 0) return 0;
        return this.timeLeft / this.totalPhaseDuration;
    }

    _getOverallProgress() {
        if (this.totalPhases === 0) return 0;
        const totalPhasesToComplete = this.totalPhases * this.repeat;
        const completedPhasesCount = (this.currentRepeat * this.totalPhases) + this.currentPhaseIndex;
        return Math.min(1, completedPhasesCount / totalPhasesToComplete);
    }

    _calculateTotalTime() {
        if (this.phases.length === 0) return 0;
        const singleLoopTime = this.phases.reduce((sum, p) => sum + p.duration, 0);
        return singleLoopTime * this.repeat;
    }

    _notify(title, body) {
        if (!this.notificationsEnabled) return;
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body });
        }
    }

    _generateReport() {
        const totalElapsed = Math.round((Date.now() - this.sessionStartTime) / 1000);

        return {
            sessionId: this.sessionId,
            type: 'custom',
            timerName: this.name,
            icon: this.icon,
            color: this.color,

            // Timing
            startTime: new Date(this.sessionStartTime).toISOString(),
            endTime: new Date().toISOString(),
            totalDurationSeconds: totalElapsed,
            totalDurationMinutes: Math.round(totalElapsed / 60 * 10) / 10,

            // Phases
            totalPhases: this.totalPhases,
            repeat: this.repeat,
            repeatsCompleted: this.currentRepeat,
            phasesCompleted: this.completedPhases,
            phaseHistory: this.phaseHistory,

            // Time breakdown
            totalFocusTimeSeconds: Math.round(this.totalFocusTime),
            totalBreakTimeSeconds: Math.round(this.totalBreakTime),
            totalFocusTimeMinutes: Math.round(this.totalFocusTime / 60 * 10) / 10,
            totalBreakTimeMinutes: Math.round(this.totalBreakTime / 60 * 10) / 10,

            // Phase configuration
            phaseConfig: this.phases.map(p => ({
                label: p.label,
                type: p.type,
                duration: p.duration,
            })),
        };
    }

    async _saveSession(report) {
        try {
            const history = await this.storage.get('customTimerHistory') || [];
            history.unshift(report);
            await this.storage.set('customTimerHistory', history.slice(0, 100));
        } catch (err) {
            console.error('Failed to save custom timer session:', err);
        }
    }

    // ---------- STATIC METHODS ----------

    /**
     * Get phase types.
     */
    static getPhaseTypes() {
        return Object.keys(PHASE_TYPES).map(key => ({
            id: key,
            ...PHASE_TYPES[key],
        }));
    }

    /**
     * Get default presets.
     */
    static getDefaultPresets() {
        return DEFAULT_PRESETS;
    }

    /**
     * Get all available icons for custom timers.
     */
    static getAvailableIcons() {
        return [
            '⚙️', '⏱️', '🎯', '📚', '💻', '🎨', '✍️', '🧘',
            '💪', '🏃', '🎵', '☕', '🌿', '💼', '📝', '🔬',
            '🎮', '🧠', '❤️', '🌟', '🔥', '💎', '🎪', '🌈',
        ];
    }

    /**
     * Get lifetime custom timer statistics.
     */
    static async getStatistics(storage = new StorageManager()) {
        const history = await storage.get('customTimerHistory') || [];

        if (history.length === 0) {
            return {
                totalSessions: 0,
                totalMinutes: 0,
                favoriteTimer: null,
                timerStats: {},
            };
        }

        const totalMinutes = history.reduce(
            (sum, s) => sum + (s.totalDurationMinutes || 0), 0
        );

        const timerStats = {};
        history.forEach(s => {
            const name = s.timerName || 'Unknown';
            if (!timerStats[name]) {
                timerStats[name] = { sessions: 0, totalMinutes: 0 };
            }
            timerStats[name].sessions++;
            timerStats[name].totalMinutes += (s.totalDurationMinutes || 0);
        });

        const favoriteTimer = Object.entries(timerStats)
            .sort((a, b) => b[1].sessions - a[1].sessions)[0]?.[0] || null;

        return {
            totalSessions: history.length,
            totalMinutes: Math.round(totalMinutes * 10) / 10,
            favoriteTimer,
            timerStats,
        };
    }
}

// ---------- HELPER: Parse preset from URL ----------
export function parsePresetFromURL() {
    const params = new URLSearchParams(window.location.search);
    const presetParam = params.get('preset');
    if (presetParam) {
        try {
            const json = atob(presetParam);
            return JSON.parse(json);
        } catch (err) {
            return null;
        }
    }
    return null;
}

export default CustomTimerEngine;
