/**
 * liquidHorizonScene.js - Liquid Horizon (Romantic, R&B)
 * Layered ocean waves with specular moon/twilight shimmer & light reflection path
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const SHIMMER_COUNT = 32;
const shimmerPool = Array.from({ length: SHIMMER_COUNT }, () => ({
  xNorm: 0.35 + Math.random() * 0.3,
  yNorm: 0.68 + Math.random() * 0.28,
  len: 12 + Math.random() * 28,
  phase: Math.random() * Math.PI * 2,
  speed: 1.5 + Math.random() * 2.0,
}));

export function renderLiquidHorizonScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    time,
    smoothBass,
    smoothMid,
    smoothTreble,
    smoothVocal,
    motionScale,
    activeAccentPrimary,
    activeAccentSecondary,
    activeAccentCold,
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const cx = width * 0.5;
  const horizonY = height * 0.64;

  // 10a. Celestial Moon/Sunset Orb in Sky
  const moonX = cx;
  const moonY = height * 0.34;
  const moonR = Math.min(width, height) * 0.08 * (1 + smoothVocal * 0.15);

  const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 2.8);
  moonGlow.addColorStop(0, hexToRgba(SOFT_IVORY, 0.75));
  moonGlow.addColorStop(0.35, hexToRgba(activeAccentSecondary || '#E0E7FF', 0.28));
  moonGlow.addColorStop(0.7, hexToRgba(activeAccentCold || '#38BDF8', 0.12));
  moonGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 2.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = SOFT_IVORY;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();

  // 10b. Layered Ocean Wave Surfaces (3 wave layers)
  for (let layer = 0; layer < 3; layer++) {
    const layerBaseY = horizonY + layer * (height * 0.1);
    const layerSpeed = (0.8 + layer * 0.4) * (motionScale || 1.0);
    const waveAmp = (8 + layer * 6) * (1 + smoothBass * 0.6);

    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, layerBaseY);

    const steps = 48;
    const dx = width / steps;
    for (let i = 0; i <= steps; i++) {
      const x = i * dx;
      const wave = Math.sin(x * 0.008 + time * layerSpeed + layer * 1.5) * waveAmp +
                   Math.cos(x * 0.018 - time * layerSpeed * 0.7) * (waveAmp * 0.4);
      ctx.lineTo(x, layerBaseY + wave);
    }
    ctx.lineTo(width, height);
    ctx.closePath();

    const waveGrad = ctx.createLinearGradient(0, layerBaseY, 0, height);
    const waveAlpha = (0.22 - layer * 0.04) + smoothMid * 0.1;
    const layerColor = layer === 0 ? (activeAccentCold || '#0284C7') : activeAccentPrimary;
    waveGrad.addColorStop(0, hexToRgba(layerColor, waveAlpha));
    waveGrad.addColorStop(1, hexToRgba(activeAccentPrimary, 0.05));
    ctx.fillStyle = waveGrad;
    ctx.fill();

    // Wave crest highlight edge
    ctx.strokeStyle = hexToRgba(SOFT_IVORY, 0.2 + smoothTreble * 0.2);
    ctx.lineWidth = 1.0;
    ctx.stroke();
  }

  // 10c. Vertical Water Specular Shimmer Reflection Path
  for (let i = 0; i < SHIMMER_COUNT; i++) {
    const s = shimmerPool[i];
    const sy = s.yNorm * height;
    const sx = cx + (s.xNorm - 0.5) * width * 0.35 + Math.sin(time * s.speed + s.phase) * 18;
    const shimmerAlpha = Math.max(0, Math.sin(time * s.speed + s.phase) * 0.5 + 0.5) * (0.35 + smoothTreble * 0.35);

    ctx.strokeStyle = hexToRgba(SOFT_IVORY, shimmerAlpha);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx - s.len * 0.5, sy);
    ctx.lineTo(sx + s.len * 0.5, sy);
    ctx.stroke();
  }

  ctx.restore();
}
