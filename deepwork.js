/**
 * ============================================================
 * Fikr Timer · Deep Work Module
 * Extended focus timer for flow state with distraction
 * blocking, ambient focus sounds, session journaling,
 * and productivity analytics.
 * ============================================================
 *
 * Features:
 *  - Extended focus sessions (60, 90, 120, 180 minutes)
 *  - Configurable break intervals and durations
 *  - Flow state detection and scoring
 *  - Distraction logging with categories
 *  - Pre‑session intention setting
 *  - Post‑session reflection and journaling
 *  - Ambient focus sound integration
 *  - Progress milestones and encouragement
 *  - Daily deep work goal tracking
 *  - Session tagging (project, task, energy level)
 *  - Cumulative deep work statistics
 *  - Export session notes
 *
 * Usage:
 *   const deepwork = new DeepWorkEngine(config);
 *   deepwork.setIntention('Complete project proposal');
 *   deepwork.start();
 *   deepwork.logDistraction('email', 'Checked inbox');
 *   const report = deepwork.endSession();
 */

import { playSound, formatTime, generateId } from '../utils.js';
import { StorageManager } from '../storage.js';

// ---------- DEEP WORK PRESETS ----------
const DEEPWORK_PRESETS = {
    quick: {
        name: 'Quick Deep Dive',
        focusDuration: 60,     // minutes
        breakDuration: 10,     // minutes
        description: 'One hour of focused work with a short break.',
        milestones: [15, 30, 45], // minutes
    },
    standard: {
        name: 'Standard Deep Work',
        focusDuration: 90,
        breakDuration: 15,
        description: '90 minutes of deep focus — the classic deep work block.',
        milestones: [25, 50, 75],
    },
    extended: {
        name: 'Extended Flow Session',
        focusDuration: 120,
        breakDuration: 20,
        description: 'Two hours of uninterrupted creative flow.',
        milestones: [30, 60, 90],
    },
    marathon: {
        name: 'Deep Work Marathon',
        focusDuration: 180,
        breakDuration: 30,
        description: 'Three hours for maximum creative output.',
        milestones: [45, 90, 135],
    },
    custom: {
        name: 'Custom Deep Work',
        focusDuration: 90,
        breakDuration: 15,
        description: 'Your own deep work configuration.',
        milestones: [30, 60],
    },
};

// ---------- DISTRACTION CATEGORIES ----------
const DISTRACTION_CATEGORIES = [
    { id: 'phone', name: 'Phone', icon: '📱', severity: 3 },
    { id: 'email', name: 'Email', icon: '📧', severity: 2 },
    { id: 'social', name: 'Social Media', icon: '💬', severity: 3 },
    { id: 'people', name: 'People Interrupting', icon: '👥', severity: 4 },
    { id: 'thoughts', name: 'Wandering Thoughts', icon: '💭', severity: 1 },
    { id: 'noise', name: 'Environmental Noise', icon: '🔊', severity: 2 },
    { id: 'hunger', name: 'Hunger/Thirst', icon: '🍽️', severity: 2 },
    { id: 'discomfort', name: 'Physical Discomfort', icon: '😣', severity: 3 },
    { id: 'multitask', name: 'Task Switching', icon: '🔄', severity: 4 },
    { id: 'other', name: 'Other', icon: '❓', severity: 2 },
];

// ---------- ENERGY LEVELS ----------
const ENERGY_LEVELS = [
    { value: 1, label: 'Exhausted', emoji: '😴' },
    { value: 2, label: 'Tired', emoji: '😪' },
    { value: 3, label: 'Neutral', emoji: '😐' },
    { value: 4, label: 'Energized', emoji: '⚡' },
    { value: 5, label: 'Peak Performance', emoji: '🚀' },
];

// ---------- FOCUS QUALITY LEVELS ----------
const FOCUS_QUALITY = [
    { value: 1, label: 'Very Distracted', emoji: '😵‍💫' },
    { value: 2, label: 'Somewhat Distracted', emoji: '🤔' },
    { value: 3, label: 'Moderate Focus', emoji: '🎯' },
    { value: 4, label: 'Good Focus', emoji: '🔥' },
    { value: 5, label: 'Deep Flow State', emoji: '🧘' },
];

// ---------- PHASES ----------
const PHASES = {
    PREPARATION: 'preparation',
    FOCUS: 'focus',
    BREAK: 'break',
    COMPLETED: 'completed',
};

// ---------- DEEP WORK ENGINE ----------
export class DeepWorkEngine {
    constructor(config = {}) {
        this.storage = new StorageManager();

        // Preset configuration
        this.preset = config.preset || 'standard';
        this.presetConfig = { ...DEEPWORK_PRESETS[this.preset] };
        this.focusDuration = config.focusDuration || this.presetConfig.focusDuration;
        this.breakDuration = config.breakDuration || this.presetConfig.breakDuration;
        this.milestones = config.milestones || this.presetConfig.milestones;

        // Features
        this.soundEnabled = config.soundEnabled !== false;
        this.notificationsEnabled = config.notificationsEnabled !== false;
        this.ambientSoundEnabled = config.ambientSoundEnabled || false;
        this.ambientSoundType = config.ambientSoundType || 'white';
        this.blockingMode = config.blockingMode || false; // Full‑screen blocking

        // Session metadata
        this.intention = config.intention || '';
        this.project = config.project || '';
        this.task = config.task || '';
        this.tags = config.tags || [];
        this.preEnergyLevel = config.energyLevel || 3;
        this.preFocusExpectation = config.focusExpectation || 3;

        // State
        this.phase = PHASES.PREPARATION;
        this.timeLeft = 0;
        this.totalFocusDuration = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.sessionId = null;
        this.sessionStartTime = null;
        this.focusStartTime = null;

        // Tracking
        this.distractions = [];
        this.milestonesReached = [];
        this.pauseEvents = [];
        this.totalPauseDuration = 0;
        this.pauseStartTime = null;
        this.focusSegments = []; // Continuous focus blocks

        // Post‑session
        this.postEnergyLevel = null;
        this.focusQuality = null;
        self.accomplished = '';
        self.reflection = '';
        self.lessonsLearned = '';

        // Flow state metrics
        self.flowScore = 0;
        self.deepWorkMinutes = 0;

        // Interval
        this._interval = null;
        this._focusSegmentStart = null;

        // Callbacks
        this.onTick = null;              // (timeLeft, phase)
        this.onPhaseChange = null;       // (newPhase, oldPhase)
        this.onMilestone = null;         // (milestoneMinutes)
        this.onDistraction = null;       // (distraction, totalCount)
        this.onComplete = null;          // (sessionReport)
        this.onPause = null;
        this.onResume = null;
    }

    // ---------- PUBLIC API ----------

    /**
     * Configure the deep work session.
     */
    configure(config) {
        Object.assign(this, config);
        if (config.preset && DEEPWORK_PRESETS[config.preset]) {
            this.presetConfig = { ...DEEPWORK_PRESETS[config.preset] };
            this.milestones = this.presetConfig.milestones;
        }
        return this;
    }

    /**
     * Set intention for the session.
     */
    setIntention(intention) {
        this.intention = intention;
        return this;
    }

    /**
     * Set project/task context.
     */
    setContext(project, task, tags = []) {
        this.project = project || '';
        this.task = task || '';
        this.tags = Array.isArray(tags) ? tags : [tags];
        return this;
    }

    /**
     * Set pre‑session energy level.
     */
    setEnergyLevel(level) {
        this.preEnergyLevel = Math.max(1, Math.min(5, level));
        return this;
    }

    /**
     * Start the deep work session.
     */
    start() {
        if (this.isRunning) return;

        this.sessionId = generateId();
        this.sessionStartTime = Date.now();
        this.focusStartTime = Date.now();
        this.phase = PHASES.FOCUS;
        this.timeLeft = this.focusDuration * 60;
        this.totalFocusDuration = this.timeLeft;
        this.isRunning = true;
        this.isPaused = false;
        this.distractions = [];
        this.milestonesReached = [];
        this._focusSegmentStart = Date.now();

        this._startTimer();

        if (this.blockingMode) {
            this._enterBlockingMode();
        }

        if (this.ambientSoundEnabled) {
            this._startAmbientSound();
        }

        this._notify('Deep Work Started', `Focusing for ${this.focusDuration} minutes. Stay in flow! 🧘`);

        return this;
    }

    /**
     * Pause the session (discouraged in deep work, but allowed).
     */
    pause() {
        if (!this.isRunning || this.isPaused) return;

        this.isPaused = true;
        this.pauseStartTime = Date.now();
        clearInterval(this._interval);
        this._interval = null;

        // End current focus segment
        if (this._focusSegmentStart) {
            this.focusSegments.push({
                start: this._focusSegmentStart,
                end: Date.now(),
                duration: Math.round((Date.now() - this._focusSegmentStart) / 1000),
            });
            this._focusSegmentStart = null;
        }

        if (this.onPause) this.onPause();
        return this;
    }

    /**
     * Resume from pause.
     */
    resume() {
        if (!this.isPaused) return;

        if (this.pauseStartTime) {
            const pauseDuration = Date.now() - this.pauseStartTime;
            this.totalPauseDuration += pauseDuration;
            this.pauseEvents.push({
                start: this.pauseStartTime,
                end: Date.now(),
                duration: Math.round(pauseDuration / 1000),
            });
            this.pauseStartTime = null;
        }

        this.isPaused = false;
        this._focusSegmentStart = Date.now();
        this._startTimer();

        if (this.onResume) this.onResume();
        return this;
    }

    /**
     * Log a distraction event.
     */
    logDistraction(categoryId, note = '') {
        const category = DISTRACTION_CATEGORIES.find(c => c.id === categoryId) ||
                         DISTRACTION_CATEGORIES.find(c => c.id === 'other');

        const distraction = {
            id: generateId(),
            timestamp: Date.now(),
            timeRemaining: this.timeLeft,
            category: category,
            note,
            severity: category.severity,
        };

        this.distractions.push(distraction);

        if (this.onDistraction) {
            this.onDistraction(distraction, this.distractions.length);
        }

        // Brief vibration feedback
        if (navigator.vibrate) {
            navigator.vibrate([50, 50, 50]);
        }

        return distraction;
    }

    /**
     * Extend the focus session by N minutes.
     */
    extendSession(minutes = 15) {
        if (this.phase !== PHASES.FOCUS) return false;
        this.timeLeft += minutes * 60;
        this.totalFocusDuration += minutes * 60;
        return true;
    }

    /**
     * End the deep work session.
     */
    endSession() {
        // Record final focus segment
        if (this._focusSegmentStart) {
            this.focusSegments.push({
                start: this._focusSegmentStart,
                end: Date.now(),
                duration: Math.round((Date.now() - this._focusSegmentStart) / 1000),
            });
        }

        const report = this._generateReport();
        this.isRunning = false;
        this.isPaused = false;
        this.phase = PHASES.COMPLETED;
        clearInterval(this._interval);
        this._interval = null;

        if (this.blockingMode) {
            this._exitBlockingMode();
        }

        if (this.ambientSoundEnabled) {
            this._stopAmbientSound();
        }

        this._saveSession(report);

        if (this.onComplete) this.onComplete(report);
        return report;
    }

    /**
     * Set post‑session reflection.
     */
    setReflection(accomplished, focusQuality, lessonsLearned = '', postEnergyLevel = null) {
        self.accomplished = accomplished;
        this.focusQuality = Math.max(1, Math.min(5, focusQuality));
        self.lessonsLearned = lessonsLearned;
        this.postEnergyLevel = postEnergyLevel || this.preEnergyLevel;
        return this;
    }

    /**
     * Get current state.
     */
    getState() {
        return {
            phase: this.phase,
            timeLeft: this.timeLeft,
            totalFocusDuration: this.totalFocusDuration,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            distractions: this.distractions.length,
            progress: this._getProgress(),
            milestonesReached: this.milestonesReached,
            timeRemainingFormatted: formatTime(this.timeLeft),
            deepWorkMinutes: Math.round(
                (this.totalFocusDuration - this.timeLeft) / 60
            ),
        };
    }

    _getProgress() {
        if (this.totalFocusDuration <= 0) return 0;
        return this.timeLeft / this.totalFocusDuration;
    }

    /**
     * Get elapsed deep work time in minutes.
     */
    getDeepWorkMinutes() {
        return Math.round((this.totalFocusDuration - this.timeLeft) / 60);
    }

    // ---------- PRIVATE METHODS ----------

    _startTimer() {
        clearInterval(this._interval);

        this._interval = setInterval(() => {
            if (this.timeLeft <= 0) {
                this._handleFocusComplete();
                return;
            }

            this.timeLeft--;

            // Check milestones
            const elapsedMinutes = Math.round(
                (this.totalFocusDuration - this.timeLeft) / 60
            );
            this._checkMilestones(elapsedMinutes);

            if (this.onTick) {
                this.onTick(this.timeLeft, this.phase);
            }
        }, 1000);
    }

    _checkMilestones(elapsedMinutes) {
        for (const milestone of this.milestones) {
            if (elapsedMinutes === milestone && !this.milestonesReached.includes(milestone)) {
                this.milestonesReached.push(milestone);
                if (this.onMilestone) this.onMilestone(milestone);
                this._notify('Milestone Reached!', `${milestone} minutes of deep work completed. 🎯`);
                playSound('milestone');

                // Vibration for milestone
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100, 50, 200]);
                }
            }
        }
    }

    _handleFocusComplete() {
        this.phase = PHASES.BREAK;
        this.timeLeft = this.breakDuration * 60;

        // Record final focus segment
        if (this._focusSegmentStart) {
            this.focusSegments.push({
                start: this._focusSegmentStart,
                end: Date.now(),
                duration: Math.round((Date.now() - this._focusSegmentStart) / 1000),
            });
            this._focusSegmentStart = null;
        }

        if (this.onPhaseChange) {
            this.onPhaseChange(PHASES.BREAK, PHASES.FOCUS);
        }

        this._notify('Focus Complete!', `Time for a ${this.breakDuration}-minute break. ☕`);
        playSound('complete');

        // Auto‑end after break notification
        setTimeout(() => {
            if (this.isRunning) {
                this.endSession();
            }
        }, 5000);
    }

    _enterBlockingMode() {
        // Request fullscreen if available
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {
                // Fullscreen not available, continue normally
            });
        }
    }

    _exitBlockingMode() {
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
    }

    _startAmbientSound() {
        // Dispatch event for sound system
        window.dispatchEvent(new CustomEvent('deepwork:ambient', {
            detail: { type: this.ambientSoundType, enabled: true },
        }));
    }

    _stopAmbientSound() {
        window.dispatchEvent(new CustomEvent('deepwork:ambient', {
            detail: { enabled: false },
        }));
    }

    _notify(title, body) {
        if (!this.notificationsEnabled) return;
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body });
        }
    }

    _generateReport() {
        const totalElapsed = Math.round((Date.now() - this.sessionStartTime) / 1000);
        const actualFocusSeconds = this.totalFocusDuration - this.timeLeft;
        this.deepWorkMinutes = Math.round(actualFocusSeconds / 60);

        // Calculate flow score (0-100)
        let flowScore = 100;
        flowScore -= this.distractions.reduce((sum, d) => sum + (d.severity * 5), 0);
        flowScore -= this.pauseEvents.length * 10;
        flowScore -= Math.round(this.totalPauseDuration / 60000) * 8;
        this.flowScore = Math.max(0, Math.min(100, flowScore));

        return {
            sessionId: this.sessionId,
            type: 'deepwork',
            preset: this.preset,
            presetName: this.presetConfig.name,

            // Context
            intention: this.intention,
            project: this.project,
            task: this.task,
            tags: this.tags,

            // Energy & focus
            preEnergyLevel: this.preEnergyLevel,
            postEnergyLevel: this.postEnergyLevel,
            preFocusExpectation: this.preFocusExpectation,
            focusQuality: this.focusQuality,

            // Timing
            startTime: new Date(this.sessionStartTime).toISOString(),
            endTime: new Date().toISOString(),
            totalDurationSeconds: totalElapsed,
            focusDurationSeconds: actualFocusSeconds,
            focusDurationMinutes: this.deepWorkMinutes,
            breakDurationSeconds: Math.round(this.totalPauseDuration / 1000),

            // Distractions
            distractions: this.distractions,
            totalDistractions: this.distractions.length,
            distractionByCategory: this._groupDistractionsByCategory(),

            // Pauses
            pauseEvents: this.pauseEvents,
            totalPauses: this.pauseEvents.length,
            totalPauseDurationSeconds: Math.round(this.totalPauseDuration / 1000),

            // Focus segments
            focusSegments: this.focusSegments,
            longestFocusSegment: this._getLongestFocusSegment(),

            // Milestones
            milestonesReached: this.milestonesReached,
            totalMilestones: this.milestones.length,
            milestonesCompleted: this.milestonesReached.length,

            // Scores
            flowScore: this.flowScore,
            distractionRate: this.distractions.length > 0
                ? Math.round((this.distractions.length / this.deepWorkMinutes) * 60 * 10) / 10
                : 0, // distractions per hour

            // Reflection
            accomplished: self.accomplished || '',
            reflection: self.reflection || '',
            lessonsLearned: self.lessonsLearned || '',

            // Config
            focusDurationConfig: this.focusDuration,
            breakDurationConfig: this.breakDuration,
            ambientSoundEnabled: this.ambientSoundEnabled,
            ambientSoundType: this.ambientSoundType,
        };
    }

    _groupDistractionsByCategory() {
        const groups = {};
        this.distractions.forEach(d => {
            const catName = d.category.name;
            groups[catName] = (groups[catName] || 0) + 1;
        });
        return groups;
    }

    _getLongestFocusSegment() {
        if (this.focusSegments.length === 0) return 0;
        return Math.max(...this.focusSegments.map(s => s.duration));
    }

    async _saveSession(report) {
        try {
            const history = await this.storage.get('deepworkHistory') || [];
            history.unshift(report);
            await this.storage.set('deepworkHistory', history.slice(0, 100));

            // Update streak
            await this._updateStreak();
        } catch (err) {
            console.error('Failed to save deep work session:', err);
        }
    }

    async _updateStreak() {
        const history = await this.storage.get('deepworkHistory') || [];
        const uniqueDays = [...new Set(
            history.map(s => new Date(s.startTime).toDateString())
        )].sort().reverse();

        let streak = 0;
        for (let i = 0; i < uniqueDays.length; i++) {
            const expected = new Date(Date.now() - i * 86400000).toDateString();
            if (uniqueDays[i] === expected) {
                streak++;
            } else {
                break;
            }
        }

        await this.storage.set('deepworkStreak', { current: streak });
    }

    // ---------- STATIC METHODS ----------

    /**
     * Get distraction categories.
     */
    static getDistractionCategories() {
        return DISTRACTION_CATEGORIES;
    }

    /**
     * Get energy levels.
     */
    static getEnergyLevels() {
        return ENERGY_LEVELS;
    }

    /**
     * Get focus quality levels.
     */
    static getFocusQualityLevels() {
        return FOCUS_QUALITY;
    }

    /**
     * Get presets.
     */
    static getPresets() {
        return Object.keys(DEEPWORK_PRESETS).map(key => ({
            id: key,
            ...DEEPWORK_PRESETS[key],
        }));
    }

    /**
     * Get lifetime deep work statistics.
     */
    static async getStatistics(storage = new StorageManager()) {
        const history = await storage.get('deepworkHistory') || [];
        const streak = await storage.get('deepworkStreak') || { current: 0 };

        if (history.length === 0) {
            return {
                totalSessions: 0,
                totalDeepWorkHours: 0,
                totalDistractions: 0,
                averageFlowScore: 0,
                currentStreak: 0,
                bestStreak: 0,
                averageDistractionRate: 0,
                projectStats: {},
            };
        }

        const totalMinutes = history.reduce((sum, s) => sum + (s.focusDurationMinutes || 0), 0);
        const totalDistractions = history.reduce((sum, s) => sum + (s.totalDistractions || 0), 0);
        const flowScores = history.map(s => s.flowScore).filter(Boolean);
        const avgFlowScore = flowScores.length > 0
            ? Math.round(flowScores.reduce((a, b) => a + b, 0) / flowScores.length)
            : 0;

        // Project stats
        const projectStats = {};
        history.forEach(s => {
            if (s.project) {
                if (!projectStats[s.project]) {
                    projectStats[s.project] = {
                        sessions: 0,
                        totalMinutes: 0,
                        averageFlowScore: 0,
                    };
                }
                projectStats[s.project].sessions++;
                projectStats[s.project].totalMinutes += (s.focusDurationMinutes || 0);
            }
        });

        return {
            totalSessions: history.length,
            totalDeepWorkHours: Math.round(totalMinutes / 60 * 10) / 10,
            totalDistractions,
            averageFlowScore: avgFlowScore,
            currentStreak: streak.current,
            bestStreak: Math.max(streak.current, streak.best || 0),
            averageDistractionRate: history.length > 0
                ? Math.round((totalDistractions / history.length) * 10) / 10
                : 0,
            projectStats,
        };
    }
}

export default DeepWorkEngine;