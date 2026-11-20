/**
 * snowfallQuietScene.js - Snowfall Quiet (Piano, Sad Ballad, Winter)
 * Multi-depth gentle drifting snowflakes + cold winter mist + crystal sparkle glints
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const SNOW_COUNT = 48;
const snowPool = Array.from({ length: SNOW_COUNT }, (_, idx) => {
  const depth = idx % 3 === 0 ? 0.4 : idx % 3 === 1 ? 0.75 : 1.0;
  return {
    x: Math.random() * 1920,
    y: Math.random() * 1080,
    vy: (0.7 + Math.random() * 1.4) * depth,
    swaySpeed: 0.8 + Math.random() * 1.2,
    swayAmp: (0.8 + Math.random() * 1.4) * depth,
    phase: Math.random() * Math.PI * 2,
    r: (1.2 + Math.random() * 2.8) * depth,
    alpha: (0.25 + Math.random() * 0.45) * depth,
    depth,
  };
});

export function renderSnowfallQuietScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    time,
    smoothMid,
    smoothTreble,
    motionScale,
    dtNorm,
    activeAccentPrimary,
    activeAccentCold,
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // 15a. Cold Winter Ambient Blue/Slate Mist
  const mistGrad = ctx.createLinearGradient(0, 0, 0, height);
  mistGrad.addColorStop(0, hexToRgba(activeAccentCold || '#64748B', 0.08));
  mistGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
  mistGrad.addColorStop(1, hexToRgba(activeAccentPrimary, 0.12 + smoothMid * 0.06));
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, 0, width, height);

  // 15b. Multi-Depth Drifting Snowflakes
  const fallRate = Math.max(0.2, (motionScale || 0.35) * dtNorm);

  for (let i = 0; i < SNOW_COUNT; i++) {
    const s = snowPool[i];
    s.y += s.vy * fallRate;
    s.x += Math.sin(time * s.swaySpeed + s.phase) * s.swayAmp * fallRate;

    if (s.y > height + 15) {
      s.y = -15;
      s.x = Math.random() * width;
    }
    if (s.x < -20) s.x = width + 20;
    if (s.x > width + 20) s.x = -20;

    const twinkle = Math.sin(time * 2.2 + s.phase);
    const alpha = s.alpha * (0.8 + twinkle * 0.2 + smoothTreble * 0.25);

    ctx.fillStyle = hexToRgba(SOFT_IVORY, alpha);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();

    // Crystal diamond glint for foreground flakes
    if (s.depth > 0.8 && twinkle > 0.4) {
      ctx.strokeStyle = hexToRgba(SOFT_IVORY, alpha * 0.65);
      ctx.lineWidth = 0.8;
      const glintLen = s.r * 2.2;
      ctx.beginPath();
      ctx.moveTo(s.x - glintLen, s.y);
      ctx.lineTo(s.x + glintLen, s.y);
      ctx.moveTo(s.x, s.y - glintLen);
      ctx.lineTo(s.x, s.y + glintLen);
      ctx.stroke();
    }
  }

  ctx.restore();
}
