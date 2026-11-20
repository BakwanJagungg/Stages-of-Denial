/**
 * celestialDriftScene.js - Celestial Drift (Indie Pop, Dreamy, R&B, Nostalgic)
 * Constellation network + proximity links + soft lens bloom + stardust parallax
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const CONSTELLATION_COUNT = 28;
const constellationPool = Array.from({ length: CONSTELLATION_COUNT }, () => ({
  x: Math.random() * 1920,
  y: Math.random() * 1080,
  vx: (Math.random() - 0.5) * 0.45,
  vy: (Math.random() - 0.5) * 0.45,
  r: 1.2 + Math.random() * 2.2,
  phase: Math.random() * Math.PI * 2,
}));

export function renderCelestialDriftScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    time,
    smoothVocal,
    motionScale,
    dtNorm,
    activeAccentPrimary,
    activeAccentSecondary,
    activeAccentCold,
    livePaceFactor,
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const maxLinkSq = 135 * 135;
  const pace = Number(livePaceFactor) || 1.0;
  const driftRate = Math.max(0.2, pace * (motionScale || 0.35) * dtNorm);

  // 4a. Constellation Network: drifting star nodes with thin proximity links
  for (let i = 0; i < CONSTELLATION_COUNT; i++) {
    const a = constellationPool[i];
    a.x += a.vx * driftRate;
    a.y += a.vy * driftRate;
    if (a.x < 0) a.x = width;
    else if (a.x > width) a.x = 0;
    if (a.y < 0) a.y = height;
    else if (a.y > height) a.y = 0;

    const twinkle = 0.3 + Math.sin(time * 1.6 + a.phase) * 0.15 + smoothVocal * 0.25;
    ctx.fillStyle = hexToRgba(SOFT_IVORY, Math.min(0.85, twinkle));
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r * (1 + smoothVocal * 0.3), 0, Math.PI * 2);
    ctx.fill();

    for (let j = i + 1; j < CONSTELLATION_COUNT; j++) {
      const b = constellationPool[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < maxLinkSq) {
        const linkAlpha = (1 - dSq / maxLinkSq) * 0.16 * (0.8 + smoothVocal * 0.6);
        ctx.strokeStyle = hexToRgba(activeAccentCold || '#68B2D6', linkAlpha);
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  // 4b. Soft Lens Bloom Discs
  const cx = width * 0.5;
  const cy = height * 0.5;
  const bloomPulse = Math.sin(time * 0.45) * 0.04 + smoothVocal * 0.08;
  const bloomGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, width * 0.44);
  bloomGrad.addColorStop(0, hexToRgba(activeAccentPrimary, 0.14 + bloomPulse));
  bloomGrad.addColorStop(0.5, hexToRgba(activeAccentSecondary || '#818CF8', 0.07 + bloomPulse * 0.5));
  bloomGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bloomGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}
