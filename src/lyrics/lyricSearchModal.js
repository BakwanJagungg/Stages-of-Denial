/**
 * lyricSearchModal.js - Multi-Stage LRCLIB Lyric Search & Live Track Applier
 */

import { setTrackSubtitles } from './karaokeEngine.js';

export function initLyricSearchModal({ getActiveTrack, onTrackLyricsApplied, showToast }) {
  const overlayEl = document.getElementById('lyricSearchOverlay');
  const closeBtnEl = document.getElementById('btnCloseLyricSearch');
  const trackLabelEl = document.getElementById('lyricSearchTrackBadge');
  const queryInputEl = document.getElementById('lyricSearchQueryInput');
  const searchBtnEl = document.getElementById('btnRunLyricSearch');
  const resultsEl = document.getElementById('lyricSearchResults');

  if (!overlayEl) {
    return { isOpen: () => false, open: () => {}, close: () => {} };
  }

  let isOpenState = false;
  let targetTrack = null;

  function renderResults(candidates = []) {
    if (!resultsEl) return;
    resultsEl.innerHTML = '';

    if (!candidates.length) {
      resultsEl.innerHTML = '<div class="tap-sync-empty">Tidak ada kandidat lirik ditemukan. Coba ubah kata kunci (misal: "ALMIGHTY Tokyo Ska Paradise Orchestra").</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    candidates.forEach((cand) => {
      const row = document.createElement('div');
      row.className = 'lyric-search-row';
      const badge = cand.hasSynced ? 'Synced LRC' : 'Plain Auto';
      const durMin = Math.floor((cand.duration || 0) / 60);
      const durSec = String(Math.round((cand.duration || 0) % 60)).padStart(2, '0');
      const diff = Number.isFinite(cand.durationDiffSec) ? cand.durationDiffSec : 999;
      const durBadge =
        diff <= 6
          ? `<span class="track-origin-badge is-imported">✅ Durasi Cocok (${durMin}:${durSec})</span>`
          : diff <= 35 && (cand.duration || 0) >= 130
            ? `<span class="track-origin-badge is-curated">● Versi Penuh (${durMin}:${durSec})</span>`
            : `<span class="track-origin-badge is-instrumental">⚠️ Beda Durasi / TV Size (${durMin}:${durSec})</span>`;
      row.innerHTML = `
        <div class="lyric-search-meta">
          <div class="lyric-search-name"></div>
          <div class="lyric-search-sub"></div>
        </div>
        ${durBadge}
        <span class="track-origin-badge ${cand.hasSynced ? 'is-imported' : 'is-instrumental'}">${badge}</span>
        <button type="button" class="tap-sync-primary-btn lyric-apply-btn">Terapkan &amp; Simpan</button>
      `;
      row.querySelector('.lyric-search-name').textContent = cand.trackName || 'Tanpa Judul';
      row.querySelector('.lyric-search-sub').textContent = `${cand.artistName || ''}${cand.albumName ? ` · ${cand.albumName}` : ''} (${durMin}:${durSec})`;

      row.querySelector('.lyric-apply-btn')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';
        try {
          const track = targetTrack || getActiveTrack?.();
          if (!track?.id) throw new Error('Track tidak valid');
          const res = await fetch('/api/fetch-lyrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'apply',
              trackId: track.id,
              duration: track.duration || cand.duration || 210,
              candidate: cand,
            }),
          });
          const payload = await res.json();
          if (!res.ok || !payload.ok) throw new Error(payload?.error || 'Gagal menyimpan lirik');

          setTrackSubtitles(payload.subtitles, payload.lyricMode || 'synced');
          onTrackLyricsApplied?.(payload);
          close();
          showToast?.(`✅ Lirik "${cand.trackName}" (${payload.subtitles.length} baris) disimpan & diterapkan!`);
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Terapkan & Simpan';
          showToast?.(`⚠ ${err.message}`);
        }
      });
      frag.appendChild(row);
    });
    resultsEl.appendChild(frag);
  }

  async function runSearch() {
    const q = String(queryInputEl?.value || '').trim();
    if (!q) {
      queryInputEl?.focus();
      return;
    }
    if (searchBtnEl) searchBtnEl.disabled = true;
    if (resultsEl) resultsEl.innerHTML = '<div class="tap-sync-empty">🔍 Mencari lirik di LRCLIB...</div>';

    try {
      const track = targetTrack || getActiveTrack?.();
      const res = await fetch('/api/fetch-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search',
          query: q,
          artist: track?.artist || '',
          title: track?.title || '',
          duration: track?.duration || 210,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload?.error || 'Pencarian lirik gagal');
      renderResults(payload.candidates || []);
    } catch (err) {
      if (resultsEl) resultsEl.innerHTML = `<div class="tap-sync-empty">⚠ ${err.message}</div>`;
    } finally {
      if (searchBtnEl) searchBtnEl.disabled = false;
    }
  }

  function open(trackOverride = null, autoRun = true) {
    targetTrack = trackOverride || getActiveTrack?.() || null;
    if (trackLabelEl) {
      trackLabelEl.textContent = targetTrack ? `${targetTrack.artist} · ${targetTrack.title}` : 'Lagu Aktif';
    }
    if (queryInputEl) {
      queryInputEl.value = targetTrack ? `${targetTrack.artist || ''} ${targetTrack.title || ''}`.trim() : '';
    }
    isOpenState = true;
    overlayEl.classList.remove('hidden');
    queryInputEl?.focus({ preventScroll: true });
    if (autoRun && queryInputEl?.value) runSearch();
  }

  function close() {
    if (!isOpenState) return;
    isOpenState = false;
    overlayEl.classList.add('hidden');
  }

  closeBtnEl?.addEventListener('click', close);
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) close();
  });
  searchBtnEl?.addEventListener('click', runSearch);
  queryInputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });

  return {
    isOpen: () => isOpenState,
    open,
    close,
  };
}
