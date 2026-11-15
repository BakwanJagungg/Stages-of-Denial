/**
 * audioEngine.js - Web Audio API DSP Graph & High-Precision Audio/Video Synchronizer
 * Stages of Denial (v7.0 Modular Architecture)
 *
 * Features:
 * - Zero-allocation 60-120Hz `getAudioTime()` linear interpolation between browser `currentTime` ticks
 * - Human vocal formant extractor (`getVocalEnergy()`) over 300Hz-3400Hz (bins 7..68)
 * - Clean DSP chain: Studio Master / Midnight Lo-Fi (4200Hz LPF) / 8D Spatial (0.08Hz LFO)
 * - Crossfade gain staging (0.7s fade) + Midnight Sleep Timer fade-out + Blob URL cleanup
 */

let audioCtx = null;
let analyser = null;
let crossfadeGain = null;
let sleepGain = null;
let masterGain = null;
let mediaSourceNode = null;
let audioEl = null;
let bgVideoEl = null;

// Audiophile & Cinematic DSP Nodes
let lofiLowpass = null;
let dspLow = null;
let dspMid = null;
let dspHigh = null;
let stereoPanner = null;
let pannerLfo = null;
let pannerLfoGain = null;

let activeCustomObjectUrl = null;
let switchToken = 0;
let onTrackEndedHandler = null;
let onAudioFallbackHandler = null;
let playbackSpeed = 1.0;
let currentTrackMeta = null;

// Built-in Generative Ambient Pad Fallback State (when local MP3 is omitted)
let ambientFallbackActive = false;
let ambientPlaying = false;
let ambientDuration = 240;
let ambientElapsed = 0;
let ambientAnchorMs = 0;
let ambientNodes = null;
let ambientFallbackNotifiedForTrack = '';

export function setAudioFallbackHandler(fn) {
  onAudioFallbackHandler = typeof fn === 'function' ? fn : null;
}

export function setActiveAudioTrackMeta(track) {
  currentTrackMeta = track || null;
}

function resolveTrackDuration(trackConfig) {
  const d = Number(trackConfig?.duration);
  if (Number.isFinite(d) && d > 10) return d;
  const acts = trackConfig?.acts;
  if (Array.isArray(acts) && acts.length > 0) {
    const end = Number(acts[acts.length - 1]?.endTime);
    if (Number.isFinite(end) && end > 10) return end;
  }
  return 240;
}

function stopAmbientPad() {
  if (!ambientNodes) return;
  try {
    ambientNodes.oscs.forEach((o) => {
      try { o.stop(); o.disconnect(); } catch {}
    });
    ambientNodes.lfo?.stop();
    ambientNodes.lfo?.disconnect();
    ambientNodes.lfoGain?.disconnect();
    ambientNodes.filter?.disconnect();
    ambientNodes.padGain?.disconnect();
  } catch {}
  ambientNodes = null;
}

function startAmbientPad() {
  if (!audioCtx || !analyser) return;
  stopAmbientPad();
  const now = audioCtx.currentTime;
  const padGain = audioCtx.createGain();
  padGain.gain.setValueAtTime(0.0001, now);
  padGain.gain.setTargetAtTime(0.14, now, 0.45);

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(520, now);
  filter.Q.setValueAtTime(1.1, now);

  const lfo = audioCtx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(0.11, now);
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.setValueAtTime(220, now);
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start(now);

  // Warm atmospheric chord (D2, A2, D3, F3)
  const freqs = [73.42, 110.0, 146.83, 174.61];
  const oscs = freqs.map((hz, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = i % 2 === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(hz, now);
    osc.detune.setValueAtTime((i - 1.5) * 4, now);
    osc.connect(filter);
    osc.start(now);
    return osc;
  });

  filter.connect(padGain);
  padGain.connect(analyser);
  ambientNodes = { oscs, lfo, lfoGain, filter, padGain };
}

function exitAmbientFallback() {
  ambientFallbackActive = false;
  ambientPlaying = false;
  stopAmbientPad();
}

function enterAmbientFallback(trackConfig = currentTrackMeta, startAt = 0, autoPlay = true) {
  setupAudioGraph();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  const dur = resolveTrackDuration(trackConfig);
  ambientFallbackActive = true;
  ambientDuration = dur;
  ambientElapsed = Math.max(0, Math.min(dur, Number(startAt) || 0));
  ambientAnchorMs = performance.now();
  ambientPlaying = Boolean(autoPlay);

  if (audioEl && !audioEl.paused) {
    try { audioEl.pause(); } catch {}
  }

  if (ambientPlaying) {
    startAmbientPad();
    updatePlayPauseIcons(true);
    syncMediaPlaybackState('playing');
  } else {
    stopAmbientPad();
    updatePlayPauseIcons(false);
    syncMediaPlaybackState('paused');
  }

  const trackId = trackConfig?.id || 'default';
  if (ambientFallbackNotifiedForTrack !== trackId) {
    ambientFallbackNotifiedForTrack = trackId;
    if (typeof onAudioFallbackHandler === 'function') {
      onAudioFallbackHandler(trackConfig);
    }
  }
}

// Midnight Sleep Timer State
let sleepMode = 'off'; // 'off' | '15m' | '30m' | 'end'
let sleepEndMs = 0;
let sleepIntervalId = 0;
let onSleepFinishCb = null;
let listenersBound = false;

let wasPlayingBeforeHide = false;
let currentVolume = 0.85;

const FFT_SIZE = 1024;
const BIN_COUNT = FFT_SIZE / 2; // 512 bins
const freqData = new Uint8Array(BIN_COUNT);
const waveData = new Uint8Array(BIN_COUNT);
waveData.fill(128);

// High-precision clock interpolation state
let clockAnchorAudioTime = 0;
let clockAnchorPerfMs = 0;
let wasPlayingClock = false;

// Pre-allocated vocal formant telemetry (300Hz-3400Hz ~ bins 7..72 at 48kHz, zero GC per frame)
const VOCAL_BIN_START = 7;
const VOCAL_BIN_END = 72;
const VOCAL_THRESHOLD = 46;
const vocalTelemetry = {
  vocalEnergy: 0,
  normalized: 0,
  transient: 0,
  isVocalActive: false,
};
let prevVocalEnergy = 0;

/** Physical audio output latency compensation (seconds) */
const LYRIC_SYNC_OFFSET = -0.16;

function resetClockAnchor(timeInSeconds = 0) {
  clockAnchorAudioTime = timeInSeconds;
  clockAnchorPerfMs = performance.now();
}

/**
 * Initialize Web Audio API DSP graph and synchronized audio/video elements.
 */
function setupAudioGraph() {
  bgVideoEl = document.getElementById('bgVideo');
  if (bgVideoEl) {
    bgVideoEl.muted = true;
    bgVideoEl.volume = 0;
  }

  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();

    crossfadeGain = audioCtx.createGain();
    crossfadeGain.gain.setValueAtTime(1, audioCtx.currentTime);

    sleepGain = audioCtx.createGain();
    sleepGain.gain.setValueAtTime(1, audioCtx.currentTime);

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.8;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;

    lofiLowpass = audioCtx.createBiquadFilter();
    lofiLowpass.type = 'lowpass';
    lofiLowpass.frequency.setValueAtTime(20000, audioCtx.currentTime);
    lofiLowpass.Q.setValueAtTime(0.7, audioCtx.currentTime);

    dspLow = audioCtx.createBiquadFilter();
    dspLow.type = 'lowshelf';
    dspLow.frequency.setValueAtTime(220, audioCtx.currentTime);
    dspLow.gain.setValueAtTime(0, audioCtx.currentTime);

    dspMid = audioCtx.createBiquadFilter();
    dspMid.type = 'peaking';
    dspMid.frequency.setValueAtTime(3000, audioCtx.currentTime);
    dspMid.Q.setValueAtTime(1.0, audioCtx.currentTime);
    dspMid.gain.setValueAtTime(0, audioCtx.currentTime);

    dspHigh = audioCtx.createBiquadFilter();
    dspHigh.type = 'highshelf';
    dspHigh.frequency.setValueAtTime(8500, audioCtx.currentTime);
    dspHigh.gain.setValueAtTime(0, audioCtx.currentTime);

    stereoPanner = typeof audioCtx.createStereoPanner === 'function' ? audioCtx.createStereoPanner() : null;
    if (stereoPanner) {
      stereoPanner.pan.setValueAtTime(0, audioCtx.currentTime);
      pannerLfo = audioCtx.createOscillator();
      pannerLfo.type = 'sine';
      pannerLfo.frequency.setValueAtTime(0.08, audioCtx.currentTime);
      pannerLfoGain = audioCtx.createGain();
      pannerLfoGain.gain.setValueAtTime(0, audioCtx.currentTime);
      pannerLfo.connect(pannerLfoGain);
      pannerLfoGain.connect(stereoPanner.pan);
      pannerLfo.start();
    }

    analyser.connect(lofiLowpass);
    lofiLowpass.connect(dspLow);
    dspLow.connect(dspMid);
    dspMid.connect(dspHigh);
    if (stereoPanner) {
      dspHigh.connect(stereoPanner);
      stereoPanner.connect(crossfadeGain);
    } else {
      dspHigh.connect(crossfadeGain);
    }
    crossfadeGain.connect(sleepGain);
    sleepGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);
  }

  if (!audioEl) {
    audioEl = new Audio('/assets/audio/penyangkalan.mp3');
    audioEl.preload = 'auto';
    audioEl.volume = 1.0;

    try {
      mediaSourceNode = audioCtx.createMediaElementSource(audioEl);
      mediaSourceNode.connect(analyser);
    } catch (err) {
      console.warn('Could not create MediaElementSource:', err);
    }

    audioEl.addEventListener('play', () => {
      updatePlayPauseIcons(true);
      syncMediaPlaybackState('playing');
      syncMediaSessionPositionState(true);
      if (bgVideoEl) {
        bgVideoEl.muted = true;
        bgVideoEl.volume = 0;
        if (bgVideoEl.paused) bgVideoEl.play().catch(() => {});
      }
    });

    audioEl.addEventListener('pause', () => {
      updatePlayPauseIcons(false);
      syncMediaPlaybackState('paused');
      syncMediaSessionPositionState(true);
      if (bgVideoEl && !bgVideoEl.paused) bgVideoEl.pause();
    });

    audioEl.addEventListener('ended', () => {
      updatePlayPauseIcons(false);
      syncMediaPlaybackState('paused');
      if (bgVideoEl) bgVideoEl.pause();
      if (sleepMode === 'end') {
        clearSleepTimerInternal(true);
        return;
      }
      if (typeof onTrackEndedHandler === 'function') {
        onTrackEndedHandler();
      }
    });

    audioEl.addEventListener('loadedmetadata', () => {
      syncMediaSessionPositionState(true);
    });

    audioEl.addEventListener('timeupdate', () => {
      syncMediaSessionPositionState(false);
      if (bgVideoEl && !bgVideoEl.seeking) {
        const drift = Math.abs(bgVideoEl.currentTime - audioEl.currentTime);
        if (drift > 0.35) bgVideoEl.currentTime = audioEl.currentTime;
      }
    });

    audioEl.addEventListener('error', () => {
      const src = audioEl?.currentSrc || audioEl?.src || '';
      if (!src || src.startsWith('blob:')) return;
      if (ambientFallbackActive) return;
      enterAmbientFallback(currentTrackMeta, audioEl.currentTime || 0, false);
    });
  }

  setupEventListeners();
}

/**
 * Initialize or resume Web Audio playback.
 * @param {'song'|'file'} [mode='song']
 * @param {string|File|null} [source=null]
 */
export async function initAudio(mode = 'song', source = null) {
  setupAudioGraph();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  if (mode === 'file' && source) {
    exitAmbientFallback();
    audioEl.src = typeof source === 'string' ? source : URL.createObjectURL(source);
  }

  if (audioEl.error || audioEl.networkState === 3) {
    enterAmbientFallback(currentTrackMeta, audioEl.currentTime || 0, true);
    return;
  }

  try {
    await audioEl.play();
    if (bgVideoEl && bgVideoEl.style.display !== 'none') {
      bgVideoEl.muted = true;
      bgVideoEl.volume = 0;
      bgVideoEl.currentTime = audioEl.currentTime;
      bgVideoEl.play().catch(() => {});
    }
  } catch (err) {
    if (audioEl.error || audioEl.networkState === 3 || err?.name === 'NotSupportedError') {
      enterAmbientFallback(currentTrackMeta, audioEl.currentTime || 0, true);
    } else {
      console.warn('audioEl.play() awaiting user gesture:', err);
    }
  }
}

/**
 * Return current playback time (60-120Hz interpolated while playing), duration, and progress (0.0-1.0).
 * @returns {{ currentTime: number, duration: number, progress: number }}
 */
export function getAudioTime() {
  if (ambientFallbackActive) {
    const nowMs = performance.now();
    let cur = ambientElapsed;
    if (ambientPlaying) {
      cur = ambientElapsed + (nowMs - ambientAnchorMs) * 0.001 * (playbackSpeed || 1);
      if (cur >= ambientDuration) {
        ambientElapsed = ambientDuration;
        ambientPlaying = false;
        stopAmbientPad();
        updatePlayPauseIcons(false);
        syncMediaPlaybackState('paused');
        if (sleepMode === 'end') {
          clearSleepTimerInternal(true);
        } else if (typeof onTrackEndedHandler === 'function') {
          onTrackEndedHandler();
        }
        cur = ambientDuration;
      }
    }
    const synced = Math.min(ambientDuration, Math.max(0, cur));
    return {
      currentTime: synced,
      duration: ambientDuration,
      progress: Math.min(1, Math.max(0, synced / (ambientDuration || 1))),
    };
  }

  if (!audioEl) {
    return { currentTime: 0, duration: 240, progress: 0 };
  }

  const duration =
    audioEl.duration && !Number.isNaN(audioEl.duration) && audioEl.duration > 0 ? audioEl.duration : 240;
  const rawTime = audioEl.currentTime || 0;
  const playing = !audioEl.paused && !audioEl.ended && !audioEl.seeking;

  if (!playing) {
    wasPlayingClock = false;
    resetClockAnchor(rawTime);
    const syncedPaused = Math.min(duration, Math.max(0, rawTime + LYRIC_SYNC_OFFSET));
    return { currentTime: syncedPaused, duration, progress: Math.min(1, Math.max(0, syncedPaused / duration)) };
  }

  const nowMs = performance.now();
  const rate = audioEl.playbackRate || 1;
  const predicted = clockAnchorAudioTime + (nowMs - clockAnchorPerfMs) * 0.001 * rate;

  if (!wasPlayingClock || rawTime !== clockAnchorAudioTime || Math.abs(rawTime - predicted) > 0.1) {
    clockAnchorAudioTime = rawTime;
    clockAnchorPerfMs = nowMs;
  }
  wasPlayingClock = true;

  const interpolated = clockAnchorAudioTime + (nowMs - clockAnchorPerfMs) * 0.001 * rate;
  const bounded = Math.min(rawTime + 0.05, interpolated);
  const currentTime = Math.min(duration, Math.max(0, bounded + LYRIC_SYNC_OFFSET));
  return { currentTime, duration, progress: Math.min(1, Math.max(0, currentTime / duration)) };
}

/**
 * Seek both audio and background video synchronously to a specific second.
 * @param {number} timeInSeconds
 */
export function seekAudio(timeInSeconds) {
  if (ambientFallbackActive) {
    const target = Math.max(0, Math.min(ambientDuration, Number(timeInSeconds) || 0));
    ambientElapsed = target;
    ambientAnchorMs = performance.now();
    syncMediaSessionPositionState(true);
    return;
  }
  const dur = audioEl && audioEl.duration && !Number.isNaN(audioEl.duration) ? audioEl.duration : 240;
  const target = Math.max(0, Math.min(dur, timeInSeconds));
  if (audioEl) audioEl.currentTime = target;
  if (bgVideoEl) bgVideoEl.currentTime = target;
  resetClockAnchor(target);
  syncMediaSessionPositionState(true);
}

/** @returns {boolean} */
export function isAudioSeeking() {
  return audioEl ? Boolean(audioEl.seeking) : false;
}

function avg(array, binStart, binEnd) {
  let sum = 0;
  for (let i = binStart; i <= binEnd; i++) sum += array[i];
  return sum / (binEnd - binStart + 1);
}

/**
 * Extract current frequency bands (0-255): bass, mid, treble.
 * @returns {{ bass: number, mid: number, treble: number }}
 */
export function getFrequencyLevels() {
  if (!analyser) return { bass: 0, mid: 0, treble: 0 };
  analyser.getByteFrequencyData(freqData);
  return {
    bass: avg(freqData, 0, 10),
    mid: avg(freqData, 11, 86),
    treble: avg(freqData, 87, 255),
  };
}

/**
 * Extract human vocal formant energy (300Hz-3400Hz) using a pre-allocated singleton object (zero GC).
 * @returns {{ vocalEnergy: number, normalized: number, transient: number, isVocalActive: boolean }}
 */
export function getVocalEnergy() {
  if (!analyser) {
    vocalTelemetry.vocalEnergy = 0;
    vocalTelemetry.normalized = 0;
    vocalTelemetry.transient = 0;
    vocalTelemetry.isVocalActive = false;
    return vocalTelemetry;
  }

  analyser.getByteFrequencyData(freqData);
  let sum = 0;
  for (let i = VOCAL_BIN_START; i <= VOCAL_BIN_END; i++) sum += freqData[i];
  const vocalEnergy = sum / (VOCAL_BIN_END - VOCAL_BIN_START + 1);
  const transient = Math.max(0, vocalEnergy - prevVocalEnergy);
  prevVocalEnergy = vocalEnergy;

  vocalTelemetry.vocalEnergy = vocalEnergy;
  vocalTelemetry.normalized = Math.min(
    1,
    Math.max(0, Math.min(1, (vocalEnergy - 20) / 145)) + Math.min(0.35, transient / 55)
  );
  vocalTelemetry.transient = transient;
  vocalTelemetry.isVocalActive = vocalEnergy > VOCAL_THRESHOLD;
  return vocalTelemetry;
}

/** @returns {Uint8Array} */
export function getWaveformData() {
  if (analyser) analyser.getByteTimeDomainData(waveData);
  return waveData;
}

/** @returns {AudioContext} */
export function getAudioContext() {
  if (!audioCtx) setupAudioGraph();
  return audioCtx;
}

/** @returns {AnalyserNode} */
export function getAnalyserNode() {
  if (!analyser) setupAudioGraph();
  return analyser;
}

/** @returns {HTMLAudioElement} */
export function getAudioElement() {
  if (!audioEl) setupAudioGraph();
  return audioEl;
}

/** @param {Function} fn */
export function setTrackEndedHandler(fn) {
  onTrackEndedHandler = fn;
}

/** @returns {number} */
export function getVolume() {
  return currentVolume;
}

/**
 * Switch actively playing track with 0.7s crossfade and Blob URL memory cleanup.
 * @param {Object} trackConfig
 * @param {File|null} [customFile=null]
 * @param {number} [initialTime=0]
 */
export async function switchTrack(trackConfig, customFile = null, initialTime = 0) {
  setupAudioGraph();
  const myToken = ++switchToken;
  currentTrackMeta = trackConfig || currentTrackMeta;
  ambientFallbackNotifiedForTrack = '';
  exitAmbientFallback();
  updateMediaSessionMetadata(trackConfig);

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  const shouldCrossfade = Boolean(audioEl && (!audioEl.paused || audioEl.currentTime > 0.25) && crossfadeGain);
  if (shouldCrossfade) {
    const now = audioCtx.currentTime;
    crossfadeGain.gain.cancelScheduledValues(now);
    crossfadeGain.gain.setValueAtTime(crossfadeGain.gain.value, now);
    crossfadeGain.gain.setTargetAtTime(0.0001, now, 0.18);
    await new Promise((r) => setTimeout(r, 380));
    if (myToken !== switchToken) return;
  }

  if (activeCustomObjectUrl) {
    URL.revokeObjectURL(activeCustomObjectUrl);
    activeCustomObjectUrl = null;
  }

  let targetAudioSrc = trackConfig?.audioSrc || '/assets/audio/penyangkalan.mp3';
  if (customFile) {
    activeCustomObjectUrl = URL.createObjectURL(customFile);
    targetAudioSrc = activeCustomObjectUrl;
  }

  const isCustomAudio = Boolean(customFile || !trackConfig?.videoSrc);
  document.body.classList.toggle('custom-audio-mode', isCustomAudio);

  const targetVideoSrc = trackConfig?.videoSrc || '';
  const seekStart = Math.max(0, Number(initialTime) || 0);

  if (audioEl) {
    audioEl.pause();
    audioEl.src = targetAudioSrc;
    applySpeedToElements(playbackSpeed);
    if (seekStart > 0) {
      audioEl.addEventListener(
        'loadedmetadata',
        () => {
          if (myToken !== switchToken || !audioEl) return;
          const clamped = audioEl.duration ? Math.min(seekStart, Math.max(0, audioEl.duration - 0.5)) : seekStart;
          audioEl.currentTime = clamped;
          if (bgVideoEl && !isCustomAudio) bgVideoEl.currentTime = clamped;
          resetClockAnchor(clamped);
        },
        { once: true }
      );
    }
    audioEl.currentTime = seekStart;
  }
  resetClockAnchor(seekStart);
  prevVocalEnergy = 0;

  if (bgVideoEl) {
    bgVideoEl.pause();
    bgVideoEl.muted = true;
    bgVideoEl.volume = 0;
    if (targetVideoSrc && !isCustomAudio) {
      bgVideoEl.style.display = '';
      bgVideoEl.src = targetVideoSrc;
      bgVideoEl.currentTime = seekStart;
      bgVideoEl.playbackRate = playbackSpeed;
    } else {
      bgVideoEl.style.display = 'none';
      bgVideoEl.removeAttribute('src');
      bgVideoEl.load();
    }
  }

  if (crossfadeGain && audioCtx) {
    const nowIn = audioCtx.currentTime;
    crossfadeGain.gain.cancelScheduledValues(nowIn);
    crossfadeGain.gain.setValueAtTime(shouldCrossfade ? 0.01 : 1.0, nowIn);
    if (shouldCrossfade) crossfadeGain.gain.setTargetAtTime(1.0, nowIn, 0.22);
  }

  if (!customFile && targetAudioSrc) {
    try {
      const headRes = await fetch(targetAudioSrc, { method: 'HEAD' });
      const contentType = String(headRes.headers.get('content-type') || '');
      if (myToken !== switchToken) return;
      if (!headRes.ok || contentType.includes('text/html')) {
        enterAmbientFallback(trackConfig, seekStart, true);
        return;
      }
    } catch {
      if (myToken !== switchToken) return;
      enterAmbientFallback(trackConfig, seekStart, true);
      return;
    }
  }

  try {
    if (audioEl) await audioEl.play();
    if (bgVideoEl && targetVideoSrc && !isCustomAudio) bgVideoEl.play().catch(() => {});
  } catch (err) {
    if (crossfadeGain && audioCtx) crossfadeGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
    if (!customFile && audioEl && (audioEl.error || audioEl.networkState === 3)) {
      enterAmbientFallback(trackConfig, seekStart, true);
      return;
    }
    console.warn('Playback play request deferred (awaiting user gesture):', err);
  }
}

/** Toggle synchronized Audio & Background Video playback. */
export async function togglePlayPause() {
  if (!audioCtx) setupAudioGraph();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  if (ambientFallbackActive) {
    if (ambientPlaying) {
      ambientElapsed = Math.min(ambientDuration, ambientElapsed + (performance.now() - ambientAnchorMs) * 0.001 * (playbackSpeed || 1));
      ambientPlaying = false;
      stopAmbientPad();
      updatePlayPauseIcons(false);
      syncMediaPlaybackState('paused');
    } else {
      if (ambientElapsed >= ambientDuration - 0.1) ambientElapsed = 0;
      ambientAnchorMs = performance.now();
      ambientPlaying = true;
      startAmbientPad();
      updatePlayPauseIcons(true);
      syncMediaPlaybackState('playing');
    }
    syncMediaSessionPositionState(true);
    return;
  }

  if (!audioEl) return;

  if (audioEl.error || audioEl.networkState === 3) {
    enterAmbientFallback(currentTrackMeta, audioEl.currentTime || 0, true);
    return;
  }

  if (audioEl.paused) {
    try {
      await audioEl.play();
      if (bgVideoEl && bgVideoEl.style.display !== 'none') {
        bgVideoEl.muted = true;
        bgVideoEl.volume = 0;
        bgVideoEl.currentTime = audioEl.currentTime;
        bgVideoEl.play().catch(() => {});
      }
    } catch (err) {
      if (audioEl.error || audioEl.networkState === 3 || err?.name === 'NotSupportedError') {
        enterAmbientFallback(currentTrackMeta, audioEl.currentTime || 0, true);
      } else {
        console.error('Playback failed:', err);
      }
    }
  } else {
    audioEl.pause();
    if (bgVideoEl) bgVideoEl.pause();
  }
}

/** @param {number|string} value */
export function setVolume(value) {
  currentVolume = Math.max(0, Math.min(1, parseFloat(value)));
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
  }
}

function updatePlayPauseIcons(playing) {
  const iconPlay = document.getElementById('iconPlay');
  const iconPause = document.getElementById('iconPause');
  if (iconPlay && iconPause) {
    iconPlay.style.display = playing ? 'none' : 'block';
    iconPause.style.display = playing ? 'block' : 'none';
  }
}

/** @returns {boolean} */
export function isAudioPlaying() {
  if (ambientFallbackActive) return ambientPlaying;
  return Boolean(audioEl && !audioEl.paused);
}

/** Available Audiophile DSP Sound Profiles */
export const AUDIO_PROFILES = [
  { id: 'studio', label: 'Studio Master', color: '#68B2D6', desc: 'Respon studio datar jernih tanpa pewarnaan' },
  { id: 'lofi', label: 'Midnight Lo-Fi', color: '#D99F4C', desc: 'Lowpass hangat 4200Hz & sentuhan intim 220Hz' },
  { id: 'spatial', label: '8D Spatial', color: '#D46E9D', desc: 'Ambience L-R berosilasi lembut 0.08Hz (12.5 detik/putaran)' },
];

let currentProfileIndex = 0;

/** @returns {Object} */
export function cycleAudioProfile() {
  currentProfileIndex = (currentProfileIndex + 1) % AUDIO_PROFILES.length;
  const profile = AUDIO_PROFILES[currentProfileIndex];
  applyAudioProfile(profile.id);
  return profile;
}

/** @returns {Object} */
export function getCurrentAudioProfile() {
  return AUDIO_PROFILES[currentProfileIndex];
}

/** @param {'studio'|'lofi'|'spatial'} profileId */
export function applyAudioProfile(profileId) {
  if (!dspLow || !dspMid || !dspHigh || !audioCtx) return;
  const now = audioCtx.currentTime;
  switch (profileId) {
    case 'lofi':
      if (lofiLowpass) lofiLowpass.frequency.setTargetAtTime(4200, now, 0.08);
      dspLow.frequency.setTargetAtTime(220, now, 0.05);
      dspLow.gain.setTargetAtTime(2.0, now, 0.05);
      dspMid.gain.setTargetAtTime(0, now, 0.05);
      dspHigh.gain.setTargetAtTime(0, now, 0.05);
      if (pannerLfoGain) pannerLfoGain.gain.setTargetAtTime(0, now, 0.12);
      break;
    case 'spatial':
      if (lofiLowpass) lofiLowpass.frequency.setTargetAtTime(20000, now, 0.08);
      dspLow.frequency.setTargetAtTime(120, now, 0.05);
      dspLow.gain.setTargetAtTime(0.8, now, 0.05);
      dspMid.gain.setTargetAtTime(1.6, now, 0.05);
      dspHigh.gain.setTargetAtTime(1.2, now, 0.05);
      if (pannerLfoGain) pannerLfoGain.gain.setTargetAtTime(0.65, now, 0.18);
      break;
    case 'studio':
    default:
      if (lofiLowpass) lofiLowpass.frequency.setTargetAtTime(20000, now, 0.08);
      dspLow.frequency.setTargetAtTime(120, now, 0.05);
      dspLow.gain.setTargetAtTime(0, now, 0.05);
      dspMid.gain.setTargetAtTime(0, now, 0.05);
      dspHigh.gain.setTargetAtTime(0, now, 0.05);
      if (pannerLfoGain) pannerLfoGain.gain.setTargetAtTime(0, now, 0.12);
      break;
  }
}

function setupEventListeners() {
  const btnPlayPause = document.getElementById('btnPlayPause');
  const volumeSlider = document.getElementById('volumeSlider');
  if (btnPlayPause) btnPlayPause.onclick = () => togglePlayPause();
  if (volumeSlider) volumeSlider.oninput = (e) => setVolume(e.target.value);

  if (listenersBound) return;
  listenersBound = true;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (audioEl && !audioEl.paused) {
        wasPlayingBeforeHide = true;
        audioEl.pause();
        if (bgVideoEl) bgVideoEl.pause();
      }
    } else if (wasPlayingBeforeHide) {
      wasPlayingBeforeHide = false;
      if (audioEl && audioEl.paused) {
        audioEl.play().catch(() => {});
        if (bgVideoEl) bgVideoEl.play().catch(() => {});
      }
    }
  });
}

function applySpeedToElements(rate) {
  if (audioEl) {
    audioEl.preservesPitch = true;
    audioEl.mozPreservesPitch = true;
    audioEl.webkitPreservesPitch = true;
    audioEl.playbackRate = rate;
  }
  if (bgVideoEl) bgVideoEl.playbackRate = rate;
}

/** @param {number} rate */
export function setPlaybackSpeed(rate) {
  const safeRate = Math.max(0.5, Math.min(2.0, Number(rate) || 1.0));
  if (ambientFallbackActive && ambientPlaying) {
    ambientElapsed = Math.min(ambientDuration, ambientElapsed + (performance.now() - ambientAnchorMs) * 0.001 * (playbackSpeed || 1));
    ambientAnchorMs = performance.now();
  }
  playbackSpeed = safeRate;
  applySpeedToElements(safeRate);
  if (audioEl) resetClockAnchor(audioEl.currentTime || 0);
  syncMediaSessionPositionState(true);
  return playbackSpeed;
}

/** @returns {number} */
export function getPlaybackSpeed() {
  return playbackSpeed;
}

function clearSleepTimerInternal(fireCallback = false) {
  if (sleepIntervalId) {
    clearInterval(sleepIntervalId);
    sleepIntervalId = 0;
  }
  sleepMode = 'off';
  sleepEndMs = 0;
  if (sleepGain && audioCtx) {
    const now = audioCtx.currentTime;
    sleepGain.gain.cancelScheduledValues(now);
    sleepGain.gain.setTargetAtTime(1.0, now, 0.15);
  }
  if (fireCallback && typeof onSleepFinishCb === 'function') {
    const cb = onSleepFinishCb;
    onSleepFinishCb = null;
    cb();
  }
}

/**
 * Configure Midnight Sleep Timer with gradual 10s fade-out.
 * @param {'off'|'15m'|'30m'|'end'} [mode='off']
 * @param {Function|null} [onFinish=null]
 */
export function setSleepTimer(mode = 'off', onFinish = null) {
  clearSleepTimerInternal(false);
  sleepMode = mode || 'off';
  onSleepFinishCb = onFinish;
  if (sleepMode === 'off') return getSleepTimerState();

  const durationSec = sleepMode === '15m' ? 900 : sleepMode === '30m' ? 1800 : 0;
  if (durationSec > 0) sleepEndMs = Date.now() + durationSec * 1000;

  sleepIntervalId = window.setInterval(() => {
    let remainingSec = Infinity;
    if (sleepMode === 'end') {
      if (audioEl && audioEl.duration > 0) remainingSec = Math.max(0, audioEl.duration - audioEl.currentTime);
    } else {
      remainingSec = Math.max(0, (sleepEndMs - Date.now()) / 1000);
    }

    if (sleepGain && audioCtx && remainingSec <= 10) {
      sleepGain.gain.setTargetAtTime(Math.max(0.0001, remainingSec / 10), audioCtx.currentTime, 0.25);
    }

    if (sleepMode !== 'end' && remainingSec <= 0.1) {
      if (audioEl && !audioEl.paused) audioEl.pause();
      if (bgVideoEl) bgVideoEl.pause();
      clearSleepTimerInternal(true);
    }
  }, 500);

  return getSleepTimerState();
}

/** @returns {{ mode: string, remainingSeconds: number|null }} */
export function getSleepTimerState() {
  let remainingSeconds = null;
  if (sleepMode === '15m' || sleepMode === '30m') {
    remainingSeconds = Math.max(0, Math.ceil((sleepEndMs - Date.now()) / 1000));
  } else if (sleepMode === 'end' && audioEl && audioEl.duration > 0) {
    remainingSeconds = Math.max(0, Math.ceil(audioEl.duration - audioEl.currentTime));
  }
  return { mode: sleepMode, remainingSeconds };
}

let mediaSessionHandlers = { onNext: null, onPrevious: null, onSeek: null };
let mediaSessionBound = false;
let lastMediaPositionSyncMs = 0;

function syncMediaPlaybackState(state) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = state;
  } catch {}
}

/** Sync Media Session playback position (~1Hz throttle unless forced). */
export function syncMediaSessionPositionState(force = false) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  if (typeof navigator.mediaSession.setPositionState !== 'function' || !audioEl) return;

  const now = performance.now();
  if (!force && now - lastMediaPositionSyncMs < 950) return;
  const duration = Number(audioEl.duration);
  if (!Number.isFinite(duration) || duration <= 0) return;

  lastMediaPositionSyncMs = now;
  const position = Math.max(0, Math.min(duration, Number(audioEl.currentTime) || 0));
  const rate = Math.max(0.25, Math.min(4, Number(playbackSpeed || audioEl.playbackRate) || 1));
  try {
    navigator.mediaSession.setPositionState({ duration, playbackRate: rate, position });
  } catch {}
}

/** Update browser OS Media Session metadata (lockscreen, hardware keys, media overlay). */
export function updateMediaSessionMetadata(trackConfig) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !trackConfig) return;
  const coverSrc = trackConfig.coverSrc || '/assets/images/penyangkalan-cover.jpg';
  let absCoverUrl = coverSrc;
  try {
    absCoverUrl = new URL(coverSrc, window.location.origin).href;
  } catch {}

  const artwork = [
    { src: absCoverUrl, sizes: '600x600', type: 'image/jpeg' },
    { src: absCoverUrl, sizes: '512x512', type: 'image/jpeg' },
  ];
  const genreLabel = trackConfig.genre && trackConfig.genre !== 'ALL' ? ` · ${trackConfig.genre}` : '';
  const metaPayload = {
    title: trackConfig.title || 'Stages of Denial',
    artist: trackConfig.artist || 'Antologi Penyangkalan',
    album: `Stages of Denial${genreLabel}`,
    artwork,
  };
  try {
    navigator.mediaSession.metadata = typeof window.MediaMetadata === 'function'
      ? new window.MediaMetadata(metaPayload)
      : metaPayload;
  } catch {}
}

/** Register OS / hardware media key handlers cleanly (idempotent). */
export function registerMediaSessionHandlers({ onNext = null, onPrevious = null, onSeek = null } = {}) {
  mediaSessionHandlers = { onNext, onPrevious, onSeek };
  if (mediaSessionBound || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  mediaSessionBound = true;

  const setHandler = (action, fn) => {
    try {
      navigator.mediaSession.setActionHandler(action, fn);
    } catch {}
  };

  setHandler('play', async () => {
    if (!isAudioPlaying()) await togglePlayPause();
  });
  setHandler('pause', async () => {
    if (isAudioPlaying()) await togglePlayPause();
  });
  setHandler('previoustrack', () => {
    if (typeof mediaSessionHandlers.onPrevious === 'function') mediaSessionHandlers.onPrevious();
  });
  setHandler('nexttrack', () => {
    if (typeof mediaSessionHandlers.onNext === 'function') mediaSessionHandlers.onNext();
  });
  setHandler('seekbackward', (details) => {
    const step = Number(details?.seekOffset) || 10;
    const nextSec = Math.max(0, (audioEl ? audioEl.currentTime : 0) - step);
    if (typeof mediaSessionHandlers.onSeek === 'function') mediaSessionHandlers.onSeek(nextSec);
    else seekAudio(nextSec);
  });
  setHandler('seekforward', (details) => {
    const step = Number(details?.seekOffset) || 10;
    const dur = audioEl && Number.isFinite(audioEl.duration) ? audioEl.duration : 300;
    const nextSec = Math.min(dur, (audioEl ? audioEl.currentTime : 0) + step);
    if (typeof mediaSessionHandlers.onSeek === 'function') mediaSessionHandlers.onSeek(nextSec);
    else seekAudio(nextSec);
  });
  setHandler('seekto', (details) => {
    if (!Number.isFinite(details?.seekTime)) return;
    if (typeof mediaSessionHandlers.onSeek === 'function') mediaSessionHandlers.onSeek(details.seekTime);
    else seekAudio(details.seekTime);
  });
}
