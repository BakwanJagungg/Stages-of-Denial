/**
 * sakuraPetalsScene.js - Sakura Petals (Folk, Acoustic, Nostalgia)
 * Soft fluttering falling petals with sine sway and gentle rotation & twilight glow
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const PETAL_COUNT = 38;
const petalPool = Array.from({ length: PETAL_COUNT }, (_, idx) => ({
  x: Math.random() * 1920,
  y: Math.random() * 1080,
  vy: 1.1 + Math.random() * 1.8,
  swaySpeed: 1.0 + Math.random() * 1.5,
  swayAmp: 1.4 + Math.random() * 2.2,
  swayPhase: Math.random() * Math.PI * 2,
  rot: Math.random() * Math.PI * 2,
  rotSpeed: (Math.random() - 0.5) * 0.04,
  size: 6 + Math.random() * 9,
  alpha: 0.35 + Math.random() * 0.45,
  isAccent: idx % 3 === 0,
}));

export function renderSakuraPetalsScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    time,
    smoothBass,
    smoothMid,
    smoothVocal,
    motionScale,
    dtNorm,
    activeAccentPrimary,
    activeAccentSecondary,
    livePaceFactor,
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // Warm twilight horizon ambient glow
  const twilightGrad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.85,
    20,
    width * 0.5,
    height * 0.85,
    width * 0.62
  );
  twilightGrad.addColorStop(0, hexToRgba(activeAccentSecondary || '#F472B6', 0.16 + smoothVocal * 0.1));
  twilightGrad.addColorStop(0.5, hexToRgba(activeAccentPrimary, 0.08 + smoothMid * 0.06));
  twilightGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = twilightGrad;
  ctx.fillRect(0, 0, width, height);

  const pace = Number(livePaceFactor) || 1.0;
  const fallRate = Math.max(0.25, (1.0 + smoothBass * 0.4) * pace * (motionScale || 0.35) * dtNorm);

  for (let i = 0; i < PETAL_COUNT; i++) {
    const p = petalPool[i];
    p.y += p.vy * fallRate;
    p.x += Math.sin(time * p.swaySpeed + p.swayPhase) * p.swayAmp * fallRate;
    p.rot += p.rotSpeed * fallRate;

    if (p.y > height + 25) {
      p.y = -25;
      p.x = Math.random() * width;
    }
    if (p.x < -30) p.x = width + 30;
    if (p.x > width + 30) p.x = -30;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    const petalScale = Math.sin(time * 1.4 + p.swayPhase);
    ctx.scale(1, Math.max(0.25, Math.abs(petalScale)));

    const petalColor = p.isAccent
      ? (activeAccentSecondary || '#F472B6')
      : activeAccentPrimary;
    ctx.fillStyle = hexToRgba(petalColor, p.alpha * (0.8 + smoothVocal * 0.3));

    // Curved Organic Petal Geometry
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.bezierCurveTo(p.size * 0.8, -p.size * 0.4, p.size * 0.7, p.size * 0.8, 0, p.size);
    ctx.bezierCurveTo(-p.size * 0.7, p.size * 0.8, -p.size * 0.8, -p.size * 0.4, 0, -p.size);
    ctx.fill();

    // Subtle Petal Highlight Rib
    ctx.strokeStyle = hexToRgba(SOFT_IVORY, p.alpha * 0.4);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -p.size * 0.7);
    ctx.lineTo(0, p.size * 0.7);
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}
