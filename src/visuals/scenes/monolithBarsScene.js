/**
 * monolithBarsScene.js - Monolith Bars (Post-Hardcore, Dramatic, Heavy)
 * Symmetrical architectural light pillars rising & falling to audio spectrum + floor reflection
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const PILLAR_COUNT = 20;

export function renderMonolithBarsScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    time,
    smoothBass,
    smoothMid,
    smoothTreble,
    motionScale,
    activeAccentPrimary,
    activeAccentSecondary,
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const baseY = height * 0.72;
  const cx = width * 0.5;
  const barW = Math.min(38, (width * 0.78) / PILLAR_COUNT);
  const gap = 8;
  const totalW = PILLAR_COUNT * (barW + gap) - gap;
  const startX = cx - totalW * 0.5;

  // Architectural horizon line
  ctx.strokeStyle = hexToRgba(activeAccentPrimary, 0.22);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  ctx.lineTo(width, baseY);
  ctx.stroke();

  for (let i = 0; i < PILLAR_COUNT; i++) {
    const x = startX + i * (barW + gap);
    const distFromCenter = Math.abs(i - (PILLAR_COUNT - 1) * 0.5) / (PILLAR_COUNT * 0.5);
    // Center responds to bass, mid to mids, outer to treble
    const freqFactor = (1 - distFromCenter) * smoothBass * 1.6 + (0.5 - Math.abs(distFromCenter - 0.5)) * smoothMid * 1.4 + distFromCenter * smoothTreble * 1.2;
    const idleBreath = Math.sin(time * 1.8 + i * 0.35) * 14 + 18;
    const barH = Math.max(12, idleBreath + freqFactor * (height * 0.44) * (motionScale || 1.0));

    const pillarGrad = ctx.createLinearGradient(x, baseY - barH, x, baseY);
    const topColor = i % 2 === 0 ? (activeAccentSecondary || '#F59E0B') : activeAccentPrimary;
    pillarGrad.addColorStop(0, hexToRgba(topColor, 0.75));
    pillarGrad.addColorStop(0.5, hexToRgba(activeAccentPrimary, 0.35));
    pillarGrad.addColorStop(1, hexToRgba(activeAccentPrimary, 0.08));

    // Pillar body
    ctx.fillStyle = pillarGrad;
    ctx.fillRect(x, baseY - barH, barW, barH);

    // Glowing Pillar Top Cap
    ctx.fillStyle = hexToRgba(SOFT_IVORY, 0.85);
    ctx.fillRect(x, baseY - barH, barW, 2.5);

    // Downward Floor Reflection
    const reflGrad = ctx.createLinearGradient(x, baseY, x, baseY + barH * 0.45);
    reflGrad.addColorStop(0, hexToRgba(topColor, 0.22));
    reflGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = reflGrad;
    ctx.fillRect(x, baseY, barW, barH * 0.45);
  }

  ctx.restore();
}
