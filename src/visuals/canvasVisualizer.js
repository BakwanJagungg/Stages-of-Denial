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
let activeParticleStyle = 'falling-ash';
let activeVisualEnergy = 'intense';
let activeGenre = '';
let activeVisualContext = 'ballad'; // 'high-tempo' | 'dreamy' | 'ballad' | 'prism'
let sceneIntensityMode = 'cinema';

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

// Pre-allocated zero-GC context-aware pools
const STREAK_COUNT = 18;
const CONSTELLATION_COUNT = 22;
const RAIN_COUNT = 24;
const streakPool = Array.from({ length: STREAK_COUNT }, () => ({
  x: Math.random() * 1400,
  y: Math.random() * 820,
  len: 75 + Math.random() * 130,
  speed: 4.5 + Math.random() * 6.5,
  alpha: 0.08 + Math.random() * 0.14,
  alt: Math.random() > 0.5,
}));
const constellationPool = Array.from({ length: CONSTELLATION_COUNT }, () => ({
  x: Math.random() * 1400,
  y: Math.random() * 820,
  vx: (Math.random() - 0.5) * 0.35,
  vy: (Math.random() - 0.5) * 0.25,
  r: 1.1 + Math.random() * 1.4,
  phase: Math.random() * Math.PI * 2,
}));
const rainPool = Array.from({ length: RAIN_COUNT }, () => ({
  x: Math.random() * 1400,
  y: Math.random() * 820,
  len: 14 + Math.random() * 18,
  speed: 2.2 + Math.random() * 2.4,
  alpha: 0.06 + Math.random() * 0.09,
}));

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

function buildBokehSprite(colorHex, innerAlpha, midAlpha) {
  const size = 96;
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
  primaryBokehSprite = buildBokehSprite(activeAccentPrimary, 0.55, 0.26);
  secondaryBokehSprite = buildBokehSprite(activeAccentSecondary || SOFT_IVORY, 0.45, 0.18);
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

const STAR_COUNT = 72;
const starPool = Array.from({ length: STAR_COUNT }, (_, idx) => {
  const depth = idx % 3 === 0 ? 0.35 : idx % 3 === 1 ? 0.65 : 1.0;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    r: 0.6 + depth * 0.95,
    baseAlpha: 0.08 + depth * 0.16,
    speedX: -0.05 * depth,
    speedY: -0.08 * depth,
    depth,
    phase: Math.random() * Math.PI * 2,
  };
});

const BOKEH_COUNT = 52;
const bokehPool = Array.from({ length: BOKEH_COUNT }, (_, idx) => ({
  x: Math.random() * width,
  y: Math.random() * height,
  radius: 10 + Math.random() * 28,
  alpha: 0.14 + Math.random() * 0.22,
  speedX: (Math.random() - 0.5) * 0.28,
  speedY: -0.18 - Math.random() * 0.38,
  swayPhase: Math.random() * Math.PI * 2,
  swayAmp: 0.2 + Math.random() * 0.45,
  useSecondary: idx % 3 === 0,
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

function handleResize() {
  if (!canvas || !ctx) return;
  width = window.innerWidth;
  height = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', handleResize);
handleResize();
rebuildBokehSprites();

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
  genre = null
) {
  currentTheme = theme || 'crimson-ash';
  if (primaryColor) activeAccentPrimary = primaryColor;
  if (secondaryColor) activeAccentSecondary = secondaryColor;
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

function renderStardust(motionScale) {
  const scrollDrift = smoothScrollVelocity * 0.42;
  const drawTrails = Math.abs(scrollDrift) > 0.45 && motionScale > 0.2;

  ctx.save();
  for (let i = 0; i < STAR_COUNT; i++) {
    const s = starPool[i];
    if (motionScale > 0) {
      s.x += s.speedX * motionScale * livePaceFactor;
      s.y += (s.speedY * livePaceFactor - scrollDrift * s.depth) * motionScale;
      if (s.x < 0) s.x = width;
      if (s.y < -8) s.y = height + 4;
      if (s.y > height + 8) s.y = -4;
    }
    const breathe = 0.78 + 0.22 * Math.sin(time * 0.9 + s.phase);
    const alpha = (s.baseAlpha * breathe).toFixed(3);
    if (drawTrails) {
      const tailLen = Math.min(22, Math.abs(scrollDrift) * s.depth * 3.5);
      const dir = scrollDrift >= 0 ? 1 : -1;
      ctx.strokeStyle = `rgba(242, 239, 233, ${alpha})`;
      ctx.lineWidth = s.r * 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x, s.y + dir * tailLen);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(242, 239, 233, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
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

const GROOVE_MOTE_COUNT = 26;
const grooveMotePool = Array.from({ length: GROOVE_MOTE_COUNT }, (_, idx) => ({
  x: Math.random() * width,
  y: height * (0.28 + Math.random() * 0.44),
  r: 4 + Math.random() * 10,
  vx: (Math.random() - 0.5) * 0.9,
  phase: idx * 0.7,
  alpha: 0.16 + Math.random() * 0.18,
  warmTone: idx % 2 === 0,
}));

const EMBER_COUNT = 24;
const emberPool = Array.from({ length: EMBER_COUNT }, () => ({
  x: Math.random() * width,
  y: height * (0.45 + Math.random() * 0.55),
  r: 1.8 + Math.random() * 3.2,
  vy: -(0.7 + Math.random() * 1.15),
  vx: (Math.random() - 0.5) * 0.45,
  alpha: 0.22 + Math.random() * 0.2,
  phase: Math.random() * Math.PI * 2,
}));

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

const RAIN_STREAK_COUNT = 34;
const rainStreakPool = Array.from({ length: RAIN_STREAK_COUNT }, (_, idx) => ({
  x: Math.random() * width,
  y: Math.random() * height,
  len: 14 + Math.random() * 20,
  speed: 3.4 + Math.random() * 2.6,
  alpha: 0.12 + (idx % 10) * 0.01,
}));

const CALM_RIPPLE_COUNT = 5;
const calmRipplePool = Array.from({ length: CALM_RIPPLE_COUNT }, (_, idx) => ({
  x: width * (0.2 + Math.random() * 0.6),
  y: height * (0.64 + Math.random() * 0.22),
  radius: idx * 24,
  maxRadius: 90 + Math.random() * 55,
  alpha: 0.16,
}));

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
 * Multi-layer Silk Aurora featuring dynamic color-shift & dual-harmonic climax ribbons.
 */
function renderSilkAurora(bassNorm, midNorm, trebleNorm, vocalNorm, motionScale) {
  const baseY = height * 0.54;
  const isClimaxAct = visualMode === 'climax' || visualMode === 'verse';
  const isPeakClimax = visualMode === 'climax';

  const isCalm = activeVisualEnergy === 'calm';
  const isGroovy = activeVisualEnergy === 'groovy';
  const isIntense = activeVisualEnergy === 'intense';

  const layerCount = isPeakClimax ? 4 : isCalm ? 2 : isGroovy ? 3 : isClimaxAct ? 4 : 3;
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

  for (let layer = 0; layer < layerCount; layer++) {
    const speedRate = (isCalm ? 0.22 : isGroovy ? 0.64 : isClimaxAct ? 0.8 : 0.46) * surgeFactor * flowEnergyBoost;
    const phase = time * (speedRate + layer * 0.18) * (motionScale || 0.2) + layer * 1.5;
    const mixRatio = layer % 2 === 1 ? colorShiftPhase : 1 - colorShiftPhase * 0.7;
    const baseAlpha = isCalm ? 0.15 : isGroovy ? 0.22 : isClimaxAct ? 0.24 : 0.18;
    const alpha = Math.max(0.11, baseAlpha - layer * 0.025);
    const ySpread = (isIntense || isPeakClimax) ? 34 : 24;
    const yOffset = (layer - (layerCount - 1) * 0.5) * ySpread;
    const thickness = isCalm
      ? 42 + layer * 16 + bassNorm * 10
      : isGroovy
        ? 52 + layer * 18 + (bassNorm + midNorm) * 18
        : (isClimaxAct ? 68 : 54) + layer * 22 + bassNorm * 38;

    ctx.beginPath();
    const steps = isCalm ? 24 : 36;
    for (let s = 0; s <= steps; s++) {
      const ratio = s / steps;
      const x = ratio * width;
      const envelope = Math.sin(ratio * Math.PI);

      let wave;
      if (isCalm && !isPeakClimax) {
        wave = Math.sin(ratio * 3.1 + phase) * 0.8 + Math.cos(ratio * 5.2 - phase * 0.5) * 0.2;
      } else if (isGroovy && !isPeakClimax) {
        wave =
          Math.sin(ratio * 5.6 + phase) * 0.54 +
          Math.sin(ratio * 11.4 - phase * 1.15) * (0.28 + midNorm * 0.22) +
          Math.cos(ratio * 16.8 + phase * 1.4) * (0.14 * bassNorm);
      } else {
        // Dual harmonic climax waves + sharp mid/treble distortion for intense tracks
        const drive = isPeakClimax ? 1.2 : isIntense ? 1.05 : 0.78;
        const harmonicDistortion = isIntense
          ? Math.sin(ratio * 27.0 - phase * 2.2) * (0.14 * (midNorm + trebleNorm))
          : 0;
        wave =
          Math.sin(ratio * 4.8 + phase) * 0.5 +
          Math.sin(ratio * 13.5 - phase * 1.35) * (0.34 * drive + bassNorm * 0.22) +
          Math.cos(ratio * 21.0 + phase * 1.8) * (0.18 * trebleNorm * drive) +
          harmonicDistortion;
      }

      const y = baseY + yOffset + wave * ribbonAmp * envelope;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = thickness;
    ctx.strokeStyle = lerpColorRgba(
      activeAccentPrimary,
      activeAccentSecondary || activeAccentPrimary,
      mixRatio,
      alpha
    );
    ctx.stroke();

    ctx.lineWidth = isCalm && !isPeakClimax ? 1.5 : 2.2;
    ctx.strokeStyle = `rgba(242, 239, 233, ${(alpha * (isCalm ? 0.3 : 0.45)).toFixed(3)})`;
    ctx.stroke();
  }

  // Beat-synced Kinetic Shockwave Rings (universal across all curated, imported & user tracks)
  {
    const cx = width * 0.5;
    const cy = height * 0.52;
    const grooveHit = bassNorm * 0.62 + midNorm * 0.38;
    for (let i = 0; i < SONIC_RING_COUNT; i++) {
      const ring = sonicRingPool[i];
      if (!ring.active) continue;
      ring.radius += (1.9 + grooveHit * 2.4) * livePaceFactor * motionScale;
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

  if (isGroovy && secondaryBokehSprite && primaryBokehSprite) {
    const grooveEnergy = midNorm * 0.55 + bassNorm * 0.45;
    for (let i = 0; i < GROOVE_MOTE_COUNT; i++) {
      const m = grooveMotePool[i];
      m.x += (m.vx + Math.cos(time * 1.2 + m.phase) * (0.55 + grooveEnergy * 1.4)) * motionScale;
      const bounceY = Math.sin(time * 2.1 + m.phase) * (8 + grooveEnergy * 24);
      if (m.x < -30) m.x = width + 30;
      if (m.x > width + 30) m.x = -30;
      const drawY = m.y + bounceY;
      const r = m.r * (0.9 + grooveEnergy * 0.55);
      ctx.globalAlpha = Math.min(0.42, m.alpha * (0.75 + grooveEnergy * 0.75));
      ctx.drawImage(m.warmTone ? secondaryBokehSprite : primaryBokehSprite, m.x - r, drawY - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  if (isIntense) {
    const sparkDrive = (isClimaxAct ? 0.78 : 0.58) + (midNorm * 0.68 + trebleNorm * 0.56 + bassNorm * 0.35);
    for (let i = 0; i < EMBER_COUNT; i++) {
      const e = emberPool[i];
      e.x += (e.vx + Math.sin(time * 1.8 + e.phase) * (0.35 + midNorm * 0.45)) * motionScale;
      e.y += e.vy * sparkDrive * motionScale;
      if (e.y < height * 0.08) {
        e.y = height * (0.74 + Math.random() * 0.24);
        e.x = Math.random() * width;
      }
      ctx.fillStyle = hexToRgba(activeAccentSecondary || activeAccentPrimary, Math.min(0.42, e.alpha * (0.6 + midNorm * 0.45 + bassNorm * 0.35)));
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (0.85 + trebleNorm * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (isCalm) {
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.05;
    for (let i = 0; i < RAIN_STREAK_COUNT; i++) {
      const drop = rainStreakPool[i];
      drop.x += drop.speed * 0.24 * motionScale;
      drop.y += drop.speed * (0.85 + vocalNorm * 0.3) * motionScale;
      if (drop.y > height + 24 || drop.x > width + 24) {
        drop.x = Math.random() * width;
        drop.y = -24 - Math.random() * 60;
      }
      ctx.strokeStyle = hexToRgba(SOFT_IVORY, drop.alpha);
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x + drop.len * 0.24, drop.y + drop.len);
      ctx.stroke();
    }

    ctx.lineWidth = 1.1;
    for (let i = 0; i < CALM_RIPPLE_COUNT; i++) {
      const rp = calmRipplePool[i];
      rp.radius += (0.45 + vocalNorm * 0.35) * motionScale;
      if (rp.radius >= rp.maxRadius) {
        rp.radius = 4;
        rp.x = width * (0.18 + Math.random() * 0.64);
        rp.y = height * (0.6 + Math.random() * 0.26);
      }
      const prog = rp.radius / rp.maxRadius;
      ctx.strokeStyle = hexToRgba(activeAccentSecondary || activeAccentPrimary, 0.16 * (1 - prog));
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rp.radius, rp.radius * 0.34, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function getVisualPhysicsMode() {
  return activeVisualEnergy;
}

function renderDepthBokeh(bassNorm, vocalNorm, motionScale) {
  if (!primaryBokehSprite || !secondaryBokehSprite) return;

  const isCalm = activeVisualEnergy === 'calm';
  const isGroovy = activeVisualEnergy === 'groovy';
  const isRainStyle =
    activeParticleStyle === 'rain' ||
    activeParticleStyle === 'heavy-rain' ||
    activeParticleStyle === 'falling-ash';

  const basePace = isCalm ? 0.48 : isGroovy ? 0.92 : 1.05;
  const speedMult = (basePace + bassNorm * (isCalm ? 0.25 : 0.68) + vocalNorm * 0.38) * motionScale;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let i = 0; i < BOKEH_COUNT; i++) {
    const b = bokehPool[i];
    if (speedMult > 0) {
      b.x += (b.speedX + Math.sin(time * 0.7 + b.swayPhase) * b.swayAmp * 0.25) * speedMult;
      b.y += (isRainStyle ? Math.abs(b.speedY) : -Math.abs(b.speedY)) * speedMult;

      if (cursorActive && motionScale > 0.2) {
        const dx = b.x - cursorPxX;
        const dy = b.y - cursorPxY;
        const distSq = dx * dx + dy * dy;
        const maxDist = 140;
        if (distSq > 1 && distSq < maxDist * maxDist) {
          const dist = Math.sqrt(distSq);
          const falloff = 1 - dist / maxDist;
          const nx = dx / dist;
          const ny = dy / dist;
          const force = falloff * 1.45 * motionScale;
          b.x += (nx - ny * 0.45) * force;
          b.y += (ny + nx * 0.45) * force;
        }
      }

      if (isRainStyle && b.y > height + b.radius * 2) resetBokehItem(b, true);
      else if (!isRainStyle && b.y < -b.radius * 2) resetBokehItem(b, false);
      if (b.x < -b.radius * 2) b.x = width + b.radius;
      if (b.x > width + b.radius * 2) b.x = -b.radius;
    }

    const r = b.radius * (0.94 + vocalNorm * 0.14);
    const sprite = b.useSecondary ? secondaryBokehSprite : primaryBokehSprite;
    ctx.globalAlpha = Math.min(0.45, b.alpha * (0.82 + vocalNorm * 0.35));
    ctx.drawImage(sprite, b.x - r, b.y - r, r * 2, r * 2);
  }

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

function updateDirectorTelemetry(nowMs, vocalNorm) {
  fpsAccFrames += 1;
  fpsAccMs += Math.min(200, Math.max(0, nowMs - lastFrameMs));
  if (fpsAccMs >= 400) {
    currentFps = Math.max(1, Math.min(120, Math.round((fpsAccFrames * 1000) / fpsAccMs)));
    fpsAccFrames = 0;
    fpsAccMs = 0;
    if (directorFpsEl && directorHudEl && !directorHudEl.hidden) {
      directorFpsEl.textContent = String(currentFps);
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

function renderContextLayer(bassNorm, trebleNorm, vocalNorm, motionScale) {
  if (!ctx || width <= 0 || height <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  if (activeVisualContext === 'high-tempo' || activeVisualContext === 'prism') {
    // Prismatic Speed Streaks + subtle eye-comfort beat flash
    const speedBoost = (1 + bassNorm * 2.2 + trebleNorm * 1.4) * livePaceFactor * motionScale;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < STREAK_COUNT; i++) {
      const s = streakPool[i];
      s.x += s.speed * speedBoost;
      s.y -= s.speed * 0.22 * speedBoost;
      if (s.x > width + s.len) { s.x = -s.len; s.y = Math.random() * height; }
      if (s.y < -40) s.y = height + 20;
      ctx.strokeStyle = hexToRgba(s.alt ? activeAccentSecondary : activeAccentPrimary, s.alpha * (0.7 + trebleNorm * 0.8));
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.len, s.y + s.len * 0.22);
      ctx.stroke();
    }
    if (bassNorm > 0.62 && motionScale > 0.3) {
      const flashAlpha = Math.min(0.11, (bassNorm - 0.62) * 0.28);
      ctx.fillStyle = hexToRgba(activeAccentPrimary, flashAlpha);
      ctx.fillRect(0, 0, width, height);
    }
  }
  if (activeVisualContext === 'dreamy' || activeVisualContext === 'prism') {
    // Constellation Starfield with thin proximity links
    const maxLinkSq = 135 * 135;
    for (let i = 0; i < CONSTELLATION_COUNT; i++) {
      const a = constellationPool[i];
      a.x += a.vx * livePaceFactor * motionScale;
      a.y += a.vy * livePaceFactor * motionScale;
      if (a.x < 0) a.x = width; else if (a.x > width) a.x = 0;
      if (a.y < 0) a.y = height; else if (a.y > height) a.y = 0;

      const twinkle = 0.28 + Math.sin(time * 1.8 + a.phase) * 0.14 + vocalNorm * 0.2;
      ctx.fillStyle = hexToRgba(SOFT_IVORY, Math.min(0.55, twinkle));
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();

      for (let j = i + 1; j < CONSTELLATION_COUNT; j++) {
        const b = constellationPool[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < maxLinkSq) {
          const linkAlpha = (1 - dSq / maxLinkSq) * 0.14 * (0.8 + vocalNorm * 0.5);
          ctx.strokeStyle = hexToRgba(activeAccentPrimary, linkAlpha);
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
  } else if (activeVisualContext === 'ballad') {
    // Ballad: Volumetric Mist Layer + soft rain reflections
    const mistY = height * 0.78;
    const mistGrad = ctx.createRadialGradient(width * 0.5, mistY, 10, width * 0.5, mistY, width * 0.52);
    mistGrad.addColorStop(0, hexToRgba(activeAccentPrimary, 0.08 + vocalNorm * 0.05));
    mistGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, height * 0.48, width, height * 0.52);

    ctx.lineWidth = 0.9;
    const dropScale = (1 + bassNorm * 0.45) * motionScale;
    for (let i = 0; i < RAIN_COUNT; i++) {
      const r = rainPool[i];
      r.x -= r.speed * 0.18 * dropScale;
      r.y += r.speed * dropScale;
      if (r.y > height + 20) { r.y = -20; r.x = Math.random() * width; }
      if (r.x < -20) r.x = width + 10;
      ctx.strokeStyle = hexToRgba(SOFT_IVORY, r.alpha * (0.75 + vocalNorm * 0.35));
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - r.len * 0.18, r.y + r.len);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function render() {
  if (!isRunning || !ctx) return;

  const nowMs = performance.now();
  const dtSec = Math.min(0.05, Math.max(0.001, (nowMs - lastFrameMs) / 1000));
  if (auroraBoostRemaining > 0) {
    auroraBoostRemaining = Math.max(0, auroraBoostRemaining - dtSec);
  }

  const isReduced = reducedMotionQuery.matches;
  const motionScale = isReduced ? 0.12 : 1.0;
  time += isReduced ? 0.004 : 0.016;

  ctx.clearRect(0, 0, width, height);

  const levels = getFrequencyLevels();
  const vocal = getVocalEnergy();

  smoothBass += (levels.bass / 255 - smoothBass) * 0.14;
  smoothMid += (levels.mid / 255 - smoothMid) * 0.14;
  smoothTreble += (levels.treble / 255 - smoothTreble) * 0.14;
  smoothVocal += ((vocal ? vocal.normalized : 0) - smoothVocal) * 0.18;

  computeLiveAudioDynamics(smoothBass, smoothMid, smoothTreble, smoothVocal, nowMs, dtSec);
  renderStardust(motionScale);
  renderContextLayer(smoothBass, smoothTreble, smoothVocal, motionScale);
  renderBreathingHalo(smoothBass, smoothVocal);
  renderSilkAurora(smoothBass, smoothMid, smoothTreble, smoothVocal, motionScale);
  renderDepthBokeh(smoothBass, smoothVocal, motionScale);
  renderHighlightRipples(dtSec);

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
  render();
}
