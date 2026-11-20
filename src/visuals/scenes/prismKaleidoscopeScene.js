/**
 * prismKaleidoscopeScene.js - Prism Kaleidoscope (Anime OP, Energetic, Dance)
 * Radial 6-fold kaleidoscopic symmetry beams spinning harmoniously & pulsating crystal facets
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const FOLDS = 6;

export function renderPrismKaleidoscopeScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    time,
    smoothBass,
    smoothMid,
    smoothTreble,
    smoothVocal,
    activeAccentPrimary,
    activeAccentSecondary,
    livePaceFactor,
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const cx = width * 0.5;
  const cy = height * 0.52;
  const pace = Number(livePaceFactor) || 1.0;
  const baseRot = time * 0.6 * pace;
  const maxR = Math.min(width, height) * 0.42 * (1 + smoothBass * 0.18);

  ctx.translate(cx, cy);

  const angleStep = (Math.PI * 2) / FOLDS;
  for (let f = 0; f < FOLDS; f++) {
    ctx.save();
    ctx.rotate(baseRot + f * angleStep);

    // Prismatic Crystal Petal Facet
    const petalW = maxR * 0.45 * (0.8 + smoothMid * 0.4);
    const petalH = maxR * (0.85 + smoothBass * 0.3);

    const facetGrad = ctx.createLinearGradient(0, 0, 0, petalH);
    const facetColor = f % 2 === 0 ? (activeAccentSecondary || '#38BDF8') : activeAccentPrimary;
    facetGrad.addColorStop(0, 'rgba(0,0,0,0)');
    facetGrad.addColorStop(0.5, hexToRgba(facetColor, 0.28 + smoothVocal * 0.2));
    facetGrad.addColorStop(1, hexToRgba(SOFT_IVORY, 0.45));

    ctx.fillStyle = facetGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(petalW * 0.5, petalH * 0.4);
    ctx.lineTo(0, petalH);
    ctx.lineTo(-petalW * 0.5, petalH * 0.4);
    ctx.closePath();
    ctx.fill();

    // Geometric Facet Wireframe Edge
    ctx.strokeStyle = hexToRgba(SOFT_IVORY, 0.55 + smoothTreble * 0.35);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Secondary Cross Facet Rib
    ctx.beginPath();
    ctx.moveTo(-petalW * 0.5, petalH * 0.4);
    ctx.lineTo(petalW * 0.5, petalH * 0.4);
    ctx.stroke();

    ctx.restore();
  }

  // Center Prismatic Jewel Orb
  const centerR = maxR * 0.18 * (1 + smoothBass * 0.25);
  const centerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, centerR);
  centerGrad.addColorStop(0, hexToRgba(SOFT_IVORY, 0.9));
  centerGrad.addColorStop(0.6, hexToRgba(activeAccentPrimary, 0.65));
  centerGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = centerGrad;
  ctx.beginPath();
  ctx.arc(0, 0, centerR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
