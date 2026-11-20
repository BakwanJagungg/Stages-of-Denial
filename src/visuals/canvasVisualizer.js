/**
 * canvasVisualizer.js - Eye-Comfort Cinema Multi-Layer Atmospheric Canvas Engine
 * Stages of Denial (v7.0 Modular Architecture)
 *
 * Features:
 * - Zero per-frame heap allocations (pre-allocated stardust, f/1.4 bokeh, ripples, motes, embers)
 * - Dynamic Color Shift & Harmonic Dual-Layer Silk Aurora responding to music energy & Babak III Climax
 * - Scroll-linked Camera Zoom & Stardust Velocity Trails coordinated with scrollyDirector.js
 */

import AudioMotionAnalyzer from 'audiomotion-analyzer';
import {
  getFrequencyLevels,
  getVocalEnergy,
  getAudioContext,
  getAnalyserNode,
} from '../audio/audioEngine.js';

const canvas = document.getElementById('visualizer-canvas');
const ctx = canvas ? canvas.getContext('2d', { alpha: true }) : null;
const ambientGlow = document.getElementById('ambientGlow');
const mistOverlay = document.getElementById('mistOverlay');
const opticalScrimEl = document.getElementById('opticalScrim');
const audioMotionContainer = document.getElementById('audiomotion-container');
const bgVideoEl = document.getElementById('bgVideo');
const kineticStageEl = document.getElementById('kineticStage');

const directorHudEl = document.getElementById('studioPopover');
const directorFpsEl = document.getElementById('directorFps');
const directorWaveCanvas = document.getElementById('directorVocalWave');
const directorWaveCtx = directorWaveCanvas ? directorWaveCanvas.getContext('2d') : null;

const bassEl = document.getElementById('liveBassLevel');
const midEl = document.getElementById('liveMidLevel');
const trebleEl = document.getElementById('liveTrebleLevel');
const bassBarEl = document.getElementById('bassMeterBar');
const midBarEl = document.getElementById('midMeterBar');
const trebleBarEl = document.getElementById('trebleMeterBar');

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const SOFT_IVORY = '#F2EFE9';

let width = window.innerWidth;
let height = window.innerHeight;
let dpr = Math.min(window.devicePixelRatio || 1, 2);

let animId = null;
let isRunning = false;
let audioMotion = null;
let time = 0;

let visualMode = 'intro';
let currentTheme = 'crimson-ash';
let activeAccentPrimary = '#D65A70';
let activeAccentSecondary = '#D98A5C';
let activeAccentCold = '#68B2D6';
let activeParticleStyle = 'falling-ash';
let activeVisualEnergy = 'intense';
let activeGenre = '';
let activeVisualContext = 'ballad'; // 'high-tempo' | 'dreamy' | 'ballad' | 'prism'
let sceneIntensityMode = 'cinema';

const STORAGE_KEY_2D_SCENE = 'stages_of_denial_2d_scene';
let userSceneArchetype = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY_2D_SCENE) || 'editorial-silk';
  } catch {
    return 'editorial-silk';
  }
})();
let activeSceneArchetype = userSceneArchetype || 'editorial-silk';

const STORAGE_KEY_EXTRA_REACTIVE = 'stages_of_denial_extra_reactive';
let extraReactiveEffects = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY_EXTRA_REACTIVE) === 'true';
  } catch {
    return false;
  }
})();

export function setExtraReactiveEffects(enabled) {
  extraReactiveEffects = Boolean(enabled);
  try {
    localStorage.setItem(STORAGE_KEY_EXTRA_REACTIVE, extraReactiveEffects ? 'true' : 'false');
  } catch {}
  return extraReactiveEffects;
}

export function getExtraReactiveEffects() {
  return extraReactiveEffects;
}
let activeTrackMeta = {
  id: 'penyangkalan',
  title: 'Penyangkalan',
  artist: 'for Revenge',
  genre: 'Post-Rock / Emo',
  particleStyle: 'falling-ash',
  visualEnergy: 'intense',
  accentPrimary: '#D65A70',
  accentSecondary: '#D98A5C',
  accentCold: '#68B2D6',
};

// Zero-GC Live Acoustic & Spectral Dynamics state
let emaEnergy = 0;
let liveBeatFlux = 0;
let beatPulseLevel = 0;
let livePaceFactor = 1.0;
let spectralToneRatio = 1.0;

function hslToHex(h, s, l) {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = ln - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/**
 * Deterministically synthesize an eye-comfort dark-cinema color palette from any track title/seed.
 * @param {string} seedText
 */
export function generateDynamicTrackPalette(seedText = 'Custom Audio') {
  const str = String(seedText || 'Custom Audio');
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 42) % 360;
  const h3 = (h1 + 195) % 360;
  return {
    accentPrimary: hslToHex(h1, 64, 62),
    accentSecondary: hslToHex(h2, 62, 65),
    accentCold: hslToHex(h3, 56, 66),
    theme: 'prism-aurora',
    particleStyle: 'floating-embers',
    visualEnergy: 'groovy',
  };
}

function computeLiveAudioDynamics(bassNorm, midNorm, trebleNorm, vocalNorm, nowMs, dtSec) {
  const instantEnergy = bassNorm * 0.72 + midNorm * 0.28;
  emaEnergy += (instantEnergy - emaEnergy) * 0.12;
  liveBeatFlux = Math.max(0, instantEnergy - emaEnergy);
  beatPulseLevel = Math.max(beatPulseLevel * Math.exp(-dtSec * 6.5), Math.min(1, liveBeatFlux * 4.5));
  const targetPace = 0.74 + Math.min(1.42, emaEnergy * 1.15 + beatPulseLevel * 0.72 + vocalNorm * 0.35);
  livePaceFactor += (targetPace - livePaceFactor) * 0.14;
  spectralToneRatio = (trebleNorm + 0.08) / (bassNorm * 0.6 + midNorm * 0.4 + 0.12);

  if (liveBeatFlux > 0.045 && instantEnergy > 0.20 && nowMs - lastSonicRingMs > 240) {
    lastSonicRingMs = nowMs;
    spawnSonicRing(Math.min(1, instantEnergy * 0.75 + liveBeatFlux * 2.4));
  }
}

export function getLiveAudioDynamics() {
  return {
    paceFactor: Number(livePaceFactor.toFixed(3)),
    beatFlux: Number(liveBeatFlux.toFixed(3)),
    beatPulse: Number(beatPulseLevel.toFixed(3)),
    spectralToneRatio: Number(spectralToneRatio.toFixed(3)),
    visualContext: activeVisualContext,
  };
}

import {
  SCENE_ARCHETYPES,
  renderSceneArchetype,
  resolve2DSceneArchetype as modularResolve2DSceneArchetype,
} from './scenes/index.js';

export { SCENE_ARCHETYPES };

/**
 * Automatically determine the most fitting 2D cinematic stage archetype
 * from the 18 distinct modular variants based on track metadata and real-time audio dynamics.
 */
export function resolve2DSceneArchetype(trackMeta, liveAudioDynamics = null) {
  if (userSceneArchetype && userSceneArchetype !== 'auto') {
    return userSceneArchetype;
  }
  return modularResolve2DSceneArchetype(trackMeta, liveAudioDynamics);
}

/** Set user override for 2D scene archetype */
export function setScene2DArchetype(mode) {
  const valid = ['auto', ...SCENE_ARCHETYPES.map((s) => s.id)];
  userSceneArchetype = valid.includes(mode) ? mode : 'auto';
  try {
    localStorage.setItem(STORAGE_KEY_2D_SCENE, userSceneArchetype);
  } catch {}
  activeSceneArchetype = resolve2DSceneArchetype(activeTrackMeta, { paceFactor: livePaceFactor });
  return activeSceneArchetype;
}

/** Return active 2D scene archetype state */
export function getScene2DArchetype() {
  return {
    userSetting: userSceneArchetype,
    activeMode: activeSceneArchetype,
  };
}

/** Set active track metadata for dynamic scene resolution */
export function setVisualizerTrack(track) {
  if (!track) return;
  activeTrackMeta = {
    id: track.id || '',
    title: track.title || '',
    artist: track.artist || '',
    genre: track.genre || '',
    theme: track.theme || 'crimson-ash',
    particleStyle: track.particleStyle || 'falling-ash',
    visualEnergy: track.visualEnergy || 'calm',
    accentPrimary: track.accentPrimary || '#D65A70',
    accentSecondary: track.accentSecondary || '#D98A5C',
    accentCold: track.accentCold || '#68B2D6',
  };
  setTheme(
    track.theme,
    track.accentPrimary,
    track.accentSecondary,
    track.particleStyle,
    track.visualEnergy,
    track.genre || '',
    track.accentCold || null
  );
  activeSceneArchetype = resolve2DSceneArchetype(activeTrackMeta, { paceFactor: 1.0 });
}

function resolveVisualContext(genre, energy, particleStyle, theme = '') {
  const g = String(genre || '');
  if (theme === 'prism-aurora' || /user audio|mp3\s*\+\s*lrc|custom/i.test(g)) {
    return 'prism';
  }
  if (/j-?pop|j-?rock|rock|ska|anime|punk|metal|electronic|hip-?hop/i.test(g) && energy !== 'calm') {
    return 'high-tempo';
  }
  if (/folk|acoustic|ballad|indo\s*pop|sad|singer/i.test(g) || particleStyle === 'rain' || particleStyle === 'heavy-rain' || energy === 'calm') {
    return 'ballad';
  }
  return 'dreamy';
}

/** @returns {'high-tempo'|'dreamy'|'ballad'} */
export function getVisualContextMode() {
  return activeVisualContext;
}

// v7.0 Scroll-Linked Choreography Modifiers (zero-GC scalars updated by scrollyDirector)
let targetCameraZoom = 1.0;
let smoothCameraZoom = 1.0;
let scrollVelocityInput = 0;
let smoothScrollVelocity = 0;

/**
 * Update scroll-linked camera depth zoom & stardust trail velocity from scrollyDirector.
 * @param {{ zoomFactor?: number, scrollVelocity?: number }} params
 */
export function setChoreographyState({ zoomFactor = 1.0, scrollVelocity = 0 } = {}) {
  targetCameraZoom = Math.max(0.98, Math.min(1.14, Number(zoomFactor) || 1.0));
  scrollVelocityInput = Math.max(-40, Math.min(40, Number(scrollVelocity) || 0));
}

/** @param {'cinema'|'pure'|'ambient'} [mode='cinema'] */
export function setSceneIntensity(mode = 'cinema') {
  const valid = mode === 'pure' || mode === 'ambient' ? mode : 'cinema';
  sceneIntensityMode = valid;
  document.body.classList.toggle('scene-pure-visualizer', valid === 'pure');
  document.body.classList.toggle('scene-ambient-focus', valid === 'ambient');
  return sceneIntensityMode;
}

/** @returns {'cinema'|'pure'|'ambient'} */
export function getSceneIntensity() {
  return sceneIntensityMode;
}

let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;
let smoothVocal = 0;
let lastMeterTextBass = -1;
let lastMeterTextMid = -1;
let lastMeterTextTreble = -1;

let mouseTargetNormX = 0;
let mouseTargetNormY = 0;
let mouseSmoothNormX = 0;
let mouseSmoothNormY = 0;
let cursorPxX = -9999;
let cursorPxY = -9999;
let cursorActive = false;

window.addEventListener(
  'mousemove',
  (e) => {
    mouseTargetNormX = (e.clientX / (width || 1)) * 2 - 1;
    mouseTargetNormY = (e.clientY / (height || 1)) * 2 - 1;
    cursorPxX = e.clientX;
    cursorPxY = e.clientY;
    cursorActive = true;
  },
  { passive: true }
);

window.addEventListener(
  'mouseleave',
  () => {
    mouseTargetNormX = 0;
    mouseTargetNormY = 0;
    cursorActive = false;
  },
  { passive: true }
);

const RIPPLE_POOL_SIZE = 6;
const ripplePool = Array.from({ length: RIPPLE_POOL_SIZE }, () => ({
  active: false,
  age: 0,
  duration: 1.05,
  maxRadius: 340,
}));
let rippleWriteIdx = 0;
let auroraBoostRemaining = 0;

/** Emit radial ripple and gentle aurora surge on emphasized karaoke words. */
export function triggerHighlightPulse() {
  if (reducedMotionQuery.matches) return;
  const r = ripplePool[rippleWriteIdx];
  rippleWriteIdx = (rippleWriteIdx + 1) % RIPPLE_POOL_SIZE;
  r.active = true;
  r.age = 0;
  r.maxRadius = Math.min(width, height) * 0.44;
  auroraBoostRemaining = 0.8;
}

const VOCAL_WAVE_SAMPLES = 44;
const vocalWaveHistory = new Float32Array(VOCAL_WAVE_SAMPLES);
let vocalWaveHead = 0;
let lastWaveSampleMs = 0;
let lastFrameMs = performance.now();
let fpsAccFrames = 0;
let fpsAccMs = 0;
let currentFps = 60;

let primaryBokehSprite = null;
let secondaryBokehSprite = null;

function parseHexRgb(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return [214, 90, 112];
  }
  const clean = hex.slice(1);
  const full =
    clean.length === 3 ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2] : clean;
  return [
    parseInt(full.slice(0, 2), 16) || 214,
    parseInt(full.slice(2, 4), 16) || 90,
    parseInt(full.slice(4, 6), 16) || 112,
  ];
}

/** @param {string} hex @param {number} [alpha=1] */
export function hexToRgba(hex, alpha = 1) {
  const [r, g, b] = parseHexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Blend two hex colors smoothly without allocating new intermediate strings unnecessarily. */
function lerpColorRgba(hexA, hexB, mixRatio, alpha) {
  const [r1, g1, b1] = parseHexRgb(hexA);
  const [r2, g2, b2] = parseHexRgb(hexB);
  const t = Math.max(0, Math.min(1, mixRatio));
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Interpolate between two hex colors and return standard 6-char hex. */
function lerpColorHex(hexA, hexB, mixRatio) {
  const [r1, g1, b1] = parseHexRgb(hexA);
  const [r2, g2, b2] = parseHexRgb(hexB);
  const t = Math.max(0, Math.min(1, mixRatio));
  const r = Math.round(r1 + (r2 - r1) * t).toString(16).padStart(2, '0');
  const g = Math.round(g1 + (g2 - g1) * t).toString(16).padStart(2, '0');
  const b = Math.round(b1 + (b2 - b1) * t).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

// Lyric Synesthesia Micro-Trigger State (Zero-GC scalar interpolation)
let activeSentimentMotif = null;
let sentimentMotifTimer = 0;
let smoothRainSurge = 0;
let smoothFireSurge = 0;
let smoothNightSurge = 0;
let smoothWarmthSurge = 0;

/**
 * Emit zero-latency micro-trigger when an active lyric line contains a motif.
 * @param {'rain'|'fire'|'night'|'warmth'} motif
 * @param {string|null} [tint=null]
 */
export function triggerLyricSentiment(motif, tint = null) {
  activeSentimentMotif = motif;
  sentimentMotifTimer = 4.2;
}

export function getSynesthesiaState() {
  return {
    activeMotif: activeSentimentMotif,
    timer: Number(sentimentMotifTimer.toFixed(2)),
    rainSurge: Number(smoothRainSurge.toFixed(3)),
    fireSurge: Number(smoothFireSurge.toFixed(3)),
    nightSurge: Number(smoothNightSurge.toFixed(3)),
    warmthSurge: Number(smoothWarmthSurge.toFixed(3)),
  };
}

// 35mm Film Grain Post-Processing (128x128 tile updated at 12 FPS)
const GRAIN_SIZE = 128;
let grainCanvas = null;
let grainCtx = null;
let grainImageData = null;
let grainData32 = null;
let grainPattern = null;
let lastGrainUpdateMs = 0;

function initGrain() {
  if (grainCanvas) return;
  grainCanvas = document.createElement('canvas');
  grainCanvas.width = GRAIN_SIZE;
  grainCanvas.height = GRAIN_SIZE;
  grainCtx = grainCanvas.getContext('2d');
  grainImageData = grainCtx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  grainData32 = new Uint32Array(grainImageData.data.buffer);
  updateGrainPattern();
}

function updateGrainPattern() {
  if (!grainCtx || !grainData32) return;
  const len = grainData32.length;
  for (let i = 0; i < len; i++) {
    const val = (Math.random() * 255) | 0;
    // 32-bit pixel: alpha 0x30 with random greyscale intensity
    grainData32[i] = (0x30 << 24) | (val << 16) | (val << 8) | val;
  }
  grainCtx.putImageData(grainImageData, 0, 0);
  if (ctx) {
    grainPattern = ctx.createPattern(grainCanvas, 'repeat');
  }
}

let foregroundBokehSprite = null;

function buildBokehSprite(colorHex, innerAlpha, midAlpha, size = 96) {
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const octx = off.getContext('2d');
  const half = size * 0.5;
  const grad = octx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, hexToRgba(colorHex, innerAlpha));
  grad.addColorStop(0.38, hexToRgba(colorHex, midAlpha));
  grad.addColorStop(0.74, hexToRgba(colorHex, midAlpha * 0.25));
  grad.addColorStop(1, hexToRgba(colorHex, 0));
  octx.fillStyle = grad;
  octx.fillRect(0, 0, size, size);
  return off;
}

function rebuildBokehSprites() {
  primaryBokehSprite = buildBokehSprite(activeAccentPrimary, 0.55, 0.26, 96);
  secondaryBokehSprite = buildBokehSprite(activeAccentSecondary || SOFT_IVORY, 0.45, 0.18, 96);
  foregroundBokehSprite = buildBokehSprite(activeAccentPrimary, 0.22, 0.08, 192);
}

/** Initialize Eye-Comfort AudioMotion-Analyzer gradient spectrum at viewport bottom edge. */
export function initAudioMotion() {
  if (!audioMotionContainer || audioMotion) return;
  const audioCtx = getAudioContext();
  const analyser = getAnalyserNode();
  if (!audioCtx || !analyser) return;

  try {
    audioMotion = new AudioMotionAnalyzer(audioMotionContainer, {
      source: analyser,
      audioCtx,
      connectSpeakers: false,
      mode: 4,
      barSpace: 0.42,
      bgAlpha: 0,
      overlay: true,
      showBgColor: false,
      showScaleX: false,
      showScaleY: false,
      showPeaks: false,
      reflexRatio: 0,
      roundBars: true,
      lumiBars: false,
      alphaBars: true,
      smoothing: 0.78,
      minFreq: 35,
      maxFreq: 14000,
    });

    audioMotion.registerGradient('eyeComfortTheme', {
      bgColor: 'transparent',
      dir: 'v',
      colorStops: [
        { pos: 0, color: hexToRgba(activeAccentPrimary, 0.22) },
        { pos: 0.68, color: hexToRgba(activeAccentSecondary || activeAccentPrimary, 0.52) },
        { pos: 1, color: hexToRgba(SOFT_IVORY, 0.72) },
      ],
    });
    audioMotion.setOptions({ gradient: 'eyeComfortTheme' });
  } catch (err) {
    console.warn('AudioMotion init fallback:', err);
  }
}

const STAR_COUNT = 84;
const STAR_Z_MAX = 1200;
const starPool = Array.from({ length: STAR_COUNT }, (_, idx) => {
  const depth = idx % 3 === 0 ? 0.35 : idx % 3 === 1 ? 0.65 : 1.0;
  return {
    x: (Math.random() - 0.5) * 1600,
    y: (Math.random() - 0.5) * 1100,
    z: 30 + Math.random() * (STAR_Z_MAX - 30),
    r: 0.75 + depth * 1.1,
    baseAlpha: 0.12 + depth * 0.2,
    speedZ: 0.9 + depth * 1.25,
    depth,
    phase: Math.random() * Math.PI * 2,
    prevProjX: 0,
    prevProjY: 0,
  };
});

// 3D Volumetric Orbital Halo / Wireframe Rings (Zero heap allocation per frame)
const ORBITAL_RING_COUNT = 3;
const ORBITAL_SEGMENTS = 52;
const ringProjX = new Float32Array(ORBITAL_RING_COUNT * (ORBITAL_SEGMENTS + 1));
const ringProjY = new Float32Array(ORBITAL_RING_COUNT * (ORBITAL_SEGMENTS + 1));
const ringProjZ = new Float32Array(ORBITAL_RING_COUNT * (ORBITAL_SEGMENTS + 1));
const ringProjScale = new Float32Array(ORBITAL_RING_COUNT * (ORBITAL_SEGMENTS + 1));
let isWebGL3DActive = false;

/** Legacy helper export for backwards compatibility */
export function setWebGL3DActive(active) {
  isWebGL3DActive = false;
}

// 3-Layer True 2D Depth-of-Field (DoF) Bokeh Pools
// Layer 1: Background distant micro-particles (crisp, small, slow drift)
const BG_BOKEH_COUNT = 32;
const bgBokehPool = Array.from({ length: BG_BOKEH_COUNT }, () => ({
  x: Math.random() * (width || 1200),
  y: Math.random() * (height || 800),
  radius: 1.5 + Math.random() * 2.5,
  alpha: 0.12 + Math.random() * 0.18,
  speedX: (Math.random() - 0.5) * 0.12,
  speedY: -0.08 - Math.random() * 0.14,
  swayPhase: Math.random() * Math.PI * 2,
}));

// Layer 2: Midground synesthesia weather bokeh particles
const BOKEH_COUNT = 52;
const bokehPool = Array.from({ length: BOKEH_COUNT }, (_, idx) => ({
  x: Math.random() * (width || 1200),
  y: Math.random() * (height || 800),
  radius: 10 + Math.random() * 28,
  alpha: 0.14 + Math.random() * 0.22,
  speedX: (Math.random() - 0.5) * 0.28,
  speedY: -0.18 - Math.random() * 0.38,
  swayPhase: Math.random() * Math.PI * 2,
  swayAmp: 0.2 + Math.random() * 0.45,
  useSecondary: idx % 3 === 0,
}));

// Layer 3: Foreground large soft blurred DoF orbs with cursor parallax
const FG_BOKEH_COUNT = 14;
const fgBokehPool = Array.from({ length: FG_BOKEH_COUNT }, (_, idx) => ({
  x: Math.random() * (width || 1200),
  y: Math.random() * (height || 800),
  radius: 42 + Math.random() * 46,
  alpha: 0.04 + Math.random() * 0.07,
  speedX: (Math.random() - 0.5) * 0.16,
  speedY: -0.10 - Math.random() * 0.18,
  swayPhase: Math.random() * Math.PI * 2,
  swayAmp: 0.15 + Math.random() * 0.35,
  parallaxFactor: 0.75 + Math.random() * 0.55,
  useSecondary: idx % 2 === 0,
}));

function resetBokehItem(b, isRainStyle) {
  b.x = Math.random() * width;
  if (isRainStyle) {
    b.y = -b.radius * 2;
    b.speedY = 0.65 + Math.random() * 0.95;
    b.speedX = -0.15;
  } else {
    b.y = height + b.radius * 2;
    b.speedY = -(0.18 + Math.random() * 0.38);
    b.speedX = (Math.random() - 0.5) * 0.28;
  }
}

let dprScaleMultiplier = 1.0;
let lowFpsConsecutiveMs = 0;
let isDprAutoThrottled = false;

function applyDynamicDpr() {
  if (!canvas || !ctx) return;
  width = window.innerWidth;
  height = window.innerHeight;
  const baseDpr = Math.min(window.devicePixelRatio || 1, 2);
  dpr = Math.max(0.75, Number((baseDpr * dprScaleMultiplier).toFixed(2)));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function handleResize() {
  applyDynamicDpr();
}
window.addEventListener('resize', handleResize);
handleResize();
rebuildBokehSprites();

/** Return current canvas device pixel ratio */
export function getCanvasDpr() {
  return dpr;
}

/** Return whether canvas DPR was auto-throttled for performance */
export function isCanvasDprThrottled() {
  return isDprAutoThrottled;
}

/**
 * Manually trigger canvas DPR scaling factor (e.g. 0.75 for low-power or testing).
 * @param {number} [factor=0.75]
 */
export function triggerCanvasDprScale(factor = 0.75) {
  isDprAutoThrottled = factor < 1.0;
  dprScaleMultiplier = Math.max(0.5, Math.min(1.0, factor));
  applyDynamicDpr();
  return dpr;
}

/** @param {'intro'|'verse'|'climax'|'outro'} mode */
export function setVisualMode(mode) {
  visualMode = mode || 'intro';
  if (mistOverlay) {
    mistOverlay.style.opacity = visualMode === 'climax' ? '0.68' : visualMode === 'outro' ? '0.44' : '0.52';
  }
}

/**
 * Update visualizer theme colors and particle dynamics when switching tracks or acts.
 */
export function setTheme(
  theme,
  primaryColor = null,
  secondaryColor = null,
  particleStyle = null,
  visualEnergy = null,
  genre = null,
  coldColor = null
) {
  currentTheme = theme || 'crimson-ash';
  if (primaryColor) activeAccentPrimary = primaryColor;
  if (secondaryColor) activeAccentSecondary = secondaryColor;
  if (coldColor) activeAccentCold = coldColor;
  if (particleStyle) activeParticleStyle = particleStyle;
  if (visualEnergy) activeVisualEnergy = visualEnergy;
  if (genre !== null) activeGenre = genre;
  activeVisualContext = resolveVisualContext(activeGenre, activeVisualEnergy, activeParticleStyle, currentTheme);

  rebuildBokehSprites();

  if (audioMotion) {
    try {
      audioMotion.registerGradient('eyeComfortTheme', {
        bgColor: 'transparent',
        dir: 'v',
        colorStops: [
          { pos: 0, color: hexToRgba(activeAccentPrimary, 0.22) },
          { pos: 0.68, color: hexToRgba(activeAccentSecondary || activeAccentPrimary, 0.52) },
          { pos: 1, color: hexToRgba(SOFT_IVORY, 0.72) },
        ],
      });
      audioMotion.setOptions({ gradient: 'eyeComfortTheme' });
    } catch {}
  }

  if (ambientGlow) {
    ambientGlow.style.background = `radial-gradient(ellipse 68% 54% at 50% 50%, ${hexToRgba(activeAccentPrimary, 0.14)} 0%, ${hexToRgba(activeAccentSecondary || activeAccentPrimary, 0.06)} 45%, transparent 78%)`;
  }
}

function renderStardust(motionScale, dtNorm = 1.0) {
  if (motionScale <= 0 || !ctx) return;
  const isReduced = reducedMotionQuery.matches;
  const isClimaxAct = visualMode === 'climax';
  const isHighTempo = activeVisualContext === 'high-tempo' || activeVisualContext === 'prism';

  const cx = width * 0.5;
  const cy = height * 0.5;
  const fov = 420;

  // 3D Camera parallax rotation from cursor
  const rotPitch = isReduced ? 0 : mouseSmoothNormY * 0.28;
  const rotYaw = isReduced ? 0 : mouseSmoothNormX * 0.28;
  const cosPitch = Math.cos(rotPitch);
  const sinPitch = Math.sin(rotPitch);
  const cosYaw = Math.cos(rotYaw);
  const sinYaw = Math.sin(rotYaw);

  // Z-depth fly-through acceleration during Climax or High-Tempo
  const flyThroughFactor = (isClimaxAct ? 3.4 : isHighTempo ? 2.4 : 0.85) *
    (1 + smoothBass * 1.8) * livePaceFactor;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let i = 0; i < STAR_COUNT; i++) {
    const s = starPool[i];

    // Forward fly-through: star moves towards camera (-z) with guaranteed ambient drift
    const starSpeed = (s.speedZ * flyThroughFactor * (motionScale || 0.25) + 0.15) * dtNorm;
    s.z -= starSpeed;
    s.y += smoothScrollVelocity * 0.35 * s.depth * (motionScale || 0.25) * dtNorm;

    // Wrap-around to far plane when passing camera
    if (s.z <= 20) {
      s.z = STAR_Z_MAX - (20 - s.z);
      s.x = (Math.random() - 0.5) * 1600;
      s.y = (Math.random() - 0.5) * 1100;
      s.prevProjX = 0;
      s.prevProjY = 0;
    } else if (s.z > STAR_Z_MAX) {
      s.z = 20;
    }

    if (s.y > 700) s.y = -700;
    else if (s.y < -700) s.y = 700;
    if (s.x > 1000) s.x = -1000;
    else if (s.x < -1000) s.x = 1000;

    // 3D Rotation (Pitch then Yaw)
    const y1 = s.y * cosPitch - (s.z - 600) * sinPitch;
    const z1 = s.y * sinPitch + (s.z - 600) * cosPitch;
    const x2 = s.x * cosYaw + z1 * sinYaw;
    const z2 = -s.x * sinYaw + z1 * cosYaw + 600;

    const zEff = Math.max(15, z2);
    const scale = fov / (fov + zEff);
    const projX = cx + x2 * scale;
    const projY = cy + y1 * scale;

    const depthFog = Math.max(0, Math.min(1, 1 - (zEff / STAR_Z_MAX)));
    const breathe = 0.78 + 0.22 * Math.sin(time * 0.9 + s.phase);
    const starAlpha = Math.min(0.85, s.baseAlpha * depthFog * breathe * (0.8 + smoothVocal * 0.4));
    const projR = Math.max(0.5, s.r * scale * 1.5);

    if (projX >= -20 && projX <= width + 20 && projY >= -20 && projY <= height + 20) {
      if (!isReduced && flyThroughFactor > 2.0 && s.prevProjX !== 0 && s.prevProjY !== 0 && motionScale > 0.3) {
        const dx = projX - s.prevProjX;
        const dy = projY - s.prevProjY;
        const trailLen = Math.min(28, Math.sqrt(dx * dx + dy * dy) * 1.4);
        if (trailLen > 1.5) {
          const angle = Math.atan2(projY - cy, projX - cx);
          ctx.strokeStyle = `rgba(242, 239, 233, ${(starAlpha * 0.65).toFixed(3)})`;
          ctx.lineWidth = Math.max(0.6, projR * 0.9);
          ctx.beginPath();
          ctx.moveTo(projX, projY);
          ctx.lineTo(projX - Math.cos(angle) * trailLen, projY - Math.sin(angle) * trailLen);
          ctx.stroke();
        }
      }

      ctx.fillStyle = `rgba(242, 239, 233, ${starAlpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(projX, projY, projR, 0, Math.PI * 2);
      ctx.fill();
    }

    s.prevProjX = projX;
    s.prevProjY = projY;
  }
  ctx.restore();
}

function renderBreathingHalo(bassNorm, vocalNorm) {
  const energy = Math.min(1, bassNorm * 0.52 + vocalNorm * 0.35 + beatPulseLevel * 0.32);
  const cx = width * 0.5;
  const cy = height * 0.5;
  const minDim = Math.min(width, height);
  const radius = minDim * (0.34 + energy * 0.18);
  const coreAlpha = 0.08 + energy * 0.15;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.06, cx, cy, radius);
  grad.addColorStop(0, hexToRgba(activeAccentPrimary, coreAlpha));
  grad.addColorStop(0.55, hexToRgba(activeAccentSecondary || activeAccentPrimary, coreAlpha * 0.45));
  grad.addColorStop(1, 'rgba(11, 12, 16, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 3D Volumetric Orbital Halo / Wireframe Rings
 * Mathematically projected in Canvas 2D with zero heap allocation per frame.
 */
function render3DOrbitalRings(smoothBass, smoothVocal, motionScale, dtNorm = 1.0) {
  if (motionScale <= 0 || !ctx) return;
  const isReduced = reducedMotionQuery.matches;
  const cx = width * 0.5;
  const cy = height * 0.5;
  const fov = 420;

  const rotPitch = isReduced ? 0 : mouseSmoothNormY * 0.32;
  const rotYaw = isReduced ? 0 : mouseSmoothNormX * 0.32;

  // Theme & Synesthesia dynamic color interpolation
  let ringPrimary = activeAccentPrimary;
  let ringSecondary = activeAccentSecondary || activeAccentPrimary;

  if (smoothRainSurge > 0.05) {
    ringPrimary = lerpColorHex(ringPrimary, '#94A3B8', smoothRainSurge * 0.85);
    ringSecondary = lerpColorHex(ringSecondary, '#64748B', smoothRainSurge * 0.85);
  } else if (smoothFireSurge > 0.05) {
    ringPrimary = lerpColorHex(ringPrimary, '#E11D48', smoothFireSurge * 0.85);
    ringSecondary = lerpColorHex(ringSecondary, '#F43F5E', smoothFireSurge * 0.85);
  } else if (smoothNightSurge > 0.05) {
    ringPrimary = lerpColorHex(ringPrimary, '#38BDF8', smoothNightSurge * 0.85);
    ringSecondary = lerpColorHex(ringSecondary, '#818CF8', smoothNightSurge * 0.85);
  } else if (smoothWarmthSurge > 0.05) {
    ringPrimary = lerpColorHex(ringPrimary, '#E6B86A', smoothWarmthSurge * 0.85);
    ringSecondary = lerpColorHex(ringSecondary, '#F59E0B', smoothWarmthSurge * 0.85);
  }

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const minDim = Math.min(width, height);
  const harmonicPulse = smoothBass * 0.22 + smoothVocal * 0.14;

  for (let rIdx = 0; rIdx < ORBITAL_RING_COUNT; rIdx++) {
    const baseRadius = minDim * (0.22 + rIdx * 0.08) * (1 + harmonicPulse);
    const ringOffset = rIdx * (ORBITAL_SEGMENTS + 1);

    // Continuous slow 3D rotation angles per ring
    let pitch, yaw, roll;
    if (rIdx === 0) {
      pitch = 1.05 + Math.sin(time * 0.22) * 0.15 + rotPitch;
      yaw = time * 0.18 + rotYaw;
      roll = 0.25;
    } else if (rIdx === 1) {
      pitch = -0.85 + Math.cos(time * 0.26) * 0.18 + rotPitch;
      yaw = -time * 0.24 + 1.2 + rotYaw;
      roll = 0.75;
    } else {
      pitch = 1.35 + Math.sin(time * 0.15) * 0.12 + rotPitch;
      yaw = time * 0.14 - 1.5 + rotYaw;
      roll = -time * 0.1;
    }

    const cosRoll = Math.cos(roll);
    const sinRoll = Math.sin(roll);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);

    for (let seg = 0; seg <= ORBITAL_SEGMENTS; seg++) {
      const theta = (seg / ORBITAL_SEGMENTS) * Math.PI * 2;
      const ripple = 1 + Math.sin(theta * 4 + time * 2.4 + rIdx * 1.5) * (smoothBass * 0.07 + smoothVocal * 0.05);
      const rad = baseRadius * ripple;

      const x0 = rad * Math.cos(theta);
      const y0 = rad * Math.sin(theta);
      const z0 = Math.sin(theta * 3 + time * 1.8) * (14 * smoothBass);

      // Roll (Z)
      const x1 = x0 * cosRoll - y0 * sinRoll;
      const y1 = x0 * sinRoll + y0 * cosRoll;
      const z1 = z0;

      // Pitch (X)
      const x2 = x1;
      const y2 = y1 * cosPitch - z1 * sinPitch;
      const z2 = y1 * sinPitch + z1 * cosPitch;

      // Yaw (Y)
      const x3 = x2 * cosYaw + z2 * sinYaw;
      const y3 = y2;
      const z3 = -x2 * sinYaw + z2 * cosYaw;

      // Projection with frustum offset
      const zProj = z3 + 450;
      const scale = fov / (fov + Math.max(20, zProj));
      const px = cx + x3 * scale;
      const py = cy + y3 * scale;

      const idx = ringOffset + seg;
      ringProjX[idx] = px;
      ringProjY[idx] = py;
      ringProjZ[idx] = zProj;
      ringProjScale[idx] = scale;
    }

    // Render wireframe ring path at full pristine 2D cinematic clarity
    const baseAlpha = isReduced
      ? 0.1
      : Math.min(0.55, (0.16 + smoothBass * 0.26 + smoothVocal * 0.14) * (rIdx === 0 ? 1 : 0.82));
    const ringAlpha = baseAlpha;
    const activeRingColor = rIdx % 2 === 0 ? ringPrimary : ringSecondary;

    ctx.beginPath();
    ctx.moveTo(ringProjX[ringOffset], ringProjY[ringOffset]);
    for (let seg = 1; seg <= ORBITAL_SEGMENTS; seg++) {
      ctx.lineTo(ringProjX[ringOffset + seg], ringProjY[ringOffset + seg]);
    }
    ctx.closePath();

    ctx.strokeStyle = hexToRgba(activeRingColor, ringAlpha);
    ctx.lineWidth = Math.max(0.8, (1.1 + smoothBass * 1.2) * (rIdx === 0 ? 1.2 : 0.95));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Subtle inner glowing border
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = hexToRgba(SOFT_IVORY, ringAlpha * 0.45);
    ctx.stroke();

    // Holographic stardust node vertices every 4th segment
    if (!isReduced) {
      for (let seg = 0; seg < ORBITAL_SEGMENTS; seg += 4) {
        const idx = ringOffset + seg;
        const px = ringProjX[idx];
        const py = ringProjY[idx];
        const sc = ringProjScale[idx];
        const pipRadius = Math.max(0.6, 1.3 * sc * (1 + smoothBass * 0.8));
        ctx.fillStyle = hexToRgba(SOFT_IVORY, Math.min(0.7, ringAlpha * 1.5));
        ctx.beginPath();
        ctx.arc(px, py, pipRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

const SONIC_RING_COUNT = 6;
const sonicRingPool = Array.from({ length: SONIC_RING_COUNT }, () => ({
  active: false,
  radius: 60,
  maxRadius: 320,
  alpha: 0,
  lineWidth: 1.5,
  useSecondary: false,
}));
let sonicRingHead = 0;
let prevGroovyEnergy = 0;
let lastSonicRingMs = 0;

function spawnSonicRing(energy) {
  const ring = sonicRingPool[sonicRingHead];
  sonicRingHead = (sonicRingHead + 1) % SONIC_RING_COUNT;
  ring.active = true;
  ring.radius = Math.min(width, height) * 0.14;
  ring.maxRadius = Math.min(width, height) * (0.38 + energy * 0.14);
  ring.alpha = Math.min(0.24, 0.12 + energy * 0.12);
  ring.lineWidth = 1.2 + energy * 1.4;
  ring.useSecondary = sonicRingHead % 2 === 0;
}

/**
 * 3-Layer Multi-Octave Fluid Silk Aurora:
 * - Layer 0: Far Haze (broad, soft atmospheric backdrop)
 * - Layer 1: Mid Silk Wave (fluid undulation, mid-bass & tempo reactive)
 * - Layer 2: Near Harmonic Ribbon (crisp foreground ribbon with vocal & synesthesia harmonics)
 */
function renderSilkAurora(bassNorm, midNorm, trebleNorm, vocalNorm, motionScale, dtNorm = 1.0) {
  const baseY = height * 0.54;
  const isClimaxAct = visualMode === 'climax' || visualMode === 'verse';
  const isPeakClimax = visualMode === 'climax';

  const isCalm = activeVisualEnergy === 'calm';
  const isGroovy = activeVisualEnergy === 'groovy';
  const isIntense = activeVisualEnergy === 'intense';

  const surgeFactor = auroraBoostRemaining > 0 ? 1 + (auroraBoostRemaining / 0.8) * 0.65 : 1;
  const flowEnergyBoost = (1 + (bassNorm * 0.28 + vocalNorm * 0.24)) * livePaceFactor;
  const ribbonAmp =
    (isCalm
      ? 14 + vocalNorm * 22
      : isGroovy
        ? 24 + (midNorm * 0.62 + bassNorm * 0.38) * 52
        : (isClimaxAct ? 36 : 24) + (bassNorm * 0.52 + trebleNorm * 0.48) * (isClimaxAct ? 68 : 42)) *
    (0.94 + surgeFactor * 0.06);

  // Subtle breathing vignette in Climax Act without blinding brightness
  if (opticalScrimEl) {
    const breath = isPeakClimax ? 0.84 + bassNorm * 0.1 : 0.92;
    opticalScrimEl.style.opacity = breath.toFixed(3);
  }

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const colorShiftPhase = 0.5 + 0.5 * Math.sin(time * 0.35 + bassNorm * 1.4);

  // 3 Distinct Depth Layers: Far Haze (0), Mid Silk Wave (1), Near Harmonic Ribbon (2)
  const layerCount = 3;
  for (let layer = 0; layer < layerCount; layer++) {
    const isFarHaze = layer === 0;
    const isMidWave = layer === 1;
    const isNearRibbon = layer === 2;

    const layerSpeed = isFarHaze ? 0.35 : isMidWave ? 0.68 : 0.95;
    const speedRate = (isCalm ? 0.22 : isGroovy ? 0.58 : isClimaxAct ? 0.82 : 0.46) * layerSpeed * surgeFactor * flowEnergyBoost * (1 - smoothNightSurge * 0.45);
    const ambientFlow = Math.max(0.14, speedRate * (motionScale || 0.25));
    const phase = time * ambientFlow + layer * 1.8;
    const mixRatio = isNearRibbon ? colorShiftPhase : 1 - colorShiftPhase * 0.7;

    const baseAlpha = isFarHaze ? 0.14 : isMidWave ? 0.22 : 0.28;
    const alpha = Math.max(0.08, baseAlpha * (isCalm ? 0.85 : 1.0));
    const yOffset = (layer - 1) * (isPeakClimax ? 30 : 22);

    const thickness = isFarHaze
      ? (isCalm ? 72 : 108) + bassNorm * 34
      : isMidWave
        ? (isCalm ? 42 : 62) + (bassNorm + midNorm) * 24
        : (isCalm ? 3 : 4.5) + vocalNorm * 3.5;

    ctx.beginPath();
    const steps = 36;
    for (let s = 0; s <= steps; s++) {
      const ratio = s / steps;
      const x = ratio * width;
      const envelope = Math.sin(ratio * Math.PI);

      let wave;
      if (isFarHaze) {
        wave = Math.sin(ratio * 2.8 + phase) * 0.75 + Math.cos(ratio * 4.6 - phase * 0.4) * 0.25;
      } else if (isMidWave) {
        wave =
          Math.sin(ratio * 5.2 + phase) * 0.5 +
          Math.sin(ratio * 10.8 - phase * 1.1) * (0.3 + midNorm * 0.22) +
          Math.cos(ratio * 15.4 + phase * 1.3) * (0.15 * bassNorm);
      } else {
        // Near Harmonic Ribbon: high-harmonic oscillation driven by vocals & climax
        const drive = isPeakClimax ? 1.25 : isIntense ? 1.1 : 0.85;
        const harmonicDistortion = isIntense
          ? Math.sin(ratio * 24.0 - phase * 2.0) * (0.12 * (midNorm + trebleNorm + vocalNorm))
          : 0;
        wave =
          Math.sin(ratio * 4.6 + phase) * 0.48 +
          Math.sin(ratio * 12.8 - phase * 1.3) * (0.32 * drive + bassNorm * 0.2) +
          Math.cos(ratio * 20.0 + phase * 1.7) * (0.18 * trebleNorm * drive) +
          harmonicDistortion;
      }

      const y = baseY + yOffset + wave * ribbonAmp * envelope;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = thickness;
    const primaryTint = smoothRainSurge > 0.01
      ? lerpColorHex(activeAccentPrimary, '#94A3B8', smoothRainSurge * 0.45)
      : smoothFireSurge > 0.01
        ? lerpColorHex(activeAccentPrimary, '#E11D48', smoothFireSurge * 0.45)
        : activeAccentPrimary;
    const secondaryTint = smoothWarmthSurge > 0.01
      ? lerpColorHex(activeAccentSecondary || activeAccentPrimary, '#E6B86A', smoothWarmthSurge * 0.55)
      : (activeAccentSecondary || activeAccentPrimary);

    ctx.strokeStyle = lerpColorRgba(
      primaryTint,
      secondaryTint,
      mixRatio,
      alpha
    );
    ctx.stroke();

    if (isNearRibbon) {
      ctx.lineWidth = isCalm && !isPeakClimax ? 1.5 : 2.2;
      ctx.strokeStyle = `rgba(242, 239, 233, ${(alpha * (isCalm ? 0.35 : 0.55)).toFixed(3)})`;
      ctx.stroke();
    }
  }

  // Beat-synced Kinetic Shockwave Rings (universal across all curated, imported & user tracks)
  {
    const cx = width * 0.5;
    const cy = height * 0.52;
    const grooveHit = bassNorm * 0.62 + midNorm * 0.38;
    for (let i = 0; i < SONIC_RING_COUNT; i++) {
      const ring = sonicRingPool[i];
      if (!ring.active) continue;
      ring.radius += (1.9 + grooveHit * 2.4) * livePaceFactor * motionScale * dtNorm;
      const progress = Math.min(1, ring.radius / Math.max(1, ring.maxRadius));
      const fadeAlpha = ring.alpha * (1 - progress);
      if (progress >= 1 || fadeAlpha <= 0.005) {
        ring.active = false;
        continue;
      }
      ctx.strokeStyle = hexToRgba(ring.useSecondary ? (activeAccentSecondary || activeAccentPrimary) : activeAccentPrimary, fadeAlpha);
      ctx.lineWidth = ring.lineWidth * (1 - progress * 0.45);
      ctx.beginPath();
      ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function getVisualPhysicsMode() {
  return activeVisualEnergy;
}

function renderDepthBokeh(bassNorm, vocalNorm, motionScale, dtNorm = 1.0) {
  if (!primaryBokehSprite || !secondaryBokehSprite || !foregroundBokehSprite) return;

  const isCalm = activeVisualEnergy === 'calm';
  const isGroovy = activeVisualEnergy === 'groovy';
  const isRainStyle =
    activeParticleStyle === 'rain' ||
    activeParticleStyle === 'heavy-rain' ||
    activeParticleStyle === 'falling-ash';

  const basePace = isCalm ? 0.48 : isGroovy ? 0.92 : 1.05;
  const speedMult = Math.max(0.18, (basePace + bassNorm * (isCalm ? 0.25 : 0.68) + vocalNorm * 0.38) * (motionScale || 0.25) * dtNorm);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // --- Layer 1: Background Distant Micro-Particles ---
  ctx.fillStyle = hexToRgba(activeAccentSecondary || SOFT_IVORY, 0.22);
  for (let i = 0; i < BG_BOKEH_COUNT; i++) {
    const b = bgBokehPool[i];
    b.x += (b.speedX + Math.sin(time * 0.4 + b.swayPhase) * 0.08) * speedMult * 0.45;
    b.y += b.speedY * speedMult * 0.45;
    if (b.y < -10) b.y = height + 10;
    if (b.y > height + 10) b.y = -10;
    if (b.x < -10) b.x = width + 10;
    if (b.x > width + 10) b.x = -10;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Layer 2: Midground Synesthesia Weather Bokeh ---
  for (let i = 0; i < BOKEH_COUNT; i++) {
    const b = bokehPool[i];
    let dirShiftY = 0;
    let dirShiftX = 0;
    if (smoothRainSurge > 0.02) {
      dirShiftY += smoothRainSurge * 2.8 * (motionScale || 0.25) * dtNorm;
    }
    if (smoothNightSurge > 0.02) {
      dirShiftY -= (0.75 + smoothNightSurge * 2.2) * (motionScale || 0.25) * dtNorm;
      dirShiftX += Math.sin(time * 0.7 + b.swayPhase) * (0.45 + smoothNightSurge * 0.8) * (motionScale || 0.25) * dtNorm;
    }
    if (smoothFireSurge > 0.02) {
      dirShiftY -= (0.45 + smoothFireSurge * 1.8) * (motionScale || 0.25) * dtNorm;
      dirShiftX += Math.sin(time * 2.4 + b.swayPhase) * (0.5 + smoothFireSurge * 1.5) * (motionScale || 0.25) * dtNorm;
    }

    b.x += (b.speedX + Math.sin(time * 0.7 + b.swayPhase) * b.swayAmp * 0.25) * speedMult + dirShiftX;
    b.y += (isRainStyle ? Math.abs(b.speedY) : -Math.abs(b.speedY)) * speedMult + dirShiftY;

    if (cursorActive && motionScale > 0.15) {
      const dx = b.x - cursorPxX;
      const dy = b.y - cursorPxY;
      const distSq = dx * dx + dy * dy;
      const maxDist = 140;
      if (distSq > 1 && distSq < maxDist * maxDist) {
        const dist = Math.sqrt(distSq);
        const falloff = 1 - dist / maxDist;
        const nx = dx / dist;
        const ny = dy / dist;
        const force = falloff * 1.45 * (motionScale || 0.25) * dtNorm;
        b.x += (nx - ny * 0.45) * force;
        b.y += (ny + nx * 0.45) * force;
      }
    }

    if (b.y > height + b.radius * 2) resetBokehItem(b, true);
    else if (b.y < -b.radius * 2) resetBokehItem(b, false);
    if (b.x < -b.radius * 2) b.x = width + b.radius;
    if (b.x > width + b.radius * 2) b.x = -b.radius;

    const warmthScale = 1 + smoothWarmthSurge * 0.42;
    const r = b.radius * (0.94 + vocalNorm * 0.14) * warmthScale;
    const sprite = b.useSecondary ? secondaryBokehSprite : primaryBokehSprite;
    ctx.globalAlpha = Math.min(0.52, b.alpha * (0.82 + vocalNorm * 0.35 + smoothWarmthSurge * 0.45));
    ctx.drawImage(sprite, b.x - r, b.y - r, r * 2, r * 2);
  }

  // --- Layer 3: Foreground Large Soft Blurred DoF Orbs with Cursor Parallax ---
  const pOffsetX = (mouseSmoothNormX || 0) * 36;
  const pOffsetY = (mouseSmoothNormY || 0) * 24;

  for (let i = 0; i < FG_BOKEH_COUNT; i++) {
    const b = fgBokehPool[i];
    b.x += (b.speedX + Math.sin(time * 0.5 + b.swayPhase) * b.swayAmp * 0.2) * speedMult * 0.65;
    b.y += b.speedY * speedMult * 0.65;
    if (b.y < -b.radius * 2) b.y = height + b.radius * 2;
    if (b.y > height + b.radius * 2) b.y = -b.radius * 2;
    if (b.x < -b.radius * 2) b.x = width + b.radius * 2;
    if (b.x > width + b.radius * 2) b.x = -b.radius * 2;

    const drawX = b.x + pOffsetX * b.parallaxFactor;
    const drawY = b.y + pOffsetY * b.parallaxFactor;
    const r = b.radius * (0.95 + vocalNorm * 0.2);
    const sprite = b.useSecondary ? secondaryBokehSprite : foregroundBokehSprite;

    ctx.globalAlpha = Math.min(0.16, b.alpha * (0.85 + vocalNorm * 0.4));
    ctx.drawImage(sprite, drawX - r, drawY - r, r * 2, r * 2);
  }

  ctx.restore();
}

/**
 * Volumetric God-Rays: Soft angled light shafts sweeping subtly and expanding with vocal energy.
 */
function renderVolumetricGodRays(smoothVocal, motionScale, dtNorm = 1.0) {
  if (motionScale <= 0 || !ctx) return;

  const isCalm = visualMode === 'verse' || activeVisualEnergy === 'calm';
  const isClimax = visualMode === 'climax';
  const isOutro = visualMode === 'outro';

  const maxAllowed = extraReactiveEffects ? 0.16 : 0.08;
  const actIntensity = extraReactiveEffects
    ? (isClimax ? 0.12 : isOutro ? 0.08 : 0.06)
    : (isClimax ? 0.055 : isOutro ? 0.04 : 0.035);
  const vocalBoost = (smoothVocal || 0) * (extraReactiveEffects ? 0.08 : 0.03);
  const totalAlpha = Math.min(maxAllowed, actIntensity + vocalBoost);
  if (totalAlpha < 0.005) return;

  const rayColor = smoothWarmthSurge > 0.1
    ? '#E6B86A'
    : smoothFireSurge > 0.1
      ? '#E11D48'
      : smoothRainSurge > 0.1
        ? '#94A3B8'
        : (activeAccentPrimary || '#D65A70');

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const originX = width * 0.18;
  const originY = -50;
  const sweepBase = 0.52 + Math.sin(time * 0.25) * 0.12;

  for (let i = 0; i < 3; i++) {
    const rayAngle = sweepBase + (i - 1) * 0.22 + Math.sin(time * 0.35 + i * 1.6) * 0.04;
    const rayLength = Math.max(width, height) * 1.45;
    const rayWidthStart = 24 + i * 14;
    const rayWidthEnd = 170 + i * 95 + vocalBoost * 150;

    const endX = originX + Math.cos(rayAngle) * rayLength;
    const endY = originY + Math.sin(rayAngle) * rayLength;

    const normalX = -Math.sin(rayAngle);
    const normalY = Math.cos(rayAngle);

    const p1x = originX - normalX * (rayWidthStart * 0.5);
    const p1y = originY - normalY * (rayWidthStart * 0.5);
    const p2x = originX + normalX * (rayWidthStart * 0.5);
    const p2y = originY + normalY * (rayWidthStart * 0.5);

    const p3x = endX + normalX * (rayWidthEnd * 0.5);
    const p3y = endY + normalY * (rayWidthEnd * 0.5);
    const p4x = endX - normalX * (rayWidthEnd * 0.5);
    const p4y = endY - normalY * (rayWidthEnd * 0.5);

    const grad = ctx.createLinearGradient(originX, originY, endX, endY);
    const rayAlpha = totalAlpha * (1 - i * 0.24);
    grad.addColorStop(0, hexToRgba(rayColor, rayAlpha * 1.25));
    grad.addColorStop(0.35, hexToRgba(rayColor, rayAlpha * 0.75));
    grad.addColorStop(0.75, hexToRgba(rayColor, rayAlpha * 0.25));
    grad.addColorStop(1, hexToRgba(rayColor, 0));

    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.lineTo(p3x, p3y);
    ctx.lineTo(p4x, p4y);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Anamorphic Cinema Flare: Horizontal luminous beam featured during Act III Climax on heavy transients.
 */
function renderAnamorphicCinemaFlare(smoothBass, motionScale) {
  if (motionScale <= 0.1 || !ctx) return;
  if (visualMode !== 'climax') return;

  const hitEnergy = smoothBass * 0.65 + liveBeatFlux * 0.35;
  if (hitEnergy < 0.36) return;

  const flareAlpha = Math.min(0.68, (hitEnergy - 0.34) * 1.55);
  const cx = width * 0.5;
  const cy = height * 0.52;
  const flareWidth = width * (0.42 + hitEnergy * 0.45);
  const flareHeight = 5 + hitEnergy * 7;

  const flareColor = activeAccentSecondary || activeAccentPrimary || '#D65A70';

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // Horizontal anamorphic beam
  const beamGrad = ctx.createLinearGradient(cx - flareWidth, cy, cx + flareWidth, cy);
  beamGrad.addColorStop(0, 'rgba(0,0,0,0)');
  beamGrad.addColorStop(0.3, hexToRgba(flareColor, flareAlpha * 0.18));
  beamGrad.addColorStop(0.46, hexToRgba('#FFFFFF', flareAlpha * 0.5));
  beamGrad.addColorStop(0.5, hexToRgba('#FFFFFF', flareAlpha * 0.95));
  beamGrad.addColorStop(0.54, hexToRgba('#FFFFFF', flareAlpha * 0.5));
  beamGrad.addColorStop(0.7, hexToRgba(flareColor, flareAlpha * 0.18));
  beamGrad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, flareWidth, flareHeight, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle central core flare
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 32 + hitEnergy * 28);
  coreGrad.addColorStop(0, hexToRgba('#FFFFFF', flareAlpha * 0.65));
  coreGrad.addColorStop(0.38, hexToRgba(flareColor, flareAlpha * 0.3));
  coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 32 + hitEnergy * 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Dynamic Visual Novel Mood Framing: Breathing reactive vignette at canvas edges.
 */
function renderCinematicVignette(smoothBass, motionScale) {
  if (motionScale <= 0 || !ctx) return;

  const isClimax = visualMode === 'climax';
  const isOutro = visualMode === 'outro';
  const isCalm = visualMode === 'verse';

  const baseVignette = isClimax ? 0.32 : isOutro ? 0.18 : isCalm ? 0.16 : 0.22;
  const pulse = baseVignette + Math.sin(time * 0.75) * 0.02 + smoothBass * (isClimax ? 0.14 : 0.07);

  const cx = width * 0.5;
  const cy = height * 0.5;
  const maxDim = Math.max(width, height);
  const innerR = maxDim * (isClimax ? 0.38 : 0.44);
  const outerR = maxDim * 0.78;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(0.7, `rgba(11, 12, 16, ${(pulse * 0.45).toFixed(3)})`);
  grad.addColorStop(1, `rgba(11, 12, 16, ${(pulse * 0.88).toFixed(3)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function renderAmbientBackdropGlow(bassNorm, motionScale) {
  if (motionScale <= 0 || !ctx) return;
  let glowColor = activeAccentPrimary || '#D65A70';
  if (smoothRainSurge > 0.1) glowColor = '#94A3B8';
  else if (smoothFireSurge > 0.1) glowColor = '#E11D48';
  else if (smoothNightSurge > 0.1) glowColor = '#38BDF8';
  else if (smoothWarmthSurge > 0.1) glowColor = '#E6B86A';

  const breath = 0.035 + bassNorm * 0.075;
  const cx = width * 0.5;
  const cy = height * 0.5;
  const maxR = Math.max(width, height) * 0.75;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const grad = ctx.createRadialGradient(cx, cy, maxR * 0.32, cx, cy, maxR);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(0.68, hexToRgba(glowColor, breath * 0.4));
  grad.addColorStop(1, hexToRgba(glowColor, breath));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function updateFrequencyDisplay(levels) {
  const bassInt = Math.round(levels.bass);
  const midInt = Math.round(levels.mid);
  const trebleInt = Math.round(levels.treble);

  if (bassEl && lastMeterTextBass !== bassInt) {
    lastMeterTextBass = bassInt;
    bassEl.textContent = String(bassInt);
  }
  if (midEl && lastMeterTextMid !== midInt) {
    lastMeterTextMid = midInt;
    midEl.textContent = String(midInt);
  }
  if (trebleEl && lastMeterTextTreble !== trebleInt) {
    lastMeterTextTreble = trebleInt;
    trebleEl.textContent = String(trebleInt);
  }

  if (bassBarEl) bassBarEl.style.width = `${Math.min(100, (bassInt / 255) * 100)}%`;
  if (midBarEl) midBarEl.style.width = `${Math.min(100, (midInt / 255) * 100)}%`;
  if (trebleBarEl) trebleBarEl.style.width = `${Math.min(100, (trebleInt / 255) * 100)}%`;
}

function renderHighlightRipples(dt) {
  let hasActive = false;
  for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
    if (ripplePool[i].active) {
      hasActive = true;
      break;
    }
  }
  if (!hasActive) return;

  const cx = width * 0.5;
  const cy = height * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
    const r = ripplePool[i];
    if (!r.active) continue;
    r.age += dt;
    if (r.age >= r.duration) {
      r.active = false;
      continue;
    }
    const p = r.age / r.duration;
    const eased = 1 - Math.pow(1 - p, 3);
    const radius = 36 + eased * r.maxRadius;
    const alpha = Math.sin((1 - p) * Math.PI * 0.5) * 0.19;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = 2.2 * (1 - p * 0.6);
    ctx.strokeStyle = hexToRgba(activeAccentPrimary, alpha);
    ctx.stroke();
  }

  ctx.restore();
}

function updateParallaxAndCameraLayers(isReduced) {
  smoothCameraZoom += (targetCameraZoom - smoothCameraZoom) * 0.045;
  smoothScrollVelocity += (scrollVelocityInput - smoothScrollVelocity) * 0.14;
  scrollVelocityInput *= 0.85;

  if (isReduced) {
    if (mouseSmoothNormX !== 0 || mouseSmoothNormY !== 0) {
      mouseSmoothNormX = 0;
      mouseSmoothNormY = 0;
      if (bgVideoEl) bgVideoEl.style.transform = '';
      if (canvas) canvas.style.transform = '';
      if (kineticStageEl) kineticStageEl.style.transform = '';
    }
    return;
  }

  mouseSmoothNormX += (mouseTargetNormX - mouseSmoothNormX) * 0.06;
  mouseSmoothNormY += (mouseTargetNormY - mouseSmoothNormY) * 0.06;

  // Base 1.03 headroom prevents edges exposing during +/-12px parallax tilt
  const videoScale = (1.03 * smoothCameraZoom).toFixed(4);
  if (bgVideoEl) {
    bgVideoEl.style.transform = `translate3d(${(mouseSmoothNormX * 12).toFixed(2)}px, ${(mouseSmoothNormY * 12).toFixed(2)}px, 0) scale(${videoScale})`;
  }
  if (canvas) {
    canvas.style.transform = `translate3d(${(mouseSmoothNormX * 24).toFixed(2)}px, ${(mouseSmoothNormY * 24).toFixed(2)}px, 0) scale(1.03)`;
  }
  if (kineticStageEl) {
    kineticStageEl.style.transform = `translate3d(${(-mouseSmoothNormX * 8).toFixed(2)}px, ${(-mouseSmoothNormY * 8).toFixed(2)}px, 0)`;
  }
}

let detectedRefreshRate = 60;
let isHighRefreshTier = false;

function updateDirectorTelemetry(nowMs, vocalNorm) {
  fpsAccFrames += 1;
  fpsAccMs += Math.min(200, Math.max(0, nowMs - lastFrameMs));
  if (fpsAccMs >= 400) {
    currentFps = Math.max(1, Math.min(240, Math.round((fpsAccFrames * 1000) / fpsAccMs)));
    fpsAccFrames = 0;
    fpsAccMs = 0;

    // Detect hardware refresh rate tier
    if (currentFps > 130) detectedRefreshRate = 144;
    else if (currentFps > 105) detectedRefreshRate = 120;
    else if (currentFps > 75) detectedRefreshRate = 90;
    else detectedRefreshRate = 60;

    isHighRefreshTier = detectedRefreshRate >= 100;

    if (directorFpsEl && directorHudEl && !directorHudEl.hidden) {
      directorFpsEl.textContent = `${currentFps} (${detectedRefreshRate}Hz)`;
    }

    // Dynamic Canvas DPR Auto-Scaling:
    // High-Refresh Tier (>= 100Hz): trigger if FPS < 75 for 3 consecutive seconds
    // Standard Tier (60Hz): trigger if FPS < 48 for 3 consecutive seconds
    const lowFpsThreshold = isHighRefreshTier ? 75 : 48;
    const recoveryThreshold = isHighRefreshTier ? 85 : 55;

    if (currentFps < lowFpsThreshold && isRunning) {
      lowFpsConsecutiveMs += 400;
      if (lowFpsConsecutiveMs >= 3000 && !isDprAutoThrottled) {
        isDprAutoThrottled = true;
        dprScaleMultiplier = 0.75;
        applyDynamicDpr();
        console.warn(`[CanvasVisualizer] Low FPS (${currentFps} in ${detectedRefreshRate}Hz tier) detected for 3s. Auto-scaled internal DPR to ${dpr} for stability.`);
      }
    } else if (currentFps >= recoveryThreshold) {
      lowFpsConsecutiveMs = Math.max(0, lowFpsConsecutiveMs - 400);
    }
  }

  if (!directorHudEl || directorHudEl.hidden || !directorWaveCtx || !directorWaveCanvas) return;

  if (nowMs - lastWaveSampleMs >= 50) {
    lastWaveSampleMs = nowMs;
    vocalWaveHistory[vocalWaveHead] = vocalNorm;
    vocalWaveHead = (vocalWaveHead + 1) % VOCAL_WAVE_SAMPLES;
  }

  const w = directorWaveCanvas.width;
  const h = directorWaveCanvas.height;
  directorWaveCtx.clearRect(0, 0, w, h);

  const barStep = w / VOCAL_WAVE_SAMPLES;
  const barW = Math.max(2, barStep - 1.5);
  directorWaveCtx.fillStyle = hexToRgba(activeAccentPrimary, 0.85);

  for (let i = 0; i < VOCAL_WAVE_SAMPLES; i++) {
    const sample = vocalWaveHistory[(vocalWaveHead + i) % VOCAL_WAVE_SAMPLES];
    const barH = Math.max(2, sample * (h - 6));
    const x = i * barStep + 0.5;
    const y = (h - barH) * 0.5;
    directorWaveCtx.fillRect(x, y, barW, barH);
  }
}

function render(timestamp) {
  if (!isRunning || !ctx) return;

  const nowMs = typeof timestamp === 'number' && timestamp > 0 ? timestamp : performance.now();
  if (lastFrameMs === 0) {
    lastFrameMs = nowMs;
  }
  const rawDtSec = (nowMs - lastFrameMs) / 1000;
  const dtSec = Number.isFinite(rawDtSec) ? Math.min(0.05, Math.max(0.001, rawDtSec)) : 0.016;
  const dtNorm = Number.isFinite(dtSec) ? Math.min(3.0, Math.max(0.1, dtSec * 60)) : 1.0;
  if (auroraBoostRemaining > 0) {
    auroraBoostRemaining = Math.max(0, auroraBoostRemaining - dtSec);
  }

  const isReduced = reducedMotionQuery.matches;
  const motionScale = isReduced ? 0.35 : 1.0;
  time += (isReduced ? 0.008 : 0.016) * dtNorm;

  ctx.clearRect(0, 0, width, height);

  const levels = getFrequencyLevels();
  const vocal = getVocalEnergy();

  if (!audioMotion) {
    initAudioMotion();
  }

  // Smooth continuous lerp for Lyric Synesthesia micro-triggers (zero flickering)
  if (sentimentMotifTimer > 0) {
    sentimentMotifTimer = Math.max(0, sentimentMotifTimer - dtSec);
    if (sentimentMotifTimer === 0) activeSentimentMotif = null;
  }
  const targetRain = activeSentimentMotif === 'rain' ? 1.0 : 0.0;
  const targetFire = activeSentimentMotif === 'fire' ? 1.0 : 0.0;
  const targetNight = activeSentimentMotif === 'night' ? 1.0 : 0.0;
  const targetWarmth = activeSentimentMotif === 'warmth' ? 1.0 : 0.0;

  const lerpSpeed = Math.min(1.0, dtSec * 3.8);
  smoothRainSurge += (targetRain - smoothRainSurge) * lerpSpeed;
  smoothFireSurge += (targetFire - smoothFireSurge) * lerpSpeed;
  smoothNightSurge += (targetNight - smoothNightSurge) * lerpSpeed;
  smoothWarmthSurge += (targetWarmth - smoothWarmthSurge) * lerpSpeed;

  smoothBass += (levels.bass / 255 - smoothBass) * 0.14;
  smoothMid += (levels.mid / 255 - smoothMid) * 0.14;
  smoothTreble += (levels.treble / 255 - smoothTreble) * 0.14;
  smoothVocal += ((vocal ? vocal.normalized : 0) - smoothVocal) * 0.18;

  computeLiveAudioDynamics(smoothBass, smoothMid, smoothTreble, smoothVocal, nowMs, dtSec);

  // Dynamic Scene Archetype resolution
  const resolvedScene = resolve2DSceneArchetype(activeTrackMeta, { paceFactor: livePaceFactor });
  if (resolvedScene !== activeSceneArchetype) {
    activeSceneArchetype = resolvedScene;
  }

  // Common dark-cinema atmospheric backdrop glow
  renderAmbientBackdropGlow(smoothBass, motionScale);

  // Dispatch to 1 of 18 distinct 2D Cinematic Scene Archetypes
  renderSceneArchetype(activeSceneArchetype, ctx, width, height, {
    time,
    smoothBass,
    smoothMid,
    smoothTreble,
    smoothVocal,
    motionScale,
    dtNorm,
    dtSec,
    activeAccentPrimary,
    activeAccentSecondary,
    activeAccentCold,
    isClimax: visualMode === 'climax',
    livePaceFactor,
    getAnalyserNode,
    renderVolumetricGodRays,
    renderStardust,
    render3DOrbitalRings,
    renderBreathingHalo,
    renderSilkAurora,
    renderAnamorphicCinemaFlare,
    renderDepthBokeh,
    extraReactiveEffects,
  });

  renderHighlightRipples(dtSec);
  renderCinematicVignette(smoothBass, motionScale);

  // 35mm Film Grain post-processing layer (128x128 offscreen tile updated at 12 FPS, 0.035 opacity)
  if (!grainCanvas) initGrain();
  if (nowMs - lastGrainUpdateMs >= 83) {
    lastGrainUpdateMs = nowMs;
    updateGrainPattern();
  }
  if (grainPattern && motionScale > 0.05) {
    ctx.save();
    ctx.globalAlpha = 0.035;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = grainPattern;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  updateParallaxAndCameraLayers(isReduced);
  updateFrequencyDisplay(levels);
  updateDirectorTelemetry(nowMs, smoothVocal);

  lastFrameMs = nowMs;
  animId = requestAnimationFrame(render);
}

/** Start visualizer render loop (idempotent, zero leak). */
export function startVisualizer() {
  initAudioMotion();
  if (isRunning) return;
  isRunning = true;
  lastFrameMs = performance.now();
  if (!animId) {
    animId = requestAnimationFrame(render);
  }
}

/** Standard alias for initializing visualizer */
export const initVisualizer = startVisualizer;

// Auto-start continuous 2D visualizer loop when DOM canvas is ready
if (typeof window !== 'undefined' && canvas && ctx) {
  startVisualizer();
}

/** Return 3D visual projection engine state for telemetry & verification */
export function get3DVisualState() {
  return {
    enabled: true,
    activeRings: ORBITAL_RING_COUNT,
    starCount: STAR_COUNT,
    fov: 420,
    starMaxZ: STAR_Z_MAX,
    isHighRefreshTier,
    detectedRefreshRate,
    currentFps,
  };
}

/** Return FPS & refresh rate telemetry state */
export function getTelemetryFps() {
  return {
    fps: currentFps,
    detectedHz: detectedRefreshRate,
    isHighRefreshTier,
    dpr,
    isThrottled: isDprAutoThrottled,
  };
}

/** Return Peak 2D Cinematic Visual Novel Engine state for telemetry & verification */
export function getPeak2DState() {
  return {
    version: '16.0',
    engine: 'Peak 2D Cinematic Visual Novel Engine',
    visualMode,
    currentTheme,
    sceneArchetype: activeSceneArchetype,
    userSceneSetting: userSceneArchetype,
    extraReactiveEffects,
    godRaysActive: activeSceneArchetype === 'editorial-silk',
    anamorphicFlareReady: true,
    silkAuroraLayers: activeSceneArchetype === 'editorial-silk' ? 3 : 0,
    dofBokehLayers: {
      background: BG_BOKEH_COUNT,
      midground: BOKEH_COUNT,
      foreground: FG_BOKEH_COUNT,
    },
    fps: currentFps,
    dpr,
  };
}
