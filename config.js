/**
 * ============================================================
 * Fikr Timer · Application Configuration
 * Centralized constants, defaults, presets, and enums
 * used across all modules.
 * ============================================================
 *
 * Purpose:
 *  - Single source of truth for all configuration
 *  - Easy customization without touching module code
 *  - Environment‑specific overrides
 *  - Feature flags for gradual rollouts
 *  - Localization strings (English default)
 *
 * Usage:
 *   import { MODES, COLORS, DEFAULTS, FEATURES } from './config.js';
 */

// ============================================================
// APPLICATION METADATA
// ============================================================
export const APP = {
    name: 'Fikr Timer',
    shortName: 'Fikr',
    version: '3.0.0',
    buildDate: '2025-01-15',
    description: 'Advanced focus & breathing timer with analytics',
    author: 'Fikr Team',
    license: 'MIT',
    repository: 'https://github.com/user/fikr-timer',
    website: 'https://fikr-timer.app',
};

// ============================================================
// FEATURE FLAGS
// ============================================================
export const FEATURES = {
    // Core features
    pomodoro: true,
    breathing: true,
    workout: true,
    exam: true,
    deepWork: true,
    customTimer: true,
    stopwatch: true,
    countdown: true,

    // Advanced features
    soundscapes: true,
    binauralBeats: true,
    particles: true,
    achievements: true,
    xpSystem: true,
    dailyChallenges: true,
    rewards: true,

    // Analytics
    analytics: true,
    heatmap: true,
    weeklyChart: true,
    modeDistribution: true,
    exportData: true,

    // UI
    darkMode: true,
    accentColors: true,
    glassmorphism: true,
    animations: true,
    keyboardShortcuts: true,
    fullscreen: true,

    // PWA
    offlineSupport: true,
    notifications: true,
    installPrompt: true,

    // Experimental
    biofeedback: false,
    voiceGuidance: true,
    cameraBreathing: false,
    cloudSync: false,
    socialFeatures: false,
};

// ============================================================
// TIMER MODES
// ============================================================
export const MODES = [
    {
        id: 'pomodoro',
        name: 'Pomodoro',
        icon: '🍅',
        description: 'Classic 25/5 focus intervals with long breaks',
        category: 'focus',
        defaults: { focus: 25, break: 5, longBreak: 15, rounds: 4 },
        color: '#ef4444',
    },
    {
        id: 'study',
        name: 'Study Mode',
        icon: '📚',
        description: 'Extended study sessions with subject tracking',
        category: 'focus',
        defaults: { focus: 50, break: 10 },
        color: '#3b82f6',
    },
    {
        id: 'deepwork',
        name: 'Deep Work',
        icon: '🧠',
        description: '90‑minute flow state for maximum productivity',
        category: 'focus',
        defaults: { focus: 90, break: 15 },
        color: '#7c5ce7',
    },
    {
        id: 'countdown',
        name: 'Countdown',
        icon: '⏲️',
        description: 'Simple countdown timer for any duration',
        category: 'basic',
        defaults: { focus: 30 },
        color: '#6b7280',
    },
    {
        id: 'stopwatch',
        name: 'Stopwatch',
        icon: '⏱️',
        description: 'Track time elapsed for any activity',
        category: 'basic',
        defaults: {},
        color: '#6b7280',
    },
    {
        id: 'interval',
        name: 'Interval',
        icon: '🔄',
        description: 'Alternating work and rest intervals',
        category: 'focus',
        defaults: { focus: 30, break: 10, rounds: 6 },
        color: '#10b981',
    },
    {
        id: 'exam',
        name: 'Exam Mode',
        icon: '📝',
        description: 'Per‑question timing with section management',
        category: 'specialized',
        defaults: { questions: 20, time: 60 },
        color: '#f59e0b',
    },
    {
        id: 'reading',
        name: 'Reading',
        icon: '📖',
        description: 'Track reading sessions with page goals',
        category: 'specialized',
        defaults: { pages: 30, time: 30 },
        color: '#8b5cf6',
    },
    {
        id: 'coding',
        name: 'Coding Sprint',
        icon: '💻',
        description: 'Focused coding sessions with task tracking',
        category: 'specialized',
        defaults: { focus: 45 },
        color: '#06b6d4',
    },
    {
        id: 'workout',
        name: 'Workout',
        icon: '💪',
        description: 'HIIT, Tabata, and circuit training timer',
        category: 'fitness',
        defaults: { exercise: 45, rest: 15, rounds: 8 },
        color: '#f97316',
    },
    {
        id: 'breathing',
        name: 'Breathing',
        icon: '🧘',
        description: 'Guided breathing exercises with patterns',
        category: 'wellness',
        defaults: { inhale: 4, hold: 4, exhale: 4, hold2: 4, cycles: 5 },
        color: '#a78bfa',
    },
    {
        id: 'prayer',
        name: 'Prayer/Break',
        icon: '🙏',
        description: 'Short prayer or mindfulness break',
        category: 'wellness',
        defaults: { focus: 10, break: 2 },
        color: '#c084fc',
    },
    {
        id: 'custom',
        name: 'Custom Timer',
        icon: '⚙️',
        description: 'Build your own timer with custom phases',
        category: 'basic',
        defaults: { focus: 30, break: 5, rounds: 4 },
        color: '#6366f1',
    },
];

// ============================================================
// ACCENT COLORS
// ============================================================
export const COLORS = [
    { name: 'Purple', hex: '#7c5ce7', cssVar: 'purple' },
    { name: 'Blue', hex: '#3b82f6', cssVar: 'blue' },
    { name: 'Green', hex: '#10b981', cssVar: 'green' },
    { name: 'Orange', hex: '#f59e0b', cssVar: 'orange' },
    { name: 'Red', hex: '#ef4444', cssVar: 'red' },
    { name: 'Pink', hex: '#ec4899', cssVar: 'pink' },
    { name: 'Indigo', hex: '#6366f1', cssVar: 'indigo' },
    { name: 'Teal', hex: '#14b8a6', cssVar: 'teal' },
    { name: 'Amber', hex: '#f97316', cssVar: 'amber' },
    { name: 'Cyan', hex: '#06b6d4', cssVar: 'cyan' },
    { name: 'Violet', hex: '#8b5cf6', cssVar: 'violet' },
    { name: 'Rose', hex: '#f43f5e', cssVar: 'rose' },
];

// ============================================================
// DEFAULT SETTINGS
// ============================================================
export const DEFAULTS = {
    // Timer
    defaultMode: 'pomodoro',
    focusDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    rounds: 4,

    // Sound
    soundEnabled: true,
    masterVolume: 0.8,
    ambientVolume: 0.5,
    binauralVolume: 0.3,
    alertType: 'chime',

    // Notifications
    notificationsEnabled: false,
    notifyOnComplete: true,
    notifyOnBreak: true,
    notifyOnMilestone: true,

    // UI
    theme: 'dark', // 'dark' | 'light' | 'auto'
    accentColor: '#7c5ce7',
    fontSize: 'medium', // 'small' | 'medium' | 'large'
    reducedMotion: false,
    showSeconds: true,
    dateFormat: 'medium',

    // Timer behavior
    autoStartBreaks: false,
    autoStartFocus: false,
    warnBeforeEnd: true,
    warningSeconds: 30,

    // Analytics
    dailyGoal: 120, // minutes
    weeklyGoal: 600,
    trackHistory: true,

    // Privacy
    shareAnalytics: false,
    enableCloudSync: false,
};

// ============================================================
// STORAGE KEYS
// ============================================================
export const STORAGE_KEYS = {
    appState: 'appState',
    settings: 'settings',
    profile: 'userProfile',
    timerHistory: 'timerHistory',
    pomodoroHistory: 'pomodoroHistory',
    breathingHistory: 'breathingHistory',
    workoutHistory: 'workoutHistory',
    deepworkHistory: 'deepworkHistory',
    examHistory: 'examHistory',
    customTimerHistory: 'customTimerHistory',
    customTimerPresets: 'customTimerPresets',
    soundPresets: 'soundPresets',
    worldClocks: 'worldClocks',
    achievements: 'achievements',
    pomodoroStreak: 'pomodoroStreak',
    deepworkStreak: 'deepworkStreak',
};

// ============================================================
// ROUTES
// ============================================================
export const ROUTES = {
    home: 'home',
    timer: 'timer',
    analytics: 'analytics',
    profile: 'profile',
    settings: 'settings',
};

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
export const SHORTCUTS = {
    startPause: 'Space',
    reset: 'r',
    addTime: '+',
    skipBreak: 's',
    toggleTheme: 't',
    toggleSound: 'm',
    home: '1',
    timer: '2',
    analytics: '3',
    profile: '4',
    settings: '5',
};

// ============================================================
// TIMER CONSTANTS
// ============================================================
export const TIMER = {
    minDuration: 1,       // minutes
    maxDuration: 300,     // minutes
    minBreak: 0,
    maxBreak: 60,
    minRounds: 1,
    maxRounds: 20,
    addTimeIncrement: 300, // 5 minutes in seconds
    progressCircumference: 565.5, // 2π × 90
};

// ============================================================
// BREATHING PATTERNS
// ============================================================
export const BREATHING_PATTERNS = {
    box: {
        name: 'Box Breathing',
        inhale: 4,
        hold: 4,
        exhale: 4,
        hold2: 4,
        cycles: 5,
    },
    '478': {
        name: '4‑7‑8 Breathing',
        inhale: 4,
        hold: 7,
        exhale: 8,
        hold2: 0,
        cycles: 4,
    },
    deep: {
        name: 'Deep Relaxation',
        inhale: 5,
        hold: 5,
        exhale: 5,
        hold2: 5,
        cycles: 6,
    },
    energizing: {
        name: 'Energizing',
        inhale: 3,
        hold: 0,
        exhale: 6,
        hold2: 2,
        cycles: 8,
    },
    wimhof: {
        name: 'Wim Hof Method',
        inhale: 2,
        hold: 0,
        exhale: 1,
        hold2: 0,
        cycles: 30,
    },
};

// ============================================================
// WORKOUT TYPES
// ============================================================
export const WORKOUT_TYPES = {
    hiit: { name: 'HIIT', exercise: 45, rest: 15, rounds: 8 },
    tabata: { name: 'Tabata', exercise: 20, rest: 10, rounds: 8 },
    amrap: { name: 'AMRAP', timeLimit: 10 },
    emom: { name: 'EMOM', exercise: 40, rest: 20, rounds: 10 },
    circuit: { name: 'Circuit', exercise: 45, rest: 15, rounds: 3, sets: 2 },
};

// ============================================================
// SOUNDSCAPE PRESETS
// ============================================================
export const SOUNDSCAPE_PRESETS = [
    {
        name: 'Deep Focus',
        ambient: 'brown',
        binaural: 'alpha',
        ambientVolume: 0.4,
        binauralVolume: 0.2,
    },
    {
        name: 'Relaxation',
        ambient: 'rain',
        binaural: 'theta',
        ambientVolume: 0.5,
        binauralVolume: 0.3,
    },
    {
        name: 'Sleep',
        ambient: 'white',
        binaural: 'delta',
        ambientVolume: 0.3,
        binauralVolume: 0.25,
    },
    {
        name: 'Energy',
        ambient: 'cafe',
        binaural: 'beta',
        ambientVolume: 0.4,
        binauralVolume: 0.3,
    },
    {
        name: 'Nature',
        ambient: 'forest',
        binaural: 'alpha',
        ambientVolume: 0.5,
        binauralVolume: 0.2,
    },
];

// ============================================================
// ACHIEVEMENT XP REWARDS
// ============================================================
export const XP_REWARDS = {
    sessionComplete: 10,
    focusScore90Plus: 20,
    focusScore75Plus: 10,
    noDistractions: 15,
    longSession60Min: 20,
    longSession30Min: 10,
    streakDay: 5,
    dailyChallenge: 'variable', // defined per challenge
    achievement: 'variable',    // defined per achievement
};

// ============================================================
// ERROR MESSAGES
// ============================================================
export const ERRORS = {
    storageFull: 'Storage is full. Please clear some data.',
    audioContextFailed: 'Audio could not be initialized.',
    notificationDenied: 'Notifications are blocked.',
    invalidMode: 'Invalid timer mode selected.',
    noPhases: 'No phases configured for this timer.',
    importFailed: 'Could not import data. Invalid format.',
};

// ============================================================
// SUCCESS MESSAGES
// ============================================================
export const MESSAGES = {
    sessionComplete: 'Session completed! 🎉',
    achievementUnlocked: 'Achievement unlocked! 🏆',
    levelUp: 'Level up! 🚀',
    presetSaved: 'Preset saved successfully.',
    dataExported: 'Data exported successfully.',
    dataCleared: 'All data cleared.',
};

// ============================================================
// HELPER: Get mode by ID
// ============================================================
export function getModeById(modeId) {
    return MODES.find(m => m.id === modeId) || null;
}

// ============================================================
// HELPER: Get color by hex
// ============================================================
export function getColorByHex(hex) {
    return COLORS.find(c => c.hex === hex) || COLORS[0];
}

// ============================================================
// HELPER: Get breathing pattern
// ============================================================
export function getBreathingPattern(patternId) {
    return BREATHING_PATTERNS[patternId] || BREATHING_PATTERNS.box;
}

// ============================================================
// HELPER: Get workout type
// ============================================================
export function getWorkoutType(typeId) {
    return WORKOUT_TYPES[typeId] || WORKOUT_TYPES.hiit;
}

// ============================================================
// EXPORT ALL
// ============================================================
export default {
    APP,
    FEATURES,
    MODES,
    COLORS,
    DEFAULTS,
    STORAGE_KEYS,
    ROUTES,
    SHORTCUTS,
    TIMER,
    BREATHING_PATTERNS,
    WORKOUT_TYPES,
    SOUNDSCAPE_PRESETS,
    XP_REWARDS,
    ERRORS,
    MESSAGES,
    getModeById,
    getColorByHex,
    getBreathingPattern,
    getWorkoutType,
};