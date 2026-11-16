/**
 * karaokeEngine.js - Lazy Lyrics Loader, LRC Parser, 50ms Word-Sweep Scheduler & Single-Line Mutex
 * Stages of Denial (v7.0 Modular Architecture)
 */

import { getAudioTime, isAudioPlaying, togglePlayPause } from '../audio/audioEngine.js';
import { triggerHighlightPulse } from '../visuals/canvasVisualizer.js';

const kineticStage = document.getElementById('kineticStage');
const subtitleTokenizerHost = document.createElement('div');

const RAPID_GAP_THRESHOLD_SEC = 0.35;
const SPACIOUS_GAP_THRESHOLD_SEC = 0.7;
const MIN_MUTEX_GAP_SEC = 0.08;
const MAX_PREROLL_LEAD_SEC = 0.45;
const STORY_HIDE_LEAD_SEC = 0.18;

const lyricsCache = new Map();
const lyricsInFlightCache = new Map();

let preloadedSubtitles = [];
let maxPreloadedWords = 24;
const lyricSlots = [];
let lyricPoolInitialized = false;
let lastVocalGlowStr = '';
let lastHighlightPulseKey = '';
let endingOutroActive = false;

const OFFSET_STORAGE_PREFIX = 'sod_lyric_offset_';
const TRANSLATION_STORAGE_KEY = 'sod_show_translation';

let seekHandler = null;
let signalChangeHandler = null;
let onPreloadCallback = null;
let onStoryDimHandler = null;
let offsetChangeHandler = null;
let currentLyricSignal = 'synced'; // 'synced' | 'auto-plain' | 'instrumental' | 'loading'
let activeOffsetTrackId = 'penyangkalan';
let lyricSyncOffsetSec = 0;
let showTranslationSubtitles = (() => {
  try {
    return localStorage.getItem(TRANSLATION_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
})();

function readStoredTrackOffset(trackId) {
  if (!trackId) return 0;
  try {
    const raw = localStorage.getItem(`${OFFSET_STORAGE_PREFIX}${trackId}`);
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(Math.max(-3, Math.min(3, parsed)) * 100) / 100;
  } catch {
    return 0;
  }
}

export function setLyricOffsetChangeCallback(fn) {
  offsetChangeHandler = fn;
}

export function getLyricSyncOffset() {
  return lyricSyncOffsetSec;
}

export function setLyricOffsetTrack(trackId) {
  activeOffsetTrackId = trackId || 'penyangkalan';
  lyricSyncOffsetSec = readStoredTrackOffset(activeOffsetTrackId);
  if (typeof offsetChangeHandler === 'function') offsetChangeHandler(lyricSyncOffsetSec, activeOffsetTrackId);
  return lyricSyncOffsetSec;
}

export function setLyricSyncOffset(seconds) {
  const clamped = Math.max(-3, Math.min(3, Number(seconds) || 0));
  lyricSyncOffsetSec = Math.round(clamped * 100) / 100;
  try {
    const key = `${OFFSET_STORAGE_PREFIX}${activeOffsetTrackId}`;
    if (lyricSyncOffsetSec === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, lyricSyncOffsetSec.toFixed(2));
  } catch {}
  if (typeof offsetChangeHandler === 'function') offsetChangeHandler(lyricSyncOffsetSec, activeOffsetTrackId);
  return lyricSyncOffsetSec;
}

export function adjustLyricSyncOffset(deltaSec) {
  return setLyricSyncOffset(lyricSyncOffsetSec + (Number(deltaSec) || 0));
}

export function isTranslationEnabled() {
  return showTranslationSubtitles;
}

export function setTranslationEnabled(enabled) {
  showTranslationSubtitles = Boolean(enabled);
  try {
    localStorage.setItem(TRANSLATION_STORAGE_KEY, showTranslationSubtitles ? 'true' : 'false');
  } catch {}
  const slot = lyricSlots[0];
  if (slot && slot.translationEl) {
    const sub = slot.subIndex >= 0 ? preloadedSubtitles[slot.subIndex] : null;
    slot.translationEl.hidden = !showTranslationSubtitles || !sub?.translation || Boolean(sub?.isInstrumental);
  }
  return showTranslationSubtitles;
}

/** Register callback invoked when user clicks an active karaoke word. */
export function setLyricSeekCallback(fn) {
  seekHandler = fn;
}

/** Register callback notified when active lyric mode changes ('synced' | 'instrumental' | 'loading'). */
export function setLyricSignalCallback(fn) {
  signalChangeHandler = fn;
}

/** Register callback invoked after subtitles are tokenized & preloaded (e.g. rebuild Lyric Drawer). */
export function setLyricPreloadCallback(fn) {
  onPreloadCallback = fn;
}

/** Register callback to dim/un-dim editorial chapter sections during active vocal lines. */
export function setStoryDimCallback(fn) {
  onStoryDimHandler = fn;
}

/** @param {boolean} active */
export function setEndingOutroActive(active) {
  endingOutroActive = Boolean(active);
}

/** @returns {'synced'|'auto-plain'|'instrumental'|'loading'} */
export function getLyricSignalStatus() {
  return currentLyricSignal;
}

function emitSignal(mode) {
  currentLyricSignal = mode;
  if (typeof signalChangeHandler === 'function') {
    signalChangeHandler(mode);
  }
}

/**
 * Lazy-load decoupled lyrics JSON (`/assets/lyrics/<id>.json`) with Map + in-flight deduplication.
 * @param {Object} track
 * @returns {Promise<Array>}
 */
export async function loadTrackLyrics(track) {
  if (!track || !track.id) return [];
  if (Array.isArray(track.subtitles) && track.subtitles.length > 0) {
    lyricsCache.set(track.id, track.subtitles);
    return track.subtitles;
  }
  if (lyricsCache.has(track.id)) {
    return lyricsCache.get(track.id);
  }
  if (String(track.id).startsWith('custom-')) return [];
  if (lyricsInFlightCache.has(track.id)) {
    return lyricsInFlightCache.get(track.id);
  }

  emitSignal('loading');
  const pending = (async () => {
    try {
      const url = track.lyricsSrc || `/assets/lyrics/${track.id}.json`;
      const res = await fetch(url);
      if (!res.ok) {
        emitSignal('instrumental');
        return [];
      }
      const payload = await res.json();
      const subs = Array.isArray(payload) ? payload : payload?.subtitles || [];
      const payloadMode = payload?.lyricMode || track?.lyricMode;
      const hasVocalLines = subs.some((s) => s && !s.isInstrumental);
      emitSignal(
        payloadMode === 'instrumental' || !hasVocalLines
          ? 'instrumental'
          : payloadMode === 'auto-plain'
            ? 'auto-plain'
            : 'synced'
      );
      lyricsCache.set(track.id, subs);
      return subs;
    } catch (err) {
      console.warn(`Failed fetching lyrics for ${track.id}:`, err);
      emitSignal('instrumental');
      return [];
    } finally {
      lyricsInFlightCache.delete(track.id);
    }
  })();

  lyricsInFlightCache.set(track.id, pending);
  return pending;
}

const autoResolveAttempted = new Set();

/**
 * Automatically search & apply missing lyrics in background via dev server /api/fetch-lyrics.
 * @param {Object} track
 * @returns {Promise<{ found: boolean, subtitles?: Array, lyricMode?: string, track?: Object, tracks?: Array }>}
 */
export async function autoResolveMissingLyrics(track) {
  if (!track || !track.id || String(track.id).startsWith('custom-')) return { found: false };
  if (autoResolveAttempted.has(track.id)) return { found: false };
  autoResolveAttempted.add(track.id);

  emitSignal('auto-searching');
  try {
    const res = await fetch('/api/fetch-lyrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        autoApply: true,
        trackId: track.id,
        title: track.title || '',
        artist: track.artist || '',
        genre: track.genre || '',
        duration: Number(track.duration) || 210,
      }),
    });
    if (!res.ok) {
      emitSignal('instrumental');
      return { found: false };
    }
    const payload = await res.json();
    if (payload?.ok && payload?.found && Array.isArray(payload.subtitles) && payload.subtitles.length > 0) {
      lyricsCache.set(track.id, payload.subtitles);
      setTrackSubtitles(payload.subtitles, payload.lyricMode || 'synced');
      return payload;
    }
    emitSignal('instrumental');
    return { found: false };
  } catch {
    emitSignal('instrumental');
    return { found: false };
  }
}

/** Expose cache stats for diagnostics & tests. */
export function getLyricsCacheStats() {
  return { cachedTrackIds: Array.from(lyricsCache.keys()), size: lyricsCache.size };
}

/** @returns {Array} */
export function getPreloadedSubtitles() {
  return preloadedSubtitles;
}

/** @returns {Object|null} */
export function getCurrentLyricSlot() {
  return lyricSlots[0] || null;
}

function tokenizeSubtitleHtml(html) {
  subtitleTokenizerHost.innerHTML = html || '';
  const tokens = [];

  function walk(node, isHighlight = false) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (!text || !text.trim()) return;
      const parts = text.trim().split(/\s+/).filter(Boolean);
      for (let i = 0; i < parts.length; i++) {
        tokens.push({ text: parts[i], isHighlight });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const highlight =
        isHighlight ||
        node.classList.contains('kinetic-highlight') ||
        node.tagName === 'EM' ||
        node.tagName === 'STRONG' ||
        node.tagName === 'B';
      node.childNodes.forEach((child) => walk(child, highlight));
    }
  }

  subtitleTokenizerHost.childNodes.forEach((child) => walk(child, false));
  subtitleTokenizerHost.textContent = '';
  return tokens;
}

/**
 * Parse raw LRC text (`[mm:ss.xx]`) into structured kinetic subtitles and 4-act timings.
 * @param {string} rawLrc
 * @param {string} [trackTitle='Custom Track']
 */
export function parseLrcText(rawLrc, trackTitle = 'Custom Track') {
  const entries = [];
  const lineRegex = /((?:\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\])+)\s*(.*)$/;
  const tsRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const zones = ['center-cinematic', 'top-left', 'mid-right', 'bottom-left'];

  const lines = String(rawLrc || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const match = lineRegex.exec(lines[i].trim());
    if (!match) continue;
    const text = match[2].trim();
    if (!text) continue;

    tsRegex.lastIndex = 0;
    let tsMatch;
    while ((tsMatch = tsRegex.exec(match[1])) !== null) {
      const mins = Number(tsMatch[1]);
      const secs = Number(tsMatch[2]);
      const fracRaw = tsMatch[3] || '0';
      const fracSec = Number(fracRaw) / (fracRaw.length === 3 ? 1000 : fracRaw.length === 1 ? 10 : 100);
      entries.push({ start: mins * 60 + secs + fracSec, text });
    }
  }

  entries.sort((a, b) => a.start - b.start);
  const subtitles = [];

  for (let i = 0; i < entries.length; i++) {
    const cur = entries[i];
    const nextStart = i + 1 < entries.length ? entries[i + 1].start : cur.start + 5.2;
    const end = Math.max(cur.start + 0.85, Math.min(nextStart - 0.1, cur.start + 6.8));

    subtitles.push({
      start: Number(cur.start.toFixed(2)),
      end: Number(end.toFixed(2)),
      text: cur.text,
      zone: zones[i % zones.length],
      vibe: i % 4 === 2 ? 'Refrain' : 'Custom Verse',
    });

    if (i + 1 < entries.length && nextStart - end > 8.0) {
      subtitles.push({
        start: Number((end + 0.5).toFixed(2)),
        end: Number((nextStart - 0.6).toFixed(2)),
        text: `<i>[Instrumental — ${trackTitle}]</i>`,
        zone: 'center-cinematic',
        vibe: 'Instrumental',
        isInstrumental: true,
      });
    }
  }

  const totalDur = subtitles.length ? subtitles[subtitles.length - 1].end + 6 : 180;
  return {
    subtitles,
    acts: [
      { id: 'act1', startTime: 0, endTime: totalDur * 0.3 },
      { id: 'act2', startTime: totalDur * 0.3, endTime: totalDur * 0.65 },
      { id: 'act3', startTime: totalDur * 0.65, endTime: totalDur * 0.88 },
      { id: 'act4', startTime: totalDur * 0.88, endTime: totalDur },
    ],
  };
}

/** Snapshot currently visible or nearest vocal lyric line for Quote Card export. */
export function getActiveLyricSnapshot() {
  const { currentTime } = getAudioTime();
  const slot = lyricSlots[0];
  if (slot && slot.subIndex >= 0 && preloadedSubtitles[slot.subIndex]) {
    const active = preloadedSubtitles[slot.subIndex];
    if (!active.isInstrumental) {
      return {
        words: active.words,
        text: active.words.map((w) => w.text).join(' '),
        currentTime,
      };
    }
  }

  let nearest = null;
  let bestDist = Infinity;
  for (let i = 0; i < preloadedSubtitles.length; i++) {
    const sub = preloadedSubtitles[i];
    if (sub.isInstrumental || !sub.words || sub.words.length === 0) continue;
    const mid = (sub.start + sub.end) * 0.5;
    const dist = currentTime >= sub.start && currentTime <= sub.end ? 0 : Math.abs(currentTime - mid);
    if (dist < bestDist) {
      bestDist = dist;
      nearest = sub;
    }
  }

  return {
    words: nearest ? nearest.words : [],
    text: nearest ? nearest.words.map((w) => w.text).join(' ') : '',
    currentTime,
  };
}

function countSyllables(word) {
  const cleaned = word.toLowerCase().replace(/[^a-z\u00C0-\u024F]/g, '');
  if (!cleaned) return 1;
  const groups = cleaned.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function buildWordSchedule(rawWords, startSec, endSec, isInstrumental) {
  if (!rawWords.length) return [];
  const totalDur = Math.max(0.25, endSec - startSec);
  const onsetLead = isInstrumental ? 0 : Math.min(0.03, totalDur * 0.015);
  const sustainTail = isInstrumental ? 0 : Math.min(0.15, totalDur * 0.06);
  const activeSpan = Math.max(0.18, totalDur - onsetLead - sustainTail);

  let totalWeight = 0;
  const weights = new Array(rawWords.length);
  for (let i = 0; i < rawWords.length; i++) {
    const token = rawWords[i];
    let w = countSyllables(token.text);
    if (/\.\.\.$|[.?!]$/.test(token.text)) w += 1.2;
    else if (/[,;:]$/.test(token.text)) w += 0.7;
    if (token.isHighlight) w *= 1.2;
    if (i === rawWords.length - 1) w *= 1.35;
    weights[i] = w;
    totalWeight += w;
  }

  let cursor = startSec + onsetLead;
  return rawWords.map((token, idx) => {
    const sliceDur = (weights[idx] / (totalWeight || 1)) * activeSpan;
    const wordStart = cursor;
    const wordEnd = cursor + sliceDur;
    cursor = wordEnd;
    return { text: token.text, isHighlight: token.isHighlight, wordStart, wordEnd };
  });
}

function buildAcousticWordSchedule(acousticWords, rawWords, startSec, endSec) {
  if (!acousticWords.length || !rawWords.length) return [];
  const origStart = Number(acousticWords[0].t ?? startSec);
  const lastW = acousticWords[acousticWords.length - 1];
  const origEnd = Number(lastW.t ?? endSec) + Number(lastW.d ?? 0.2);
  const origSpan = Math.max(0.1, origEnd - origStart);
  const targetSpan = Math.max(0.25, endSec - startSec);
  const scale = targetSpan / origSpan;

  const schedule = [];
  let prevEnd = startSec;

  for (let i = 0; i < rawWords.length; i++) {
    const aw = acousticWords[i];
    const relStart = Math.max(0, Number(aw.t ?? origStart) - origStart);
    const scaledDur = Math.max(0.06, Number(aw.d ?? 0.2) * scale);
    const wStart = Math.max(prevEnd, Math.min(endSec - 0.05, startSec + relStart * scale));
    const isLast = i === rawWords.length - 1;
    const wEnd = isLast ? endSec : Math.max(wStart + 0.06, Math.min(endSec, wStart + scaledDur));
    prevEnd = wEnd;

    schedule.push({
      text: rawWords[i].text,
      isHighlight: Boolean(rawWords[i].isHighlight || aw.h),
      wordStart: wStart,
      wordEnd: wEnd,
    });
  }
  return schedule;
}

/**
 * Preload & tokenize subtitles with Single-Visible-Line Mutex & Tempo-Adaptive Pace.
 * @param {Object|Array} trackOrSubtitles
 */
export function preloadTrackLyrics(trackOrSubtitles) {
  const sourceSubs = Array.isArray(trackOrSubtitles)
    ? trackOrSubtitles
    : trackOrSubtitles?.subtitles || [];

  let peakWords = 24;
  const prepared = sourceSubs.map((sub) => {
    const rawTokens = tokenizeSubtitleHtml(sub.text);
    const plain = rawTokens.map((t) => t.text).join(' ');
    const isInstrumental = sub.isInstrumental === true || plain.includes('♪') || /^\[.*\]$/.test(plain);
    const totalSyllables = rawTokens.reduce((sum, tok) => sum + countSyllables(tok.text), 0);
    if (rawTokens.length > peakWords) peakWords = rawTokens.length;

    return {
      ...sub,
      start: Number(sub.start),
      end: Number(sub.end),
      translation: typeof sub.translation === 'string' ? sub.translation.trim() : '',
      acousticWords: Array.isArray(sub.words) ? sub.words : null,
      rawTokens,
      isInstrumental,
      totalSyllables: Math.max(1, totalSyllables),
      syllablesPerSecond: 1,
      gapToPrev: 5,
      gapToNext: 5,
      transitionSpeedSec: 0.24,
      exitSpeedSec: 0.16,
      preRollTime: Number(sub.start),
      words: [],
    };
  });

  for (let i = 1; i < prepared.length; i++) {
    const prev = prepared[i - 1];
    const cur = prepared[i];
    const rawGap = cur.start - prev.end;
    if (rawGap < RAPID_GAP_THRESHOLD_SEC && rawGap < MIN_MUTEX_GAP_SEC) {
      prev.end = Number(Math.max(prev.start + 0.35, cur.start - MIN_MUTEX_GAP_SEC).toFixed(2));
      if (cur.start < prev.end + MIN_MUTEX_GAP_SEC) {
        cur.start = Number((prev.end + MIN_MUTEX_GAP_SEC).toFixed(2));
        cur.end = Math.max(cur.start + 0.35, cur.end);
      }
    }
  }

  for (let i = 0; i < prepared.length; i++) {
    const cur = prepared[i];
    const prev = i > 0 ? prepared[i - 1] : null;
    const next = i < prepared.length - 1 ? prepared[i + 1] : null;

    const lineDur = Math.max(0.35, cur.end - cur.start);
    cur.syllablesPerSecond = Number((cur.totalSyllables / lineDur).toFixed(2));
    cur.gapToPrev = prev ? Math.max(0, Number((cur.start - prev.end).toFixed(3))) : cur.start;
    cur.gapToNext = next ? Math.max(0, Number((next.start - cur.end).toFixed(3))) : 5.0;

    if (cur.isInstrumental) cur.transitionSpeedSec = 0.28;
    else if (cur.gapToPrev < RAPID_GAP_THRESHOLD_SEC) cur.transitionSpeedSec = 0.12;
    else if (cur.syllablesPerSecond >= 4.2) cur.transitionSpeedSec = 0.15;
    else if (cur.syllablesPerSecond >= 2.6) cur.transitionSpeedSec = 0.24;
    else cur.transitionSpeedSec = 0.38;

    if (cur.gapToNext < RAPID_GAP_THRESHOLD_SEC) {
      cur.exitSpeedSec = Number(Math.min(0.05, Math.max(0.03, cur.gapToNext * 0.5)).toFixed(3));
    } else if (cur.gapToNext < SPACIOUS_GAP_THRESHOLD_SEC) {
      cur.exitSpeedSec = Number(Math.min(0.14, Math.max(0.06, (cur.gapToNext - 0.1) * 0.45)).toFixed(3));
    } else {
      cur.exitSpeedSec = Number(Math.min(0.24, Math.max(0.1, cur.transitionSpeedSec * 0.65)).toFixed(3));
    }

    const prevGoneAt = prev ? prev.end + prev.exitSpeedSec + 0.025 : 0;
    if (cur.isInstrumental) {
      cur.preRollTime = Math.max(prevGoneAt, cur.start);
    } else if (cur.gapToPrev >= SPACIOUS_GAP_THRESHOLD_SEC) {
      cur.preRollTime = Number(Math.max(prevGoneAt, cur.start - Math.min(MAX_PREROLL_LEAD_SEC, cur.gapToPrev - 0.18)).toFixed(3));
    } else if (cur.gapToPrev >= RAPID_GAP_THRESHOLD_SEC) {
      cur.preRollTime = Number(Math.max(prevGoneAt, cur.start - Math.min(0.24, Math.max(0.06, cur.gapToPrev - 0.18))).toFixed(3));
    } else {
      const whipLead = Math.max(prevGoneAt, cur.start - 0.04);
      cur.preRollTime = Number((cur.start - whipLead >= 0.03 ? whipLead : cur.start).toFixed(3));
    }

    if (cur.acousticWords && cur.acousticWords.length === cur.rawTokens.length) {
      cur.words = buildAcousticWordSchedule(cur.acousticWords, cur.rawTokens, cur.start, cur.end);
    } else {
      cur.words = buildWordSchedule(cur.rawTokens, cur.start, cur.end, cur.isInstrumental);
    }
    delete cur.acousticWords;
    delete cur.rawTokens;
  }

  preloadedSubtitles = prepared;
  maxPreloadedWords = peakWords;
  if (lyricPoolInitialized) expandSlotWordPool();
  if (typeof onPreloadCallback === 'function') onPreloadCallback(preloadedSubtitles);
  return preloadedSubtitles;
}

/** Replace active subtitles immediately (e.g. after lazy fetch or custom LRC drop). */
export function setTrackSubtitles(subtitles, lyricModeHint = null) {
  const subs = Array.isArray(subtitles) ? subtitles : [];
  preloadTrackLyrics(subs);
  resetLyricPool();
  if (lyricModeHint) {
    emitSignal(lyricModeHint);
  } else {
    const hasVocalLines = subs.some((s) => s && !s.isInstrumental);
    emitSignal(hasVocalLines ? 'synced' : 'instrumental');
  }
}

function createWordSpan() {
  const span = document.createElement('span');
  span.className = 'k-word k-hidden upcoming';
  return span;
}

function expandSlotWordPool() {
  for (let s = 0; s < lyricSlots.length; s++) {
    const slot = lyricSlots[s];
    while (slot.wordEls.length < maxPreloadedWords) {
      const span = createWordSpan();
      slot.wordEls.push(span);
      slot.textEl.appendChild(span);
    }
  }
}

export function ensureLyricPool() {
  if (lyricPoolInitialized || !kineticStage) return;
  kineticStage.textContent = '';

  const el = document.createElement('div');
  el.className = 'kinetic-subtitle phase-idle';
  el.dataset.slot = '0';

  const textEl = document.createElement('div');
  textEl.className = 'kinetic-text';
  el.appendChild(textEl);

  const translationEl = document.createElement('div');
  translationEl.className = 'kinetic-translation';
  translationEl.hidden = true;
  el.appendChild(translationEl);

  kineticStage.appendChild(el);

  lyricSlots.push({
    el,
    textEl,
    translationEl,
    wordEls: [],
    phase: 'idle',
    subIndex: -1,
    exitTimer: 0,
    exitSpeedSec: 0.16,
  });

  lyricPoolInitialized = true;
  expandSlotWordPool();
}

export function resetLyricPool() {
  if (!lyricPoolInitialized) ensureLyricPool();
  for (let i = 0; i < lyricSlots.length; i++) {
    const slot = lyricSlots[i];
    if (slot.exitTimer) {
      clearTimeout(slot.exitTimer);
      slot.exitTimer = 0;
    }
    slot.phase = 'idle';
    slot.subIndex = -1;
    slot.el.className = 'kinetic-subtitle phase-idle instant-cut';
  }
  if (typeof onStoryDimHandler === 'function') onStoryDimHandler(false);
}

function bindSlotToSubtitle(slot, sub, subIndex) {
  if (slot.exitTimer) {
    clearTimeout(slot.exitTimer);
    slot.exitTimer = 0;
  }
  if (slot.phase !== 'idle') {
    slot.el.className = 'kinetic-subtitle phase-idle instant-cut';
    slot.phase = 'idle';
    void slot.el.offsetWidth;
  }

  slot.subIndex = subIndex;
  const wordCount = sub.words.length;
  while (slot.wordEls.length < wordCount) {
    const span = createWordSpan();
    slot.wordEls.push(span);
    slot.textEl.appendChild(span);
  }

  for (let i = 0; i < slot.wordEls.length; i++) {
    const span = slot.wordEls[i];
    if (i < wordCount) {
      const token = sub.words[i];
      span.dataset.wordIdx = String(i);
      span.textContent = token.text;
      span.className = token.isHighlight ? 'k-word k-highlight upcoming' : 'k-word upcoming';
      span.style.setProperty('--word-progress', '0%');
      span._pct = '0%';
      span._state = 'upcoming';
    } else if (span._state !== 'hidden') {
      span.textContent = '';
      span.className = 'k-word k-hidden';
      span._state = 'hidden';
      span._pct = '';
    }
  }

  let enterX = '0px';
  let enterY = '18px';
  if (sub.vector === 'throw-from-left') {
    enterX = '-72px';
    enterY = '6px';
  } else if (sub.vector === 'throw-from-right') {
    enterX = '72px';
    enterY = '6px';
  } else if (sub.vector === 'throw-diagonal-up') {
    enterX = '-48px';
    enterY = '42px';
  }
  slot.el.style.setProperty('--enter-x', enterX);
  slot.el.style.setProperty('--enter-y', enterY);
  slot.el.style.setProperty('--transition-speed', `${sub.transitionSpeedSec ?? 0.24}s`);
  slot.el.style.setProperty('--exit-speed', `${sub.exitSpeedSec ?? 0.16}s`);

  slot.zoneClass = `zone-${sub.zone || 'center-cinematic'}`;
  slot.isInstrumental = sub.isInstrumental;
  slot.exitSpeedSec = sub.exitSpeedSec ?? 0.16;

  if (slot.translationEl) {
    slot.translationEl.textContent = sub.translation || '';
    slot.translationEl.hidden = !showTranslationSubtitles || !sub.translation || Boolean(sub.isInstrumental);
  }
}

function setSlotPhase(slot, phase) {
  if (slot.phase === phase && phase !== 'idle') return;
  if (slot.exitTimer) {
    clearTimeout(slot.exitTimer);
    slot.exitTimer = 0;
  }

  slot.phase = phase;
  if (phase === 'idle') {
    slot.subIndex = -1;
    slot.el.className = 'kinetic-subtitle phase-idle';
    return;
  }

  const instClass = slot.isInstrumental ? ' is-instrumental' : '';
  slot.el.className = `kinetic-subtitle ${slot.zoneClass || 'zone-center-cinematic'} ${phase}${instClass}`;

  if (phase === 'exit') {
    const exitMs = Math.max(30, Math.round((slot.exitSpeedSec ?? 0.16) * 1000));
    slot.exitTimer = setTimeout(() => {
      slot.phase = 'idle';
      slot.subIndex = -1;
      slot.exitTimer = 0;
      slot.el.className = 'kinetic-subtitle phase-idle';
    }, exitMs);
  }
}

function setWordState(span, nextState, pctStr) {
  if (span._state !== nextState) {
    span.classList.remove('upcoming', 'singing', 'sung');
    span.classList.add(nextState);
    span._state = nextState;
  }
  if (span._pct !== pctStr) {
    span.style.setProperty('--word-progress', pctStr);
    span._pct = pctStr;
  }
}

function updateSlotWords(slot, sub, effectiveTime, isPreRoll) {
  const words = sub.words;
  const count = words.length;
  for (let i = 0; i < count; i++) {
    const w = words[i];
    const span = slot.wordEls[i];
    if (sub.isInstrumental) {
      setWordState(span, 'sung', '100%');
      continue;
    }
    if (isPreRoll || effectiveTime < w.wordStart) {
      setWordState(span, 'upcoming', '0%');
    } else if (effectiveTime <= w.wordEnd) {
      const spanDur = Math.max(0.05, w.wordEnd - w.wordStart);
      const rawProgress = Math.max(0, Math.min(1, (effectiveTime - w.wordStart) / spanDur));
      const easedProgress = i === count - 1 ? Math.pow(rawProgress, 0.85) : rawProgress;
      setWordState(span, 'singing', `${(easedProgress * 100).toFixed(1)}%`);

      if (w.isHighlight) {
        const pulseKey = `${slot.subIndex}:${i}`;
        if (lastHighlightPulseKey !== pulseKey) {
          lastHighlightPulseKey = pulseKey;
          triggerHighlightPulse();
        }
      }
    } else {
      setWordState(span, 'sung', '100%');
    }
  }
}

/**
 * Single-Visible-Line Mutex & Tempo-Adaptive 3-Phase Subtitle Engine.
 * Guarantees at most 1 visible lyric element at any frame.
 */
export function syncKineticSubtitles(rawEffectiveTime, vocalTelemetry) {
  if (!kineticStage) return;
  if (!lyricPoolInitialized) ensureLyricPool();
  const slot = lyricSlots[0];
  if (!slot) return;

  if (!isAudioPlaying() && rawEffectiveTime <= 0.02) {
    if (slot.phase !== 'idle') setSlotPhase(slot, 'idle');
    if (onStoryDimHandler) onStoryDimHandler(false);
    return;
  }

  const effectiveTime = Math.max(0, rawEffectiveTime + lyricSyncOffsetSec);

  const glowIntensity = (vocalTelemetry?.normalized ?? 0).toFixed(2);
  if (lastVocalGlowStr !== glowIntensity) {
    lastVocalGlowStr = glowIntensity;
    kineticStage.style.setProperty('--vocal-glow', glowIntensity);
  }
  const hasAcousticBoost = Boolean(vocalTelemetry?.isVocalActive || (vocalTelemetry?.vocalEnergy ?? 0) > 58);
  kineticStage.classList.toggle('vocal-energy-boost', hasAcousticBoost);

  let activeIdx = -1;
  let preRollIdx = -1;
  let nextUpcomingStart = Infinity;

  for (let i = 0; i < preloadedSubtitles.length; i++) {
    const s = preloadedSubtitles[i];
    if (effectiveTime >= s.start && effectiveTime < s.end) {
      activeIdx = i;
      break;
    }
    if (s.preRollTime > effectiveTime && s.preRollTime < nextUpcomingStart) {
      nextUpcomingStart = s.preRollTime;
    }
  }

  if (activeIdx === -1) {
    for (let i = 0; i < preloadedSubtitles.length; i++) {
      const s = preloadedSubtitles[i];
      if (effectiveTime >= s.preRollTime && effectiveTime < s.start) {
        preRollIdx = i;
        break;
      }
    }
  }

  if (slot.phase === 'exit' && slot.subIndex !== -1) {
    const exitingSub = preloadedSubtitles[slot.subIndex];
    if (!exitingSub || effectiveTime >= exitingSub.end + exitingSub.exitSpeedSec) {
      setSlotPhase(slot, 'idle');
    }
  }

  if (activeIdx !== -1) {
    const activeSub = preloadedSubtitles[activeIdx];
    if (endingOutroActive && activeSub.isInstrumental) {
      if (slot.phase !== 'idle') setSlotPhase(slot, 'exit');
      if (onStoryDimHandler) onStoryDimHandler(false);
      return;
    }
    if (onStoryDimHandler) onStoryDimHandler(true);
    if (slot.subIndex !== activeIdx) bindSlotToSubtitle(slot, activeSub, activeIdx);
    setSlotPhase(slot, 'active');
    updateSlotWords(slot, activeSub, effectiveTime, false);
    return;
  }

  if (preRollIdx !== -1) {
    const preSub = preloadedSubtitles[preRollIdx];
    const prevSub = preRollIdx > 0 ? preloadedSubtitles[preRollIdx - 1] : null;
    const prevStillExiting = slot.phase === 'exit' && prevSub && effectiveTime < prevSub.end + prevSub.exitSpeedSec;
    if (onStoryDimHandler) onStoryDimHandler(true);
    if (!prevStillExiting) {
      if (slot.subIndex !== preRollIdx) bindSlotToSubtitle(slot, preSub, preRollIdx);
      setSlotPhase(slot, 'pre-roll');
      updateSlotWords(slot, preSub, effectiveTime, true);
    }
    return;
  }

  if (slot.phase === 'active' || slot.phase === 'pre-roll') {
    setSlotPhase(slot, 'exit');
  }
  const hasCueNear = nextUpcomingStart - effectiveTime < STORY_HIDE_LEAD_SEC + 0.65;
  if (onStoryDimHandler) onStoryDimHandler(slot.phase !== 'idle' || hasCueNear);
}

// Click-to-Seek delegated listener on active/pre-roll vocal words
if (kineticStage) {
  kineticStage.addEventListener('click', (e) => {
    const wordEl = e.target.closest('.k-word');
    if (!wordEl) return;
    const slotEl = wordEl.closest('.kinetic-subtitle');
    if (
      !slotEl ||
      slotEl.classList.contains('is-instrumental') ||
      slotEl.classList.contains('phase-idle') ||
      slotEl.classList.contains('exit')
    ) {
      return;
    }
    const slot = lyricSlots[0];
    if (!slot || slot.subIndex < 0) return;
    const sub = preloadedSubtitles[slot.subIndex];
    const wordIdx = Number(wordEl.dataset.wordIdx);
    if (!sub || !Number.isInteger(wordIdx) || !sub.words[wordIdx]) return;

    if (typeof seekHandler === 'function') {
      seekHandler(Math.max(0, sub.words[wordIdx].wordStart - lyricSyncOffsetSec));
    }
    if (!isAudioPlaying()) togglePlayPause();
  });
}

ensureLyricPool();
