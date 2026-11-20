/**
 * auroraCurtainScene.js - Aurora Curtain (Ambient, Ballad)
 * Vertical shimmering drapery of northern lights dancing in night sky
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const CURTAIN_COLUMNS = 14;
const columnPool = Array.from({ length: CURTAIN_COLUMNS }, (_, idx) => ({
  phaseOffset: (idx / CURTAIN_COLUMNS) * Math.PI * 2,
  widthRatio: 0.12 + Math.random() * 0.08,
  freq: 0.8 + Math.random() * 0.7,
  speed: 0.7 + Math.random() * 0.6,
  alphaBase: 0.12 + Math.random() * 0.16,
}));

const STAR_COUNT = 32;
const starPool = Array.from({ length: STAR_COUNT }, () => ({
  x: Math.random() * 1920,
  y: Math.random() * 600,
  r: 0.8 + Math.random() * 1.6,
  phase: Math.random() * Math.PI * 2,
}));

export function renderAuroraCurtainScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    time,
    smoothMid,
    smoothTreble,
    smoothVocal,
    motionScale,
    dtNorm,
    activeAccentPrimary,
    activeAccentSecondary,
    activeAccentCold,
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // Upper sky stardust glimmers
  for (let i = 0; i < STAR_COUNT; i++) {
    const s = starPool[i];
    const twinkle = 0.2 + Math.sin(time * 1.5 + s.phase) * 0.18 + smoothTreble * 0.25;
    ctx.fillStyle = hexToRgba(SOFT_IVORY, Math.max(0, twinkle));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vertical shimmering aurora curtain columns
  const curtainBaseY = height * 0.68;
  const colStep = width / (CURTAIN_COLUMNS - 1);

  for (let i = 0; i < CURTAIN_COLUMNS; i++) {
    const col = columnPool[i];
    const baseX = i * colStep;
    const wave = Math.sin(time * col.speed + col.phaseOffset) * 45;
    const x = baseX + wave;
    const colW = width * col.widthRatio * (1 + smoothMid * 0.3);
    const colH = curtainBaseY + Math.sin(time * 1.1 + col.phaseOffset * 2) * 35;

    const curtainGrad = ctx.createLinearGradient(x, 0, x, colH);
    const alpha = (col.alphaBase + smoothVocal * 0.14 + smoothMid * 0.1) * (motionScale || 1.0);
    const colColor = i % 2 === 0
      ? (activeAccentCold || '#38BDF8')
      : (activeAccentSecondary || activeAccentPrimary);

    curtainGrad.addColorStop(0, 'rgba(0,0,0,0)');
    curtainGrad.addColorStop(0.2, hexToRgba(colColor, alpha * 0.5));
    curtainGrad.addColorStop(0.65, hexToRgba(colColor, alpha));
    curtainGrad.addColorStop(0.9, hexToRgba(activeAccentPrimary, alpha * 0.6));
    curtainGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = curtainGrad;
    ctx.beginPath();
    ctx.moveTo(x - colW * 0.5, 0);
    ctx.lineTo(x + colW * 0.5, 0);
    ctx.lineTo(x + colW * 0.35 + wave * 0.4, colH);
    ctx.lineTo(x - colW * 0.35 + wave * 0.4, colH);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
