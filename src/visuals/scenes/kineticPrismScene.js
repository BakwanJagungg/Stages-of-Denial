/**
 * kineticPrismScene.js - Kinetic Prism (J-Pop, Tokusatsu, Ska, High-Tempo)
 * Depth-scaled geometric prism frames + laser speed streaks & beat glints
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const STREAK_COUNT = 24;
const streakPool = Array.from({ length: STREAK_COUNT }, (_, idx) => ({
  x: Math.random() * 1920,
  y: Math.random() * 1080,
  speed: 4.8 + Math.random() * 7.2,
  len: 55 + Math.random() * 130,
  thickness: 1.2 + Math.random() * 2.2,
  alpha: 0.28 + Math.random() * 0.45,
  alt: idx % 3 === 0,
}));

export function renderKineticPrismScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    time,
    smoothBass,
    smoothMid,
    smoothTreble,
    smoothVocal,
    motionScale,
    dtNorm,
    activeAccentPrimary,
    activeAccentSecondary,
    isClimax,
    livePaceFactor,
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const pace = Math.max(0.4, Number(livePaceFactor) || 1.0);
  const speedRate = Math.max(0.4, (1.0 + smoothBass * 2.2 + smoothTreble * 1.5) * pace * (motionScale || 0.35) * dtNorm);
  const cx = width * 0.5;
  const cy = height * 0.52;

  // 1a. Diagonal Laser Speed Streaks
  for (let i = 0; i < STREAK_COUNT; i++) {
    const s = streakPool[i];
    s.x += s.speed * speedRate * 1.4;
    s.y -= s.speed * 0.42 * speedRate;
    if (s.x > width + s.len) {
      s.x = -s.len;
      s.y = Math.random() * height;
    }
    if (s.y < -50) {
      s.y = height + 40;
    }

    const strokeColor = s.alt ? (activeAccentSecondary || '#E6B86A') : activeAccentPrimary;
    const streakAlpha = Math.min(0.65, s.alpha * (0.85 + smoothTreble * 0.75 + (isClimax ? 0.3 : 0)));
    ctx.strokeStyle = hexToRgba(strokeColor, streakAlpha);
    ctx.lineWidth = s.thickness * (1 + smoothBass * 0.4);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.len, s.y + s.len * 0.32);
    ctx.stroke();
  }

  // 1b. Beat Pulse Geometric Chevrons / Frames (3 depth tiers)
  const pulseScale = 1.0 + (smoothBass * 0.35 + smoothMid * 0.2) * motionScale;
  const frameR = Math.min(width, height) * 0.32 * pulseScale;

  for (let tier = 0; tier < 3; tier++) {
    const tierScale = 0.55 + tier * 0.35;
    const r = frameR * tierScale;
    const tierAlpha = (0.22 - tier * 0.05) + smoothBass * 0.2;
    ctx.lineWidth = (1.6 - tier * 0.3) + smoothBass * 1.5;
    ctx.strokeStyle = hexToRgba(activeAccentPrimary, Math.max(0.04, tierAlpha));
    ctx.strokeRect(cx - r * 0.8, cy - r * 0.55, r * 1.6, r * 1.1);

    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.75);
    ctx.lineTo(cx + r * 0.95, cy);
    ctx.lineTo(cx, cy + r * 0.75);
    ctx.lineTo(cx - r * 0.95, cy);
    ctx.closePath();
    ctx.strokeStyle = hexToRgba(activeAccentSecondary || SOFT_IVORY, Math.max(0.04, (0.16 - tier * 0.04) + smoothVocal * 0.2));
    ctx.stroke();
  }

  // 1c. Dynamic Prismatic Corner / Center Glints
  const glintPulse = Math.sin(time * 2.8) * 0.15 + smoothVocal * 0.35;
  if (glintPulse > 0.06) {
    const glintSize = 14 + glintPulse * 26;
    ctx.fillStyle = hexToRgba(SOFT_IVORY, Math.min(0.7, 0.25 + glintPulse * 0.55));
    ctx.beginPath();
    ctx.moveTo(cx, cy - glintSize);
    ctx.lineTo(cx + glintSize * 0.3, cy);
    ctx.lineTo(cx, cy + glintSize);
    ctx.lineTo(cx - glintSize * 0.3, cy);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
