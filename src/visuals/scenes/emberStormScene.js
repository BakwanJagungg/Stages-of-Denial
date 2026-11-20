/**
 * emberStormScene.js - Ember Storm (Post-Rock, Emo, Amarah, Alt-Rock)
 * Rising turbulent embers + atmospheric storm lightning glow + bass shockwaves
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const EMBER_COUNT = 48;
const emberPool = Array.from({ length: EMBER_COUNT }, () => ({
  x: Math.random() * 1920,
  y: Math.random() * 1080,
  vx: (Math.random() - 0.5) * 1.4,
  vy: -1.2 - Math.random() * 3.4,
  size: 1.5 + Math.random() * 3.2,
  alpha: 0.35 + Math.random() * 0.55,
  swaySpeed: 1.2 + Math.random() * 2.2,
  swayPhase: Math.random() * Math.PI * 2,
  heat: Math.random(),
}));

const SHOCKWAVE_COUNT = 5;
const shockwavePool = Array.from({ length: SHOCKWAVE_COUNT }, () => ({
  r: 0,
  maxR: 380,
  active: false,
  alpha: 0.3,
  speed: 4.5,
}));
let lastShockwaveTime = 0;

export function renderEmberStormScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    time,
    smoothBass,
    smoothMid,
    motionScale,
    dtNorm,
    activeAccentPrimary,
    activeAccentSecondary,
    isClimax,
    livePaceFactor,
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const cx = width * 0.5;
  const cy = height * 0.52;

  // 3a. Moody Storm Atmospheric Glow
  const stormPulse = Math.sin(time * 0.6) * 0.05 + smoothBass * (isClimax ? 0.28 : 0.16);
  const stormGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, width * 0.54);
  stormGrad.addColorStop(0, hexToRgba(activeAccentPrimary, 0.16 + stormPulse));
  stormGrad.addColorStop(0.55, hexToRgba(activeAccentSecondary || '#D98A5C', 0.08 + stormPulse * 0.5));
  stormGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = stormGrad;
  ctx.fillRect(0, 0, width, height);

  // 3b. Turbulent Rising Embers
  const emberPace = Math.max(0.25, (1.0 + smoothBass * 1.8 + (isClimax ? 0.8 : 0)) * (motionScale || 0.3) * dtNorm);
  for (let i = 0; i < EMBER_COUNT; i++) {
    const e = emberPool[i];
    e.x += (e.vx + Math.sin(time * e.swaySpeed + e.swayPhase) * (1.6 + smoothBass * 3.2)) * emberPace;
    e.y += e.vy * emberPace;
    if (e.y < -20) {
      e.y = height + 20;
      e.x = Math.random() * width;
    }
    if (e.x < -20) e.x = width + 20;
    if (e.x > width + 20) e.x = -20;

    const emberColor = e.heat > 0.6 ? '#FEF08A' : e.heat > 0.3 ? '#F59E0B' : '#E11D48';
    const emberAlpha = Math.min(0.9, e.alpha * (0.8 + smoothBass * 0.5));
    const r = e.size * (1 + smoothBass * 0.4);

    ctx.fillStyle = hexToRgba(emberColor, emberAlpha);
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();

    if (e.heat > 0.4) {
      ctx.fillStyle = hexToRgba(SOFT_IVORY, emberAlpha * 0.8);
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3c. Kinetic Shockwaves
  const pace = Number(livePaceFactor) || 1.0;
  if (smoothBass > 0.42 && time - lastShockwaveTime > 0.75) {
    lastShockwaveTime = time;
    for (let i = 0; i < SHOCKWAVE_COUNT; i++) {
      if (!shockwavePool[i].active) {
        shockwavePool[i].active = true;
        shockwavePool[i].r = 20;
        shockwavePool[i].maxR = Math.min(width, height) * (0.42 + smoothBass * 0.3);
        shockwavePool[i].alpha = 0.28 + smoothBass * 0.22;
        break;
      }
    }
  }

  for (let i = 0; i < SHOCKWAVE_COUNT; i++) {
    const sw = shockwavePool[i];
    if (!sw.active) continue;
    sw.r += (sw.speed + smoothBass * 6.5) * pace * motionScale * dtNorm;
    const prog = sw.r / sw.maxR;
    if (prog >= 1.0) {
      sw.active = false;
      continue;
    }
    const alpha = sw.alpha * (1 - prog);
    ctx.lineWidth = Math.max(1, 2.5 * (1 - prog));
    ctx.strokeStyle = hexToRgba(activeAccentPrimary, alpha);
    ctx.beginPath();
    ctx.arc(cx, cy, sw.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
