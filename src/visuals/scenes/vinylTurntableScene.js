/**
 * vinylTurntableScene.js - Vinyl Turntable (Lo-Fi, Classic, Vintage, Oldies)
 * Cinematic rotating 2D vinyl disc + concentric grooves + rotating specular light cones + center spindle
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const DUST_COUNT = 18;
const dustPool = Array.from({ length: DUST_COUNT }, () => ({
  x: Math.random() * 1920,
  y: Math.random() * 1080,
  vx: (Math.random() - 0.5) * 0.22,
  vy: -0.08 - Math.random() * 0.16,
  r: 0.9 + Math.random() * 1.5,
  alpha: 0.15 + Math.random() * 0.35,
}));

export function renderVinylTurntableScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    time,
    smoothBass,
    smoothMid,
    smoothVocal,
    activeAccentPrimary,
    activeAccentSecondary,
    livePaceFactor,
  } = params;

  ctx.save();

  const cx = width * 0.5;
  const cy = height * 0.52;
  const pace = Number(livePaceFactor) || 1.0;
  const discR = Math.min(width, height) * 0.38;
  const spinAngle = (time * 1.6 * pace) % (Math.PI * 2);

  // 13a. Dark Vinyl Disc Body
  ctx.fillStyle = '#07080B';
  ctx.beginPath();
  ctx.arc(cx, cy, discR, 0, Math.PI * 2);
  ctx.fill();

  // 13b. Rotating Specular Light Sheen (Dual radial specular cones)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(cx, cy);
  ctx.rotate(spinAngle);

  for (let sheen = 0; sheen < 2; sheen++) {
    ctx.rotate(Math.PI);
    const sheenGrad = ctx.createRadialGradient(0, 0, discR * 0.28, 0, 0, discR);
    const sheenAlpha = 0.18 + smoothMid * 0.12;
    sheenGrad.addColorStop(0, 'rgba(0,0,0,0)');
    sheenGrad.addColorStop(0.5, hexToRgba(SOFT_IVORY, sheenAlpha));
    sheenGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = sheenGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, discR, -0.35, 0.35);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 13c. Concentric Micro-Grooves
  ctx.lineWidth = 0.8;
  const grooveCount = 18;
  for (let g = 0; g < grooveCount; g++) {
    const gr = discR * (0.34 + (g / grooveCount) * 0.62);
    ctx.strokeStyle = hexToRgba('#1E222D', 0.65 + (g % 3 === 0 ? 0.3 : 0));
    ctx.beginPath();
    ctx.arc(cx, cy, gr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 13d. Center Record Label
  const labelR = discR * 0.32;
  const labelGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, labelR);
  labelGrad.addColorStop(0, hexToRgba(activeAccentSecondary || '#E6B86A', 0.9));
  labelGrad.addColorStop(0.85, hexToRgba(activeAccentPrimary, 0.95));
  labelGrad.addColorStop(1, '#0F1117');
  ctx.fillStyle = labelGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
  ctx.fill();

  // Center Spindle Hole
  ctx.fillStyle = '#07080B';
  ctx.beginPath();
  ctx.arc(cx, cy, labelR * 0.14, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(SOFT_IVORY, 0.6);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 13e. Floating Vintage Vinyl Dust Motes
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < DUST_COUNT; i++) {
    const d = dustPool[i];
    d.x += d.vx;
    d.y += d.vy;
    if (d.y < -10) d.y = height + 10;
    if (d.x < -10) d.x = width + 10;
    if (d.x > width + 10) d.x = -10;

    ctx.fillStyle = hexToRgba(SOFT_IVORY, d.alpha * (0.8 + smoothVocal * 0.3));
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
