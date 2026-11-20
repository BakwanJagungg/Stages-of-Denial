/**
 * goldenDustRaysScene.js - Golden Dust Rays (Uplifting, Hopeful, Morning/Golden Hour)
 * Diagonal golden sunbeams + floating golden dust specks dancing peacefully in warm radiant light
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const DUST_COUNT = 34;
const dustPool = Array.from({ length: DUST_COUNT }, () => ({
  x: Math.random() * 1920,
  y: Math.random() * 1080,
  vx: (Math.random() - 0.5) * 0.35,
  vy: -0.15 - Math.random() * 0.45,
  r: 1.2 + Math.random() * 2.4,
  alpha: 0.25 + Math.random() * 0.55,
  swaySpeed: 0.9 + Math.random() * 1.4,
  phase: Math.random() * Math.PI * 2,
}));

const BEAM_COUNT = 6;
const beamPool = Array.from({ length: BEAM_COUNT }, (_, idx) => ({
  originXRatio: 0.15 + (idx / BEAM_COUNT) * 0.7,
  widthRatio: 0.1 + Math.random() * 0.08,
  speed: 0.6 + Math.random() * 0.5,
  phase: Math.random() * Math.PI * 2,
  alphaBase: 0.12 + Math.random() * 0.14,
}));

export function renderGoldenDustRaysScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    time,
    smoothMid,
    smoothVocal,
    motionScale,
    dtNorm,
    activeAccentPrimary,
    activeAccentSecondary,
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // 18a. Top Golden Origin Ambient Flare
  const flareGrad = ctx.createRadialGradient(width * 0.25, 0, 10, width * 0.25, 0, width * 0.65);
  const goldColor = activeAccentSecondary || '#F59E0B';
  flareGrad.addColorStop(0, hexToRgba('#FEF08A', 0.45 + smoothVocal * 0.25));
  flareGrad.addColorStop(0.35, hexToRgba(goldColor, 0.25 + smoothMid * 0.15));
  flareGrad.addColorStop(0.75, hexToRgba(activeAccentPrimary, 0.08));
  flareGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = flareGrad;
  ctx.fillRect(0, 0, width, height);

  // 18b. Diagonal Volumetric Golden Sunbeams
  for (let i = 0; i < BEAM_COUNT; i++) {
    const b = beamPool[i];
    const topX = width * b.originXRatio + Math.sin(time * b.speed + b.phase) * 30;
    const bottomX = topX + width * 0.28 + Math.cos(time * b.speed * 0.8 + b.phase) * 40;
    const beamW = width * b.widthRatio;

    const beamGrad = ctx.createLinearGradient(topX, 0, bottomX, height);
    const alpha = (b.alphaBase + smoothVocal * 0.18) * (motionScale || 1.0);
    beamGrad.addColorStop(0, hexToRgba('#FEF08A', alpha * 0.8));
    beamGrad.addColorStop(0.45, hexToRgba(goldColor, alpha));
    beamGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(topX - beamW * 0.5, 0);
    ctx.lineTo(topX + beamW * 0.5, 0);
    ctx.lineTo(bottomX + beamW * 0.85, height);
    ctx.lineTo(bottomX - beamW * 0.85, height);
    ctx.closePath();
    ctx.fill();
  }

  // 18c. Floating Golden Dust Specks dancing peacefully in sunbeams
  const moveRate = Math.max(0.2, (motionScale || 0.3) * dtNorm);
  for (let i = 0; i < DUST_COUNT; i++) {
    const d = dustPool[i];
    d.y += d.vy * moveRate;
    d.x += (d.vx + Math.sin(time * d.swaySpeed + d.phase) * 0.35) * moveRate;

    if (d.y < -15) d.y = height + 15;
    if (d.x < -20) d.x = width + 20;
    if (d.x > width + 20) d.x = -20;

    const twinkle = Math.sin(time * 2.0 + d.phase);
    const alpha = d.alpha * (0.7 + twinkle * 0.3 + smoothVocal * 0.3);

    ctx.fillStyle = hexToRgba('#FEF08A', alpha);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();

    // Hot ivory center for bright specks
    if (alpha > 0.45) {
      ctx.fillStyle = hexToRgba(SOFT_IVORY, alpha * 0.75);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
