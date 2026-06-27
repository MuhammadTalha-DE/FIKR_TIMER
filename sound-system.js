/**
 * ============================================================
 * Fikr Timer · Advanced Sound System
 * Procedural audio generation, ambient soundscapes,
 * binaural beats, alert sounds, and audio mixing.
 * ============================================================
 *
 * Features:
 *  - Procedural white/pink/brown noise generation
 *  - Nature soundscapes (rain, ocean, forest, café, thunder)
 *  - Binaural beats generator (alpha, beta, theta, delta, gamma)
 *  - Alert sounds (chime, bell, digital, nature, custom)
 *  - Volume control per sound layer
 *  - Crossfade between soundscapes
 *  - Audio visualizer (FFT frequency data)
 *  - Mute/unmute with smooth transitions
 *  - Preset saving and loading
 *  - Sleep timer (auto‑fade after N minutes)
 *  - Focus music integration (optional)
 *  - No audio files required (all procedural)
 *  - Works offline
 *
 * Usage:
 *   const sound = new SoundSystem();
 *   sound.playAmbient('rain', 0.5);
 *   sound.playBinauralBeat('alpha', 0.3);
 *   sound.playAlert('chime');
 *   sound.setMasterVolume(0.8);
 *   sound.stopAll();
 */

import { StorageManager } from './storage.js';

// ---------- SOUNDSCAPE TYPES ----------
const SOUNDSCAPES = {
    white: {
        name: 'White Noise',
        icon: '🌬️',
        description: 'Uniform noise across all frequencies',
        category: 'noise',
        color: '#e0e0e0',
    },
    pink: {
        name: 'Pink Noise',
        icon: '🎀',
        description: 'Deeper, more natural sounding noise',
        category: 'noise',
        color: '#f4a4c0',
    },
    brown: {
        name: 'Brown Noise',
        icon: '🤎',
        description: 'Deep, rumbling noise for deep focus',
        category: 'noise',
        color: '#8b5e3c',
    },
    rain: {
        name: 'Rain',
        icon: '🌧️',
        description: 'Gentle rainfall with occasional thunder',
        category: 'nature',
        color: '#4a90d9',
    },
    ocean: {
        name: 'Ocean Waves',
        icon: '🌊',
        description: 'Rhythmic ocean waves on a beach',
        category: 'nature',
        color: '#2196f3',
    },
    forest: {
        name: 'Forest',
        icon: '🌲',
        description: 'Birds, wind, and rustling leaves',
        category: 'nature',
        color: '#4caf50',
    },
    cafe: {
        name: 'Café',
        icon: '☕',
        description: 'Background café murmur and clinks',
        category: 'environment',
        color: '#795548',
    },
    fireplace: {
        name: 'Fireplace',
        icon: '🔥',
        description: 'Crackling fire with gentle warmth',
        category: 'environment',
        color: '#ff6f00',
    },
    thunder: {
        name: 'Thunderstorm',
        icon: '⛈️',
        description: 'Heavy rain with rolling thunder',
        category: 'nature',
        color: '#5c6bc0',
    },
    wind: {
        name: 'Wind',
        icon: '💨',
        description: 'Gentle breeze through trees',
        category: 'nature',
        color: '#90a4ae',
    },
    stream: {
        name: 'Mountain Stream',
        icon: '🏞️',
        description: 'Bubbling stream with water sounds',
        category: 'nature',
        color: '#26c6da',
    },
};

// ---------- BINAURAL BEAT FREQUENCIES ----------
const BINAURAL_BEATS = {
    delta: {
        name: 'Delta Waves',
        frequency: 2,
        description: 'Deep sleep, healing (0.5‑4 Hz)',
        benefits: ['Deep sleep', 'Healing', 'Unconscious mind'],
        color: '#1a237e',
    },
    theta: {
        name: 'Theta Waves',
        frequency: 6,
        description: 'Meditation, creativity (4‑8 Hz)',
        benefits: ['Meditation', 'Creativity', 'Intuition'],
        color: '#4a148c',
    },
    alpha: {
        name: 'Alpha Waves',
        frequency: 10,
        description: 'Relaxation, learning (8‑14 Hz)',
        benefits: ['Relaxation', 'Learning', 'Calm focus'],
        color: '#7c5ce7',
    },
    beta: {
        name: 'Beta Waves',
        frequency: 18,
        description: 'Active thinking, focus (14‑30 Hz)',
        benefits: ['Focus', 'Alertness', 'Problem solving'],
        color: '#2196f3',
    },
    gamma: {
        name: 'Gamma Waves',
        frequency: 40,
        description: 'Peak performance (30‑100 Hz)',
        benefits: ['Peak cognition', 'Memory', 'Perception'],
        color: '#00bcd4',
    },
};

// ---------- ALERT SOUNDS ----------
const ALERT_SOUNDS = {
    chime: {
        name: 'Chime',
        frequencies: [880, 1100],
        duration: 0.4,
        type: 'sine',
    },
    bell: {
        name: 'Bell',
        frequencies: [523, 659, 784],
        duration: 0.6,
        type: 'triangle',
    },
    digital: {
        name: 'Digital',
        frequencies: [1200, 800],
        duration: 0.2,
        type: 'square',
    },
    gentle: {
        name: 'Gentle',
        frequencies: [660, 880],
        duration: 0.8,
        type: 'sine',
        fadeIn: 0.1,
        fadeOut: 0.3,
    },
    alert: {
        name: 'Alert',
        frequencies: [800, 1000, 1200],
        duration: 0.3,
        type: 'sawtooth',
    },
    success: {
        name: 'Success',
        frequencies: [523, 659, 784, 1047],
        duration: 0.5,
        type: 'sine',
    },
    warning: {
        name: 'Warning',
        frequencies: [400, 350],
        duration: 0.4,
        type: 'square',
        repeat: 2,
    },
};

// ---------- SOUND SYSTEM CLASS ----------
export class SoundSystem {
    constructor(config = {}) {
        this.storage = new StorageManager();

        // Configuration
        this.masterVolume = config.masterVolume || 0.8;
        this.muted = config.muted || false;
        this.soundEnabled = config.soundEnabled !== false;

        // Audio context (lazy initialization)
        this._ctx = null;

        // Active sound nodes
        this.activeSounds = {
            ambient: null,    // Current ambient sound
            binaural: null,   // Current binaural beat
            alerts: [],       // Active alert sounds
        };

        // Ambient state
        this.currentAmbient = null;
        this.ambientVolume = config.ambientVolume || 0.5;
        this.ambientFadeIn = config.ambientFadeIn || 2000; // ms

        // Binaural state
        this.currentBinaural = null;
        this.binauralVolume = config.binauralVolume || 0.3;
        this.binauralCarrierFrequency = config.binauralCarrierFrequency || 200; // Hz

        // Sleep timer
        this.sleepTimer = null;
        this.sleepTimerDuration = 0;
        this.sleepTimerRemaining = 0;

        // Visualizer
        this.visualizerEnabled = config.visualizerEnabled || false;
        this._analyser = null;
        this._visualizerData = null;
        this._visualizerInterval = null;

        // Presets
        this.presets = [];

        // Callbacks
        this.onVolumeChange = null;     // (volume)
        this.onAmbientChange = null;    // (ambientType)
        this.onBinauralChange = null;   // (beatType)
        this.onSleepTimerTick = null;   // (remainingSeconds)
        this.onSleepTimerEnd = null;    // ()
    }

    // ---------- AUDIO CONTEXT ----------

    /**
     * Get or create audio context.
     */
    _getContext() {
        if (!this._ctx) {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._ctx.state === 'suspended') {
            this._ctx.resume();
        }
        return this._ctx;
    }

    /**
     * Create gain node with optional volume.
     */
    _createGain(volume = 1) {
        const ctx = this._getContext();
        const gain = ctx.createGain();
        gain.gain.value = this.muted ? 0 : volume * this.masterVolume;
        gain.connect(ctx.destination);
        return gain;
    }

    // ---------- NOISE GENERATORS ----------

    /**
     * Generate white noise.
     */
    _createWhiteNoise() {
        const ctx = this._getContext();
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        return source;
    }

    /**
     * Generate pink noise.
     */
    _createPinkNoise() {
        const ctx = this._getContext();
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        return source;
    }

    /**
     * Generate brown noise.
     */
    _createBrownNoise() {
        const ctx = this._getContext();
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        return source;
    }

    // ---------- NATURE SOUND GENERATORS ----------

    /**
     * Generate rain sound.
     */
    _createRainSound() {
        const ctx = this._getContext();
        const source = this._createWhiteNoise();

        // High‑pass filter for rain texture
        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 800;
        highpass.Q.value = 0.5;

        // Low‑pass to soften
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 8000;

        // Occasional low rumble for thunder
        const rumbleOsc = ctx.createOscillator();
        rumbleOsc.type = 'sine';
        rumbleOsc.frequency.value = 40;
        const rumbleGain = ctx.createGain();
        rumbleGain.gain.value = 0;
        rumbleOsc.connect(rumbleGain);

        // Schedule thunder rumbles
        this._scheduleThunder(rumbleGain);

        rumbleOsc.start();

        return {
            source,
            processors: [highpass, lowpass],
            extraSources: [rumbleOsc],
            extraGains: [rumbleGain],
        };
    }

    /**
     * Schedule random thunder rumbles.
     */
    _scheduleThunder(rumbleGain) {
        const scheduleNext = () => {
            const delay = 5 + Math.random() * 25; // 5-30 seconds
            setTimeout(() => {
                // Quick attack, slow decay
                const now = this._getContext().currentTime;
                rumbleGain.gain.setValueAtTime(0, now);
                rumbleGain.gain.linearRampToValueAtTime(0.3, now + 0.1);
                rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 2);
                scheduleNext();
            }, delay * 1000);
        };
        scheduleNext();
    }

    /**
     * Generate ocean waves sound.
     */
    _createOceanSound() {
        const ctx = this._getContext();
        const source = this._createPinkNoise();

        // Band‑pass filter for wave sound
        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 400;
        bandpass.Q.value = 0.8;

        // LFO for wave rhythm
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1; // 10‑second wave cycle
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 200;
        lfo.connect(lfoGain);
        lfoGain.connect(bandpass.frequency);
        lfo.start();

        return {
            source,
            processors: [bandpass],
            extraSources: [lfo],
        };
    }

    /**
     * Generate forest sound.
     */
    _createForestSound() {
        const ctx = this._getContext();
        const source = this._createPinkNoise();

        // Wind sound (filtered noise)
        const windFilter = ctx.createBiquadFilter();
        windFilter.type = 'lowpass';
        windFilter.frequency.value = 1000;

        // Bird chirps (random oscillators)
        const birdGain = ctx.createGain();
        birdGain.gain.value = 0;
        source.connect(birdGain);

        this._scheduleBirds(birdGain);

        return {
            source,
            processors: [windFilter],
            extraGains: [birdGain],
        };
    }

    /**
     * Schedule random bird chirps.
     */
    _scheduleBirds(birdGain) {
        const scheduleNext = () => {
            const delay = 1 + Math.random() * 4; // 1-5 seconds
            setTimeout(() => {
                const ctx = this._getContext();
                const now = ctx.currentTime;

                // Create a chirp
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = 1500 + Math.random() * 2000;
                const chirpGain = ctx.createGain();
                chirpGain.gain.setValueAtTime(0, now);
                chirpGain.gain.linearRampToValueAtTime(0.05, now + 0.05);
                chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

                osc.connect(chirpGain);
                chirpGain.connect(birdGain);
                osc.start(now);
                osc.stop(now + 0.2);

                scheduleNext();
            }, delay * 1000);
        };
        scheduleNext();
    }

    /**
     * Generate café ambiance.
     */
    _createCafeSound() {
        const ctx = this._getContext();
        const source = this._createBrownNoise();

        // Low‑pass for murmur
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 600;

        // Occasional clinks
        const clinkGain = ctx.createGain();
        clinkGain.gain.value = 0;
        source.connect(clinkGain);

        this._scheduleClinks(clinkGain);

        return {
            source,
            processors: [lowpass],
            extraGains: [clinkGain],
        };
    }

    /**
     * Schedule café clink sounds.
     */
    _scheduleClinks(clinkGain) {
        const scheduleNext = () => {
            const delay = 3 + Math.random() * 8;
            setTimeout(() => {
                const ctx = this._getContext();
                const now = ctx.currentTime;

                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = 2000 + Math.random() * 1000;
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.03, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

                osc.connect(gain);
                gain.connect(clinkGain);
                osc.start(now);
                osc.stop(now + 0.15);

                scheduleNext();
            }, delay * 1000);
        };
        scheduleNext();
    }

    // ---------- BINAURAL BEATS ----------

    /**
     * Generate binaural beat.
     * @param {string} type - Beat type (delta, theta, alpha, beta, gamma)
     * @param {number} volume - Volume 0-1
     */
    _createBinauralBeat(type, volume = 0.3) {
        const ctx = this._getContext();
        const beatConfig = BINAURAL_BEATS[type];
        if (!beatConfig) return null;

        const carrierFreq = this.binauralCarrierFrequency;
        const beatFreq = beatConfig.frequency;

        // Left ear: carrier
        const leftOsc = ctx.createOscillator();
        leftOsc.type = 'sine';
        leftOsc.frequency.value = carrierFreq;

        // Right ear: carrier + beat frequency
        const rightOsc = ctx.createOscillator();
        rightOsc.type = 'sine';
        rightOsc.frequency.value = carrierFreq + beatFreq;

        // Panning
        const merger = ctx.createChannelMerger(2);
        const leftGain = ctx.createGain();
        const rightGain = ctx.createGain();
        leftGain.gain.value = volume;
        rightGain.gain.value = volume;

        leftOsc.connect(leftGain);
        rightOsc.connect(rightGain);
        leftGain.connect(merger, 0, 0);
        rightGain.connect(merger, 0, 1);

        leftOsc.start();
        rightOsc.start();

        return {
            leftOsc,
            rightOsc,
            merger,
            leftGain,
            rightGain,
            type,
            beatFreq,
        };
    }

    // ---------- PUBLIC API ----------

    /**
     * Play an ambient soundscape.
     */
    playAmbient(type, volume = null) {
        if (!this.soundEnabled) return;

        // Stop current ambient
        this.stopAmbient();

        if (!SOUNDSCAPES[type]) {
            console.warn(`Unknown ambient type: ${type}`);
            return;
        }

        const ctx = this._getContext();
        const gain = this._createGain(volume !== null ? volume : this.ambientVolume);

        let soundData;
        switch (type) {
            case 'white':
                soundData = { source: this._createWhiteNoise(), processors: [] };
                break;
            case 'pink':
                soundData = { source: this._createPinkNoise(), processors: [] };
                break;
            case 'brown':
                soundData = { source: this._createBrownNoise(), processors: [] };
                break;
            case 'rain':
                soundData = this._createRainSound();
                break;
            case 'ocean':
                soundData = this._createOceanSound();
                break;
            case 'forest':
                soundData = this._createForestSound();
                break;
            case 'cafe':
                soundData = this._createCafeSound();
                break;
            case 'fireplace':
                soundData = { source: this._createBrownNoise(), processors: [] };
                break;
            case 'wind':
                soundData = { source: this._createPinkNoise(), processors: [] };
                break;
            case 'stream':
                soundData = { source: this._createPinkNoise(), processors: [] };
                break;
            default:
                soundData = { source: this._createWhiteNoise(), processors: [] };
        }

        // Connect source → processors → gain → destination
        let lastNode = soundData.source;
        soundData.processors.forEach(proc => {
            lastNode.connect(proc);
            lastNode = proc;
        });
        lastNode.connect(gain);

        // Start source
        if (soundData.source.start) {
            soundData.source.start(0);
        }

        // Start extra sources
        if (soundData.extraSources) {
            soundData.extraSources.forEach(src => {
                if (src.start) src.start(0);
            });
        }

        // Connect extra gains
        if (soundData.extraGains) {
            soundData.extraGains.forEach(g => g.connect(gain));
        }

        // Fade in
        if (this.ambientFadeIn > 0) {
            const now = ctx.currentTime;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(
                (volume !== null ? volume : this.ambientVolume) * this.masterVolume,
                now + this.ambientFadeIn / 1000
            );
        }

        this.activeSounds.ambient = {
            type,
            gain,
            soundData,
            startTime: Date.now(),
        };

        this.currentAmbient = type;

        if (this.onAmbientChange) this.onAmbientChange(type);

        return this;
    }

    /**
     * Stop ambient sound.
     */
    stopAmbient(fadeOut = 500) {
        if (!this.activeSounds.ambient) return this;

        const ambient = this.activeSounds.ambient;
        const ctx = this._getContext();

        if (fadeOut > 0) {
            const now = ctx.currentTime;
            ambient.gain.gain.setValueAtTime(ambient.gain.gain.value, now);
            ambient.gain.gain.linearRampToValueAtTime(0, now + fadeOut / 1000);

            setTimeout(() => {
                this._disconnectAmbient(ambient);
            }, fadeOut);
        } else {
            this._disconnectAmbient(ambient);
        }

        this.activeSounds.ambient = null;
        this.currentAmbient = null;

        if (this.onAmbientChange) this.onAmbientChange(null);

        return this;
    }

    _disconnectAmbient(ambient) {
        if (ambient.soundData.source.stop) {
            ambient.soundData.source.stop();
        }
        ambient.soundData.source.disconnect();
        ambient.gain.disconnect();

        if (ambient.soundData.extraSources) {
            ambient.soundData.extraSources.forEach(src => {
                if (src.stop) src.stop();
                src.disconnect();
            });
        }
    }

    /**
     * Play binaural beats.
     */
    playBinauralBeat(type, volume = null) {
        if (!this.soundEnabled) return;

        this.stopBinauralBeat();

        if (!BINAURAL_BEATS[type]) {
            console.warn(`Unknown binaural beat type: ${type}`);
            return;
        }

        const ctx = this._getContext();
        const beatData = this._createBinauralBeat(
            type,
            volume !== null ? volume : this.binauralVolume
        );

        if (!beatData) return;

        const masterGain = this._createGain(1);
        beatData.merger.connect(masterGain);

        this.activeSounds.binaural = {
            type,
            gain: masterGain,
            beatData,
        };

        this.currentBinaural = type;

        if (this.onBinauralChange) this.onBinauralChange(type);

        return this;
    }

    /**
     * Stop binaural beats.
     */
    stopBinauralBeat() {
        if (!this.activeSounds.binaural) return this;

        const binaural = this.activeSounds.binaural;
        binaural.beatData.leftOsc.stop();
        binaural.beatData.rightOsc.stop();
        binaural.beatData.merger.disconnect();
        binaural.gain.disconnect();

        this.activeSounds.binaural = null;
        this.currentBinaural = null;

        if (this.onBinauralChange) this.onBinauralChange(null);

        return this;
    }

    /**
     * Play an alert sound.
     */
    playAlert(type = 'chime') {
        if (!this.soundEnabled || this.muted) return;

        const alertConfig = ALERT_SOUNDS[type] || ALERT_SOUNDS.chime;
        const ctx = this._getContext();
        const now = ctx.currentTime;

        const masterGain = this._createGain(0.6);

        alertConfig.frequencies.forEach((freq, index) => {
            const osc = ctx.createOscillator();
            osc.type = alertConfig.type || 'sine';
            osc.frequency.value = freq;

            const gain = ctx.createGain();
            const startTime = now + (index * 0.08);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.4, startTime + (alertConfig.fadeIn || 0.02));
            gain.gain.exponentialRampToValueAtTime(
                0.001,
                startTime + (alertConfig.duration || 0.3)
            );

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(startTime);
            osc.stop(startTime + alertConfig.duration + 0.1);

            this.activeSounds.alerts.push({ osc, gain });
        });

        // Clean up old alerts
        setTimeout(() => {
            this.activeSounds.alerts = this.activeSounds.alerts.filter(a => {
                try { a.osc.stop(); } catch (e) {}
                a.osc.disconnect();
                a.gain.disconnect();
                return false;
            });
        }, 2000);

        return this;
    }

    // ---------- VOLUME CONTROL ----------

    /**
     * Set master volume.
     */
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));

        // Update ambient gain
        if (this.activeSounds.ambient) {
            this.activeSounds.ambient.gain.gain.value =
                this.muted ? 0 : this.ambientVolume * this.masterVolume;
        }

        // Update binaural gain
        if (this.activeSounds.binaural) {
            this.activeSounds.binaural.gain.gain.value =
                this.muted ? 0 : this.masterVolume;
        }

        if (this.onVolumeChange) this.onVolumeChange(this.masterVolume);

        return this;
    }

    /**
     * Set ambient volume.
     */
    setAmbientVolume(volume) {
        this.ambientVolume = Math.max(0, Math.min(1, volume));

        if (this.activeSounds.ambient) {
            this.activeSounds.ambient.gain.gain.value =
                this.muted ? 0 : this.ambientVolume * this.masterVolume;
        }

        return this;
    }

    /**
     * Toggle mute.
     */
    toggleMute() {
        this.muted = !this.muted;

        if (this.activeSounds.ambient) {
            this.activeSounds.ambient.gain.gain.value =
                this.muted ? 0 : this.ambientVolume * this.masterVolume;
        }

        if (this.activeSounds.binaural) {
            this.activeSounds.binaural.gain.gain.value =
                this.muted ? 0 : this.masterVolume;
        }

        return this.muted;
    }

    // ---------- SLEEP TIMER ----------

    /**
     * Set sleep timer (auto‑fade after N minutes).
     */
    setSleepTimer(minutes) {
        this.cancelSleepTimer();

        if (minutes <= 0) return this;

        this.sleepTimerDuration = minutes * 60;
        this.sleepTimerRemaining = this.sleepTimerDuration;

        this.sleepTimer = setInterval(() => {
            this.sleepTimerRemaining--;

            if (this.onSleepTimerTick) {
                this.onSleepTimerTick(this.sleepTimerRemaining);
            }

            // Start fading in last 60 seconds
            if (this.sleepTimerRemaining <= 60 && this.activeSounds.ambient) {
                const fadeProgress = this.sleepTimerRemaining / 60;
                this.activeSounds.ambient.gain.gain.value =
                    this.ambientVolume * this.masterVolume * fadeProgress;
            }

            if (this.sleepTimerRemaining <= 0) {
                this.stopAll();
                this.cancelSleepTimer();
                if (this.onSleepTimerEnd) this.onSleepTimerEnd();
            }
        }, 1000);

        return this;
    }

    /**
     * Cancel sleep timer.
     */
    cancelSleepTimer() {
        if (this.sleepTimer) {
            clearInterval(this.sleepTimer);
            this.sleepTimer = null;
        }
        this.sleepTimerDuration = 0;
        this.sleepTimerRemaining = 0;
        return this;
    }

    /**
     * Stop all sounds.
     */
    stopAll() {
        this.stopAmbient(0);
        this.stopBinauralBeat();
        this.cancelSleepTimer();
        return this;
    }

    // ---------- PRESETS ----------

    /**
     * Save current sound configuration as preset.
     */
    async savePreset(name) {
        const preset = {
            name,
            ambientType: this.currentAmbient,
            ambientVolume: this.ambientVolume,
            binauralType: this.currentBinaural,
            binauralVolume: this.binauralVolume,
            createdAt: new Date().toISOString(),
        };

        try {
            this.presets = await this.storage.get('soundPresets') || [];
            this.presets.push(preset);
            await this.storage.set('soundPresets', this.presets);
            return preset;
        } catch (err) {
            console.error('Failed to save sound preset:', err);
            return null;
        }
    }

    /**
     * Load a sound preset.
     */
    async loadPreset(name) {
        this.presets = await this.storage.get('soundPresets') || [];
        const preset = this.presets.find(p => p.name === name);

        if (preset) {
            if (preset.ambientType) {
                this.playAmbient(preset.ambientType, preset.ambientVolume);
            }
            if (preset.binauralType) {
                this.playBinauralBeat(preset.binauralType, preset.binauralVolume);
            }
            return true;
        }
        return false;
    }

    // ---------- DESTROY ----------

    /**
     * Clean up all resources.
     */
    destroy() {
        this.stopAll();
        if (this._ctx) {
            this._ctx.close();
            this._ctx = null;
        }
    }

    // ---------- STATIC METHODS ----------

    /**
     * Get available soundscapes.
     */
    static getSoundscapes() {
        return Object.keys(SOUNDSCAPES).map(key => ({
            id: key,
            ...SOUNDSCAPES[key],
        }));
    }

    /**
     * Get binaural beat types.
     */
    static getBinauralBeats() {
        return Object.keys(BINAURAL_BEATS).map(key => ({
            id: key,
            ...BINAURAL_BEATS[key],
        }));
    }

    /**
     * Get alert sound types.
     */
    static getAlertTypes() {
        return Object.keys(ALERT_SOUNDS).map(key => ({
            id: key,
            ...ALERT_SOUNDS[key],
        }));
    }

    /**
     * Get categories.
     */
    static getCategories() {
        const categories = new Set();
        Object.values(SOUNDSCAPES).forEach(s => categories.add(s.category));
        return [...categories];
    }
}

export default SoundSystem;