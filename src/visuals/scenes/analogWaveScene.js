/**
 * analogWaveScene.js - Analog Wave (Retro Pop, Soul, Lo-Fi, Jazz)
 * Dual oscilloscope analog waveform + warm film halation + slow floating projector motes
 * Zero-allocation per frame (60-144 FPS dt-normalized)
 */
import { hexToRgba, SOFT_IVORY } from './common.js';

const MOTE_COUNT = 24;
const motePool = Array.from({ length: MOTE_COUNT }, () => ({
  x: Math.random() * 1920,
  y: Math.random() * 1080,
  vx: (Math.random() - 0.5) * 0.32,
  vy: -0.15 - Math.random() * 0.35,
  size: 1.2 + Math.random() * 2.2,
  alpha: 0.18 + Math.random() * 0.35,
  pulse: Math.random() * Math.PI * 2,
}));

const TIME_DOMAIN_SIZE = 128;
const timeDomainBuffer = new Uint8Array(TIME_DOMAIN_SIZE);

export function renderAnalogWaveScene(ctx, width, height, params) {
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
    getAnalyserNode,
  } = params;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const cy = height * 0.52;
  const steps = 64;
  const dx = width / steps;

  const analyser = typeof getAnalyserNode === 'function' ? getAnalyserNode() : null;
  if (analyser) {
    try {
      analyser.getByteTimeDomainData(timeDomainBuffer);
    } catch {}
  }

  // 5a. Dual Oscilloscope Glowing Waveform
  const amp1 = 28 + smoothBass * 55 + smoothVocal * 42;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const x = i * dx;
    const sampleIdx = Math.floor(ratio * (TIME_DOMAIN_SIZE - 1));
    const rawVal = analyser ? (timeDomainBuffer[sampleIdx] - 128) / 128 : 0;
    const synthVal = Math.sin(ratio * Math.PI * 4 + time * 1.8) * 0.6 + Math.sin(ratio * Math.PI * 8 - time * 2.4) * 0.4;
    const waveY = cy + (rawVal * 0.75 + synthVal * 0.25) * amp1 * Math.sin(ratio * Math.PI);
    if (i === 0) ctx.moveTo(x, waveY);
    else ctx.lineTo(x, waveY);
  }
  ctx.lineWidth = 4.2;
  ctx.strokeStyle = hexToRgba(activeAccentPrimary, 0.25 + smoothVocal * 0.2);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = hexToRgba(SOFT_IVORY, 0.75);
  ctx.stroke();

  // Beam 2: Secondary harmonic curve offset by phase
  const amp2 = 18 + smoothMid * 40 + smoothTreble * 30;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const x = i * dx;
    const synthVal2 = Math.cos(ratio * Math.PI * 5 + time * 1.4 + 1.2) * 0.7 + Math.sin(ratio * Math.PI * 10 - time * 1.6) * 0.3;
    const waveY2 = cy + synthVal2 * amp2 * Math.sin(ratio * Math.PI);
    if (i === 0) ctx.moveTo(x, waveY2);
    else ctx.lineTo(x, waveY2);
  }
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = hexToRgba(activeAccentSecondary || '#E6B86A', 0.22 + smoothMid * 0.18);
  ctx.stroke();

  // 5b. Warm Film Halation diffusion glow along center axis
  const halationGrad = ctx.createLinearGradient(0, cy - 40, 0, cy + 40);
  halationGrad.addColorStop(0, 'rgba(0,0,0,0)');
  halationGrad.addColorStop(0.5, hexToRgba(activeAccentSecondary || '#E6B86A', 0.08 + smoothBass * 0.06));
  halationGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halationGrad;
  ctx.fillRect(0, cy - 40, width, 80);

  // 5c. Slow Floating Projector Motes
  const moteSpeed = Math.max(0.18, (motionScale || 0.25) * dtNorm);
  for (let i = 0; i < MOTE_COUNT; i++) {
    const m = motePool[i];
    m.x += m.vx * moteSpeed;
    m.y += m.vy * moteSpeed;
    if (m.y < -10) m.y = height + 10;
    if (m.x < -10) m.x = width + 10;
    if (m.x > width + 10) m.x = -10;

    const moteAlpha = m.alpha * (0.7 + Math.sin(time * 0.8 + m.pulse) * 0.3);
    ctx.fillStyle = hexToRgba(SOFT_IVORY, moteAlpha);
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5d. CRT phosphor scanline hint
  ctx.fillStyle = 'rgba(0, 0, 0, 0.025)';
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1);
  }

  ctx.restore();
}
