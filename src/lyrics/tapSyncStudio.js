/**
 * tapSyncStudio.js - In-Browser "Tap to Sync" Lyric Studio (Stages of Denial v9.0)
 * Enables creators to paste raw lyrics, tap Space in real-time with audio playback,
 * apply 50ms karaoke timings live, and export clean .LRC or .JSON lyric assets.
 */

import { getAudioTime, isAudioPlaying, togglePlayPause } from '../audio/audioEngine.js';
import { parseLrcText, setTrackSubtitles, getPreloadedSubtitles } from './karaokeEngine.js';
import { seekPlayback } from '../scroll/scrollyDirector.js';

function formatLrcTimestamp(sec) {
  const safe = Math.max(0, Number(sec) || 0);
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  const wholeSecs = Math.floor(rem);
  const centis = Math.min(99, Math.round((rem - wholeSecs) * 100));
  return `${String(mins).padStart(2, '0')}:${String(wholeSecs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

function slugifyId(text) {
  return (
    String(text || 'custom-track')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'custom-track'
  );
}

function triggerBlobDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildWordsForLine(text, start, end) {
  const tokens = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const totalDur = Math.max(0.4, end - start);
  const step = totalDur / tokens.length;
  return tokens.map((w, idx) => ({
    t: Number((start + idx * step).toFixed(2)),
    d: Number(Math.max(0.15, step).toFixed(2)),
    w,
  }));
}

/**
 * Initialize Tap-to-Sync Lyric Studio modal controller.
 */
export function initTapSyncStudio({ getActiveTrack, onApplySubtitles, showToast }) {
  const overlayEl = document.getElementById('tapSyncOverlay');
  const closeBtnEl = document.getElementById('btnCloseTapSync');
  const trackBadgeEl = document.getElementById('tapSyncTrackBadge');
  const textareaEl = document.getElementById('tapSyncLyricsInput');
  const startBtnEl = document.getElementById('btnTapSyncStart');
  const tapBtnEl = document.getElementById('btnTapSyncTap');
  const undoBtnEl = document.getElementById('btnTapSyncUndo');
  const applyBtnEl = document.getElementById('btnTapSyncApply');
  const dlLrcBtnEl = document.getElementById('btnTapSyncDownloadLrc');
  const dlJsonBtnEl = document.getElementById('btnTapSyncDownloadJson');
  const progressLabelEl = document.getElementById('tapSyncProgressLabel');
  const clockEl = document.getElementById('tapSyncClock');
  const currentLineEl = document.getElementById('tapSyncCurrentLine');
  const recordedListEl = document.getElementById('tapSyncRecordedList');

  if (!overlayEl) {
    return {
      isOpen: () => false,
      open: () => {},
      close: () => {},
      destroy: () => {},
    };
  }

  let isModalOpen = false;
  let lines = [];
  let recorded = []; // Array of { start, end, text }
  let isSyncActive = false;
  let clockRafId = 0;

  function parseInputLines() {
    return String(textareaEl?.value || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function updateClockLoop() {
    if (!isModalOpen) {
      clockRafId = 0;
      return;
    }
    if (clockEl) {
      const { currentTime } = getAudioTime();
      clockEl.textContent = formatLrcTimestamp(currentTime);
    }
    clockRafId = requestAnimationFrame(updateClockLoop);
  }

  function renderStatus() {
    const total = lines.length;
    const done = recorded.length;

    if (progressLabelEl) {
      progressLabelEl.textContent = total > 0 ? `Baris ${Math.min(done + 1, total)} / ${total} (${done} tersinkron)` : 'Tempel lirik di Langkah 1';
    }

    if (currentLineEl) {
      if (total === 0) {
        currentLineEl.textContent = 'Belum ada baris lirik — tempel lirik terlebih dahulu.';
      } else if (done >= total) {
        currentLineEl.textContent = '✓ Semua baris selesai diketuk! Klik "Terapkan ke Pemutar" atau Unduh.';
      } else {
        currentLineEl.textContent = `Berikutnya: "${lines[done]}"`;
      }
    }

    if (tapBtnEl) {
      tapBtnEl.disabled = !isSyncActive || done >= total || total === 0;
    }
    if (undoBtnEl) {
      undoBtnEl.disabled = done === 0;
    }

    const canExport = done > 0;
    if (applyBtnEl) applyBtnEl.disabled = !canExport;
    if (dlLrcBtnEl) dlLrcBtnEl.disabled = !canExport;
    if (dlJsonBtnEl) dlJsonBtnEl.disabled = !canExport;

    if (recordedListEl) {
      if (done === 0) {
        recordedListEl.innerHTML = '<div class="tap-sync-empty">Ketuk tombol Spasi setiap penyanyi mulai menyanyikan baris baru.</div>';
      } else {
        recordedListEl.innerHTML = '';
        const frag = document.createDocumentFragment();
        const startIdx = Math.max(0, done - 6);
        for (let i = startIdx; i < done; i += 1) {
          const item = recorded[i];
          const row = document.createElement('div');
          row.className = 'tap-sync-row';
          row.innerHTML = `<span class="tap-sync-ts">[${formatLrcTimestamp(item.start)}]</span><span class="tap-sync-txt"></span>`;
          row.querySelector('.tap-sync-txt').textContent = item.text;
          frag.appendChild(row);
        }
        recordedListEl.appendChild(frag);
      }
    }
  }

  function finalizeTailEndTime() {
    if (recorded.length === 0) return;
    const { duration } = getAudioTime();
    const last = recorded[recorded.length - 1];
    const maxCap = Number.isFinite(duration) && duration > last.start + 0.5 ? duration : last.start + 5.2;
    last.end = Number(Math.max(last.start + 0.85, Math.min(maxCap, last.start + 5.2)).toFixed(2));
  }

  function buildFinalPayload() {
    if (recorded.length === 0) return null;
    finalizeTailEndTime();

    const activeTrack = getActiveTrack?.() || { id: 'custom-track', title: 'Custom Track' };
    const lrcLines = recorded.map((r) => `[${formatLrcTimestamp(r.start)}] ${r.text}`);
    const rawLrc = lrcLines.join('\n');
    const parsed = parseLrcText(rawLrc, activeTrack.title || 'Custom Track');

    // Preserve exact user-tapped end boundaries cleanly while reusing choreography zones/vectors
    const subtitles = parsed.subtitles.map((sub, i) => {
      const rec = recorded[i];
      const start = rec ? rec.start : sub.start;
      const end = rec ? rec.end : sub.end;
      return {
        start,
        end,
        text: sub.text,
        zone: sub.zone,
        vector: sub.vector,
        words: buildWordsForLine(sub.text, start, end),
      };
    });

    return {
      trackId: slugifyId(activeTrack.id || activeTrack.title),
      rawLrc,
      jsonPayload: {
        id: slugifyId(activeTrack.id || activeTrack.title),
        lyricMode: 'synced',
        hasLyrics: true,
        subtitles,
      },
      subtitles,
    };
  }

  async function startTapSession() {
    lines = parseInputLines();
    if (lines.length === 0) {
      showToast?.('⚠ Tempel minimal 1 baris lirik sebelum memulai');
      textareaEl?.focus();
      return;
    }

    recorded = [];
    isSyncActive = true;
    seekPlayback(0);
    if (!isAudioPlaying()) {
      await togglePlayPause();
    }
    renderStatus();
    tapBtnEl?.focus({ preventScroll: true });
    showToast?.('⏱ Ketuk Spasi saat vokalis menyanyikan setiap baris');
  }

  function recordNextTap() {
    if (!isSyncActive || recorded.length >= lines.length) return;
    const { currentTime } = getAudioTime();
    const prev = recorded[recorded.length - 1];
    const minAllowed = prev ? prev.start + 0.35 : 0;
    const start = Number(Math.max(minAllowed, currentTime).toFixed(2));

    if (prev) {
      prev.end = Number(Math.max(prev.start + 0.35, start - 0.08).toFixed(2));
    }

    const idx = recorded.length;
    recorded.push({
      start,
      end: Number((start + 4.5).toFixed(2)),
      text: lines[idx],
    });

    if (recorded.length === lines.length) {
      finalizeTailEndTime();
      isSyncActive = false;
      showToast?.('✅ Semua baris selesai disinkronkan! Klik Terapkan ke Pemutar.');
    }

    renderStatus();
  }

  function undoLastTap() {
    if (recorded.length === 0) return;
    const removed = recorded.pop();
    isSyncActive = true;
    if (removed && Number.isFinite(removed.start)) {
      seekPlayback(Math.max(0, removed.start - 0.6));
    }
    renderStatus();
    tapBtnEl?.focus({ preventScroll: true });
  }

  function applyToPlayer() {
    const built = buildFinalPayload();
    if (!built) {
      showToast?.('⚠ Rekam minimal 1 ketukan lirik terlebih dahulu');
      return;
    }
    setTrackSubtitles(built.subtitles, 'synced');
    onApplySubtitles?.(built.subtitles);
    close();
    const firstStart = Math.max(0, (built.subtitles[0]?.start || 0) - 0.35);
    seekPlayback(firstStart);
    showToast?.(`✨ ${built.subtitles.length} baris lirik diterapkan ke pemutar karaoke`);
  }

  function downloadLrc() {
    const built = buildFinalPayload();
    if (!built) return;
    triggerBlobDownload(`${built.trackId}.lrc`, built.rawLrc, 'text/plain;charset=utf-8');
    showToast?.(`💾 Mengunduh ${built.trackId}.lrc`);
  }

  function downloadJson() {
    const built = buildFinalPayload();
    if (!built) return;
    triggerBlobDownload(`${built.trackId}.json`, JSON.stringify(built.jsonPayload, null, 2), 'application/json;charset=utf-8');
    showToast?.(`💾 Mengunduh ${built.trackId}.json`);
  }

  function open() {
    const track = getActiveTrack?.();
    if (trackBadgeEl) {
      trackBadgeEl.textContent = track ? `${track.artist || 'Custom'} · ${track.title || 'Untitled'}` : 'Lagu Aktif';
    }

    // Pre-fill existing non-instrumental lyrics smoothly when textarea is empty
    if (textareaEl && !textareaEl.value.trim()) {
      const existing = getPreloadedSubtitles()
        .filter((s) => s && !s.isInstrumental && s.text)
        .map((s) => String(s.text).replace(/<[^>]+>/g, '').trim())
        .filter(Boolean);
      if (existing.length > 0) {
        textareaEl.value = existing.join('\n');
      }
    }

    lines = parseInputLines();
    isModalOpen = true;
    overlayEl.classList.remove('hidden');
    renderStatus();
    if (!clockRafId) clockRafId = requestAnimationFrame(updateClockLoop);
    textareaEl?.focus({ preventScroll: true });
  }

  function close() {
    if (!isModalOpen) return;
    isModalOpen = false;
    isSyncActive = false;
    overlayEl.classList.add('hidden');
    if (clockRafId) {
      cancelAnimationFrame(clockRafId);
      clockRafId = 0;
    }
  }

  const handleOverlayKeydown = (e) => {
    if (!isModalOpen) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    const active = document.activeElement;
    const isTypingInTextarea = active === textareaEl;
    if (e.code === 'Space' && !isTypingInTextarea && isSyncActive) {
      e.preventDefault();
      e.stopPropagation();
      recordNextTap();
    }
  };

  closeBtnEl?.addEventListener('click', close);
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) close();
  });
  textareaEl?.addEventListener('input', () => {
    lines = parseInputLines();
    renderStatus();
  });
  startBtnEl?.addEventListener('click', startTapSession);
  tapBtnEl?.addEventListener('click', recordNextTap);
  undoBtnEl?.addEventListener('click', undoLastTap);
  applyBtnEl?.addEventListener('click', applyToPlayer);
  dlLrcBtnEl?.addEventListener('click', downloadLrc);
  dlJsonBtnEl?.addEventListener('click', downloadJson);
  document.addEventListener('keydown', handleOverlayKeydown);

  return {
    isOpen: () => isModalOpen,
    open,
    close,
    destroy: () => {
      close();
      document.removeEventListener('keydown', handleOverlayKeydown);
    },
  };
}
