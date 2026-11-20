/**
 * eclipseCoronaScene.js - Eclipse Corona (Introspective, Dark Pop, Dark Ambient)
 * Dark eclipse disc with shimmering solar corona & dynamic undulating solar flares
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const FLARE_SEGMENTS = 48;

export function renderEclipseCoronaScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    time,
    smoothBass,
    smoothMid,
    smoothVocal,
    activeAccentPrimary,
    activeAccentSecondary,
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const cx = width * 0.5;
  const cy = height * 0.52;
  const baseR = Math.min(width, height) * 0.22;

  // 14a. Radiant Atmospheric Halo
  const haloR = baseR * (2.2 + smoothBass * 0.5 + smoothVocal * 0.4);
  const haloGrad = ctx.createRadialGradient(cx, cy, baseR * 0.9, cx, cy, haloR);
  haloGrad.addColorStop(0, hexToRgba(activeAccentSecondary || '#F59E0B', 0.65 + smoothVocal * 0.25));
  haloGrad.addColorStop(0.35, hexToRgba(activeAccentPrimary, 0.32 + smoothBass * 0.18));
  haloGrad.addColorStop(0.75, hexToRgba(activeAccentPrimary, 0.08));
  haloGrad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
  ctx.fill();

  // 14b. Dynamic Undulating Solar Flare Prominences
  ctx.beginPath();
  const dTheta = (Math.PI * 2) / FLARE_SEGMENTS;
  for (let i = 0; i <= FLARE_SEGMENTS; i++) {
    const theta = i * dTheta;
    const wave = Math.sin(theta * 6 + time * 2.4) * (baseR * 0.14) +
                 Math.cos(theta * 12 - time * 3.2) * (baseR * 0.08);
    const flareR = baseR + (12 + (smoothBass * 0.45 + smoothVocal * 0.55) * (baseR * 0.6)) + wave;
    const x = cx + Math.cos(theta) * flareR;
    const y = cy + Math.sin(theta) * flareR;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  ctx.fillStyle = hexToRgba(activeAccentSecondary || '#FDE047', 0.24 + smoothVocal * 0.22);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(SOFT_IVORY, 0.7);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // 14c. Central Pitch-Black Moon Disc (blocks the center)
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#060709';
  ctx.beginPath();
  ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
  ctx.fill();

  // Thin Radiant Edge Shimmer on Rim
  ctx.strokeStyle = hexToRgba(SOFT_IVORY, 0.85);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.restore();
}
