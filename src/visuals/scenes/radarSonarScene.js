/**
 * radarSonarScene.js - Radar Sonar (Minimalist, Experimental, Deep Ambient)
 * Concentric expanding sonar pulse rings + smooth 360-deg radar sweep line & phosphor blips
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const PING_COUNT = 4;
const pingPool = Array.from({ length: PING_COUNT }, (_, idx) => ({
  r: (idx / PING_COUNT) * 420,
  speed: 1.8 + Math.random() * 0.8,
  maxR: 450,
}));

const BLIP_COUNT = 8;
const blipPool = Array.from({ length: BLIP_COUNT }, () => ({
  distNorm: 0.25 + Math.random() * 0.65,
  angle: Math.random() * Math.PI * 2,
  size: 2.2 + Math.random() * 2.5,
  glow: 0,
}));

export function renderRadarSonarScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    time,
    smoothBass,
    smoothMid,
    smoothTreble,
    motionScale,
    dtNorm,
    activeAccentPrimary,
    activeAccentSecondary,
    livePaceFactor,
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const cx = width * 0.5;
  const cy = height * 0.52;
  const maxRadarR = Math.min(width, height) * 0.44;
  const pace = Number(livePaceFactor) || 1.0;
  const sweepAngle = (time * 1.8 * pace) % (Math.PI * 2);

  // 17a. Concentric Static Grid Rings & Crosshair Axis
  ctx.strokeStyle = hexToRgba(activeAccentPrimary, 0.12);
  ctx.lineWidth = 1.0;
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (ring / 4) * maxRadarR, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crosshair
  ctx.beginPath();
  ctx.moveTo(cx - maxRadarR, cy);
  ctx.lineTo(cx + maxRadarR, cy);
  ctx.moveTo(cx, cy - maxRadarR);
  ctx.lineTo(cx, cy + maxRadarR);
  ctx.stroke();

  // 17b. Expanding Dynamic Sonar Ping Rings
  const pingSpeedMult = (1 + smoothBass * 0.8) * (motionScale || 0.35) * dtNorm;
  for (let i = 0; i < PING_COUNT; i++) {
    const ping = pingPool[i];
    ping.r += ping.speed * pingSpeedMult * 2.2;
    if (ping.r > maxRadarR) {
      ping.r = 10;
    }
    const prog = ping.r / maxRadarR;
    const alpha = (1 - prog) * (0.28 + smoothBass * 0.35);

    ctx.strokeStyle = hexToRgba(activeAccentSecondary || '#22D3EE', alpha);
    ctx.lineWidth = 1.6 * (1 - prog * 0.5);
    ctx.beginPath();
    ctx.arc(cx, cy, ping.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 17c. Rotating Radar Sweep Beam with Phosphor Trail
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sweepAngle);

  const trailSteps = 16;
  const trailAngle = 0.55;
  for (let t = 0; t < trailSteps; t++) {
    const a = (t / trailSteps) * trailAngle;
    const alpha = (1 - t / trailSteps) * (0.24 + smoothMid * 0.18);
    ctx.fillStyle = hexToRgba(activeAccentSecondary || '#06B6D4', alpha * 0.3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, maxRadarR, -a, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Leading Sweep Line
  ctx.strokeStyle = hexToRgba(SOFT_IVORY, 0.85);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(maxRadarR, 0);
  ctx.stroke();
  ctx.restore();

  // 17d. Blip Targets
  for (let i = 0; i < BLIP_COUNT; i++) {
    const blip = blipPool[i];
    const bx = cx + Math.cos(blip.angle) * (blip.distNorm * maxRadarR);
    const by = cy + Math.sin(blip.angle) * (blip.distNorm * maxRadarR);

    // Calculate angle difference from sweep line
    let angleDiff = sweepAngle - blip.angle;
    while (angleDiff < 0) angleDiff += Math.PI * 2;
    while (angleDiff >= Math.PI * 2) angleDiff -= Math.PI * 2;

    if (angleDiff < 0.2) {
      blip.glow = 1.0;
    } else {
      blip.glow = Math.max(0, blip.glow - 0.02 * dtNorm);
    }

    if (blip.glow > 0.05) {
      ctx.fillStyle = hexToRgba(SOFT_IVORY, blip.glow * 0.9);
      ctx.beginPath();
      ctx.arc(bx, by, blip.size * (1 + blip.glow * 0.6), 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = hexToRgba(activeAccentSecondary || '#22D3EE', blip.glow * 0.5);
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(bx, by, (blip.size + 4) * (1 + blip.glow), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}
