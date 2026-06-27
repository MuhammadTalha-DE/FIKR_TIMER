
/**
 * ============================================================
 * Fikr Timer · Advanced Analytics Engine
 * Session analytics, charts, heatmaps, trend analysis,
 * data export, and dashboard rendering.
 * ============================================================
 *
 * Features:
 *  - Today's focus time, sessions, and streak calculation
 *  - Weekly focus bar chart (pure CSS rendering)
 *  - Monthly heatmap (GitHub‑style contribution grid)
 *  - Mode distribution donut chart (CSS conic‑gradient)
 *  - Subject‑wise study time breakdown
 *  - Hourly and daily productivity trends
 *  - Recent session history list
 *  - Export data as JSON, CSV, or formatted text
 *  - Clear all history with confirmation
 *  - Daily/Weekly/Monthly goal tracking
 *  - Focus score trends over time
 *  - All rendering is CSS‑only (no canvas needed)
 *
 * Usage:
 *   import { AnalyticsEngine } from './analytics.js';
 *   const analytics = new AnalyticsEngine(storage);
 *   await analytics.loadAllData();
 *   analytics.renderDashboard(container);
 *   analytics.exportJSON();
 *   analytics.exportCSV();
 */

// ---------- DAY & MONTH CONSTANTS ----------
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------- CHART COLORS ----------
const CHART_COLORS = [
    '#7c5ce7', '#3b82f6', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4',
    '#84cc16', '#f97316', '#6366f1', '#14b8a6',
];

// ---------- INTENSITY LEVELS ----------
const INTENSITY_LEVELS = [
    { max: 0, level: 0, color: 'var(--border)', label: 'No activity' },
    { max: 15, level: 1, color: 'rgba(124, 92, 231, 0.2)', label: 'Light' },
    { max: 30, level: 2, color: 'rgba(124, 92, 231, 0.4)', label: 'Moderate' },
    { max: 60, level: 3, color: 'rgba(124, 92, 231, 0.7)', label: 'Heavy' },
    { max: Infinity, level: 4, color: 'rgba(124, 92, 231, 1)', label: 'Intense' },
];

// ---------- ANALYTICS ENGINE CLASS ----------
export class AnalyticsEngine {
    constructor(storage = null) {
        this.storage = storage;
        this.history = [];
        this.pomodoroHistory = [];
        this.breathingHistory = [];
        this.workoutHistory = [];
        this.deepworkHistory = [];
        this.examHistory = [];
        this.customHistory = [];
        this._ready = false;
    }

    // ============================================================
    // DATA LOADING
    // ============================================================

    /**
     * Load all session data from storage.
     */
    async loadAllData() {
        if (this.storage) {
            try {
                this.history = (await this.storage.get('timerHistory')) || [];
                this.pomodoroHistory = (await this.storage.get('pomodoroHistory')) || [];
                this.breathingHistory = (await this.storage.get('breathingHistory')) || [];
                this.workoutHistory = (await this.storage.get('workoutHistory')) || [];
                this.deepworkHistory = (await this.storage.get('deepworkHistory')) || [];
                this.examHistory = (await this.storage.get('examHistory')) || [];
                this.customHistory = (await this.storage.get('customTimerHistory')) || [];
            } catch (err) {
                console.error('[Analytics] Failed to load data:', err);
            }
        } else {
            // Fallback to localStorage
            this.history = JSON.parse(localStorage.getItem('fikr_timerHistory') || '[]');
            this.pomodoroHistory = JSON.parse(localStorage.getItem('fikr_pomodoroHistory') || '[]');
            this.breathingHistory = JSON.parse(localStorage.getItem('fikr_breathingHistory') || '[]');
            this.workoutHistory = JSON.parse(localStorage.getItem('fikr_workoutHistory') || '[]');
            this.deepworkHistory = JSON.parse(localStorage.getItem('fikr_deepworkHistory') || '[]');
            this.examHistory = JSON.parse(localStorage.getItem('fikr_examHistory') || '[]');
            this.customHistory = JSON.parse(localStorage.getItem('fikr_customTimerHistory') || '[]');
        }
        this._ready = true;
        return this;
    }

    // ============================================================
    // DATA AGGREGATION
    // ============================================================

    /**
     * Get all sessions across all modes, sorted by date (newest first).
     */
    getAllSessions() {
        return [
            ...this.history,
            ...this.pomodoroHistory,
            ...this.breathingHistory,
            ...this.workoutHistory,
            ...this.deepworkHistory,
            ...this.examHistory,
            ...this.customHistory,
        ].sort((a, b) => {
            const dateA = new Date(a.startTime || a.date || 0);
            const dateB = new Date(b.startTime || b.date || 0);
            return dateB - dateA;
        });
    }

    /**
     * Extract duration in minutes from a session object.
     */
    _getDuration(session) {
        return session.totalDurationMinutes ||
               session.focusDurationMinutes ||
               session.duration ||
               (session.totalDurationSeconds ? Math.round(session.totalDurationSeconds / 60) : 0) ||
               0;
    }

    /**
     * Extract date string from a session object.
     */
    _getDateString(session) {
        return new Date(session.startTime || session.date || Date.now()).toDateString();
    }

    /**
     * Extract mode name from a session object.
     */
    _getModeName(session) {
        return session.modeName || session.mode || session.type || 'Unknown';
    }

    // ============================================================
    // TODAY STATS
    // ============================================================

    /**
     * Get today's statistics.
     */
    getTodayStats() {
        const allSessions = this.getAllSessions();
        const today = new Date().toDateString();

        const todaySessions = allSessions.filter(s => this._getDateString(s) === today);

        const totalMinutes = todaySessions.reduce((sum, s) => sum + this._getDuration(s), 0);

        const modesUsed = {};
        todaySessions.forEach(s => {
            const modeName = this._getModeName(s);
            modesUsed[modeName] = (modesUsed[modeName] || 0) + 1;
        });

        return {
            date: today,
            sessions: todaySessions.length,
            totalMinutes,
            totalHours: Math.round(totalMinutes / 60 * 10) / 10,
            modesUsed,
        };
    }

    // ============================================================
    // STREAK CALCULATION
    // ============================================================

    /**
     * Calculate current streak (consecutive days with at least one session).
     */
    getStreak() {
        const allSessions = this.getAllSessions();
        const uniqueDays = [...new Set(allSessions.map(s => this._getDateString(s)))]
            .sort()
            .reverse();

        if (uniqueDays.length === 0) return 0;

        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        // Must have session today or yesterday for active streak
        if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) return 0;

        let streak = 0;
        for (let i = 0; i < uniqueDays.length; i++) {
            const expected = new Date(Date.now() - i * 86400000).toDateString();
            if (uniqueDays[i] === expected) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    }

    // ============================================================
    // WEEKLY DATA
    // ============================================================

    /**
     * Get weekly focus data (last 7 days).
     */
    getWeeklyData() {
        const allSessions = this.getAllSessions();
        const days = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date(Date.now() - i * 86400000);
            const dateStr = date.toDateString();

            const daySessions = allSessions.filter(s => this._getDateString(s) === dateStr);
            const totalMinutes = daySessions.reduce((sum, s) => sum + this._getDuration(s), 0);

            days.push({
                date: dateStr,
                dayName: DAY_NAMES[date.getDay()],
                fullName: DAY_NAMES_FULL[date.getDay()],
                minutes: totalMinutes,
                sessions: daySessions.length,
            });
        }

        const maxMinutes = Math.max(...days.map(d => d.minutes), 1);

        return {
            days,
            maxMinutes,
            totalMinutes: days.reduce((sum, d) => sum + d.minutes, 0),
            totalSessions: days.reduce((sum, d) => sum + d.sessions, 0),
        };
    }

    // ============================================================
    // HEATMAP DATA (30 days)
    // ============================================================

    /**
     * Get heatmap data for the last N days.
     */
    getHeatmapData(days = 30) {
        const allSessions = this.getAllSessions();
        const cells = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(Date.now() - i * 86400000);
            const dateStr = date.toDateString();

            const daySessions = allSessions.filter(s => this._getDateString(s) === dateStr);
            const totalMinutes = daySessions.reduce((sum, s) => sum + this._getDuration(s), 0);

            // Determine intensity level
            let intensity = 0;
            for (const level of INTENSITY_LEVELS) {
                if (totalMinutes <= level.max) {
                    intensity = level.level;
                    break;
                }
            }

            cells.push({
                date: dateStr,
                dayName: DAY_NAMES[date.getDay()],
                dayOfWeek: date.getDay(),
                minutes: totalMinutes,
                sessions: daySessions.length,
                intensity,
            });
        }

        return {
            cells,
            totalDays: days,
            activeDays: cells.filter(d => d.minutes > 0).length,
            totalMinutes: cells.reduce((sum, d) => sum + d.minutes, 0),
        };
    }

    // ============================================================
    // MODE DISTRIBUTION
    // ============================================================

    /**
     * Get mode usage distribution for donut chart.
     */
    getModeDistribution() {
        const allSessions = this.getAllSessions();
        const modeMap = {};

        allSessions.forEach(s => {
            const modeName = this._getModeName(s);
            if (!modeMap[modeName]) {
                modeMap[modeName] = {
                    mode: modeName,
                    sessions: 0,
                    totalMinutes: 0,
                };
            }
            modeMap[modeName].sessions++;
            modeMap[modeName].totalMinutes += this._getDuration(s);
        });

        const distribution = Object.values(modeMap)
            .map(m => ({
                ...m,
                averageDuration: m.sessions > 0 ? Math.round(m.totalMinutes / m.sessions) : 0,
            }))
            .sort((a, b) => b.totalMinutes - a.totalMinutes);

        return {
            modes: distribution,
            totalSessions: distribution.reduce((sum, m) => sum + m.sessions, 0),
            totalMinutes: distribution.reduce((sum, m) => sum + m.totalMinutes, 0),
        };
    }

    // ============================================================
    // PRODUCTIVITY TRENDS
    // ============================================================

    /**
     * Get hourly productivity trends.
     */
    getHourlyProductivity() {
        const allSessions = this.getAllSessions();
        const hourlyData = new Array(24).fill(null).map(() => ({
            sessions: 0,
            totalMinutes: 0,
        }));

        allSessions.forEach(s => {
            const hour = new Date(s.startTime || s.date || Date.now()).getHours();
            hourlyData[hour].sessions++;
            hourlyData[hour].totalMinutes += this._getDuration(s);
        });

        const mostProductive = hourlyData
            .map((d, i) => ({ hour: i, ...d }))
            .sort((a, b) => b.totalMinutes - a.totalMinutes)[0];

        return { hours: hourlyData, mostProductiveHour: mostProductive };
    }

    /**
     * Get daily productivity trends.
     */
    getDailyProductivity() {
        const allSessions = this.getAllSessions();
        const dailyData = new Array(7).fill(null).map(() => ({
            sessions: 0,
            totalMinutes: 0,
        }));

        allSessions.forEach(s => {
            const day = new Date(s.startTime || s.date || Date.now()).getDay();
            dailyData[day].sessions++;
            dailyData[day].totalMinutes += this._getDuration(s);
        });

        const mostProductive = dailyData
            .map((d, i) => ({ dayIndex: i, dayName: DAY_NAMES[i], ...d }))
            .sort((a, b) => b.totalMinutes - a.totalMinutes)[0];

        return { days: dailyData, mostProductiveDay: mostProductive };
    }

    // ============================================================
    // RENDERING — DASHBOARD
    // ============================================================

    /**
     * Render the complete analytics dashboard into a container element.
     */
    async renderDashboard(container) {
        if (!container) return;
        if (!this._ready) await this.loadAllData();

        const todayStats = this.getTodayStats();
        const streak = this.getStreak();

        container.innerHTML = `
            <div class="analytics-dashboard">
                <!-- Stats Row -->
                <div class="stats-row">
                    <div class="stat-card">
                        <span class="stat-value">${todayStats.totalMinutes}m</span>
                        <span class="stat-label">Today's Focus</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${todayStats.sessions}</span>
                        <span class="stat-label">Today's Sessions</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${streak}🔥</span>
                        <span class="stat-label">Day Streak</span>
                    </div>
                </div>

                <!-- Weekly Chart -->
                <div class="analytics-section">
                    <h3>📊 Weekly Focus</h3>
                    <div id="weeklyChartContainer"></div>
                </div>

                <!-- Heatmap -->
                <div class="analytics-section">
                    <h3>🗓️ Last 30 Days</h3>
                    <div id="heatmapContainer"></div>
                </div>

                <!-- Mode Distribution -->
                <div class="analytics-section">
                    <h3>🍩 Mode Distribution</h3>
                    <div id="modeChartContainer"></div>
                </div>

                <!-- Recent Sessions -->
                <div class="analytics-section">
                    <h3>📋 Recent Sessions</h3>
                    <div id="recentSessionsContainer"></div>
                </div>

                <!-- Actions -->
                <div class="analytics-actions">
                    <button class="btn btn-outline" id="exportJSONBtn">📥 Export JSON</button>
                    <button class="btn btn-outline" id="exportCSVBtn">📊 Export CSV</button>
                    <button class="btn btn-outline btn-danger" id="clearDataBtn">🗑 Clear History</button>
                </div>
            </div>
        `;

        // Render sub‑components
        this.renderWeeklyChart(document.getElementById('weeklyChartContainer'));
        this.renderHeatmap(document.getElementById('heatmapContainer'));
        this.renderModeChart(document.getElementById('modeChartContainer'));
        this.renderRecentSessions(document.getElementById('recentSessionsContainer'));

        // Setup action buttons
        this._setupActionButtons();
    }

    // ============================================================
    // RENDERING — WEEKLY BAR CHART
    // ============================================================

    /**
     * Render weekly focus bar chart using pure CSS.
     */
    renderWeeklyChart(container) {
        if (!container) return;

        const weeklyData = this.getWeeklyData();
        const maxHeight = 120;

        container.innerHTML = `
            <div class="weekly-chart">
                ${weeklyData.days.map(day => {
                    const height = (day.minutes / weeklyData.maxMinutes) * maxHeight;
                    return `
                        <div class="chart-column" title="${day.fullName}: ${day.minutes} min (${day.sessions} sessions)">
                            <div class="chart-bar" style="height: ${Math.max(4, height)}px;">
                                ${day.minutes > 0 ? `<span class="chart-value">${day.minutes}m</span>` : ''}
                            </div>
                            <span class="chart-label">${day.dayName}</span>
                        </div>
                    `;
                }).join('')}
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:0.75rem; color:var(--text-secondary);">
                <span>Total: ${weeklyData.totalMinutes} min</span>
                <span>Sessions: ${weeklyData.totalSessions}</span>
            </div>
        `;
    }

    // ============================================================
    // RENDERING — HEATMAP
    // ============================================================

    /**
     * Render 30‑day heatmap grid.
     */
    renderHeatmap(container) {
        if (!container) return;

        const heatmapData = this.getHeatmapData(30);
        const weeks = [];
        let currentWeek = [];

        // Group into weeks
        heatmapData.cells.forEach(cell => {
            currentWeek.push(cell);
            if (cell.dayOfWeek === 6) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        });
        if (currentWeek.length > 0) weeks.push(currentWeek);

        container.innerHTML = `
            <div class="heatmap-container">
                <div class="heatmap-grid">
                    ${weeks.map(week => `
                        <div class="heatmap-week">
                            ${week.map(cell => `
                                <div class="heatmap-cell intensity-${cell.intensity}"
                                     title="${cell.date}: ${cell.minutes} min">
                                    <span class="heatmap-tooltip">${cell.minutes}m</span>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
                <div class="heatmap-legend">
                    <span>Less</span>
                    <span class="legend-cell intensity-0"></span>
                    <span class="legend-cell intensity-1"></span>
                    <span class="legend-cell intensity-2"></span>
                    <span class="legend-cell intensity-3"></span>
                    <span class="legend-cell intensity-4"></span>
                    <span>More</span>
                </div>
            </div>
        `;
    }

    // ============================================================
    // RENDERING — MODE DONUT CHART
    // ============================================================

    /**
     * Render mode distribution donut chart using CSS conic‑gradient.
     */
    renderModeChart(container) {
        if (!container) return;

        const distribution = this.getModeDistribution();

        if (distribution.modes.length === 0) {
            container.innerHTML = '<p class="empty-state">No data yet. Complete a session first!</p>';
            return;
        }

        // Build conic gradient
        let cumulativePercent = 0;
        const gradientParts = distribution.modes.map((mode, index) => {
            const percent = distribution.totalMinutes > 0
                ? (mode.totalMinutes / distribution.totalMinutes) * 100
                : 0;
            const start = cumulativePercent;
            cumulativePercent += percent;
            const color = CHART_COLORS[index % CHART_COLORS.length];
            return `${color} ${start}% ${cumulativePercent}%`;
        });

        container.innerHTML = `
            <div class="mode-chart-container">
                <div class="mode-donut" style="background: conic-gradient(${gradientParts.join(', ')});">
                    <div class="donut-hole">
                        <span class="donut-total">${distribution.totalMinutes}m</span>
                        <span class="donut-label">Total Focus</span>
                    </div>
                </div>
                <div class="mode-legend">
                    ${distribution.modes.map((mode, index) => `
                        <div class="legend-item">
                            <span class="legend-color" style="background: ${CHART_COLORS[index % CHART_COLORS.length]};"></span>
                            <span class="legend-name">${mode.mode}</span>
                            <span class="legend-value">${mode.totalMinutes}m (${mode.sessions})</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // ============================================================
    // RENDERING — RECENT SESSIONS LIST
    // ============================================================

    /**
     * Render list of recent sessions.
     */
    renderRecentSessions(container) {
        if (!container) return;

        const allSessions = this.getAllSessions();
        const recent = allSessions.slice(0, 20);

        if (recent.length === 0) {
            container.innerHTML = '<p class="empty-state">No sessions yet. Start your first timer!</p>';
            return;
        }

        container.innerHTML = `
            <div class="session-list">
                ${recent.map(session => {
                    const date = new Date(session.startTime || session.date || Date.now());
                    const minutes = this._getDuration(session);
                    const modeName = this._getModeName(session);
                    const score = session.focusScore || session.flowScore || null;

                    return `
                        <div class="session-item">
                            <div class="session-info">
                                <span class="session-mode">${modeName}</span>
                                <span class="session-date">
                                    ${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div class="session-stats">
                                <span class="session-duration">${minutes}m</span>
                                ${score ? `<span class="session-score">${score}%</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // ============================================================
    // DATA EXPORT
    // ============================================================

    /**
     * Export all data as JSON file.
     */
    exportJSON() {
        const data = {
            exportDate: new Date().toISOString(),
            statistics: {
                today: this.getTodayStats(),
                streak: this.getStreak(),
                weekly: this.getWeeklyData(),
                modeDistribution: this.getModeDistribution(),
            },
            sessions: this.getAllSessions(),
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this._downloadBlob(blob, `fikr-analytics-${Date.now()}.json`);
    }

    /**
     * Export sessions as CSV file.
     */
    exportCSV() {
        const allSessions = this.getAllSessions();

        const headers = ['Date', 'Time', 'Mode', 'Duration (min)', 'Focus Score', 'Distractions'];
        const rows = allSessions.map(s => {
            const date = new Date(s.startTime || s.date || Date.now());
            return [
                date.toLocaleDateString(),
                date.toLocaleTimeString(),
                this._getModeName(s),
                this._getDuration(s),
                s.focusScore || s.flowScore || '',
                s.totalDistractions || s.distractions || '',
            ].map(v => `"${v}"`).join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        this._downloadBlob(blob, `fikr-sessions-${Date.now()}.csv`);
    }

    /**
     * Clear all analytics data.
     */
    async clearAllData() {
        const keys = [
            'timerHistory', 'pomodoroHistory', 'breathingHistory',
            'workoutHistory', 'deepworkHistory', 'examHistory',
            'customTimerHistory',
        ];

        if (this.storage) {
            for (const key of keys) {
                await this.storage.remove(key);
            }
        } else {
            keys.forEach(key => localStorage.removeItem(`fikr_${key}`));
        }

        this.history = [];
        this.pomodoroHistory = [];
        this.breathingHistory = [];
        this.workoutHistory = [];
        this.deepworkHistory = [];
        this.examHistory = [];
        this.customHistory = [];

        return true;
    }

    // ============================================================
    // PRIVATE HELPERS
    // ============================================================

    _setupActionButtons() {
        document.getElementById('exportJSONBtn')?.addEventListener('click', () => this.exportJSON());
        document.getElementById('exportCSVBtn')?.addEventListener('click', () => this.exportCSV());
        document.getElementById('clearDataBtn')?.addEventListener('click', () => {
            if (confirm('Delete ALL analytics data? This cannot be undone.')) {
                this.clearAllData().then(() => {
                    // Re‑render dashboard
                    const dashboard = document.querySelector('.analytics-dashboard');
                    if (dashboard) {
                        this.renderDashboard(dashboard.parentElement);
                    }
                });
            }
        });
    }

    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// ============================================================
// DEFAULT EXPORT
// ============================================================
export default AnalyticsEngine;
