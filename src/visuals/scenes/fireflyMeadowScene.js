/**
 * fireflyMeadowScene.js - Firefly Meadow (Indie Folk, Acoustic, Nature)
 * Bioluminescent warm pulsing fireflies drifting organically over gentle night mist
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const FIREFLY_COUNT = 34;
const fireflyPool = Array.from({ length: FIREFLY_COUNT }, () => ({
  x: Math.random() * 1920,
  y: Math.random() * 1080,
  vx: (Math.random() - 0.5) * 0.45,
  vy: (Math.random() - 0.5) * 0.45,
  r: 2.2 + Math.random() * 2.8,
  glowR: 16 + Math.random() * 26,
  blinkSpeed: 1.2 + Math.random() * 1.8,
  phase: Math.random() * Math.PI * 2,
  swayFreq: 0.6 + Math.random() * 0.8,
}));

export function renderFireflyMeadowScene(ctx, width, height, params) {
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

  // 12a. Low-Lying Meadow Mist along bottom
  const mistY = height * 0.78;
  const mistGrad = ctx.createLinearGradient(0, mistY - 60, 0, height);
  mistGrad.addColorStop(0, 'rgba(0,0,0,0)');
  mistGrad.addColorStop(0.5, hexToRgba(activeAccentPrimary, 0.12 + smoothMid * 0.08));
  mistGrad.addColorStop(1, hexToRgba(activeAccentSecondary || '#84CC16', 0.2));
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, mistY - 60, width, height - mistY + 60);

  // 12b. Bioluminescent Wandering Fireflies
  const moveMult = Math.max(0.2, (motionScale || 0.3) * dtNorm);

  for (let i = 0; i < FIREFLY_COUNT; i++) {
    const f = fireflyPool[i];
    f.x += (f.vx + Math.sin(time * f.swayFreq + f.phase) * 0.6) * moveMult;
    f.y += (f.vy + Math.cos(time * f.swayFreq * 0.8 + f.phase) * 0.5) * moveMult;

    if (f.x < -30) f.x = width + 30;
    if (f.x > width + 30) f.x = -30;
    if (f.y < -30) f.y = height + 30;
    if (f.y > height + 30) f.y = -30;

    const blink = Math.sin(time * f.blinkSpeed + f.phase);
    if (blink < -0.2) continue; // Firefly lamp is turned off during down-phase

    const lightNorm = Math.max(0, (blink + 0.2) / 1.2);
    const alpha = lightNorm * (0.45 + smoothVocal * 0.45);
    const currentGlowR = f.glowR * (0.8 + lightNorm * 0.4 + smoothVocal * 0.25);

    // Warm green/gold firefly light gradient
    const fireflyColor = i % 2 === 0 ? '#BEF264' : (activeAccentSecondary || '#FDE047');
    const haloGrad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, currentGlowR);
    haloGrad.addColorStop(0, hexToRgba(fireflyColor, alpha));
    haloGrad.addColorStop(0.35, hexToRgba(fireflyColor, alpha * 0.4));
    haloGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(f.x, f.y, currentGlowR, 0, Math.PI * 2);
    ctx.fill();

    // Hot Ivory Center Core
    ctx.fillStyle = hexToRgba(SOFT_IVORY, Math.min(1.0, alpha * 1.5));
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * (0.8 + lightNorm * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
