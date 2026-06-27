/**
 * ============================================================
 * Fikr Timer · Advanced Workout Module
 * HIIT, Tabata, AMRAP, EMOM, custom circuit training timer
 * with exercise tracking, rest management, and audio cues.
 * ============================================================
 *
 * Features:
 *  - Multiple workout types: HIIT, Tabata, AMRAP, EMOM, Custom
 *  - Configurable exercise & rest durations (seconds)
 *  - Round and set management (sets × rounds structure)
 *  - Exercise name announcements (Web Speech API)
 *  - Countdown beeps for last 3 seconds
 *  - Auto‑advance with transition warnings
 *  - Warm‑up and cool‑down phases
 *  - Exercise library with presets
 *  - Session summary with calories burned estimate
 *  - Rest skipping and round extension
 *  - Visual phase indicators (Exercise/Rest/Transition)
 *
 * Usage:
 *   const workout = new WorkoutEngine(config);
 *   workout.setCircuit(exercises);
 *   workout.start();
 *   workout.skipRest();
 *   const report = workout.endSession();
 */

import { playSound, formatTime, generateId } from '../utils.js';
import { StorageManager } from '../storage.js';

// ---------- WORKOUT TYPES ----------
const WORKOUT_TYPES = {
    hiit: {
        name: 'HIIT',
        description: 'High-Intensity Interval Training',
        defaultExercise: 45,
        defaultRest: 15,
        defaultRounds: 8,
        defaultSets: 1,
    },
    tabata: {
        name: 'Tabata',
        description: '20s work, 10s rest, 8 rounds',
        defaultExercise: 20,
        defaultRest: 10,
        defaultRounds: 8,
        defaultSets: 1,
    },
    amrap: {
        name: 'AMRAP',
        description: 'As Many Rounds As Possible in time limit',
        defaultExercise: 0,
        defaultRest: 0,
        defaultRounds: 0,
        defaultSets: 1,
        timeLimit: 10, // minutes
    },
    emom: {
        name: 'EMOM',
        description: 'Every Minute On the Minute',
        defaultExercise: 40,
        defaultRest: 20,
        defaultRounds: 10,
        defaultSets: 1,
    },
    circuit: {
        name: 'Circuit Training',
        description: 'Multiple exercises in sequence',
        defaultExercise: 45,
        defaultRest: 15,
        defaultRounds: 3,
        defaultSets: 2,
    },
    custom: {
        name: 'Custom Workout',
        description: 'Your own workout structure',
        defaultExercise: 45,
        defaultRest: 15,
        defaultRounds: 8,
        defaultSets: 1,
    },
};

// ---------- EXERCISE LIBRARY ----------
const EXERCISE_LIBRARY = [
    { name: 'Jumping Jacks', category: 'cardio', difficulty: 'easy', caloriesPerMin: 8 },
    { name: 'Burpees', category: 'full-body', difficulty: 'hard', caloriesPerMin: 12 },
    { name: 'Mountain Climbers', category: 'cardio', difficulty: 'medium', caloriesPerMin: 10 },
    { name: 'Push-ups', category: 'upper-body', difficulty: 'medium', caloriesPerMin: 7 },
    { name: 'Squats', category: 'lower-body', difficulty: 'easy', caloriesPerMin: 8 },
    { name: 'Lunges', category: 'lower-body', difficulty: 'medium', caloriesPerMin: 7 },
    { name: 'Plank Hold', category: 'core', difficulty: 'medium', caloriesPerMin: 5 },
    { name: 'High Knees', category: 'cardio', difficulty: 'medium', caloriesPerMin: 10 },
    { name: 'Bicycle Crunches', category: 'core', difficulty: 'medium', caloriesPerMin: 7 },
    { name: 'Dumbbell Rows', category: 'upper-body', difficulty: 'medium', caloriesPerMin: 6 },
    { name: 'Kettlebell Swings', category: 'full-body', difficulty: 'hard', caloriesPerMin: 11 },
    { name: 'Box Jumps', category: 'plyometric', difficulty: 'hard', caloriesPerMin: 12 },
    { name: 'Battle Ropes', category: 'cardio', difficulty: 'hard', caloriesPerMin: 11 },
    { name: 'Russian Twists', category: 'core', difficulty: 'easy', caloriesPerMin: 6 },
    { name: 'Deadlifts', category: 'lower-body', difficulty: 'hard', caloriesPerMin: 8 },
];

// ---------- PHASES ----------
const PHASES = {
    WARMUP: 'warmup',
    EXERCISE: 'exercise',
    REST: 'rest',
    TRANSITION: 'transition',
    COOLDOWN: 'cooldown',
    COMPLETED: 'completed',
};

// ---------- WORKOUT ENGINE ----------
export class WorkoutEngine {
    constructor(config = {}) {
        this.storage = new StorageManager();

        // Workout configuration
        this.workoutType = config.type || 'hiit';
        this.typeConfig = { ...WORKOUT_TYPES[this.workoutType] };
        this.exerciseDuration = config.exerciseDuration || this.typeConfig.defaultExercise;
        this.restDuration = config.restDuration || this.typeConfig.defaultRest;
        this.rounds = config.rounds || this.typeConfig.defaultRounds;
        this.sets = config.sets || this.typeConfig.defaultSets;
        this.timeLimit = config.timeLimit || this.typeConfig.timeLimit || 0; // minutes

        // Circuit exercises
        this.exercises = config.exercises || [];
        this.currentExerciseIndex = 0;

        // Warm-up / cool-down
        this.warmupEnabled = config.warmupEnabled || false;
        this.warmupDuration = config.warmupDuration || 180; // 3 minutes
        this.cooldownEnabled = config.cooldownEnabled || false;
        this.cooldownDuration = config.cooldownDuration || 120; // 2 minutes

        // Features
        this.soundEnabled = config.soundEnabled !== false;
        this.voiceEnabled = config.voiceEnabled !== false;
        this.vibrationEnabled = config.vibrationEnabled !== false;
        this.autoAdvance = config.autoAdvance !== false;
        this.countdownBeeps = config.countdownBeeps !== false;

        // State
        this.phase = PHASES.WARMUP;
        this.currentSet = 1;
        this.currentRound = 1;
        this.timeLeft = 0;
        this.totalPhaseDuration = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.sessionId = null;
        this.sessionStartTime = null;
        this.totalElapsedTime = 0;

        // Tracking
        this.completedExercises = [];
        this.totalExerciseTime = 0;
        this.totalRestTime = 0;
        this.skippedRests = 0;
        this.extendedRounds = 0;
        this.heartRateReadings = []; // simulated

        // Interval
        this._interval = null;

        // Callbacks
        this.onTick = null;             // (timeLeft, phase, exercise)
        this.onPhaseChange = null;      // (newPhase, oldPhase, exercise)
        this.onSetComplete = null;      // (setNumber, totalSets)
        this.onRoundComplete = null;    // (roundNumber, totalRounds)
        this.onExerciseChange = null;   // (exercise, index)
        this.onComplete = null;         // (sessionReport)
        this.onCountdown = null;        // (secondsRemaining)
    }

    // ---------- PUBLIC API ----------

    /**
     * Configure workout parameters.
     */
    configure(config) {
        Object.assign(this, config);
        if (config.type && WORKOUT_TYPES[config.type]) {
            this.typeConfig = { ...WORKOUT_TYPES[config.type] };
        }
        return this;
    }

    /**
     * Set exercises for circuit training.
     */
    setCircuit(exercises) {
        this.exercises = Array.isArray(exercises) ? exercises : [exercises];
        this.currentExerciseIndex = 0;
        return this;
    }

    /**
     * Add an exercise to the circuit.
     */
    addExercise(exercise) {
        this.exercises.push(exercise);
        return this;
    }

    /**
     * Start the workout.
     */
    start() {
        if (this.isRunning) return;

        this.sessionId = generateId();
        this.sessionStartTime = Date.now();

        // Determine starting phase
        if (this.warmupEnabled) {
            this.phase = PHASES.WARMUP;
            this.timeLeft = this.warmupDuration;
        } else {
            this.phase = PHASES.EXCERCISE;
            this.timeLeft = this._getExerciseDuration();
        }

        this.totalPhaseDuration = this.timeLeft;
        this.isRunning = true;
        this.isPaused = false;

        this._startTimer();
        this._announcePhase();

        return this;
    }

    /**
     * Pause the workout.
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
     * Skip current rest period.
     */
    skipRest() {
        if (this.phase !== PHASES.REST && this.phase !== PHASES.TRANSITION) {
            return false;
        }
        this.skippedRests++;
        this._advanceToNextExercise();
        return true;
    }

    /**
     * Extend current exercise by N seconds.
     */
    extendExercise(seconds = 15) {
        if (this.phase !== PHASES.EXCERCISE) return false;
        this.timeLeft += seconds;
        this.totalPhaseDuration += seconds;
        this.extendedRounds++;
        return true;
    }

    /**
     * End the workout session.
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
        return {
            phase: this.phase,
            currentSet: this.currentSet,
            totalSets: this.sets,
            currentRound: this.currentRound,
            totalRounds: this.rounds,
            currentExercise: this._getCurrentExercise(),
            timeLeft: this.timeLeft,
            totalPhaseDuration: this.totalPhaseDuration,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            progress: this._getProgress(),
            totalElapsed: Math.round((Date.now() - this.sessionStartTime) / 1000),
        };
    }

    /**
     * Get current exercise info.
     */
    _getCurrentExercise() {
        if (this.exercises.length === 0) {
            return { name: 'Exercise', category: 'general', difficulty: 'medium' };
        }
        return this.exercises[this.currentExerciseIndex % this.exercises.length];
    }

    /**
     * Get exercise duration (may vary per exercise in circuit mode).
     */
    _getExerciseDuration() {
        if (this.workoutType === 'amrap') {
            return 0; // Continuous
        }
        return this.exerciseDuration;
    }

    /**
     * Get progress as decimal.
     */
    _getProgress() {
        if (this.totalPhaseDuration <= 0) return 0;
        return this.timeLeft / this.totalPhaseDuration;
    }

    // ---------- PRIVATE METHODS ----------

    _startTimer() {
        clearInterval(this._interval);

        this._interval = setInterval(() => {
            // Countdown beeps for last 3 seconds
            if (this.countdownBeeps && this.timeLeft <= 3 && this.timeLeft > 0) {
                if (this.onCountdown) this.onCountdown(this.timeLeft);
                playSound('beep');
            }

            if (this.timeLeft <= 0) {
                this._handlePhaseEnd();
                return;
            }

            this.timeLeft--;

            if (this.onTick) {
                this.onTick(this.timeLeft, this.phase, this._getCurrentExercise());
            }
        }, 1000);
    }

    _handlePhaseEnd() {
        switch (this.phase) {
            case PHASES.WARMUP:
                this.phase = PHASES.EXCERCISE;
                this.timeLeft = this._getExerciseDuration();
                break;

            case PHASES.EXCERCISE:
                this._recordExerciseComplete();
                if (this._shouldRest()) {
                    this.phase = PHASES.REST;
                    this.timeLeft = this.restDuration;
                } else {
                    this._advanceRound();
                }
                break;

            case PHASES.REST:
            case PHASES.TRANSITION:
                this._advanceRound();
                break;

            case PHASES.COOLDOWN:
                this.endSession();
                return;

            default:
                this.endSession();
                return;
        }

        this.totalPhaseDuration = this.timeLeft;

        if (this.isRunning) {
            this._announcePhase();
            if (this.onPhaseChange) {
                this.onPhaseChange(this.phase, this._getPreviousPhase(), this._getCurrentExercise());
            }
        }

        // Check AMRAP time limit
        if (this.workoutType === 'amrap' && this.timeLimit > 0) {
            const elapsed = (Date.now() - this.sessionStartTime) / 60000;
            if (elapsed >= this.timeLimit) {
                this.endSession();
                return;
            }
        }
    }

    _shouldRest() {
        if (this.workoutType === 'amrap' || this.workoutType === 'tabata') {
            return true; // Always rest between rounds
        }
        return this.restDuration > 0 && this.currentRound < this.rounds;
    }

    _advanceRound() {
        this.currentRound++;

        if (this.currentRound > this.rounds) {
            // Set complete
            this.currentRound = 1;
            this.currentSet++;

            if (this.onSetComplete) {
                this.onSetComplete(this.currentSet - 1, this.sets);
            }

            if (this.currentSet > this.sets) {
                // All sets complete
                if (this.cooldownEnabled) {
                    this.phase = PHASES.COOLDOWN;
                    this.timeLeft = this.cooldownDuration;
                } else {
                    this.endSession();
                    return;
                }
            } else {
                // Start new set
                this.phase = PHASES.EXCERCISE;
                this.timeLeft = this._getExerciseDuration();
            }
        } else {
            // Next round in current set
            if (this.onRoundComplete) {
                this.onRoundComplete(this.currentRound - 1, this.rounds);
            }

            this.phase = PHASES.EXCERCISE;
            this.timeLeft = this._getExerciseDuration();

            // Advance exercise in circuit
            if (this.exercises.length > 1) {
                this.currentExerciseIndex++;
                if (this.onExerciseChange) {
                    this.onExerciseChange(
                        this._getCurrentExercise(),
                        this.currentExerciseIndex % this.exercises.length
                    );
                }
            }
        }
    }

    _advanceToNextExercise() {
        this.currentRound++;

        if (this.currentRound > this.rounds) {
            this.currentRound = 1;
            this.currentSet++;

            if (this.onSetComplete) {
                this.onSetComplete(this.currentSet - 1, this.sets);
            }

            if (this.currentSet > this.sets) {
                if (this.cooldownEnabled) {
                    this.phase = PHASES.COOLDOWN;
                    this.timeLeft = this.cooldownDuration;
                } else {
                    this.endSession();
                    return;
                }
            }
        }

        this.phase = PHASES.EXCERCISE;
        this.timeLeft = this._getExerciseDuration();
        this.totalPhaseDuration = this.timeLeft;

        if (this.exercises.length > 1) {
            this.currentExerciseIndex++;
            if (this.onExerciseChange) {
                this.onExerciseChange(
                    this._getCurrentExercise(),
                    this.currentExerciseIndex % this.exercises.length
                );
            }
        }

        if (this.onPhaseChange) {
            this.onPhaseChange(this.phase, PHASES.REST, this._getCurrentExercise());
        }

        this._announcePhase();
    }

    _recordExerciseComplete() {
        this.completedExercises.push({
            exercise: { ...this._getCurrentExercise() },
            duration: this.totalPhaseDuration - this.timeLeft,
            set: this.currentSet,
            round: this.currentRound,
            timestamp: Date.now(),
        });
        this.totalExerciseTime += (this.totalPhaseDuration - this.timeLeft);
    }

    _announcePhase() {
        if (!this.voiceEnabled || !('speechSynthesis' in window)) return;

        window.speechSynthesis.cancel();

        let text = '';
        const exercise = this._getCurrentExercise();

        switch (this.phase) {
            case PHASES.WARMUP:
                text = 'Warm up';
                break;
            case PHASES.EXCERCISE:
                text = exercise.name;
                break;
            case PHASES.REST:
                text = 'Rest';
                break;
            case PHASES.TRANSITION:
                text = 'Get ready';
                break;
            case PHASES.COOLDOWN:
                text = 'Cool down';
                break;
        }

        if (text) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            utterance.volume = 0.7;
            window.speechSynthesis.speak(utterance);
        }

        // Vibration
        if (this.vibrationEnabled && navigator.vibrate) {
            const pattern = this.phase === PHASES.EXCERCISE ? [300] :
                           this.phase === PHASES.REST ? [100, 100, 100] : [200];
            navigator.vibrate(pattern);
        }
    }

    _getPreviousPhase() {
        if (this.phase === PHASES.EXCERCISE) return PHASES.REST;
        if (this.phase === PHASES.REST) return PHASES.EXCERCISE;
        return PHASES.EXCERCISE;
    }

    _generateReport() {
        const totalDuration = Math.round((Date.now() - this.sessionStartTime) / 1000);
        const caloriesPerMin = this.completedExercises.reduce(
            (sum, e) => sum + (e.exercise.caloriesPerMin || 7), 0
        ) / Math.max(1, this.completedExercises.length);
        const estimatedCalories = Math.round(caloriesPerMin * (this.totalExerciseTime / 60));

        return {
            sessionId: this.sessionId,
            type: 'workout',
            workoutType: this.workoutType,
            workoutName: this.typeConfig.name,

            // Timing
            startTime: new Date(this.sessionStartTime).toISOString(),
            endTime: new Date().toISOString(),
            totalDurationSeconds: totalDuration,
            totalDurationMin: Math.round(totalDuration / 60 * 10) / 10,

            // Structure
            sets: this.sets,
            roundsPerSet: this.rounds,
            setsCompleted: this.currentSet,
            roundsInLastSet: this.currentRound - 1,

            // Exercise details
            exercises: this.exercises.map(e => e.name),
            completedExercises: this.completedExercises,
            totalExerciseTimeSeconds: this.totalExerciseTime,
            totalRestTimeSeconds: this.totalRestTime,

            // Metrics
            skippedRests: this.skippedRests,
            extendedRounds: this.extendedRounds,
            estimatedCaloriesBurned: estimatedCalories,
            averageHeartRate: this._calculateAverageHR(),

            // Config
            warmupEnabled: this.warmupEnabled,
            cooldownEnabled: this.cooldownEnabled,
            exerciseDuration: this.exerciseDuration,
            restDuration: this.restDuration,
        };
    }

    _calculateAverageHR() {
        if (this.heartRateReadings.length === 0) return 0;
        return Math.round(
            this.heartRateReadings.reduce((a, b) => a + b, 0) / this.heartRateReadings.length
        );
    }

    async _saveSession(report) {
        try {
            const history = await this.storage.get('workoutHistory') || [];
            history.unshift(report);
            await this.storage.set('workoutHistory', history.slice(0, 100));
        } catch (err) {
            console.error('Failed to save workout session:', err);
        }
    }

    /**
     * Get exercise library.
     */
    static getExerciseLibrary() {
        return EXERCISE_LIBRARY;
    }

    /**
     * Get workout types.
     */
    static getWorkoutTypes() {
        return Object.keys(WORKOUT_TYPES).map(key => ({
            id: key,
            ...WORKOUT_TYPES[key],
        }));
    }

    /**
     * Get lifetime workout statistics.
     */
    static async getStatistics(storage = new StorageManager()) {
        const history = await storage.get('workoutHistory') || [];

        if (history.length === 0) {
            return {
                totalWorkouts: 0,
                totalMinutes: 0,
                totalCalories: 0,
                favoriteType: null,
                typeStats: {},
            };
        }

        const totalMinutes = history.reduce((sum, s) => sum + (s.totalDurationMin || 0), 0);
        const totalCalories = history.reduce((sum, s) => sum + (s.estimatedCaloriesBurned || 0), 0);

        const typeStats = {};
        history.forEach(s => {
            const type = s.workoutName || s.workoutType;
            if (!typeStats[type]) {
                typeStats[type] = { count: 0, totalMinutes: 0, totalCalories: 0 };
            }
            typeStats[type].count++;
            typeStats[type].totalMinutes += (s.totalDurationMin || 0);
            typeStats[type].totalCalories += (s.estimatedCaloriesBurned || 0);
        });

        const favoriteType = Object.entries(typeStats)
            .sort((a, b) => b[1].count - a[1].count)[0]?.[0] || null;

        return {
            totalWorkouts: history.length,
            totalMinutes: Math.round(totalMinutes * 10) / 10,
            totalCalories,
            favoriteType,
            typeStats,
        };
    }
}

export default WorkoutEngine;
