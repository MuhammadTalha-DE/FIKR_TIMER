/**
 * ============================================================
 * Fikr Timer · Core Timer Engine
 * Handles all timer modes, countdown logic, phase management,
 * and session tracking. Supports 12+ timer modes.
 * ============================================================
 */

import { MODES } from './config.js';
import { playSound, formatTime } from './utils.js';

export class TimerEngine {
    constructor() {
        // Core state
        this.mode = null;
        this.modeId = null;
        this.timeLeft = 0;
        this.totalDuration = 0;
        this.isRunning = false;
        this.isPaused = false;

        // Phase management
        this.currentPhase = 'focus'; // 'focus' | 'break' | 'longBreak'
        this.currentRound = 1;
        this.totalRounds = 1;
        this.isBreak = false;

        // Session tracking
        this.sessionStartTime = null;
        this.totalFocusTime = 0;
        this.totalBreakTime = 0;
        this.distractions = 0;
        this.pauseCount = 0;
        this.focusScore = 100;

        // Breathing-specific
        this.breathingPhases = [];
        this.breathingPhaseIndex = 0;
        this.breathingCycle = 0;
        this.breathingMaxCycles = 0;
        this.breathingParams = {};

        // Interval
        this._interval = null;

        // Callbacks
        this.onTick = null;
        this.onPhaseChange = null;
        this.onComplete = null;
        this.onRoundChange = null;
    }

    /**
     * Initialize the timer with a mode and optional custom parameters.
     * @param {string} modeId - The mode identifier (e.g., 'pomodoro', 'breathing')
     * @param {object} customParams - Override default parameters
     */
    initialize(modeId, customParams = {}) {
        this.stop();
        const modeConfig = MODES.find(m => m.id === modeId);
        if (!modeConfig) {
            console.error(`Unknown mode: ${modeId}`);
            return;
        }

        this.modeId = modeId;
        this.mode = { ...modeConfig };
        this.isBreak = false;
        this.currentPhase = 'focus';
        this.currentRound = 1;
        this.distractions = 0;
        this.pauseCount = 0;
        this.focusScore = 100;
        this.sessionStartTime = Date.now();

        const defaults = modeConfig.defaults;

        switch (modeId) {
            case 'pomodoro':
                this._initPomodoro(customParams, defaults);
                break;
            case 'study':
                this._initStandard(customParams.focus || defaults.focus, customParams.break || defaults.break, 1);
                break;
            case 'deepwork':
                this._initStandard(defaults.focus, defaults.break, 1);
                break;
            case 'countdown':
                this._initCountdown(customParams.duration || defaults.focus);
                break;
            case 'stopwatch':
                this._initStopwatch();
                break;
            case 'interval':
                this._initInterval(customParams, defaults);
                break;
            case 'exam':
                this._initExam(customParams, defaults);
                break;
            case 'reading':
                this._initStandard(customParams.time || defaults.time, 0, 1);
                break;
            case 'coding':
                this._initStandard(customParams.duration || defaults.focus, 0, 1);
                break;
            case 'workout':
                this._initWorkout(customParams, defaults);
                break;
            case 'breathing':
                this._initBreathing(customParams, defaults);
                break;
            case 'prayer':
                this._initStandard(defaults.focus, defaults.break, 1);
                break;
            case 'custom':
                this._initCustom(customParams, defaults);
                break;
            default:
                this._initStandard(25, 5, 1);
        }

        return this;
    }

    // ---------- PRIVATE INITIALIZERS ----------

    _initPomodoro(params, defaults) {
        const focusMin = params.focus || defaults.focus;
        const shortBreak = params.break || defaults.break;
        const longBreak = params.longBreak || defaults.longBreak;
        const rounds = params.rounds || defaults.rounds;

        this.totalRounds = rounds;
        this.pomodoroConfig = { focusMin, shortBreak, longBreak, rounds };
        this.timeLeft = focusMin * 60;
        this.totalDuration = this.timeLeft;
        this.currentPhase = 'focus';
    }

    _initStandard(focusMin, breakMin, rounds) {
        this.totalRounds = rounds || 1;
        this.standardConfig = { focusMin, breakMin };
        this.timeLeft = focusMin * 60;
        this.totalDuration = this.timeLeft;
        this.currentPhase = 'focus';
    }

    _initCountdown(durationMin) {
        this.totalRounds = 1;
        this.timeLeft = durationMin * 60;
        this.totalDuration = this.timeLeft;
        this.currentPhase = 'focus';
    }

    _initStopwatch() {
        this.totalRounds = 1;
        this.timeLeft = 0;
        this.totalDuration = Infinity;
        this.currentPhase = 'stopwatch';
    }

    _initInterval(params, defaults) {
        const focusMin = params.focus || defaults.focus;
        const breakMin = params.break || defaults.break;
        const rounds = params.rounds || defaults.rounds;

        this.totalRounds = rounds;
        this.intervalConfig = { focusMin, breakMin };
        this.timeLeft = focusMin * 60;
        this.totalDuration = this.timeLeft;
        this.currentPhase = 'focus';
    }

    _initExam(params, defaults) {
        const totalTime = params.time || defaults.time;
        const questionCount = params.questions || defaults.questions;

        this.totalRounds = 1;
        this.examConfig = { totalTime, questionCount };
        this.timeLeft = totalTime * 60;
        this.totalDuration = this.timeLeft;
        this.timePerQuestion = Math.floor(this.timeLeft / questionCount);
        this.currentPhase = 'exam';
    }

    _initWorkout(params, defaults) {
        const exerciseSec = params.exercise || defaults.exercise;
        const restSec = params.rest || defaults.rest;
        const rounds = params.rounds || defaults.rounds;

        this.totalRounds = rounds;
        this.workoutConfig = { exerciseSec, restSec };
        this.timeLeft = exerciseSec;
        this.totalDuration = this.timeLeft;
        this.currentPhase = 'exercise';
    }

    _initBreathing(params, defaults) {
        const inhale = parseInt(params.inhale || defaults.inhale);
        const hold = parseInt(params.hold ?? defaults.hold);
        const exhale = parseInt(params.exhale || defaults.exhale);
        const hold2 = parseInt(params.hold2 ?? defaults.hold2);
        const cycles = parseInt(params.cycles || defaults.cycles);

        this.breathingParams = { inhale, hold, exhale, hold2, cycles };
        this.breathingMaxCycles = cycles;
        this.totalRounds = cycles;
        this.currentPhase = 'breathing';

        // Build phases array
        this.breathingPhases = [];
        this.breathingPhases.push({ name: 'Inhale', duration: inhale });
        if (hold > 0) this.breathingPhases.push({ name: 'Hold', duration: hold });
        this.breathingPhases.push({ name: 'Exhale', duration: exhale });
        if (hold2 > 0) this.breathingPhases.push({ name: 'Hold', duration: hold2 });

        this.breathingPhaseIndex = 0;
        this.breathingCycle = 0;
        this.timeLeft = this.breathingPhases[0].duration;
        this.totalDuration = this.timeLeft;
    }

    _initCustom(params, defaults) {
        const focusMin = params.focus || defaults.focus;
        const breakMin = params.break || defaults.break;
        const rounds = params.rounds || defaults.rounds;

        this.mode.name = params.name || 'Custom Timer';
        this.mode.icon = params.icon || '⚙️';
        this.totalRounds = rounds;
        this.timeLeft = focusMin * 60;
        this.totalDuration = this.timeLeft;
        this.currentPhase = 'focus';
    }

    // ---------- PUBLIC CONTROLS ----------

    start() {
        if (this.isRunning && !this.isPaused) return;

        if (this.isPaused) {
            this.isPaused = false;
        }

        this.isRunning = true;
        this._interval = setInterval(() => this._tick(), 1000);
    }

    pause() {
        if (!this.isRunning) return;
        this.isPaused = true;
        this.isRunning = false;
        this.pauseCount++;
        clearInterval(this._interval);
        this._interval = null;
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        clearInterval(this._interval);
        this._interval = null;
    }

    reset() {
        this.stop();
        this.initialize(this.modeId);
    }

    addTime(seconds) {
        if (this.modeId === 'stopwatch' || this.modeId === 'breathing') return false;
        this.timeLeft += seconds;
        this.totalDuration += seconds;
        return true;
    }

    skipBreak() {
        if (!this.isBreak) return false;

        this.isBreak = false;
        this.currentPhase = 'focus';

        if (this.modeId === 'workout') {
            this.timeLeft = this.workoutConfig.exerciseSec;
            this.totalDuration = this.timeLeft;
        } else if (this.modeId === 'pomodoro') {
            this.timeLeft = this.pomodoroConfig.focusMin * 60;
            this.totalDuration = this.timeLeft;
        } else {
            this.timeLeft = (this.standardConfig?.focusMin || 25) * 60;
            this.totalDuration = this.timeLeft;
        }

        if (this.onPhaseChange) this.onPhaseChange('focus');
        return true;
    }

    incrementDistractions() {
        this.distractions++;
        // Reduce focus score slightly
        this.focusScore = Math.max(0, this.focusScore - 2);
    }

    endSession() {
        this.stop();
        const session = this._buildSessionReport();
        if (this.onComplete) this.onComplete(session);
        return session;
    }

    // ---------- STATE GETTERS ----------

    getState() {
        return {
            timeLeft: this.timeLeft,
            totalDuration: this.totalDuration,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            currentPhase: this.currentPhase,
            currentRound: this.currentRound,
            totalRounds: this.totalRounds,
            distractions: this.distractions,
            focusScore: this.focusScore,
        };
    }

    getMode() {
        return this.mode;
    }

    getProgress() {
        if (this.modeId === 'stopwatch') return 0;
        if (this.totalDuration <= 0) return 1;
        return this.timeLeft / this.totalDuration;
    }

    getPhaseLabel() {
        switch (this.currentPhase) {
            case 'focus': return 'Focus';
            case 'break': return 'Break';
            case 'longBreak': return 'Long Break';
            case 'exercise': return 'Exercise';
            case 'rest': return 'Rest';
            case 'exam': return 'Exam';
            case 'stopwatch': return 'Stopwatch';
            case 'breathing': return '';
            default: return 'Focus';
        }
    }

    getRoundInfo() {
        if (this.totalRounds <= 1) return '';

        if (this.modeId === 'breathing') {
            return `Cycle ${this.breathingCycle + 1}/${this.breathingMaxCycles}`;
        }

        if (this.modeId === 'pomodoro') {
            return `Round ${this.currentRound}/${this.totalRounds}`;
        }

        return `Round ${this.currentRound}/${this.totalRounds}`;
    }

    getBreathingPhase() {
        if (this.modeId !== 'breathing') return null;
        return this.breathingPhases[this.breathingPhaseIndex];
    }

    // ---------- PRIVATE TICK LOGIC ----------

    _tick() {
        if (this.modeId === 'stopwatch') {
            this.timeLeft++;
            if (this.onTick) this.onTick();
            return;
        }

        if (this.timeLeft <= 0) {
            this._handlePhaseEnd();
            return;
        }

        this.timeLeft--;
        if (this.onTick) this.onTick();
    }

    _handlePhaseEnd() {
        if (this.modeId === 'breathing') {
            this._advanceBreathingPhase();
            return;
        }

        if (this.modeId === 'exam') {
            this._endSession('exam completed');
            return;
        }

        // Handle round-based modes
        if (!this.isBreak) {
            // Just finished a focus/exercise round
            if (this.currentRound >= this.totalRounds) {
                // All rounds complete
                this._endSession('all rounds complete');
                return;
            }

            // Start break
            this.isBreak = true;
            this.currentPhase = this._getBreakPhaseName();
            this.timeLeft = this._getBreakDuration();
            this.totalDuration = this.timeLeft;
            this.totalFocusTime += (this.totalDuration - this.timeLeft);

            if (this.onPhaseChange) this.onPhaseChange('break');
            playSound('tick');
        } else {
            // Just finished a break
            this.isBreak = false;
            this.currentRound++;
            this.currentPhase = this._getFocusPhaseName();
            this.timeLeft = this._getFocusDuration();
            this.totalDuration = this.timeLeft;

            if (this.onRoundChange) this.onRoundChange(this.currentRound);
            if (this.onPhaseChange) this.onPhaseChange('focus');
            playSound('tick');
        }
    }

    _advanceBreathingPhase() {
        this.breathingPhaseIndex++;

        if (this.breathingPhaseIndex >= this.breathingPhases.length) {
            // Cycle complete
            this.breathingPhaseIndex = 0;
            this.breathingCycle++;

            if (this.breathingCycle >= this.breathingMaxCycles) {
                // All cycles complete
                this._endSession('breathing complete');
                return;
            }
        }

        const nextPhase = this.breathingPhases[this.breathingPhaseIndex];
        this.timeLeft = nextPhase.duration;
        this.totalDuration = this.timeLeft;

        if (this.onPhaseChange) this.onPhaseChange(nextPhase.name);
        playSound('tick');
    }

    _getBreakDuration() {
        switch (this.modeId) {
            case 'pomodoro':
                return (this.currentRound % 4 === 0)
                    ? this.pomodoroConfig.longBreak * 60
                    : this.pomodoroConfig.shortBreak * 60;
            case 'interval':
                return this.intervalConfig.breakMin * 60;
            case 'workout':
                return this.workoutConfig.restSec;
            default:
                return (this.standardConfig?.breakMin || 5) * 60;
        }
    }

    _getBreakPhaseName() {
        if (this.modeId === 'pomodoro' && this.currentRound % 4 === 0) return 'longBreak';
        if (this.modeId === 'workout') return 'rest';
        return 'break';
    }

    _getFocusDuration() {
        switch (this.modeId) {
            case 'pomodoro': return this.pomodoroConfig.focusMin * 60;
            case 'workout': return this.workoutConfig.exerciseSec;
            default: return (this.standardConfig?.focusMin || 25) * 60;
        }
    }

    _getFocusPhaseName() {
        if (this.modeId === 'workout') return 'exercise';
        return 'focus';
    }

    _endSession(reason) {
        const session = this._buildSessionReport(reason);
        this.stop();
        if (this.onComplete) this.onComplete(session);
        return session;
    }

    _buildSessionReport(reason = 'completed') {
        const totalElapsed = Math.round((Date.now() - this.sessionStartTime) / 1000);
        const effectiveFocus = Math.round((this.totalDuration - this.timeLeft) / 60);

        // Calculate focus score
        const pausePenalty = this.pauseCount * 5;
        const distractionPenalty = this.distractions * 3;
        this.focusScore = Math.max(0, Math.min(100, 100 - pausePenalty - distractionPenalty));

        return {
            modeId: this.modeId,
            modeName: this.mode?.name || 'Unknown',
            modeIcon: this.mode?.icon || '⏱️',
            duration: effectiveFocus,
            totalElapsed,
            roundsCompleted: this.currentRound,
            totalRounds: this.totalRounds,
            distractions: this.distractions,
            pauseCount: this.pauseCount,
            focusScore: this.focusScore,
            date: new Date().toISOString(),
            reason,
        };
    }
}
