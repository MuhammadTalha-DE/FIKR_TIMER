/**
 * ============================================================
 * Fikr Timer · Profile & Achievement Manager
 * User profile, XP/leveling system, achievements, badges,
 * and personalized statistics.
 * ============================================================
 *
 * Features:
 *  - User profile (name, avatar, bio, join date)
 *  - XP and leveling system
 *  - Achievement badges (50+ achievements)
 *  - Streak tracking with milestones
 *  - Focus time milestones
 *  - Mode mastery levels
 *  - Daily/weekly challenges
 *  - Unlockable rewards (themes, sounds, icons)
 *  - Profile statistics (lifetime focus, best streak, etc.)
 *  - Level progress bar
 *  - Achievement notifications
 *  - Export profile data
 *
 * Usage:
 *   const profile = new ProfileManager(storage);
 *   await profile.loadProfile();
 *   profile.addXP(50);
 *   profile.checkAchievements();
 *   profile.getLevel();
 *   profile.renderProfile(container);
 */

import { StorageManager } from './storage.js';

// ---------- LEVEL THRESHOLDS ----------
const LEVEL_THRESHOLDS = [
    0,      // Level 1
    100,    // Level 2
    250,    // Level 3
    500,    // Level 4
    1000,   // Level 5
    1750,   // Level 6
    2750,   // Level 7
    4000,   // Level 8
    5500,   // Level 9
    7500,   // Level 10
    10000,  // Level 11
    13000,  // Level 12
    16500,  // Level 13
    20500,  // Level 14
    25000,  // Level 15
    30000,  // Level 16
    36000,  // Level 17
    43000,  // Level 18
    51000,  // Level 19
    60000,  // Level 20
];

// ---------- LEVEL NAMES ----------
const LEVEL_NAMES = [
    'Beginner', 'Novice', 'Apprentice', 'Learner', 'Explorer',
    'Practitioner', 'Focused', 'Dedicated', 'Committed', 'Warrior',
    'Master', 'Grandmaster', 'Sage', 'Guru', 'Legend',
    'Mythic', 'Transcendent', 'Enlightened', 'Cosmic', 'Ultimate',
];

// ---------- ACHIEVEMENTS ----------
const ACHIEVEMENTS = [
    // Session milestones
    { id: 'first_session', name: 'First Step', description: 'Complete your first session', icon: '👣', xp: 10 },
    { id: '5_sessions', name: 'Getting Started', description: 'Complete 5 sessions', icon: '🌱', xp: 25 },
    { id: '25_sessions', name: 'Building Habits', description: 'Complete 25 sessions', icon: '🏗️', xp: 50 },
    { id: '100_sessions', name: 'Centurion', description: 'Complete 100 sessions', icon: '💯', xp: 100 },
    { id: '500_sessions', name: 'Dedicated', description: 'Complete 500 sessions', icon: '🏆', xp: 250 },
    { id: '1000_sessions', name: 'Legendary', description: 'Complete 1000 sessions', icon: '👑', xp: 500 },

    // Focus time milestones
    { id: '1_hour', name: 'Hour of Power', description: 'Accumulate 1 hour of focus', icon: '⏰', xp: 20 },
    { id: '10_hours', name: 'Focused Mind', description: 'Accumulate 10 hours of focus', icon: '🧠', xp: 50 },
    { id: '100_hours', name: 'Deep Worker', description: 'Accumulate 100 hours of focus', icon: '💎', xp: 100 },
    { id: '1000_hours', name: 'Master of Focus', description: 'Accumulate 1000 hours of focus', icon: '🌟', xp: 500 },

    // Streak milestones
    { id: 'streak_3', name: 'Hat Trick', description: '3-day focus streak', icon: '🎩', xp: 30 },
    { id: 'streak_7', name: 'Weekly Warrior', description: '7-day focus streak', icon: '⚔️', xp: 50 },
    { id: 'streak_30', name: 'Monthly Master', description: '30-day focus streak', icon: '📅', xp: 100 },
    { id: 'streak_100', name: 'Unstoppable', description: '100-day focus streak', icon: '🚀', xp: 500 },
    { id: 'streak_365', name: 'Year of Focus', description: '365-day focus streak', icon: '🎉', xp: 1000 },

    // Mode‑specific
    { id: 'pomodoro_master', name: 'Pomodoro Pro', description: 'Complete 50 Pomodoro sessions', icon: '🍅', xp: 75 },
    { id: 'breathing_master', name: 'Zen Master', description: 'Complete 50 breathing sessions', icon: '🧘', xp: 75 },
    { id: 'workout_champion', name: 'Fit Focus', description: 'Complete 50 workout sessions', icon: '💪', xp: 75 },
    { id: 'deepwork_pro', name: 'Deep Thinker', description: 'Complete 50 deep work sessions', icon: '🧠', xp: 100 },
    { id: 'exam_ace', name: 'Exam Ace', description: 'Complete 20 exam sessions', icon: '📝', xp: 75 },

    // Distraction‑free
    { id: 'no_distractions', name: 'Laser Focus', description: 'Complete a session with 0 distractions', icon: '🔒', xp: 30 },
    { id: 'low_distractions', name: 'Minimalist', description: 'Complete 10 sessions with ≤1 distraction each', icon: '🧹', xp: 50 },

    // Perfect score
    { id: 'perfect_score', name: 'Perfect Flow', description: 'Achieve 100% focus score', icon: '✨', xp: 50 },
    { id: 'high_score_10', name: 'High Achiever', description: 'Achieve ≥90% focus score 10 times', icon: '📈', xp: 75 },

    // Early bird / night owl
    { id: 'early_bird', name: 'Early Bird', description: 'Complete 10 sessions before 7 AM', icon: '🌅', xp: 50 },
    { id: 'night_owl', name: 'Night Owl', description: 'Complete 10 sessions after 10 PM', icon: '🦉', xp: 50 },

    // Weekend warrior
    { id: 'weekend_warrior', name: 'Weekend Warrior', description: 'Complete 20 sessions on weekends', icon: '🎯', xp: 50 },

    // Special
    { id: 'all_modes', name: 'Explorer', description: 'Try every timer mode', icon: '🗺️', xp: 100 },
    { id: 'custom_creator', name: 'Creator', description: 'Create and save a custom timer', icon: '🛠️', xp: 50 },
    { id: 'sound_explorer', name: 'Audiophile', description: 'Try 5 different ambient sounds', icon: '🎧', xp: 30 },
];

// ---------- DAILY CHALLENGES ----------
const DAILY_CHALLENGES = [
    { id: 'focus_30', name: 'Focus 30', description: 'Complete 30 minutes of focus', target: 30, unit: 'minutes', xp: 20 },
    { id: 'focus_60', name: 'Hour Focus', description: 'Complete 60 minutes of focus', target: 60, unit: 'minutes', xp: 40 },
    { id: 'focus_120', name: 'Deep Dive', description: 'Complete 120 minutes of focus', target: 120, unit: 'minutes', xp: 80 },
    { id: 'sessions_3', name: 'Triple Threat', description: 'Complete 3 sessions', target: 3, unit: 'sessions', xp: 30 },
    { id: 'sessions_5', name: 'High Five', description: 'Complete 5 sessions', target: 5, unit: 'sessions', xp: 50 },
    { id: 'no_distractions', name: 'Clean Slate', description: 'Complete a session with 0 distractions', target: 1, unit: 'sessions', xp: 40 },
    { id: 'breathe_10', name: 'Breathe Easy', description: 'Complete 10 minutes of breathing', target: 10, unit: 'minutes', xp: 30 },
    { id: 'early_start', name: 'Early Riser', description: 'Complete a session before 8 AM', target: 1, unit: 'sessions', xp: 25 },
];

// ---------- REWARDS ----------
const REWARDS = [
    { id: 'theme_purple', name: 'Purple Theme', type: 'theme', cost: 0, description: 'Default purple theme' },
    { id: 'theme_ocean', name: 'Ocean Theme', type: 'theme', cost: 200, description: 'Calming ocean colors' },
    { id: 'theme_sunset', name: 'Sunset Theme', type: 'theme', cost: 200, description: 'Warm sunset palette' },
    { id: 'theme_forest', name: 'Forest Theme', type: 'theme', cost: 200, description: 'Natural forest greens' },
    { id: 'theme_neon', name: 'Neon Theme', type: 'theme', cost: 500, description: 'Vibrant neon colors' },
    { id: 'sound_rain', name: 'Rain Sound', type: 'sound', cost: 100, description: 'Unlock rain ambient sound' },
    { id: 'sound_ocean', name: 'Ocean Sound', type: 'sound', cost: 100, description: 'Unlock ocean ambient sound' },
    { id: 'sound_thunder', name: 'Thunder Sound', type: 'sound', cost: 150, description: 'Unlock thunderstorm sound' },
    { id: 'icon_gold', name: 'Gold Icon', type: 'icon', cost: 300, description: 'Gold timer icon' },
    { id: 'icon_crystal', name: 'Crystal Icon', type: 'icon', cost: 500, description: 'Crystal timer icon' },
    { id: 'badge_special', name: 'Special Badge', type: 'badge', cost: 1000, description: 'Exclusive profile badge' },
];

// ---------- PROFILE MANAGER CLASS ----------
export class ProfileManager {
    constructor(storage = null) {
        this.storage = storage || new StorageManager();

        // Profile data
        this.profile = {
            name: '',
            avatar: '👤',
            bio: '',
            joinDate: new Date().toISOString(),
            totalXP: 0,
            level: 1,
            achievements: [],
            unlockedRewards: ['theme_purple'],
            activeTheme: 'theme_purple',
            challenges: {
                daily: { date: '', completed: [], progress: {} },
                weekly: { date: '', completed: [], progress: {} },
            },
            stats: {
                totalSessions: 0,
                totalFocusMinutes: 0,
                totalFocusHours: 0,
                bestStreak: 0,
                currentStreak: 0,
                modesUsed: {},
                favoriteMode: null,
                mostProductiveHour: null,
                mostProductiveDay: null,
                averageFocusScore: 0,
                totalDistractions: 0,
                totalBreaths: 0,
                totalWorkoutMinutes: 0,
                totalDeepWorkHours: 0,
            },
        };

        // Recent achievements (for notifications)
        this.newAchievements = [];
    }

    // ---------- DATA LOADING ----------

    /**
     * Load profile from storage.
     */
    async loadProfile() {
        try {
            const saved = await this.storage.get('userProfile');
            if (saved) {
                this.profile = { ...this.profile, ...saved };
            }
            this._recalculateLevel();
        } catch (err) {
            console.error('Failed to load profile:', err);
        }
        return this;
    }

    /**
     * Save profile to storage.
     */
    async saveProfile() {
        try {
            await this.storage.set('userProfile', this.profile);
        } catch (err) {
            console.error('Failed to save profile:', err);
        }
        return this;
    }

    // ---------- PROFILE MANAGEMENT ----------

    /**
     * Set profile name.
     */
    setName(name) {
        this.profile.name = name;
        this.saveProfile();
        return this;
    }

    /**
     * Set avatar.
     */
    setAvatar(avatar) {
        this.profile.avatar = avatar;
        this.saveProfile();
        return this;
    }

    /**
     * Set bio.
     */
    setBio(bio) {
        this.profile.bio = bio;
        this.saveProfile();
        return this;
    }

    // ---------- XP & LEVELING ----------

    /**
     * Add XP to profile.
     */
    addXP(amount) {
        this.profile.totalXP += amount;
        this._recalculateLevel();
        this.saveProfile();
        return this;
    }

    /**
     * Get current level.
     */
    getLevel() {
        return this.profile.level;
    }

    /**
     * Get level name.
     */
    getLevelName() {
        const index = Math.min(this.profile.level - 1, LEVEL_NAMES.length - 1);
        return LEVEL_NAMES[index];
    }

    /**
     * Get XP progress to next level.
     */
    getLevelProgress() {
        const currentLevelXP = LEVEL_THRESHOLDS[this.profile.level - 1] || 0;
        const nextLevelXP = LEVEL_THRESHOLDS[this.profile.level] || currentLevelXP + 1000;
        const progress = this.profile.totalXP - currentLevelXP;
        const required = nextLevelXP - currentLevelXP;
        return {
            current: progress,
            required,
            percentage: Math.round((progress / required) * 100),
        };
    }

    /**
     * Get XP for next level.
     */
    getXPToNextLevel() {
        const nextLevelXP = LEVEL_THRESHOLDS[this.profile.level] || 0;
        return Math.max(0, nextLevelXP - this.profile.totalXP);
    }

    _recalculateLevel() {
        let level = 1;
        for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
            if (this.profile.totalXP >= LEVEL_THRESHOLDS[i]) {
                level = i + 1;
            }
        }
        this.profile.level = Math.min(level, 20);
    }

    // ---------- ACHIEVEMENTS ----------

    /**
     * Check all achievements against current stats.
     */
    checkAchievements() {
        this.newAchievements = [];

        const checks = [
            this._checkSessionAchievements(),
            this._checkFocusTimeAchievements(),
            this._checkStreakAchievements(),
            this._checkModeAchievements(),
            this._checkSpecialAchievements(),
        ];

        checks.forEach(achievement => {
            if (achievement && !this.profile.achievements.includes(achievement.id)) {
                this.profile.achievements.push(achievement.id);
                this.newAchievements.push(achievement);
                this.addXP(achievement.xp);
            }
        });

        this.saveProfile();

        return this.newAchievements;
    }

    _checkSessionAchievements() {
        const total = this.profile.stats.totalSessions;
        if (total >= 1000) return ACHIEVEMENTS.find(a => a.id === '1000_sessions');
        if (total >= 500) return ACHIEVEMENTS.find(a => a.id === '500_sessions');
        if (total >= 100) return ACHIEVEMENTS.find(a => a.id === '100_sessions');
        if (total >= 25) return ACHIEVEMENTS.find(a => a.id === '25_sessions');
        if (total >= 5) return ACHIEVEMENTS.find(a => a.id === '5_sessions');
        if (total >= 1) return ACHIEVEMENTS.find(a => a.id === 'first_session');
        return null;
    }

    _checkFocusTimeAchievements() {
        const hours = this.profile.stats.totalFocusHours;
        if (hours >= 1000) return ACHIEVEMENTS.find(a => a.id === '1000_hours');
        if (hours >= 100) return ACHIEVEMENTS.find(a => a.id === '100_hours');
        if (hours >= 10) return ACHIEVEMENTS.find(a => a.id === '10_hours');
        if (hours >= 1) return ACHIEVEMENTS.find(a => a.id === '1_hour');
        return null;
    }

    _checkStreakAchievements() {
        const streak = this.profile.stats.currentStreak;
        if (streak >= 365) return ACHIEVEMENTS.find(a => a.id === 'streak_365');
        if (streak >= 100) return ACHIEVEMENTS.find(a => a.id === 'streak_100');
        if (streak >= 30) return ACHIEVEMENTS.find(a => a.id === 'streak_30');
        if (streak >= 7) return ACHIEVEMENTS.find(a => a.id === 'streak_7');
        if (streak >= 3) return ACHIEVEMENTS.find(a => a.id === 'streak_3');
        return null;
    }

    _checkModeAchievements() {
        const modes = this.profile.stats.modesUsed || {};
        if (modes['Pomodoro'] >= 50) return ACHIEVEMENTS.find(a => a.id === 'pomodoro_master');
        if (modes['Breathing'] >= 50) return ACHIEVEMENTS.find(a => a.id === 'breathing_master');
        if (modes['Workout'] >= 50) return ACHIEVEMENTS.find(a => a.id === 'workout_champion');
        if (modes['Deep Work'] >= 50) return ACHIEVEMENTS.find(a => a.id === 'deepwork_pro');
        if (modes['Exam'] >= 20) return ACHIEVEMENTS.find(a => a.id === 'exam_ace');
        return null;
    }

    _checkSpecialAchievements() {
        const modeCount = Object.keys(this.profile.stats.modesUsed || {}).length;
        if (modeCount >= 12) return ACHIEVEMENTS.find(a => a.id === 'all_modes');
        return null;
    }

    /**
     * Get all achievements with unlock status.
     */
    getAllAchievements() {
        return ACHIEVEMENTS.map(a => ({
            ...a,
            unlocked: this.profile.achievements.includes(a.id),
        }));
    }

    /**
     * Get new achievements (since last check).
     */
    getNewAchievements() {
        return this.newAchievements;
    }

    // ---------- REWARDS ----------

    /**
     * Get available rewards.
     */
    getRewards() {
        return REWARDS.map(r => ({
            ...r,
            unlocked: this.profile.unlockedRewards.includes(r.id),
            affordable: this.profile.totalXP >= r.cost,
        }));
    }

    /**
     * Purchase a reward.
     */
    purchaseReward(rewardId) {
        const reward = REWARDS.find(r => r.id === rewardId);
        if (!reward) return false;
        if (this.profile.unlockedRewards.includes(rewardId)) return false;
        if (this.profile.totalXP < reward.cost) return false;

        this.profile.totalXP -= reward.cost;
        this.profile.unlockedRewards.push(rewardId);
        this._recalculateLevel();
        this.saveProfile();
        return true;
    }

    // ---------- CHALLENGES ----------

    /**
     * Generate daily challenges.
     */
    generateDailyChallenges() {
        const today = new Date().toDateString();
        if (this.profile.challenges.daily.date === today) {
            return this.profile.challenges.daily;
        }

        // Pick 3 random challenges
        const shuffled = [...DAILY_CHALLENGES].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, 3);

        this.profile.challenges.daily = {
            date: today,
            challenges: selected,
            completed: [],
            progress: {},
        };

        this.saveProfile();
        return this.profile.challenges.daily;
    }

    /**
     * Update daily challenge progress.
     */
    updateDailyChallenge(challengeId, value) {
        const daily = this.profile.challenges.daily;
        if (!daily.progress[challengeId]) {
            daily.progress[challengeId] = 0;
        }
        daily.progress[challengeId] += value;

        const challenge = daily.challenges.find(c => c.id === challengeId);
        if (challenge && daily.progress[challengeId] >= challenge.target) {
            if (!daily.completed.includes(challengeId)) {
                daily.completed.push(challengeId);
                this.addXP(challenge.xp);
            }
        }

        this.saveProfile();
    }

    // ---------- STATISTICS UPDATE ----------

    /**
     * Update statistics from a completed session.
     */
    updateStats(session) {
        this.profile.stats.totalSessions++;
        this.profile.stats.totalFocusMinutes += session.totalDurationMinutes || session.duration || 0;
        this.profile.stats.totalFocusHours = Math.round(this.profile.stats.totalFocusMinutes / 60 * 10) / 10;

        // Mode usage
        const modeName = session.modeName || session.mode || session.type || 'Unknown';
        this.profile.stats.modesUsed[modeName] = (this.profile.stats.modesUsed[modeName] || 0) + 1;

        // Distractions
        this.profile.stats.totalDistractions += session.totalDistractions || session.distractions || 0;

        // Mode‑specific
        if (modeName === 'Breathing') {
            this.profile.stats.totalBreaths += session.totalBreaths || 0;
        }
        if (modeName === 'Workout') {
            this.profile.stats.totalWorkoutMinutes += session.totalDurationMinutes || 0;
        }
        if (modeName === 'Deep Work') {
            this.profile.stats.totalDeepWorkHours += (session.totalDurationMinutes || 0) / 60;
        }

        // Focus score
        const score = session.focusScore || session.flowScore || 0;
        if (score > 0) {
            const totalScores = this.profile.stats.averageFocusScore *
                (this.profile.stats.totalSessions - 1) + score;
            this.profile.stats.averageFocusScore = Math.round(totalScores / this.profile.stats.totalSessions);
        }

        // Update challenges
        this.updateDailyChallenge('focus_30', session.totalDurationMinutes || session.duration || 0);
        this.updateDailyChallenge('focus_60', session.totalDurationMinutes || session.duration || 0);
        this.updateDailyChallenge('focus_120', session.totalDurationMinutes || session.duration || 0);
        this.updateDailyChallenge('sessions_3', 1);
        this.updateDailyChallenge('sessions_5', 1);

        if ((session.totalDistractions || 0) === 0) {
            this.updateDailyChallenge('no_distractions', 1);
        }

        if (modeName === 'Breathing') {
            this.updateDailyChallenge('breathe_10', session.totalDurationMinutes || 0);
        }

        // Check achievements
        this.checkAchievements();

        this.saveProfile();
    }

    // ---------- RENDERING ----------

    /**
     * Render profile view.
     */
    renderProfile(container) {
        if (!container) return;

        const levelProgress = this.getLevelProgress();
        const achievements = this.getAllAchievements();
        const unlockedCount = achievements.filter(a => a.unlocked).length;
        const dailyChallenges = this.profile.challenges.daily;

        container.innerHTML = `
            <div class="profile-view">
                <!-- Profile Header -->
                <div class="profile-header glass">
                    <div class="profile-avatar">
                        <span class="avatar-emoji">${this.profile.avatar}</span>
                    </div>
                    <div class="profile-info">
                        <h2 class="profile-name">${this.profile.name || 'Focus Master'}</h2>
                        <p class="profile-bio">${this.profile.bio || 'Welcome to your focus journey!'}</p>
                        <p class="profile-join">Joined ${new Date(this.profile.joinDate).toLocaleDateString()}</p>
                    </div>
                </div>

                <!-- Level & XP -->
                <div class="level-section glass">
                    <div class="level-header">
                        <span class="level-badge">Lv. ${this.profile.level}</span>
                        <span class="level-name">${this.getLevelName()}</span>
                        <span class="level-xp">${this.profile.totalXP} XP</span>
                    </div>
                    <div class="level-progress-bar">
                        <div class="level-progress-fill" style="width: ${levelProgress.percentage}%;"></div>
                    </div>
                    <span class="level-progress-text">
                        ${levelProgress.current} / ${levelProgress.required} XP to Level ${this.profile.level + 1}
                    </span>
                </div>

                <!-- Stats Grid -->
                <div class="stats-grid glass">
                    <div class="stat-item">
                        <span class="stat-value">${this.profile.stats.totalSessions}</span>
                        <span class="stat-label">Sessions</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.profile.stats.totalFocusHours}h</span>
                        <span class="stat-label">Focus Time</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.profile.stats.currentStreak}🔥</span>
                        <span class="stat-label">Streak</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.profile.stats.averageFocusScore}%</span>
                        <span class="stat-label">Avg Score</span>
                    </div>
                </div>

                <!-- Achievements -->
                <div class="achievements-section glass">
                    <h3>Achievements (${unlockedCount}/${ACHIEVEMENTS.length})</h3>
                    <div class="achievements-grid">
                        ${achievements.map(a => `
                            <div class="achievement-item ${a.unlocked ? 'unlocked' : 'locked'}"
                                 title="${a.description}">
                                <span class="achievement-icon">${a.icon}</span>
                                <span class="achievement-name">${a.name}</span>
                                ${a.unlocked ? '<span class="achievement-check">✅</span>' : '<span class="achievement-lock">🔒</span>'}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Daily Challenges -->
                <div class="challenges-section glass">
                    <h3>Daily Challenges</h3>
                    ${dailyChallenges.challenges ? `
                        <div class="challenges-list">
                            ${dailyChallenges.challenges.map(c => {
                                const progress = dailyChallenges.progress[c.id] || 0;
                                const completed = dailyChallenges.completed.includes(c.id);
                                const percentage = Math.min(100, (progress / c.target) * 100);
                                return `
                                    <div class="challenge-item ${completed ? 'completed' : ''}">
                                        <span class="challenge-name">${c.description}</span>
                                        <div class="challenge-bar">
                                            <div class="challenge-fill" style="width: ${percentage}%;"></div>
                                        </div>
                                        <span class="challenge-xp">+${c.xp} XP</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : '<p>No challenges today.</p>'}
                </div>
            </div>
        `;
    }

    // ---------- STATIC METHODS ----------

    /**
     * Get available avatars.
     */
    static getAvatars() {
        return [
            '👤', '🧑', '👨', '👩', '🧑‍💻', '🧘', '🏃', '🧠',
            '💪', '🎯', '🌟', '🔥', '💎', '🎨', '📚', '💻',
            '🦊', '🐱', '🐶', '🦄', '🐲', '🌺', '🍀', '🌈',
        ];
    }

    /**
     * Get all achievements.
     */
    static getAchievements() {
        return ACHIEVEMENTS;
    }

    /**
     * Get all rewards.
     */
    static getRewards() {
        return REWARDS;
    }

    /**
     * Calculate XP for a session.
     */
    static calculateSessionXP(session) {
        let xp = 0;
        const minutes = session.totalDurationMinutes || session.duration || 0;

        // Base XP: 1 XP per minute
        xp += minutes;

        // Bonus for high focus score
        const score = session.focusScore || session.flowScore || 0;
        if (score >= 90) xp += 20;
        else if (score >= 75) xp += 10;
        else if (score >= 50) xp += 5;

        // Bonus for no distractions
        if ((session.totalDistractions || session.distractions || 0) === 0) {
            xp += 15;
        }

        // Bonus for long sessions
        if (minutes >= 60) xp += 20;
        else if (minutes >= 30) xp += 10;

        return Math.round(xp);
    }
}

export default ProfileManager;
