/**
 * editorialSilkScene.js - Editorial Silk (Orchestral, Dramatic Ballad, & Default Clean Mode)
 * Fluid Silk Aurora + Subtle Volumetric God-Rays + Delicate Orbital Rings + Eye-Comfort Stardust
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */

export function renderEditorialSilkScene(ctx, width, height, params) {
  if (!ctx || width <= 0 || height <= 0) return;
  const {
    smoothBass,
    smoothMid,
    smoothTreble,
    smoothVocal,
    motionScale,
    dtNorm,
    renderVolumetricGodRays,
    renderStardust,
    render3DOrbitalRings,
    renderBreathingHalo,
    renderSilkAurora,
    renderAnamorphicCinemaFlare,
    renderDepthBokeh,
    extraReactiveEffects = false,
  } = params;

  // Calm, serene volumetric god-rays (strictly capped <= 0.08 opacity for reading comfort)
  if (typeof renderVolumetricGodRays === 'function') {
    renderVolumetricGodRays(smoothVocal * 0.45, motionScale * 0.65, dtNorm);
  }

  // Gentle, tranquil stardust drift
  if (typeof renderStardust === 'function') {
    renderStardust(motionScale * 0.7, dtNorm);
  }

  // Thin, elegant central orbital rings
  if (typeof render3DOrbitalRings === 'function') {
    render3DOrbitalRings(smoothBass * 0.6, smoothVocal * 0.6, motionScale * 0.75, dtNorm);
  }

  // Soft breathing central glow
  if (typeof renderBreathingHalo === 'function') {
    renderBreathingHalo(smoothBass * 0.5, smoothVocal * 0.5);
  }

  // Ethereal 3-layer fluid silk aurora
  if (typeof renderSilkAurora === 'function') {
    renderSilkAurora(smoothBass * 0.75, smoothMid * 0.75, smoothTreble * 0.75, smoothVocal * 0.75, motionScale * 0.8, dtNorm);
  }

  // Harsh anamorphic cinema flare only if user explicitly turned ON Extra Reactive Effects
  if (extraReactiveEffects && typeof renderAnamorphicCinemaFlare === 'function') {
    renderAnamorphicCinemaFlare(smoothBass, motionScale);
  }

  // Soft depth-of-field bokeh
  if (typeof renderDepthBokeh === 'function') {
    renderDepthBokeh(smoothBass * 0.6, smoothVocal * 0.6, motionScale * 0.65, dtNorm);
  }
}
