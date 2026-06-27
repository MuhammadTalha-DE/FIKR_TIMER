/**
 * ============================================================
 * Fikr Timer · Main Application Controller
 * Handles routing, view management, global state, theme,
 * notifications, and module orchestration.
 * ============================================================
 */

// ---------- IMPORTS ----------
import { MODES, COLORS, DEFAULTS } from './config.js';
import { TimerEngine } from './timer-engine.js';
import { ClockManager } from './clock.js';
import { SoundSystem } from './sound-system.js';
import { ProfileManager } from './profile.js';
import { AnalyticsEngine } from './analytics.js';
import { StorageManager } from './storage.js';
import { showToast, formatTime, playSound } from './utils.js';

// ---------- GLOBAL STATE ----------
const AppState = {
    currentView: 'home',
    currentMode: null,
    isTimerRunning: false,
    theme: 'dark',
    primaryColor: '#7c5ce7',
    soundEnabled: true,
    notificationsEnabled: false,
    autoNextRound: false,
    dailyGoal: 120,
    ambientType: 'none',
    ambientVolume: 0.5,
    desktopLayout: false,
    achievements: [],
};

// ---------- DOM REFERENCES ----------
const DOM = {
    mainContent: document.getElementById('mainContent'),
    navItems: document.querySelectorAll('.nav-item'),
    themeBtn: document.getElementById('themeBtn'),
    themeIcon: document.getElementById('themeIcon'),
    ambientBtn: document.getElementById('ambientBtn'),
    profileBtn: document.getElementById('profileBtn'),
    clockOverlay: document.getElementById('clockOverlay'),
    closeClockOverlay: document.getElementById('closeClockOverlay'),
    toastContainer: document.getElementById('toastContainer'),
};

// ---------- MODULE INSTANCES ----------
const timerEngine = new TimerEngine();
const clockManager = new ClockManager();
const soundSystem = new SoundSystem();
const profileManager = new ProfileManager();
const analyticsEngine = new AnalyticsEngine();
const storageManager = new StorageManager();

// ---------- INITIALIZATION ----------
async function initApp() {
    await loadAppState();
    applyTheme();
    applyPrimaryColor();
    setupNavigation();
    setupGlobalListeners();
    clockManager.start();
    renderView('home');
    requestNotificationPermission();
    checkAchievements();
    console.log('✅ Fikr Timer initialized successfully');
}

// ---------- STATE PERSISTENCE ----------
async function loadAppState() {
    const saved = await storageManager.get('appState');
    if (saved) {
        Object.assign(AppState, saved);
    }
}

async function saveAppState() {
    await storageManager.set('appState', { ...AppState });
}

// ---------- THEME MANAGEMENT ----------
function applyTheme() {
    document.documentElement.setAttribute('data-theme', AppState.theme);
    DOM.themeIcon.textContent = AppState.theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
    AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    saveAppState();
}

function applyPrimaryColor() {
    document.documentElement.setAttribute('data-primary', getColorName(AppState.primaryColor));
    document.documentElement.style.setProperty('--primary', AppState.primaryColor);
}

function getColorName(hex) {
    const colorMap = {
        '#7c5ce7': 'purple', '#3b82f6': 'blue', '#10b981': 'green',
        '#f59e0b': 'orange', '#ef4444': 'red', '#ec4899': 'pink',
        '#6366f1': 'indigo', '#14b8a6': 'teal',
    };
    return colorMap[hex] || 'purple';
}

function setPrimaryColor(color) {
    AppState.primaryColor = color;
    applyPrimaryColor();
    saveAppState();
    showToast('Color theme updated! 🎨');
}

// ---------- NAVIGATION SYSTEM ----------
function setupNavigation() {
    DOM.navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            navigateTo(view);
        });
    });

    // Handle browser back button
    window.addEventListener('popstate', (e) => {
        if (e.state?.view) {
            renderView(e.state.view, false);
        }
    });
}

function navigateTo(view, pushState = true) {
    if (view === AppState.currentView) return;

    AppState.currentView = view;

    // Update nav active state
    DOM.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });

    // Update browser history
    if (pushState) {
        history.pushState({ view }, '', `#${view}`);
    }

    renderView(view);
}

// ---------- VIEW RENDERING ----------
function renderView(view) {
    const main = DOM.mainContent;
    main.innerHTML = '';

    // Add fade-out class to current view
    const currentView = main.querySelector('.view.active');
    if (currentView) {
        currentView.style.animation = 'fadeOut 0.2s ease forwards';
    }

    setTimeout(() => {
        main.innerHTML = '';
        switch (view) {
            case 'home': renderHomeView(main); break;
            case 'timer': renderTimerView(main); break;
            case 'analytics': renderAnalyticsView(main); break;
            case 'profile': renderProfileView(main); break;
            case 'settings': renderSettingsView(main); break;
            default: renderHomeView(main);
        }
        main.querySelector('.view')?.classList.add('active');
    }, 200);
}

// ---------- HOME VIEW ----------
function renderHomeView(container) {
    container.innerHTML = `
        <div class="view">
            <div class="section-header">
                <h2>Choose Your Mode</h2>
                <p class="section-subtitle">Select a timer mode to begin your focus session</p>
            </div>
            <div class="mode-grid" id="modeGrid"></div>
            <div class="quick-start-section glass">
                <h3>⚡ Quick Start</h3>
                <div class="quick-start-row">
                    <select id="quickModeSelect" class="form-input">
                        ${MODES.map(m => `<option value="${m.id}">${m.icon} ${m.name}</option>`).join('')}
                    </select>
                    <button class="btn btn-primary" id="quickStartBtn">Start</button>
                </div>
            </div>
        </div>
    `;

    // Populate mode cards
    const grid = document.getElementById('modeGrid');
    grid.innerHTML = MODES.map(mode => `
        <div class="mode-card card-3d" data-mode="${mode.id}" title="${mode.description || mode.name}">
            <div class="mode-icon">${mode.icon}</div>
            <div class="mode-name">${mode.name}</div>
            <div class="mode-defaults">${mode.defaults.focus || mode.defaults.inhale || '—'} min</div>
        </div>
    `).join('');

    // Mode card click handlers
    grid.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
            const modeId = card.dataset.mode;
            if (modeId === 'breathing') {
                openBreathingSetup();
            } else if (modeId === 'custom') {
                openCustomTimerModal();
            } else {
                startTimerMode(modeId);
            }
        });
    });

    // Quick start
    document.getElementById('quickStartBtn').addEventListener('click', () => {
        const modeId = document.getElementById('quickModeSelect').value;
        if (modeId === 'breathing') {
            openBreathingSetup();
        } else if (modeId === 'custom') {
            openCustomTimerModal();
        } else {
            startTimerMode(modeId);
        }
    });
}

// ---------- TIMER VIEW ----------
function renderTimerView(container) {
    const mode = AppState.currentMode || MODES[0];
    const timerState = timerEngine.getState();

    container.innerHTML = `
        <div class="view timer-container">
            <div class="timer-header">
                <span class="timer-mode-badge">${mode.icon} ${mode.name}</span>
                <span class="timer-round-info" id="roundInfo">${timerEngine.getRoundInfo()}</span>
            </div>

            <div class="timer-circle-wrapper">
                <div class="timer-circle ${mode.id === 'breathing' ? 'breathing-idle' : ''}" id="timerCircle">
                    <canvas id="particleCanvas" class="particles-canvas"></canvas>
                    <svg class="timer-svg" viewBox="0 0 200 200">
                        <circle class="timer-bg-circle" cx="100" cy="100" r="90"/>
                        <circle class="timer-progress-circle" id="progressCircle"
                                cx="100" cy="100" r="90"
                                stroke-dasharray="565.5"
                                stroke-dashoffset="0"/>
                        <circle class="breathing-ring" id="breathRing"
                                cx="100" cy="100" r="50" opacity="0"/>
                    </svg>
                    <div class="timer-display">
                        <span class="timer-time" id="timerTime">${formatTime(timerState.timeLeft)}</span>
                        <span class="timer-label" id="timerLabel">${timerEngine.getPhaseLabel()}</span>
                        <span class="breathing-phase-text hidden" id="breathingPhaseText">INHALE</span>
                    </div>
                </div>
            </div>

            <div class="timer-controls">
                <button class="ctrl-btn" id="btnReset" title="Reset (R)">
                    <span>↺</span>
                </button>
                <button class="ctrl-btn start glow-pulse" id="btnStart" title="Start/Pause (Space)">
                    <span>${AppState.isTimerRunning ? '⏸' : '▶'}</span>
                </button>
                <button class="ctrl-btn" id="btnAdd5" title="Add 5 minutes (+)">
                    <span>+5</span>
                </button>
            </div>

            <div class="timer-extra-controls">
                <button class="btn btn-sm btn-outline" id="btnSkipBreak">⏭ Skip Break</button>
                <button class="btn btn-sm btn-outline" id="btnEndSession">⏹ End Session</button>
                <button class="btn btn-sm btn-outline" id="btnDistraction">📱 +Distraction</button>
            </div>

            <div class="ambient-controls">
                <select id="ambientSelect" class="form-input">
                    <option value="none">🔇 No Ambience</option>
                    <option value="white">🌬 White Noise</option>
                    <option value="rain">🌧 Rain</option>
                    <option value="waves">🌊 Ocean Waves</option>
                    <option value="forest">🌲 Forest</option>
                    <option value="cafe">☕ Café</option>
                    <option value="binaural">🧠 Binaural Beats</option>
                </select>
                <input type="range" id="volumeSlider" class="volume-slider"
                       min="0" max="1" step="0.05" value="${AppState.ambientVolume}">
            </div>

            <div class="breathing-panel hidden" id="breathingPanel">
                <!-- Dynamically populated for breathing mode -->
            </div>

            <button class="btn btn-ghost mt-20" id="btnBackToModes">← Back to Modes</button>
        </div>
    `;

    // Setup timer event listeners
    setupTimerEventListeners();

    // Initialize particles if in breathing mode
    if (mode.id === 'breathing') {
        initBreathingVisuals();
    }

    // Update progress display
    updateTimerDisplay();
    updateProgressRing();
}

function setupTimerEventListeners() {
    document.getElementById('btnStart')?.addEventListener('click', toggleTimer);
    document.getElementById('btnReset')?.addEventListener('click', resetTimer);
    document.getElementById('btnAdd5')?.addEventListener('click', addFiveMinutes);
    document.getElementById('btnSkipBreak')?.addEventListener('click', skipBreak);
    document.getElementById('btnEndSession')?.addEventListener('click', endSession);
    document.getElementById('btnDistraction')?.addEventListener('click', incrementDistraction);
    document.getElementById('btnBackToModes')?.addEventListener('click', () => navigateTo('home'));

    document.getElementById('ambientSelect')?.addEventListener('change', (e) => {
        AppState.ambientType = e.target.value;
        soundSystem.setAmbient(e.target.value, AppState.ambientVolume);
        saveAppState();
    });

    document.getElementById('volumeSlider')?.addEventListener('input', (e) => {
        AppState.ambientVolume = parseFloat(e.target.value);
        soundSystem.setVolume(AppState.ambientVolume);
        saveAppState();
    });
}

// ---------- TIMER ACTIONS ----------
function startTimerMode(modeId, customParams = {}) {
    timerEngine.initialize(modeId, customParams);
    AppState.currentMode = timerEngine.getMode();
    AppState.isTimerRunning = false;
    navigateTo('timer');
}

function toggleTimer() {
    if (!AppState.currentMode) return;

    if (AppState.isTimerRunning) {
        timerEngine.pause();
        AppState.isTimerRunning = false;
    } else {
        timerEngine.start();
        AppState.isTimerRunning = true;
    }

    updateTimerDisplay();
    updateStartButton();
}

function resetTimer() {
    timerEngine.reset();
    AppState.isTimerRunning = false;
    updateTimerDisplay();
    updateProgressRing();
    updateStartButton();
}

function addFiveMinutes() {
    if (timerEngine.addTime(300)) {
        updateTimerDisplay();
        updateProgressRing();
        showToast('Added 5 minutes ⏰');
    }
}

function skipBreak() {
    if (timerEngine.skipBreak()) {
        updateTimerDisplay();
        updateProgressRing();
        showToast('Break skipped ⏭');
    }
}

function endSession() {
    const session = timerEngine.endSession();
    if (session) {
        analyticsEngine.recordSession(session);
        profileManager.updateStats(session);
        showSessionSummary(session);
    }
    AppState.isTimerRunning = false;
    updateStartButton();
}

function incrementDistraction() {
    timerEngine.incrementDistractions();
    showToast('Distraction recorded 📱');
}

// ---------- DISPLAY UPDATES ----------
function updateTimerDisplay() {
    const timeEl = document.getElementById('timerTime');
    const labelEl = document.getElementById('timerLabel');
    const roundEl = document.getElementById('roundInfo');

    if (timeEl) timeEl.textContent = formatTime(timerEngine.getState().timeLeft);
    if (labelEl) labelEl.textContent = timerEngine.getPhaseLabel();
    if (roundEl) roundEl.textContent = timerEngine.getRoundInfo();

    document.title = `${formatTime(timerEngine.getState().timeLeft)} - Fikr Timer`;
}

function updateProgressRing() {
    const circle = document.getElementById('progressCircle');
    if (!circle) return;
    const progress = timerEngine.getProgress();
    circle.style.strokeDashoffset = 565.5 * (1 - Math.min(1, Math.max(0, progress)));
}

function updateStartButton() {
    const btn = document.getElementById('btnStart');
    if (btn) {
        btn.querySelector('span').textContent = AppState.isTimerRunning ? '⏸' : '▶';
    }
}

// ---------- TIMER ENGINE CALLBACKS ----------
timerEngine.onTick = () => {
    updateTimerDisplay();
    updateProgressRing();
};

timerEngine.onPhaseChange = (phase) => {
    updateTimerDisplay();
    updateProgressRing();
    if (phase === 'break') {
        showToast('Break time! ☕');
    } else if (phase === 'focus') {
        showToast('Focus! 🎯');
    }
};

timerEngine.onComplete = (session) => {
    AppState.isTimerRunning = false;
    analyticsEngine.recordSession(session);
    profileManager.updateStats(session);
    showSessionSummary(session);
    updateStartButton();
    soundSystem.playAlert('complete');
};

// ---------- GLOBAL EVENT LISTENERS ----------
function setupGlobalListeners() {
    // Theme toggle
    DOM.themeBtn.addEventListener('click', toggleTheme);

    // Ambient toggle
    DOM.ambientBtn.addEventListener('click', () => {
        if (AppState.ambientType === 'none') {
            AppState.ambientType = 'white';
            soundSystem.setAmbient('white', AppState.ambientVolume);
            showToast('Ambient sound on 🌬');
        } else {
            AppState.ambientType = 'none';
            soundSystem.stopAmbient();
            showToast('Ambient sound off 🔇');
        }
        saveAppState();
    });

    // Profile button
    DOM.profileBtn.addEventListener('click', () => navigateTo('profile'));

    // Clock overlay
    document.getElementById('digitalClockSmall')?.addEventListener('click', () => {
        DOM.clockOverlay.classList.remove('hidden');
    });
    DOM.closeClockOverlay?.addEventListener('click', () => {
        DOM.clockOverlay.classList.add('hidden');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Handle window resize for responsive adjustments
    window.addEventListener('resize', () => {
        // Re-render current view on significant breakpoints
    });
}

function handleKeyboardShortcuts(e) {
    // Ignore if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    switch (e.code) {
        case 'Space':
            e.preventDefault();
            if (AppState.currentView === 'timer') toggleTimer();
            break;
        case 'KeyR':
            if (AppState.currentView === 'timer') resetTimer();
            break;
        case 'Equal':
            if (e.shiftKey && AppState.currentView === 'timer') addFiveMinutes();
            break;
        case 'Escape':
            if (DOM.clockOverlay && !DOM.clockOverlay.classList.contains('hidden')) {
                DOM.clockOverlay.classList.add('hidden');
            }
            break;
        case 'Digit1': navigateTo('home'); break;
        case 'Digit2': navigateTo('timer'); break;
        case 'Digit3': navigateTo('analytics'); break;
        case 'Digit4': navigateTo('profile'); break;
        case 'Digit5': navigateTo('settings'); break;
    }
}

// ---------- MODAL HELPERS ----------
function openCustomTimerModal() {
    document.getElementById('customTimerModal')?.classList.remove('hidden');
}

function openBreathingSetup() {
    document.getElementById('breathingSetupModal')?.classList.remove('hidden');
}

function showSessionSummary(session) {
    const modal = document.getElementById('sessionSummaryModal');
    const details = document.getElementById('summaryDetails');
    if (!modal || !details) return;

    details.innerHTML = `
        <div class="summary-card">
            <p><strong>Mode:</strong> ${session.modeName}</p>
            <p><strong>Duration:</strong> ${session.duration} minutes</p>
            <p><strong>Focus Score:</strong> ${session.focusScore}%</p>
            <p><strong>Distractions:</strong> ${session.distractions || 0}</p>
        </div>
    `;
    modal.classList.remove('hidden');

    document.getElementById('closeSummaryBtn')?.addEventListener('click', () => {
        modal.classList.add('hidden');
        navigateTo('home');
    }, { once: true });
}

// ---------- NOTIFICATIONS ----------
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        AppState.notificationsEnabled = permission === 'granted';
        saveAppState();
    }
}

function sendNotification(title, body) {
    if (AppState.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: 'assets/icons/icon-192.png' });
    }
}

// ---------- ACHIEVEMENTS ----------
function checkAchievements() {
    const newAchievements = profileManager.checkAchievements();
    newAchievements.forEach(achievement => {
        showToast(`🏆 Achievement: ${achievement}`);
        sendNotification('Achievement Unlocked!', achievement);
    });
}

// ---------- RENDER OTHER VIEWS (stubs for completeness) ----------
function renderAnalyticsView(container) {
    analyticsEngine.render(container);
}

function renderProfileView(container) {
    profileManager.render(container);
}

function renderSettingsView(container) {
    container.innerHTML = `
        <div class="view">
            <h2>Settings</h2>
            <div class="settings-section glass">
                <div class="setting-row">
                    <span>Sound Alerts</span>
                    <div class="toggle-switch ${AppState.soundEnabled ? 'active' : ''}" id="soundToggle"></div>
                </div>
                <div class="setting-row">
                    <span>Notifications</span>
                    <div class="toggle-switch ${AppState.notificationsEnabled ? 'active' : ''}" id="notifToggle"></div>
                </div>
                <div class="setting-row">
                    <span>Auto-start Breaks</span>
                    <div class="toggle-switch ${AppState.autoNextRound ? 'active' : ''}" id="autoNextToggle"></div>
                </div>
                <div class="setting-row">
                    <span>Daily Goal (min)</span>
                    <input type="number" id="dailyGoalInput" value="${AppState.dailyGoal}"
                           min="1" max="600" class="form-input" style="width:100px;">
                </div>
            </div>
            <div class="settings-section glass mt-20">
                <h3>Accent Color</h3>
                <div class="color-palette">
                    ${COLORS.map(c => `
                        <span class="color-swatch ${c === AppState.primaryColor ? 'active' : ''}"
                              style="background:${c};" data-color="${c}"></span>
                    `).join('')}
                </div>
            </div>
            <div class="settings-section glass mt-20">
                <button class="btn btn-outline" id="exportDataBtn">📥 Export Data</button>
                <button class="btn btn-outline btn-danger" id="clearDataBtn">🗑 Clear All Data</button>
            </div>
        </div>
    `;

    // Setup settings listeners
    setupSettingsListeners();
}

function setupSettingsListeners() {
    document.getElementById('soundToggle')?.addEventListener('click', function() {
        this.classList.toggle('active');
        AppState.soundEnabled = this.classList.contains('active');
        saveAppState();
    });

    document.getElementById('notifToggle')?.addEventListener('click', async function() {
        if (!AppState.notificationsEnabled) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                AppState.notificationsEnabled = true;
                this.classList.add('active');
            }
        } else {
            AppState.notificationsEnabled = false;
            this.classList.remove('active');
        }
        saveAppState();
    });

    document.getElementById('autoNextToggle')?.addEventListener('click', function() {
        this.classList.toggle('active');
        AppState.autoNextRound = this.classList.contains('active');
        saveAppState();
    });

    document.getElementById('dailyGoalInput')?.addEventListener('change', (e) => {
        AppState.dailyGoal = parseInt(e.target.value) || 120;
        saveAppState();
    });

    // Color swatches
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            const color = swatch.dataset.color;
            setPrimaryColor(color);
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
        });
    });

    // Data management
    document.getElementById('exportDataBtn')?.addEventListener('click', () => {
        analyticsEngine.exportData();
    });

    document.getElementById('clearDataBtn')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
            storageManager.clearAll();
            showToast('All data cleared');
            navigateTo('home');
        }
    });
}

// ---------- BREATHING VISUALS ----------
function initBreathingVisuals() {
    // Show breathing panel
    document.getElementById('breathingPanel')?.classList.remove('hidden');
    document.getElementById('breathingPhaseText')?.classList.remove('hidden');

    // Initialize particle system
    import('./particles.js').then(module => {
        const canvas = document.getElementById('particleCanvas');
        if (canvas) {
            module.initParticles(canvas);
        }
    });
}

// ---------- BOOTSTRAP ----------
document.addEventListener('DOMContentLoaded', initApp);

// ---------- EXPORTS ----------
export { AppState, navigateTo, startTimerMode, showToast, sendNotification, setPrimaryColor };
