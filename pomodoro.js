/**
 * ============================================================
 * Fikr Timer · Advanced Pomodoro Module
 * Multi-phase timer with auto‑cycling, distraction tracking,
 * focus scoring, project tagging, and detailed session analytics.
 * ============================================================
 *
 * Features:
 *  - Configurable focus, short break, and long break durations
 *  - Auto‑cycling with customizable round counts
 *  - Distraction counter with real‑time scoring
 *  - Project/task tagging for analytics
 *  - Skip break, extend focus, early finish
 *  - Detailed per‑session and cumulative statistics
 *  - Long break after every N rounds (default: every 4th)
 *  - Sound alerts and browser notifications
 *  - Session notes and mood tracking
 *  - Streak preservation with grace periods
 *
 * Usage:
 *   const pomodoro = new PomodoroTimer(config);
 *   pomodoro.start();
 *   pomodoro.pause();
 *   pomodoro.skipBreak();
 *   pomodoro.recordDistraction();
 *   const report = pomodoro.endSession();
 */

import { playSound, formatTime, generateId } from '../utils.js';
import { StorageManager } from '../storage.js';

// ---------- CONSTANTS ----------
const DEFAULT_CONFIG = {
    focusDuration: 25,         // minutes
    shortBreakDuration: 5,    // minutes
    longBreakDuration: 15,    // minutes
    longBreakInterval: 4,     // every N rounds
    totalRounds: 4,           // number of focus sessions
    autoStartBreaks: false,   // automatically start break timer
    autoStartFocus: false,    // automatically start next focus
    soundEnabled: true,
    notificationsEnabled: true,
};

const PHASES = {
    IDLE: 'idle',
    FOCUS: 'focus',
    SHORT_BREAK: 'shortBreak',
    LONG_BREAK: 'longBreak',
    COMPLETED: 'completed',
    PAUSED: 'paused',
};

// ---------- POMODORO TIMER CLASS ----------
export class PomodoroTimer {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.storage = new StorageManager();

        // State
        this.phase = PHASES.IDLE;
        this.currentRound = 0;
        this.completedRounds = 0;
        this.timeLeft = 0;
        this.totalPhaseDuration = 0;
        this.sessionId = null;
        this.startTime = null;
        this.isRunning = false;
        this.isPaused = false;

        // Tracking
        this.distractions = [];
        this.pauseCount = 0;
        this.totalPauseDuration = 0;
        this.pauseStartTime = null;
        this.notes = '';
        this.mood = null; // 1-5 scale
        this.project = '';
        this.task = '';
        this.tags = [];

        // History per round
        this.roundHistory = [];

        // Interval reference
        this._interval = null;

        // Callbacks
        this.onTick = null;           // (timeLeft, phase)
        this.onPhaseChange = null;    // (newPhase, oldPhase)
        this.onRoundComplete = null;  // (roundNumber, roundData)
        this.onDistraction = null;    // (distractionCount)
        this.onComplete = null;       // (sessionReport)
        this.onPause = null;          // ()
        this.onResume = null;         // ()
    }

    // ---------- PUBLIC API ----------

    /**
     * Configure the pomodoro timer with new settings.
     * Must be called before start().
     */
    configure(config) {
        this.config = { ...this.config, ...config };
        return this;
    }

    /**
     * Set project/task context for this session.
     */
    setContext(project, task, tags = []) {
        this.project = project || '';
        this.task = task || '';
        this.tags = Array.isArray(tags) ? tags : [tags];
        return this;
    }

    /**
     * Start the pomodoro session.
     */
    start() {
        if (this.isRunning) return;

        if (this.phase === PHASES.IDLE || this.phase === PHASES.COMPLETED) {
            this._initializeSession();
        }

        if (this.isPaused) {
            this._resume();
            return;
        }

        this.isRunning = true;
        this.isPaused = false;
        this._startPhaseTimer();
        this._notifyPhaseStart();

        if (this.onPhaseChange) {
            this.onPhaseChange(this.phase, PHASES.IDLE);
        }

        return this;
    }

    /**
     * Pause the current phase.
     */
    pause() {
        if (!this.isRunning || this.isPaused) return;

        this.isRunning = false;
        this.isPaused = true;
        this.pauseCount++;
        this.pauseStartTime = Date.now();

        clearInterval(this._interval);
        this._interval = null;

        if (this.onPause) this.onPause();
        return this;
    }

    /**
     * Resume from pause.
     */
    resume() {
        if (!this.isPaused) return;
        this._resume();
        return this;
    }

    /**
     * Skip the current break and start next focus round.
     * Only works when in a break phase.
     */
    skipBreak() {
        if (this.phase !== PHASES.SHORT_BREAK && this.phase !== PHASES.LONG_BREAK) {
            console.warn('Cannot skip break: not currently in a break phase');
            return false;
        }

        this._recordRoundComplete();
        this._startFocusRound();
        return true;
    }

    /**
     * Extend the current focus session by N minutes.
     */
    extendFocus(minutes = 5) {
        if (this.phase !== PHASES.FOCUS) return false;

        this.timeLeft += minutes * 60;
        this.totalPhaseDuration += minutes * 60;
        return true;
    }

    /**
     * Record a distraction event.
     */
    recordDistraction(type = 'unspecified', note = '') {
        const distraction = {
            id: generateId(),
            timestamp: Date.now(),
            round: this.currentRound,
            phase: this.phase,
            type,
            note,
        };

        this.distractions.push(distraction);

        if (this.onDistraction) {
            this.onDistraction(this.distractions.length);
        }

        return distraction;
    }

    /**
     * Set the mood for the current session (1-5).
     */
    setMood(rating) {
        this.mood = Math.max(1, Math.min(5, rating));
        return this;
    }

    /**
     * Add session notes.
     */
    addNotes(notes) {
        this.notes = notes;
        return this;
    }

    /**
     * End the session early or after completion.
     */
    endSession() {
        this._recordRoundComplete();
        const report = this._generateReport();
        this.phase = PHASES.COMPLETED;
        this.isRunning = false;
        this.isPaused = false;
        clearInterval(this._interval);
        this._interval = null;

        // Save to storage
        this._saveSession(report);

        if (this.onComplete) this.onComplete(report);
        return report;
    }

    /**
     * Reset the timer completely.
     */
    reset() {
        clearInterval(this._interval);
        this._interval = null;

        this.phase = PHASES.IDLE;
        this.currentRound = 0;
        this.completedRounds = 0;
        this.timeLeft = 0;
        this.totalPhaseDuration = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.distractions = [];
        this.pauseCount = 0;
        this.totalPauseDuration = 0;
        this.roundHistory = [];
        this.notes = '';
        this.mood = null;

        return this;
    }

    /**
     * Get current state snapshot.
     */
    getState() {
        return {
            phase: this.phase,
            currentRound: this.currentRound,
            completedRounds: this.completedRounds,
            totalRounds: this.config.totalRounds,
            timeLeft: this.timeLeft,
            totalPhaseDuration: this.totalPhaseDuration,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            distractions: this.distractions.length,
            progress: this._calculateProgress(),
            timeRemainingFormatted: formatTime(this.timeLeft),
        };
    }

    /**
     * Get progress as a decimal (0 to 1).
     */
    _calculateProgress() {
        if (this.totalPhaseDuration <= 0) return 0;
        return this.timeLeft / this.totalPhaseDuration;
    }

    /**
     * Get overall session progress (rounds completed / total rounds).
     */
    getOverallProgress() {
        if (this.config.totalRounds <= 0) return 0;
        return this.completedRounds / this.config.totalRounds;
    }

    // ---------- PRIVATE METHODS ----------

    _initializeSession() {
        this.sessionId = generateId();
        this.startTime = Date.now();
        this.currentRound = 1;
        this.completedRounds = 0;
        this.distractions = [];
        this.pauseCount = 0;
        this.totalPauseDuration = 0;
        this.roundHistory = [];
        this._startFocusRound();
    }

    _startFocusRound() {
        this.phase = PHASES.FOCUS;
        this.timeLeft = this.config.focusDuration * 60;
        this.totalPhaseDuration = this.timeLeft;
        this.isBreak = false;

        if (this.isRunning) {
            this._startPhaseTimer();
        }

        if (this.onPhaseChange) {
            this.onPhaseChange(PHASES.FOCUS, this._getPreviousPhase());
        }
    }

    _startBreakRound() {
        const isLongBreak = (this.currentRound % this.config.longBreakInterval === 0);

        this.phase = isLongBreak ? PHASES.LONG_BREAK : PHASES.SHORT_BREAK;
        this.timeLeft = isLongBreak
            ? this.config.longBreakDuration * 60
            : this.config.shortBreakDuration * 60;
        this.totalPhaseDuration = this.timeLeft;
        this.isBreak = true;

        if (this.isRunning) {
            this._startPhaseTimer();
        }

        if (this.onPhaseChange) {
            this.onPhaseChange(this.phase, PHASES.FOCUS);
        }
    }

    _startPhaseTimer() {
        clearInterval(this._interval);

        this._interval = setInterval(() => {
            if (this.timeLeft <= 0) {
                this._handlePhaseEnd();
                return;
            }

            this.timeLeft--;

            if (this.onTick) {
                this.onTick(this.timeLeft, this.phase);
            }
        }, 1000);
    }

    _handlePhaseEnd() {
        if (this.phase === PHASES.FOCUS) {
            // Focus round completed
            this._recordRoundComplete();

            if (this.currentRound >= this.config.totalRounds) {
                // All rounds done
                this.endSession();
                return;
            }

            // Start break
            this._startBreakRound();
            playSound('focusComplete');

        } else if (this.phase === PHASES.SHORT_BREAK || this.phase === PHASES.LONG_BREAK) {
            // Break completed
            this.currentRound++;
            this._startFocusRound();
            playSound('breakComplete');
        }

        this._notifyPhaseStart();
    }

    _recordRoundComplete() {
        if (this.phase !== PHASES.FOCUS) return;

        const roundData = {
            roundNumber: this.currentRound,
            phase: this.phase,
            durationMinutes: Math.round((this.totalPhaseDuration - this.timeLeft) / 60),
            distractionsDuring: this.distractions.filter(
                d => d.round === this.currentRound
            ).length,
            completedAt: Date.now(),
            wasPaused: this.pauseCount > 0,
        };

        this.roundHistory.push(roundData);
        this.completedRounds++;

        if (this.onRoundComplete) {
            this.onRoundComplete(this.currentRound, roundData);
        }
    }

    _resume() {
        if (this.pauseStartTime) {
            this.totalPauseDuration += Date.now() - this.pauseStartTime;
            this.pauseStartTime = null;
        }

        this.isRunning = true;
        this.isPaused = false;
        this._startPhaseTimer();

        if (this.onResume) this.onResume();
    }

    _getPreviousPhase() {
        if (this.roundHistory.length === 0) return PHASES.IDLE;
        return this.isBreak ? PHASES.FOCUS : PHASES.SHORT_BREAK;
    }

    _notifyPhaseStart() {
        if (!this.config.notificationsEnabled) return;

        const title = 'Fikr Timer';
        let body = '';

        switch (this.phase) {
            case PHASES.FOCUS:
                body = `Focus round ${this.currentRound}/${this.config.totalRounds} started. Stay focused! 🎯`;
                break;
            case PHASES.SHORT_BREAK:
                body = 'Short break! Stand up and stretch. ☕';
                break;
            case PHASES.LONG_BREAK:
                body = 'Long break! Take a proper rest. 🌿';
                break;
        }

        if (body && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body });
        }
    }

    _generateReport() {
        const totalSessionDuration = Date.now() - this.startTime;
        const totalFocusMinutes = this.roundHistory.reduce(
            (sum, r) => sum + r.durationMinutes, 0
        );
        const totalDistractions = this.distractions.length;

        // Calculate focus score (0-100)
        let focusScore = 100;
        focusScore -= totalDistractions * 3; // Each distraction costs 3 points
        focusScore -= this.pauseCount * 5;   // Each pause costs 5 points
        focusScore -= Math.max(0, (this.completedRounds - this.config.totalRounds) * 10);
        focusScore = Math.max(0, Math.min(100, focusScore));

        return {
            sessionId: this.sessionId,
            type: 'pomodoro',
            config: { ...this.config },
            project: this.project,
            task: this.task,
            tags: this.tags,
            mood: this.mood,
            notes: this.notes,

            // Timing
            startTime: new Date(this.startTime).toISOString(),
            endTime: new Date().toISOString(),
            totalDurationMs: totalSessionDuration,
            totalDurationMin: Math.round(totalSessionDuration / 60000),

            // Rounds
            totalRounds: this.config.totalRounds,
            completedRounds: this.completedRounds,
            roundHistory: this.roundHistory,
            totalFocusMinutes,

            // Distractions & pauses
            distractions: this.distractions,
            totalDistractions,
            pauseCount: this.pauseCount,
            totalPauseDurationMs: this.totalPauseDuration,

            // Scores
            focusScore,
            efficiency: this.completedRounds / this.config.totalRounds * 100,
        };
    }

    async _saveSession(report) {
        try {
            const history = await this.storage.get('pomodoroHistory') || [];
            history.unshift(report);
            // Keep last 100 sessions
            await this.storage.set('pomodoroHistory', history.slice(0, 100));

            // Update streak
            await this._updateStreak();
        } catch (err) {
            console.error('Failed to save pomodoro session:', err);
        }
    }

    async _updateStreak() {
        const history = await this.storage.get('pomodoroHistory') || [];
        const today = new Date().toDateString();

        // Count consecutive days
        let streak = 0;
        const uniqueDays = [...new Set(
            history.map(s => new Date(s.startTime).toDateString())
        )].sort().reverse();

        for (let i = 0; i < uniqueDays.length; i++) {
            const expected = new Date(Date.now() - i * 86400000).toDateString();
            if (uniqueDays[i] === expected) {
                streak++;
            } else {
                break;
            }
        }

        await this.storage.set('pomodoroStreak', {
            current: streak,
            lastUpdated: today,
        });
    }

    /**
     * Get lifetime pomodoro statistics.
     */
    static async getStatistics(storage = new StorageManager()) {
        const history = await storage.get('pomodoroHistory') || [];
        const streak = await storage.get('pomodoroStreak') || { current: 0 };

        if (history.length === 0) {
            return {
                totalSessions: 0,
                totalFocusHours: 0,
                totalDistractions: 0,
                averageScore: 0,
                currentStreak: 0,
                bestStreak: 0,
                mostProductiveDay: null,
                projectStats: {},
            };
        }

        const totalFocusMinutes = history.reduce((sum, s) => sum + (s.totalFocusMinutes || 0), 0);
        const totalDistractions = history.reduce((sum, s) => sum + (s.totalDistractions || 0), 0);
        const scores = history.map(s => s.focusScore).filter(Boolean);
        const averageScore = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;

        // Project statistics
        const projectStats = {};
        history.forEach(s => {
            if (s.project) {
                if (!projectStats[s.project]) {
                    projectStats[s.project] = { sessions: 0, totalMinutes: 0 };
                }
                projectStats[s.project].sessions++;
                projectStats[s.project].totalMinutes += (s.totalFocusMinutes || 0);
            }
        });

        // Most productive day
        const dayTotals = {};
        history.forEach(s => {
            const day = new Date(s.startTime).toDateString();
            dayTotals[day] = (dayTotals[day] || 0) + (s.totalFocusMinutes || 0);
        });
        const mostProductiveDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0] || null;

        return {
            totalSessions: history.length,
            totalFocusHours: Math.round(totalFocusMinutes / 60 * 10) / 10,
            totalDistractions,
            averageScore,
            currentStreak: streak.current,
            bestStreak: Math.max(streak.current, streak.best || 0),
            mostProductiveDay: mostProductiveDay ? {
                date: mostProductiveDay[0],
                minutes: mostProductiveDay[1],
            } : null,
            projectStats,
        };
    }
}

// ---------- DEFAULT EXPORT ----------
export default PomodoroTimer;