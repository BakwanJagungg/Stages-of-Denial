/**
 * audioEngine.js - Web Audio API DSP Graph & High-Precision Audio/Video Synchronizer
 * Stages of Denial (v7.0 Modular Architecture)
 *
 * Features:
 * - Zero-allocation 60-120Hz `getAudioTime()` linear interpolation between browser `currentTime` ticks
 * - Human vocal formant extractor (`getVocalEnergy()`) over 300Hz-3400Hz (bins 7..68)
 * - Clean DSP chain: Studio Master / Midnight Lo-Fi / 8D Spatial / Cathedral Hall / Warm Vinyl
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
let hrtfPanner = null;
let isHrtfActive = false;

// Virtual Acoustic Room & Warm Vinyl Nodes
let dryGain = null;
let wetGain = null;
let convolverNode = null;
let cachedCathedralBuffer = null;
let vinylBandpass = null;
let vinylCrackleGain = null;
let vinylSourceNode = null;
let cachedVinylBuffer = null;
let vinylCrackleActive = false;

let activeCustomObjectUrl = null;
let switchToken = 0;
let onTrackEndedHandler = null;
let playbackSpeed = 1.0;
let currentTrackConfig = null;
let filterSweepActive = false;

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

    // True 3D Binaural HRTF Panner (with graceful fallback to StereoPannerNode)
    if (typeof audioCtx.createPanner === 'function') {
      try {
        hrtfPanner = audioCtx.createPanner();
        hrtfPanner.panningModel = 'HRTF';
        hrtfPanner.distanceModel = 'inverse';
        hrtfPanner.refDistance = 1;
        hrtfPanner.maxDistance = 10000;
        hrtfPanner.rolloffFactor = 1;
        hrtfPanner.coneInnerAngle = 360;
        if (hrtfPanner.positionX) {
          hrtfPanner.positionX.setValueAtTime(0, audioCtx.currentTime);
          hrtfPanner.positionY.setValueAtTime(0, audioCtx.currentTime);
          hrtfPanner.positionZ.setValueAtTime(-1, audioCtx.currentTime);
        } else if (typeof hrtfPanner.setPosition === 'function') {
          hrtfPanner.setPosition(0, 0, -1);
        }
      } catch {
        hrtfPanner = null;
      }
    }

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

    dryGain = audioCtx.createGain();
    dryGain.gain.setValueAtTime(1, audioCtx.currentTime);

    wetGain = audioCtx.createGain();
    wetGain.gain.setValueAtTime(0, audioCtx.currentTime);

    vinylCrackleGain = audioCtx.createGain();
    vinylCrackleGain.gain.setValueAtTime(0, audioCtx.currentTime);
    vinylCrackleGain.connect(crossfadeGain);

    const spatialNode = hrtfPanner || stereoPanner;
    const postStage = spatialNode || crossfadeGain;
    analyser.connect(lofiLowpass);
    lofiLowpass.connect(dspLow);
    dspLow.connect(dspMid);
    dspMid.connect(dspHigh);
    dspHigh.connect(dryGain);
    dryGain.connect(postStage);
    wetGain.connect(postStage);
    if (spatialNode) {
      spatialNode.connect(crossfadeGain);
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
      if (getCurrentAudioProfile().id === 'vinyl') startVinylCrackle();
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
      stopVinylCrackle();
      if (bgVideoEl && !bgVideoEl.paused) bgVideoEl.pause();
    });

    audioEl.addEventListener('ended', () => {
      updatePlayPauseIcons(false);
      syncMediaPlaybackState('paused');
      stopVinylCrackle();
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

    audioEl.addEventListener('error', (err) => {
      console.warn('Audio playback error:', err);
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
    audioEl.src = typeof source === 'string' ? source : URL.createObjectURL(source);
  }

  try {
    await audioEl.play();
    if (bgVideoEl) {
      bgVideoEl.muted = true;
      bgVideoEl.volume = 0;
      bgVideoEl.currentTime = audioEl.currentTime;
      bgVideoEl.play().catch(() => {});
    }
  } catch (err) {
    console.warn('audioEl.play() awaiting user gesture:', err);
  }
}

function updateHrtfOrbit(nowSec) {
  if (!hrtfPanner || !isHrtfActive || !audioCtx) return;
  const angle = nowSec * 2 * Math.PI * 0.08; // 1 full revolution every ~12.5 seconds
  const radius = 2.4;
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius;
  const y = Math.sin(angle * 2) * 0.25; // Subtle natural height variation
  const now = audioCtx.currentTime;
  if (hrtfPanner.positionX) {
    hrtfPanner.positionX.setTargetAtTime(x, now, 0.05);
    hrtfPanner.positionY.setTargetAtTime(y, now, 0.05);
    hrtfPanner.positionZ.setTargetAtTime(z, now, 0.05);
  } else if (typeof hrtfPanner.setPosition === 'function') {
    hrtfPanner.setPosition(x, y, z);
  }
}

/**
 * Return current 3D HRTF spatial panner state for telemetry/testing.
 */
export function getHrtfPannerState() {
  return {
    isHrtfActive,
    hasHrtf: Boolean(hrtfPanner),
    panningModel: hrtfPanner?.panningModel || (stereoPanner ? 'stereo' : 'none'),
  };
}

/**
 * Return current playback time (60-120Hz interpolated while playing), duration, and progress (0.0-1.0).
 * @returns {{ currentTime: number, duration: number, progress: number }}
 */
export function getAudioTime() {
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

  if (isHrtfActive) {
    updateHrtfOrbit(currentTime);
  }

  return { currentTime, duration, progress: Math.min(1, Math.max(0, currentTime / duration)) };
}

/**
 * Seek both audio and background video synchronously to a specific second.
 * @param {number} timeInSeconds
 */
export function seekAudio(timeInSeconds) {
  resetCrossfadeFilter(0.15);
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
  currentTrackConfig = trackConfig;
  resetFilterSweep();
  const myToken = ++switchToken;
  updateMediaSessionMetadata(trackConfig);
  stopVinylCrackle();

  if (getCurrentAudioProfile().id === 'auto') {
    applyAudioProfile('auto');
  }

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
    audioEl.load();
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
      bgVideoEl.src = targetVideoSrc;
      bgVideoEl.currentTime = seekStart;
      bgVideoEl.playbackRate = playbackSpeed;
    } else {
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

  resetCrossfadeFilter(0.25);

  try {
    if (audioEl) {
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        await playPromise.catch((err) => {
          if (crossfadeGain && audioCtx) crossfadeGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
          console.warn('Playback play request deferred (awaiting user gesture):', err);
        });
      }
    }
    if (bgVideoEl && targetVideoSrc && !isCustomAudio) {
      bgVideoEl.play().catch(() => {});
    }
  } catch (err) {
    if (crossfadeGain && audioCtx) crossfadeGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
    console.warn('Playback play request deferred (awaiting user gesture):', err);
  }
}

/** Toggle synchronized Audio & Background Video playback. */
export async function togglePlayPause() {
  if (!audioCtx) setupAudioGraph();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  if (!audioEl) return;

  if (audioEl.paused) {
    resetCrossfadeFilter(0.2);
    try {
      await audioEl.play();
      if (bgVideoEl) {
        bgVideoEl.muted = true;
        bgVideoEl.volume = 0;
        bgVideoEl.currentTime = audioEl.currentTime;
        bgVideoEl.play().catch(() => {});
      }
    } catch (err) {
      console.error('Playback failed:', err);
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
  return Boolean(audioEl && !audioEl.paused);
}

/** Available Audiophile DSP Sound Profiles */
/**
 * Synthesize stereo exponential-decay impulse response for Cathedral Hall acoustic mode.
 * @param {AudioContext} ctx
 * @param {number} [durationSec=2.4]
 * @param {number} [decayRate=2.8]
 * @returns {AudioBuffer}
 */
export function createSyntheticImpulseResponse(ctx, durationSec = 2.4, decayRate = 2.8) {
  const sampleRate = ctx.sampleRate || 48000;
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const channelData = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      const env = Math.pow(1 - t, decayRate);
      // Slight low-pass smoothing on white noise avoids metallic ringing on vocals
      const white = Math.random() * 2 - 1;
      lp = lp * 0.45 + white * 0.55;
      channelData[i] = lp * env;
    }
  }
  return buffer;
}

function getOrCreateVinylCrackleBuffer(ctx) {
  if (cachedVinylBuffer && cachedVinylBuffer.sampleRate === ctx.sampleRate) {
    return cachedVinylBuffer;
  }
  const sampleRate = ctx.sampleRate || 48000;
  const length = Math.floor(sampleRate * 4);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.04 * white) / 1.04;
    // Sparse dusty needle crackles + ultra-gentle warm surface noise
    const impulse = Math.random() < 0.0014 ? (Math.random() * 2 - 1) * 0.45 : 0;
    data[i] = brown * 0.25 + impulse;
  }
  cachedVinylBuffer = buffer;
  return buffer;
}

function attachCathedralConvolver() {
  if (!audioCtx || !dspHigh || !wetGain) return;
  if (!cachedCathedralBuffer || cachedCathedralBuffer.sampleRate !== audioCtx.sampleRate) {
    cachedCathedralBuffer = createSyntheticImpulseResponse(audioCtx, 2.4, 2.8);
  }
  if (!convolverNode) {
    convolverNode = audioCtx.createConvolver();
    convolverNode.normalize = true;
    convolverNode.buffer = cachedCathedralBuffer;
    dspHigh.connect(convolverNode);
    convolverNode.connect(wetGain);
  }
}

function detachCathedralConvolver() {
  if (!convolverNode) return;
  try { dspHigh?.disconnect(convolverNode); } catch {}
  try { convolverNode.disconnect(); } catch {}
  convolverNode.buffer = null;
  convolverNode = null;
}

function startVinylCrackle(level = 0.012) {
  if (!audioCtx || !vinylCrackleGain || vinylCrackleActive) return;
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

  const src = audioCtx.createBufferSource();
  src.buffer = getOrCreateVinylCrackleBuffer(audioCtx);
  src.loop = true;

  const bandpass = audioCtx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(1650, audioCtx.currentTime);
  bandpass.Q.setValueAtTime(0.85, audioCtx.currentTime);

  src.connect(bandpass);
  bandpass.connect(vinylCrackleGain);
  vinylCrackleGain.gain.cancelScheduledValues(audioCtx.currentTime);
  vinylCrackleGain.gain.setTargetAtTime(level, audioCtx.currentTime, 0.06);
  src.start();

  vinylSourceNode = src;
  vinylBandpass = bandpass;
  vinylCrackleActive = true;
}

function stopVinylCrackle() {
  if (vinylCrackleGain && audioCtx) {
    vinylCrackleGain.gain.cancelScheduledValues(audioCtx.currentTime);
    vinylCrackleGain.gain.setValueAtTime(0, audioCtx.currentTime);
  }
  if (vinylSourceNode) {
    try { vinylSourceNode.stop(); } catch {}
    try { vinylSourceNode.disconnect(); } catch {}
    vinylSourceNode = null;
  }
  if (vinylBandpass) {
    try { vinylBandpass.disconnect(); } catch {}
    vinylBandpass = null;
  }
  vinylCrackleActive = false;
}

/** Release acoustic DSP nodes cleanly without touching cached reusable graph topology. */
export function cleanupAcousticNodes() {
  stopVinylCrackle();
  detachCathedralConvolver();
}

export function getAcousticState() {
  return {
    profileId: getCurrentAudioProfile().id,
    hasConvolver: Boolean(convolverNode),
    vinylCrackleActive,
  };
}

export const AUDIO_PROFILES = [
  { id: 'auto', label: 'Auto-Adaptif', color: '#A78BFA', desc: 'DSP cerdas otomatis beradaptasi dengan genre & tempo lagu' },
  { id: 'studio', label: 'Studio Master', color: '#68B2D6', desc: 'Respon studio datar jernih tanpa pewarnaan' },
  { id: 'lofi', label: 'Midnight Lo-Fi', color: '#D99F4C', desc: 'Lowpass hangat 4200Hz & sentuhan intim 220Hz' },
  { id: 'spatial', label: '8D Spatial', color: '#D46E9D', desc: 'Ambience L-R berosilasi lembut 0.08Hz (12.5 detik/putaran)' },
  { id: 'cathedral', label: 'Cathedral Hall', color: '#8E97DC', desc: 'Convolver stereo 2.4s reverb melankolis (wet 0.32)' },
  { id: 'vinyl', label: 'Warm Vinyl', color: '#D88855', desc: 'Band-pass warmth & desir piringan hitam halus' },
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

const DSP_PRESETS = {
  studio: [20000, 120, 0, 3000, 0, 0, 0],
  lofi: [4200, 220, 2.0, 3000, 0, 0, 0],
  spatial: [20000, 120, 0.8, 3000, 1.6, 1.2, 0.65],
  cathedral: [15500, 140, 0.6, 2400, 1.2, -0.8, 0],
  vinyl: [5200, 185, 2.4, 1450, 1.5, -2.6, 0],
};

function resolveAdaptiveDsp(trackConfig) {
  const genre = String(trackConfig?.genre || '').toLowerCase();
  const visualEnergy = String(trackConfig?.visualEnergy || '').toLowerCase();
  if (/acoustic|folk|ballad|sad|pop\s*akustik|singer/i.test(genre) || visualEnergy === 'calm') {
    return 'ballad';
  }
  if (/indie|lo-?fi|retro|chill|vintage|bedroom/i.test(genre)) {
    return 'lofi';
  }
  return 'studio';
}

/** @param {'auto'|'studio'|'lofi'|'spatial'|'cathedral'|'vinyl'} profileId */
export function applyAudioProfile(profileId) {
  if (!audioCtx) setupAudioGraph();
  if (!dspLow || !dspMid || !dspHigh || !audioCtx) return;

  const idx = AUDIO_PROFILES.findIndex((p) => p.id === profileId);
  if (idx >= 0) currentProfileIndex = idx;

  const now = audioCtx.currentTime;

  if (profileId === 'auto') {
    const adaptiveMode = resolveAdaptiveDsp(currentTrackConfig);
    if (adaptiveMode === 'ballad') {
      // Acoustic / Folk / Ballad -> subtle Cathedral Hall (wet 0.14) for intimate room
      attachCathedralConvolver();
      if (dryGain) dryGain.gain.setTargetAtTime(0.86, now, 0.08);
      if (wetGain) wetGain.gain.setTargetAtTime(0.14, now, 0.08);
      stopVinylCrackle();
      if (lofiLowpass && !filterSweepActive) lofiLowpass.frequency.setTargetAtTime(17500, now, 0.08);
      dspLow.frequency.setTargetAtTime(135, now, 0.05);
      dspLow.gain.setTargetAtTime(0.8, now, 0.05);
      dspMid.frequency.setTargetAtTime(2600, now, 0.05);
      dspMid.gain.setTargetAtTime(1.0, now, 0.05);
      dspHigh.gain.setTargetAtTime(0.2, now, 0.05);
      if (pannerLfoGain) pannerLfoGain.gain.setTargetAtTime(0, now, 0.12);
    } else if (adaptiveMode === 'lofi') {
      // Indie / Retro / Lo-Fi -> Warm Vinyl with ultra-minimal crackle (0.005)
      detachCathedralConvolver();
      if (dryGain) dryGain.gain.setTargetAtTime(0.96, now, 0.06);
      if (wetGain) wetGain.gain.setTargetAtTime(0.0, now, 0.05);
      if (isAudioPlaying()) startVinylCrackle(0.005);
      if (lofiLowpass && !filterSweepActive) lofiLowpass.frequency.setTargetAtTime(5200, now, 0.08);
      dspLow.frequency.setTargetAtTime(185, now, 0.05);
      dspLow.gain.setTargetAtTime(2.2, now, 0.05);
      dspMid.frequency.setTargetAtTime(1450, now, 0.05);
      dspMid.gain.setTargetAtTime(1.4, now, 0.05);
      dspHigh.gain.setTargetAtTime(-2.2, now, 0.05);
      if (pannerLfoGain) pannerLfoGain.gain.setTargetAtTime(0, now, 0.12);
    } else {
      // Rock / J-Pop / High-Tempo -> clean Studio Master
      detachCathedralConvolver();
      if (dryGain) dryGain.gain.setTargetAtTime(1.0, now, 0.06);
      if (wetGain) wetGain.gain.setTargetAtTime(0.0, now, 0.05);
      stopVinylCrackle();
      if (lofiLowpass && !filterSweepActive) lofiLowpass.frequency.setTargetAtTime(20000, now, 0.08);
      dspLow.frequency.setTargetAtTime(120, now, 0.05);
      dspLow.gain.setTargetAtTime(0, now, 0.05);
      dspMid.frequency.setTargetAtTime(3000, now, 0.05);
      dspMid.gain.setTargetAtTime(0, now, 0.05);
      dspHigh.gain.setTargetAtTime(0, now, 0.05);
      if (pannerLfoGain) pannerLfoGain.gain.setTargetAtTime(0, now, 0.12);
    }
    return;
  }

  const isCathedral = profileId === 'cathedral';
  if (!isCathedral) {
    if (dryGain) dryGain.gain.setTargetAtTime(1.0, now, 0.06);
    if (wetGain) wetGain.gain.setTargetAtTime(0.0, now, 0.05);
    detachCathedralConvolver();
  } else {
    attachCathedralConvolver();
    if (dryGain) dryGain.gain.setTargetAtTime(0.78, now, 0.08);
    if (wetGain) wetGain.gain.setTargetAtTime(0.32, now, 0.08);
  }

  if (profileId !== 'vinyl') stopVinylCrackle();
  else if (isAudioPlaying()) startVinylCrackle(0.012);

  const [lpFreq, lowFreq, lowGain, midFreq, midGain, highGain, panDepth] =
    DSP_PRESETS[profileId] || DSP_PRESETS.studio;
  if (lofiLowpass && !filterSweepActive) lofiLowpass.frequency.setTargetAtTime(lpFreq, now, 0.08);
  dspLow.frequency.setTargetAtTime(lowFreq, now, 0.05);
  dspLow.gain.setTargetAtTime(lowGain, now, 0.05);
  dspMid.frequency.setTargetAtTime(midFreq, now, 0.05);
  dspMid.gain.setTargetAtTime(midGain, now, 0.05);
  dspHigh.gain.setTargetAtTime(highGain, now, 0.05);

  if (profileId === 'spatial') {
    isHrtfActive = true;
    if (hrtfPanner) {
      if (pannerLfoGain) pannerLfoGain.gain.setTargetAtTime(0, now, 0.12);
    } else if (pannerLfoGain) {
      pannerLfoGain.gain.setTargetAtTime(panDepth, now, 0.18);
    }
  } else {
    isHrtfActive = false;
    if (hrtfPanner) {
      if (hrtfPanner.positionX) {
        hrtfPanner.positionX.setTargetAtTime(0, now, 0.08);
        hrtfPanner.positionY.setTargetAtTime(0, now, 0.08);
        hrtfPanner.positionZ.setTargetAtTime(-1, now, 0.08);
      } else if (typeof hrtfPanner.setPosition === 'function') {
        hrtfPanner.setPosition(0, 0, -1);
      }
    }
    if (pannerLfoGain) pannerLfoGain.gain.setTargetAtTime(0, now, 0.12);
  }
}

/**
 * Apply smooth cinematic low-pass filter sweep transition over the final seconds of a track.
 * @param {number} [durationSec=2.5]
 */
export function triggerFilterSweep(durationSec = 2.5) {
  if (!audioCtx || !lofiLowpass) return;
  filterSweepActive = true;
  const now = audioCtx.currentTime;
  const currentF = Math.max(750, lofiLowpass.frequency.value || 20000);
  lofiLowpass.frequency.cancelScheduledValues(now);
  lofiLowpass.frequency.setValueAtTime(currentF, now);
  lofiLowpass.frequency.exponentialRampToValueAtTime(750, now + durationSec);
}

/**
 * Reset crossfade low-pass filter to full range (20,000 Hz) smoothly,
 * preventing audio from sounding boxy / muffled after Auto-Next, track switch, or seek.
 * @param {number} [rampSec=0.25]
 */
export function resetCrossfadeFilter(rampSec = 0.25) {
  filterSweepActive = false;
  if (!audioCtx || !lofiLowpass) return;
  const now = audioCtx.currentTime;
  lofiLowpass.frequency.cancelScheduledValues(now);
  const currentF = Math.max(750, Math.min(20000, lofiLowpass.frequency.value || 20000));
  lofiLowpass.frequency.setValueAtTime(currentF, now);

  const activeProfile = getCurrentAudioProfile().id;
  let targetFreq = 20000;
  if (activeProfile === 'lofi') targetFreq = 4200;
  else if (activeProfile === 'vinyl') targetFreq = 5200;
  else if (activeProfile === 'auto') {
    const adaptiveMode = resolveAdaptiveDsp(currentTrackConfig);
    targetFreq = adaptiveMode === 'lofi' ? 5200 : adaptiveMode === 'ballad' ? 17500 : 20000;
  }
  lofiLowpass.frequency.setTargetAtTime(targetFreq, now, Math.max(0.04, rampSec));
}

/**
 * Legacy alias for resetCrossfadeFilter.
 * @param {number} [rampSec=0.25]
 */
export function resetFilterSweep(rampSec = 0.25) {
  resetCrossfadeFilter(rampSec);
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
