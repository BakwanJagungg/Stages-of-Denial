/**
 * common.js - Zero-GC Math & Color Helpers for 2D Cinematic Scenes
 * Stages of Denial (v16.0 Modular Architecture)
 */

export const SOFT_IVORY = '#F2EFE9';
export const CHARCOAL_DEPTH = '#0B0C10';

export function parseHexRgb(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return [214, 90, 112];
  }
  const clean = hex.slice(1);
  const full =
    clean.length === 3 ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2] : clean;
  return [
    parseInt(full.slice(0, 2), 16) || 214,
    parseInt(full.slice(2, 4), 16) || 90,
    parseInt(full.slice(4, 6), 16) || 112,
  ];
}

/** @param {string} hex @param {number} [alpha=1] */
export function hexToRgba(hex, alpha = 1) {
  const [r, g, b] = parseHexRgb(hex);
  const a = Math.max(0, Math.min(1, Number(alpha) || 0));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Blend two hex colors smoothly without allocating new strings unnecessarily. */
export function lerpColorRgba(hexA, hexB, mixRatio, alpha = 1) {
  const [r1, g1, b1] = parseHexRgb(hexA);
  const [r2, g2, b2] = parseHexRgb(hexB);
  const t = Math.max(0, Math.min(1, mixRatio));
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  const a = Math.max(0, Math.min(1, Number(alpha) || 0));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
