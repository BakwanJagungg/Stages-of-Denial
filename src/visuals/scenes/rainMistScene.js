/**
 * rainMistScene.js - Rain Mist (Melancholy, Pop Soul, Ballad)
 * Soft volumetric mist + 2-depth slanted rain + horizon puddles + warm streetlamp bokeh
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const RAIN_DROP_COUNT = 64;
const rainPool = Array.from({ length: RAIN_DROP_COUNT }, (_, idx) => {
  const depth = idx % 2 === 0 ? 0.6 : 1.0;
  return {
    x: Math.random() * 1920,
    y: Math.random() * 1080,
    speed: (12 + Math.random() * 16) * depth,
    len: (14 + Math.random() * 26) * depth,
    wind: (3.2 + Math.random() * 2.8) * depth,
    alpha: (0.16 + Math.random() * 0.32) * depth,
    depth,
  };
});

const RIPPLE_COUNT = 8;
const ripplePool = Array.from({ length: RIPPLE_COUNT }, () => ({
  x: Math.random() * 1920,
  r: 2 + Math.random() * 20,
  maxR: 26 + Math.random() * 32,
  speed: 16 + Math.random() * 22,
  alpha: 0.25 + Math.random() * 0.35,
}));

const BOKEH_COUNT = 8;
const lampBokehPool = Array.from({ length: BOKEH_COUNT }, () => ({
  x: Math.random() * 1920,
  y: Math.random() * 600,
  radius: 12 + Math.random() * 24,
  speedX: (Math.random() - 0.5) * 0.18,
  speedY: -0.06 - Math.random() * 0.12,
  swayPhase: Math.random() * Math.PI * 2,
}));

export function renderRainMistScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
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
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const mistBaseY = height * 0.72;

  // 2a. Soft Volumetric Horizon Mist
  const mistWave = Math.sin(time * 0.4) * 20;
  const mistGrad = ctx.createRadialGradient(
    width * 0.5 + Math.sin(time * 0.25) * 60,
    mistBaseY + mistWave,
    20,
    width * 0.5,
    mistBaseY,
    width * 0.56
  );
  const mistAlpha = 0.12 + smoothMid * 0.08 + smoothVocal * 0.06;
  mistGrad.addColorStop(0, hexToRgba(activeAccentCold || '#68B2D6', mistAlpha));
  mistGrad.addColorStop(0.5, hexToRgba(activeAccentPrimary, mistAlpha * 0.5));
  mistGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, height * 0.45, width, height * 0.55);

  // 2b. 2-Depth Slanted Rain Streaks
  const rainSpeedMult = Math.max(0.4, (1 + smoothBass * 0.4) * (motionScale || 0.35) * dtNorm);
  ctx.lineWidth = 1.1;
  for (let i = 0; i < RAIN_DROP_COUNT; i++) {
    const r = rainPool[i];
    r.y += r.speed * rainSpeedMult;
    r.x += r.wind * rainSpeedMult;
    if (r.y > height + 20) {
      r.y = -20;
      r.x = Math.random() * (width + 200) - 100;
    }
    if (r.x > width + 50) {
      r.x = -50;
    }

    ctx.strokeStyle = hexToRgba(activeAccentCold || '#94A3B8', r.alpha * (0.8 + smoothTreble * 0.4));
    ctx.beginPath();
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x - r.wind * 1.8, r.y - r.len);
    ctx.stroke();
  }

  // 2c. Ground Ripple Puddles at Horizon
  const puddleY = height * 0.88;
  for (let i = 0; i < RIPPLE_COUNT; i++) {
    const rip = ripplePool[i];
    rip.r += rip.speed * (dtSec || 0.016);
    if (rip.r >= rip.maxR) {
      rip.r = 2;
      rip.x = Math.random() * width;
    }
    const ripFade = Math.max(0, 1 - rip.r / rip.maxR);
    ctx.strokeStyle = hexToRgba(activeAccentCold || '#94A3B8', rip.alpha * ripFade * 0.4);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(rip.x, puddleY, rip.r * 2.4, rip.r * 0.65, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 2d. Warm Streetlamp Bokeh in Upper Atmosphere
  const bokehSpeedMult = Math.max(0.18, (motionScale || 0.25) * dtNorm);
  for (let i = 0; i < BOKEH_COUNT; i++) {
    const b = lampBokehPool[i];
    b.x += (b.speedX + Math.sin(time * 0.3 + b.swayPhase) * 0.08) * bokehSpeedMult * 0.35;
    b.y += b.speedY * bokehSpeedMult * 0.35;
    if (b.y < -20) b.y = height * 0.65;
    if (b.y > height * 0.65) b.y = -20;
    if (b.x < -20) b.x = width + 20;
    if (b.x > width + 20) b.x = -20;

    const r = Math.max(4, b.radius * (1.6 + smoothVocal * 0.3));
    const lampGrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    lampGrad.addColorStop(0, hexToRgba(activeAccentSecondary || '#E6B86A', 0.24));
    lampGrad.addColorStop(0.6, hexToRgba(activeAccentPrimary, 0.1));
    lampGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lampGrad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
