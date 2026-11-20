/**
 * cyberGridScene.js - Cyber Grid (Electronic, Synth-Pop, Synthwave, Techno)
 * Retro outrun perspective grid floor + sliced horizontal neon sun + speed lines
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

export function renderCyberGridScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    time,
    smoothBass,
    smoothMid,
    motionScale,
    dtNorm,
    activeAccentPrimary,
    activeAccentSecondary,
    livePaceFactor,
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const cx = width * 0.5;
  const horizonY = height * 0.54;
  const pace = Number(livePaceFactor) || 1.0;

  // 11a. Sliced Retro Neon Sun on Horizon
  const sunR = Math.min(width, height) * 0.18 * (1 + smoothBass * 0.12);
  const sunY = horizonY - sunR * 0.35;

  const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sunGrad.addColorStop(0, hexToRgba(activeAccentSecondary || '#F59E0B', 0.95));
  sunGrad.addColorStop(0.6, hexToRgba(activeAccentPrimary, 0.85));
  sunGrad.addColorStop(1, hexToRgba('#EC4899', 0.8));

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = sunGrad;
  ctx.fillRect(cx - sunR, sunY - sunR, sunR * 2, sunR * 2);

  // Horizontal blind slices across lower half of sun
  const sliceCount = 8;
  for (let s = 0; s < sliceCount; s++) {
    const sliceY = sunY + (s / sliceCount) * sunR;
    const sliceH = 2.5 + s * 1.2;
    ctx.clearRect(cx - sunR, sliceY, sunR * 2, sliceH);
  }
  ctx.restore();

  // 11b. Perspective Grid Floor
  const gridSpeed = (0.22 + smoothBass * 0.4) * pace * (motionScale || 1.0) * dtNorm;
  const floorH = height - horizonY;

  // Moving Horizontal perspective lines
  const hLines = 14;
  const offset = (time * 0.45 * pace) % 1.0;
  for (let i = 0; i < hLines; i++) {
    const p = Math.pow((i + offset) / hLines, 2.4);
    const y = horizonY + p * floorH;
    const alpha = (0.12 + p * 0.5) * (1 + smoothMid * 0.35);

    ctx.strokeStyle = hexToRgba(activeAccentPrimary, alpha);
    ctx.lineWidth = 1.0 + p * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Radiating Vertical lines from vanishing point (cx, horizonY)
  const vLines = 18;
  for (let i = -vLines; i <= vLines; i++) {
    const bottomX = cx + i * (width * 0.05);
    ctx.strokeStyle = hexToRgba(activeAccentSecondary || activeAccentPrimary, 0.22 + smoothBass * 0.18);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(cx, horizonY);
    ctx.lineTo(bottomX, height);
    ctx.stroke();
  }

  // Neon Horizon Glow Line
  ctx.strokeStyle = hexToRgba(SOFT_IVORY, 0.85);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(width, horizonY);
  ctx.stroke();

  ctx.restore();
}
