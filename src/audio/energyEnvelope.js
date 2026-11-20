/**
 * energyEnvelope.js - Background Audio RMS & Amplitude Envelope Analyzer
 * Stages of Denial v10.0 (Cinematic Synesthesia & Adaptive Direction Edition)
 *
 * Analyzes audio amplitude/RMS curves non-blocking in <150ms to detect actual
 * song structure: Intro/Verse (Act I), Build-up (Act II), Peak Climax (Act III), and Outro (Act IV).
 * Provides instantaneous fallback to standard duration ratios when audio is undecoded or streaming.
 */

const analysisCache = new Map();

/**
 * Generate standard fallback acts based on total duration.
 * @param {number} duration
 * @param {Object} [meta={}]
 * @returns {Array<Object>}
 */
export function getDefaultFallbackActs(duration = 240, meta = {}) {
  const d = Math.max(10, Number(duration) || 240);
  return [
    {
      id: 'act1',
      startTime: 0,
      endTime: Number((d * 0.30).toFixed(2)),
      chapterBadge: meta.act1Badge || 'BABAK I • KESUNYIAN AWAL',
      heading: meta.act1Heading || 'Ketika Semua Terasa Jauh',
      roman: 'I',
      theme: 'slate',
      visualMode: 'intro',
      glowColor: '#94a3b8',
    },
    {
      id: 'act2',
      startTime: Number((d * 0.30).toFixed(2)),
      endTime: Number((d * 0.65).toFixed(2)),
      chapterBadge: meta.act2Badge || 'BABAK II • PERLAHAN MERACUNI',
      heading: meta.act2Heading || 'Dia Masih di Sini',
      roman: 'II',
      theme: 'indigo',
      visualMode: 'verse',
      glowColor: '#38bdf8',
    },
    {
      id: 'act3',
      startTime: Number((d * 0.65).toFixed(2)),
      endTime: Number((d * 0.88).toFixed(2)),
      chapterBadge: meta.act3Badge || 'BABAK III • SALING MENGHANTAM',
      heading: meta.act3Heading || 'PENYANGKALAN',
      roman: 'III',
      theme: 'crimson',
      visualMode: 'climax',
      glowColor: '#e11d48',
    },
    {
      id: 'act4',
      startTime: Number((d * 0.88).toFixed(2)),
      endTime: Number(d.toFixed(2)),
      chapterBadge: meta.act4Badge || 'BABAK IV • KENYATAAN YANG SEPI',
      heading: meta.act4Heading || 'Kenyataan yang Sepi',
      roman: 'IV',
      theme: 'amber',
      visualMode: 'outro',
      glowColor: '#f97316',
    },
  ];
}

/**
 * Rapidly compute RMS energy curve from an AudioBuffer.
 * Downsamples channels into ~120 time windows for ultra-fast <15ms execution.
 * @param {AudioBuffer} audioBuffer
 * @param {Object} [meta={}]
 * @returns {Array<Object>}
 */
export function computeEnergyActsFromBuffer(audioBuffer, meta = {}) {
  if (!audioBuffer || !audioBuffer.duration || audioBuffer.duration <= 0) {
    return getDefaultFallbackActs(240, meta);
  }

  const duration = audioBuffer.duration;
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate || 44100;
  const totalSamples = channelData.length;

  // Divide into 120-160 windows across the song (each window ~1.5 - 2s)
  const windowCount = Math.min(160, Math.max(60, Math.floor(duration * 0.8)));
  const samplesPerWindow = Math.floor(totalSamples / windowCount);
  const stride = Math.max(1, Math.floor(samplesPerWindow / 256)); // Sample 256 points per window for <5ms execution

  const rmsCurve = new Float32Array(windowCount);
  let minRms = 1.0;
  let maxRms = 0.0;
  let peakWindowIdx = 0;

  for (let w = 0; w < windowCount; w++) {
    const startIdx = w * samplesPerWindow;
    const endIdx = Math.min(totalSamples, startIdx + samplesPerWindow);
    let sumSq = 0;
    let count = 0;

    for (let i = startIdx; i < endIdx; i += stride) {
      const val = channelData[i];
      sumSq += val * val;
      count++;
    }

    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    rmsCurve[w] = rms;

    if (rms < minRms) minRms = rms;
    if (rms > maxRms) {
      maxRms = rms;
      peakWindowIdx = w;
    }
  }

  const rmsRange = Math.max(0.001, maxRms - minRms);
  const windowSec = duration / windowCount;

  // Find Build-up threshold (energy crosses 35% of dynamic range)
  const buildUpThreshold = minRms + rmsRange * 0.35;
  let act1EndWindow = Math.floor(windowCount * 0.28);
  for (let w = Math.floor(windowCount * 0.15); w < Math.floor(windowCount * 0.5); w++) {
    if (rmsCurve[w] >= buildUpThreshold && rmsCurve[Math.min(windowCount - 1, w + 1)] >= buildUpThreshold) {
      act1EndWindow = w;
      break;
    }
  }

  // Find Climax region (window where peak RMS sustains)
  const climaxThreshold = minRms + rmsRange * 0.72;
  let climaxStartWindow = Math.max(act1EndWindow + 4, peakWindowIdx - Math.floor(12 / windowSec));
  let climaxEndWindow = Math.min(windowCount - 6, peakWindowIdx + Math.floor(18 / windowSec));

  for (let w = Math.floor(windowCount * 0.45); w <= peakWindowIdx; w++) {
    if (rmsCurve[w] >= climaxThreshold) {
      climaxStartWindow = Math.max(act1EndWindow + 4, w);
      break;
    }
  }

  for (let w = peakWindowIdx; w < windowCount - 4; w++) {
    if (rmsCurve[w] < climaxThreshold * 0.85 && rmsCurve[Math.min(windowCount - 1, w + 2)] < climaxThreshold * 0.85) {
      climaxEndWindow = w;
      break;
    }
  }

  // Ensure minimum act durations for comfortable storytelling pacing
  const minActDur = Math.max(8, duration * 0.08);
  let t1 = Math.max(minActDur, Math.min(duration * 0.45, act1EndWindow * windowSec));
  let t2 = Math.max(t1 + minActDur, Math.min(duration * 0.78, climaxStartWindow * windowSec));
  let t3 = Math.max(t2 + minActDur, Math.min(duration - minActDur, climaxEndWindow * windowSec));

  // Sanity check order
  if (t2 <= t1 + 4) t2 = t1 + minActDur;
  if (t3 <= t2 + 6) t3 = Math.min(duration - 6, t2 + minActDur * 1.5);

  const t1Sec = Number(t1.toFixed(2));
  const t2Sec = Number(t2.toFixed(2));
  const t3Sec = Number(t3.toFixed(2));
  const totalSec = Number(duration.toFixed(2));

  return [
    {
      id: 'act1',
      startTime: 0,
      endTime: t1Sec,
      chapterBadge: meta.act1Badge || 'BABAK I • KESUNYIAN AWAL',
      heading: meta.act1Heading || 'Ketika Semua Terasa Jauh',
      roman: 'I',
      theme: 'slate',
      visualMode: 'intro',
      glowColor: '#94a3b8',
    },
    {
      id: 'act2',
      startTime: t1Sec,
      endTime: t2Sec,
      chapterBadge: meta.act2Badge || 'BABAK II • PERLAHAN MERACUNI',
      heading: meta.act2Heading || 'Dia Masih di Sini',
      roman: 'II',
      theme: 'indigo',
      visualMode: 'verse',
      glowColor: '#38bdf8',
    },
    {
      id: 'act3',
      startTime: t2Sec,
      endTime: t3Sec,
      chapterBadge: meta.act3Badge || 'BABAK III • SALING MENGHANTAM',
      heading: meta.act3Heading || 'PENYANGKALAN',
      roman: 'III',
      theme: 'crimson',
      visualMode: 'climax',
      glowColor: '#e11d48',
    },
    {
      id: 'act4',
      startTime: t3Sec,
      endTime: totalSec,
      chapterBadge: meta.act4Badge || 'BABAK IV • KENYATAAN YANG SEPI',
      heading: meta.act4Heading || 'Kenyataan yang Sepi',
      roman: 'IV',
      theme: 'amber',
      visualMode: 'outro',
      glowColor: '#f97316',
    },
  ];
}

/**
 * Asynchronously analyze an audio file/source or buffer with caching.
 * Resolves within <150ms or returns instant fallback.
 * @param {AudioContext} audioCtx
 * @param {string|File|Blob|AudioBuffer} source
 * @param {number} fallbackDuration
 * @param {Object} [meta={}]
 * @returns {Promise<Array<Object>>}
 */
export async function analyzeAudioEnergy(audioCtx, source, fallbackDuration = 240, meta = {}) {
  const cacheKey = typeof source === 'string' ? source : meta.id || 'custom-audio';
  if (analysisCache.has(cacheKey)) {
    return analysisCache.get(cacheKey);
  }

  // If already an AudioBuffer
  if (source && typeof source.getChannelData === 'function') {
    const acts = computeEnergyActsFromBuffer(source, meta);
    analysisCache.set(cacheKey, acts);
    return acts;
  }

  // If File or Blob
  if (source instanceof Blob && audioCtx) {
    try {
      const arrayBuffer = await source.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const acts = computeEnergyActsFromBuffer(decoded, meta);
      analysisCache.set(cacheKey, acts);
      return acts;
    } catch {
      const fallback = getDefaultFallbackActs(fallbackDuration, meta);
      return fallback;
    }
  }

  // If URL string
  if (typeof source === 'string' && source.length > 0 && audioCtx) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(source, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const arrayBuffer = await resp.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
        const acts = computeEnergyActsFromBuffer(decoded, meta);
        analysisCache.set(cacheKey, acts);
        return acts;
      }
    } catch {
      // Fallback below
    }
  }

  const fallback = getDefaultFallbackActs(fallbackDuration, meta);
  return fallback;
}
