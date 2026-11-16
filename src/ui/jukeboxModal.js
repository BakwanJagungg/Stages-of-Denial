/**
 * jukeboxModal.js - 2-Tab Anthology Library, Universal YTM Playlist Loader & Streaming Importer
 * Stages of Denial (v7.0 Modular Architecture)
 *
 * Features:
 * - Tab 1: Installed Tracks with "Kurasi Utama" badge on 14 protected tracks & Delete (x) on user imports
 * - Tab 2: Universal Playlist URL loader (`POST /api/load-playlist`) + Multi-Select ("Choose & Close")
 * - Live NDJSON Streaming Progress Bar for `POST /api/import-selected-tracks`
 */

import { formatLoopSec, showToast, updateSignalStatusUi } from './studioHud.js';
import { getLyricSignalStatus } from '../scroll/scrollyDirector.js';
import { generateDynamicTrackPalette } from '../visuals/canvasVisualizer.js';
import { enhanceGenreSelect } from './customSelect.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTrackDurationSeconds(track) {
  if (Number(track.duration) > 0) return Number(track.duration);
  const acts = track.acts || [];
  if (acts.length > 0 && Number(acts[acts.length - 1]?.endTime) > 0) {
    return Number(acts[acts.length - 1].endTime);
  }
  const subs = track.subtitles || [];
  if (subs.length > 0 && Number(subs[subs.length - 1]?.end) > 0) {
    return Number(subs[subs.length - 1].end);
  }
  return 0;
}

/**
 * Initialize Jukebox Modal, Universal Playlist Loader, Collection Manager & Streaming Importer.
 */
export function initJukeboxModal({
  getTracks,
  setTracks,
  getActiveTrackId,
  selectTrack,
  onTracksUpdated,
  getUpNextQueue,
  onEnqueueNext,
  onClearQueue,
  onTrackDeleted,
}) {
  const overlay = document.getElementById('gatewayOverlay');
  const tracksGrid = document.getElementById('tracksGrid');
  const audioFileInput = document.getElementById('audioFileInput');
  const audioHudEl = document.getElementById('audioHud');
  const kineticStageEl = document.getElementById('kineticStage');
  const storyMainEl = document.querySelector('.story-container');
  const jukeboxSearchEl = document.getElementById('jukeboxSearch');
  const jukeboxMoodGroupEl = document.getElementById('jukeboxMoodGroup');
  const jukeboxGenreWrapEl = document.getElementById('jukeboxGenreWrap');
  const jukeboxGenreSelectEl = document.getElementById('jukeboxGenreSelect');
  const jukeboxResultCountEl = document.getElementById('jukeboxResultCount');
  const jukeboxQueueBadgeEl = document.getElementById('jukeboxQueueBadge');
  const jukeboxQueueCountLabelEl = document.getElementById('jukeboxQueueCountLabel');
  const btnClearQueue = document.getElementById('btnClearQueue');
  const jukeboxEmptyStateEl = document.getElementById('jukeboxEmptyState');
  const moodPillBtns = Array.from(document.querySelectorAll('.mood-pill'));

  const tabInstalledBtn = document.getElementById('tabInstalledBtn');
  const tabPlaylistBtn = document.getElementById('tabPlaylistBtn');
  const tabInstalledCountEl = document.getElementById('tabInstalledCount');
  const tabPlaylistCountEl = document.getElementById('tabPlaylistCount');
  const panelInstalled = document.getElementById('panelInstalled');
  const panelPlaylistCatalog = document.getElementById('panelPlaylistCatalog');
  const playlistGrid = document.getElementById('playlistGrid');
  const playlistEmptyStateEl = document.getElementById('playlistEmptyState');

  // Universal Playlist Loader & Live Progress Bar elements
  const playlistUrlInput = document.getElementById('playlistUrlInput');
  const btnLoadPlaylistUrl = document.getElementById('btnLoadPlaylistUrl');
  const btnResetDefaultPlaylist = document.getElementById('btnResetDefaultPlaylist');
  const playlistCatalogMetaEl = document.getElementById('playlistCatalogMeta');
  const playlistProgressWrapEl = document.getElementById('playlistProgressWrap');
  const playlistProgressFillEl = document.getElementById('playlistProgressFill');
  const playlistProgressPctEl = document.getElementById('playlistProgressPct');
  const playlistImportStatusEl = document.getElementById('playlistImportStatus');
  const btnResetPlaylistSelection = document.getElementById('btnResetPlaylistSelection');
  const btnClosePlaylistBar = document.getElementById('btnClosePlaylistBar');
  const btnImportSelected = document.getElementById('btnImportSelected');

  let activeMoodFilter = 'all';
  let activeGenreFilter = 'all';
  let activeSearchQuery = '';
  let activeJukeboxTab = 'installed';
  let playlistCatalogItems = [];
  let playlistMetaTitle = '';
  let playlistCatalogLoaded = false;
  let playlistCatalogLoading = false;
  const newlyImportedIds = new Set();

  const importDonePopup = document.getElementById('importDonePopup');
  const importDoneMsg = document.getElementById('importDoneMessage');
  const btnImportDonePlay = document.getElementById('btnImportDonePlay');
  const btnImportDoneClose = document.getElementById('btnImportDoneClose');
  let pendingPlayTrack = null;

  function showImportDonePopup(addedTracks = [], skippedCount = 0) {
    if (!importDonePopup || !importDoneMsg) return;
    const firstNew = addedTracks[0] || null;
    pendingPlayTrack = firstNew;
    const skipNote = skippedCount ? ` (${skippedCount} dilewati)` : '';
    importDoneMsg.textContent = firstNew
      ? `✅ Selesai! ${addedTracks.length} lagu berhasil diunduh ke Koleksi Terpasang${skipNote}.`
      : `ℹ️ Unduhan selesai: ${skippedCount} lagu sudah terpasang sebelumnya.`;
    if (btnImportDonePlay) btnImportDonePlay.hidden = !firstNew;
    importDonePopup.classList.remove('hidden');
  }

  btnImportDoneClose?.addEventListener('click', () => {
    importDonePopup?.classList.add('hidden');
  });
  btnImportDonePlay?.addEventListener('click', () => {
    const track = pendingPlayTrack;
    importDonePopup?.classList.add('hidden');
    if (track) selectTrack(track);
  });

  async function handleReplaceTrackAudio(track) {
    if (!track || track.isOriginal) return;
    showToast(`🔄 Mencari Official Full Audio untuk "${track.title}"...`);
    try {
      const res = await fetch('/api/replace-track-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload?.error || 'Gagal mengganti audio');

      if (Array.isArray(payload.tracks)) setTracks(payload.tracks);
      renderTracksGrid();
      if (getActiveTrackId() === track.id && payload.track) {
        await selectTrack(payload.track);
      }
      showToast(`✅ Audio "${track.title}" berhasil diperbarui ke versi penuh!`);
    } catch (err) {
      showToast(`⚠ Gagal mengganti audio: ${err.message}`);
    }
  }
  let isLoadingPlaylistUrl = false;
  let isImportingSelected = false;
  const selectedVideoIds = new Set();

  function setModalOpenState(isOpen) {
    if (!overlay) return;
    overlay.classList.toggle('hidden', !isOpen);
    overlay.setAttribute('aria-hidden', String(!isOpen));

    const bgTargets = [audioHudEl, kineticStageEl, storyMainEl];
    bgTargets.forEach((el) => {
      if (el) el.inert = isOpen;
    });

    if (isOpen) {
      renderTracksGrid();
      if (activeJukeboxTab === 'playlist') ensurePlaylistCatalogLoaded();
    }
  }

  function updateTabCountBadges() {
    if (tabInstalledCountEl) tabInstalledCountEl.textContent = String(getTracks().length);
    if (tabPlaylistCountEl && playlistCatalogItems.length > 0) {
      tabPlaylistCountEl.textContent = String(playlistCatalogItems.length);
    }
  }

  function setProgressBarUi({ active = false, percent = 0, text = '' }) {
    if (playlistProgressWrapEl) playlistProgressWrapEl.hidden = !active;
    if (playlistProgressFillEl) {
      playlistProgressFillEl.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
    if (playlistProgressPctEl) {
      playlistProgressPctEl.textContent = `${Math.max(0, Math.min(100, Math.round(percent)))}%`;
    }
    if (playlistImportStatusEl && text) {
      playlistImportStatusEl.textContent = text;
    }
  }

  function updateSelectionActionBar() {
    const count = selectedVideoIds.size;
    if (btnImportSelected) {
      btnImportSelected.disabled = count === 0 || isImportingSelected || isLoadingPlaylistUrl;
      btnImportSelected.textContent = isImportingSelected
        ? `Mengunduh...`
        : `Unduh & Tambahkan Terpilih (${count})`;
    }
    if (btnResetPlaylistSelection) {
      btnResetPlaylistSelection.disabled = count === 0 || isImportingSelected;
    }
    if (playlistImportStatusEl && !isImportingSelected) {
      playlistImportStatusEl.textContent =
        count > 0
          ? `${count} lagu dipilih untuk diunduh & dikalibrasi lirik 50ms.`
          : 'Pilih lagu dari playlist untuk diunduh ke Koleksi Terpasang.';
    }
  }

  function applyCatalogPayload(payload) {
    if (Array.isArray(payload?.items)) {
      playlistCatalogItems = payload.items;
      playlistCatalogLoaded = true;
    }
    if (payload?.playlistTitle) {
      playlistMetaTitle = payload.playlistTitle;
    }
    if (playlistUrlInput && payload?.playlistUrl && !playlistUrlInput.value.trim()) {
      playlistUrlInput.value = payload.playlistUrl;
    }
    if (playlistCatalogMetaEl) {
      const label = playlistMetaTitle ? `${playlistMetaTitle} · ` : '';
      playlistCatalogMetaEl.textContent = `${label}${playlistCatalogItems.length} lagu tersedia`;
    }
    updateTabCountBadges();
    renderPlaylistCatalogGrid();
  }

  async function ensurePlaylistCatalogLoaded(forceReload = false) {
    if ((playlistCatalogLoaded && !forceReload) || playlistCatalogLoading) return;
    playlistCatalogLoading = true;
    try {
      let res = await fetch('/api/playlist-catalog');
      if (!res.ok) res = await fetch('/assets/playlist_catalog.json');
      if (res.ok) {
        const data = await res.json();
        applyCatalogPayload(data);
      }
    } catch (err) {
      console.warn('Playlist catalog prefetch skipped:', err);
    } finally {
      playlistCatalogLoading = false;
    }
  }

  async function syncInstalledTracksFromServer() {
    try {
      const res = await fetch('/api/tracks');
      if (res.ok) {
        const serverTracks = await res.json();
        if (Array.isArray(serverTracks) && serverTracks.length > 0) {
          setTracks(serverTracks);
          renderTracksGrid();
        }
      }
    } catch {}
    await ensurePlaylistCatalogLoaded();
  }

  function setActiveJukeboxTab(tabName) {
    activeJukeboxTab = tabName === 'playlist' ? 'playlist' : 'installed';
    const isInstalled = activeJukeboxTab === 'installed';

    tabInstalledBtn?.classList.toggle('active', isInstalled);
    tabInstalledBtn?.setAttribute('aria-selected', String(isInstalled));
    tabPlaylistBtn?.classList.toggle('active', !isInstalled);
    tabPlaylistBtn?.setAttribute('aria-selected', String(!isInstalled));

    if (panelInstalled) panelInstalled.hidden = !isInstalled;
    if (panelPlaylistCatalog) panelPlaylistCatalog.hidden = isInstalled;
    if (jukeboxMoodGroupEl) jukeboxMoodGroupEl.hidden = !isInstalled;
    if (jukeboxGenreWrapEl) jukeboxGenreWrapEl.hidden = !isInstalled;

    if (isInstalled) filterTracksGrid();
    else {
      ensurePlaylistCatalogLoaded().then(() => filterPlaylistCatalog());
      filterPlaylistCatalog();
    }
  }

  // Delete non-original imported track handler
  async function handleDeleteTrack(track) {
    if (!track || track.isOriginal) return;
    try {
      const res = await fetch(`/api/tracks/${encodeURIComponent(track.id)}`, { method: 'DELETE' });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload?.error || 'Gagal menghapus lagu');

      const nextTracks = Array.isArray(payload.tracks)
        ? payload.tracks
        : getTracks().filter((t) => t.id !== track.id);
      setTracks(nextTracks);
      if (typeof onTrackDeleted === 'function') onTrackDeleted(track.id);

      if (Array.isArray(payload.catalog?.items)) {
        applyCatalogPayload(payload.catalog);
      } else {
        playlistCatalogItems = playlistCatalogItems.map((it) =>
          it.matchedTrackId === track.id ? { ...it, installed: false, matchedTrackId: null } : it
        );
        renderPlaylistCatalogGrid();
      }

      if (getActiveTrackId() === track.id && nextTracks.length > 0) {
        await selectTrack(nextTracks[0]);
      }
      renderTracksGrid();
      showToast(`🗑 "${track.title}" dihapus dari Koleksi Terpasang`);
    } catch (err) {
      showToast(`⚠ ${err.message}`);
    }
  }

  // Universal Playlist Loader (Tab 2 URL input -> POST /api/load-playlist)
  async function handleLoadPlaylistUrl(overrideUrl = null) {
    if (isLoadingPlaylistUrl || isImportingSelected) return;
    const rawUrl = overrideUrl !== null ? overrideUrl : String(playlistUrlInput?.value || '').trim();
    isLoadingPlaylistUrl = true;
    if (btnLoadPlaylistUrl) {
      btnLoadPlaylistUrl.disabled = true;
      btnLoadPlaylistUrl.textContent = 'Memuat...';
    }
    if (playlistCatalogMetaEl) playlistCatalogMetaEl.textContent = 'Memindai daftar lagu playlist via yt-dlp...';
    updateSelectionActionBar();

    try {
      const res = await fetch('/api/load-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistUrl: rawUrl }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload?.error || 'Gagal memuat playlist');

      selectedVideoIds.clear();
      if (playlistUrlInput && payload.playlistUrl) playlistUrlInput.value = payload.playlistUrl;
      applyCatalogPayload(payload);
      updateSelectionActionBar();
      showToast(`📋 Playlist dimuat: ${payload.playlistTitle} (${payload.total} lagu)`);
    } catch (err) {
      if (playlistCatalogMetaEl) playlistCatalogMetaEl.textContent = `⚠ ${err.message}`;
      showToast(`⚠ ${err.message}`);
    } finally {
      isLoadingPlaylistUrl = false;
      if (btnLoadPlaylistUrl) {
        btnLoadPlaylistUrl.disabled = false;
        btnLoadPlaylistUrl.textContent = 'Muat Playlist';
      }
      updateSelectionActionBar();
    }
  }

  btnLoadPlaylistUrl?.addEventListener('click', () => handleLoadPlaylistUrl());
  playlistUrlInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLoadPlaylistUrl();
    }
  });
  btnResetDefaultPlaylist?.addEventListener('click', () => {
    if (playlistUrlInput) playlistUrlInput.value = '';
    handleLoadPlaylistUrl('');
  });

  tabInstalledBtn?.addEventListener('click', () => setActiveJukeboxTab('installed'));
  tabPlaylistBtn?.addEventListener('click', () => setActiveJukeboxTab('playlist'));
  btnClosePlaylistBar?.addEventListener('click', () => setModalOpenState(false));
  document.getElementById('btnCloseGateway')?.addEventListener('click', () => setModalOpenState(false));
  document.getElementById('btnChangeTrack')?.addEventListener('click', () => setModalOpenState(true));

  btnResetPlaylistSelection?.addEventListener('click', () => {
    selectedVideoIds.clear();
    playlistGrid?.querySelectorAll('.playlist-card.is-selected').forEach((card) => {
      card.classList.remove('is-selected');
      card.setAttribute('aria-checked', 'false');
      const cb = card.querySelector('.playlist-check-box');
      if (cb) cb.textContent = '';
    });
    updateSelectionActionBar();
  });

  // Streaming NDJSON import handler
  btnImportSelected?.addEventListener('click', async () => {
    if (isImportingSelected || selectedVideoIds.size === 0) return;
    const targetIds = Array.from(selectedVideoIds);
    isImportingSelected = true;
    updateSelectionActionBar();
    updateSignalStatusUi('downloading', `Mengunduh (${targetIds.length})...`);
    setProgressBarUi({
      active: true,
      percent: 4,
      text: `Menyiapkan unduhan untuk ${targetIds.length} lagu...`,
    });

    try {
      const res = await fetch('/api/import-selected-tracks?stream=1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson',
        },
        body: JSON.stringify({ videoIds: targetIds }),
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload?.error || 'Gagal mengimpor lagu terpilih');
      }

      let finalPayload = null;
      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/x-ndjson') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            let nlIdx;
            while ((nlIdx = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, nlIdx).trim();
              buffer = buffer.slice(nlIdx + 1);
              if (!line) continue;
              const evt = JSON.parse(line);
              if (evt.type === 'progress') {
                setProgressBarUi({ active: true, percent: evt.percent ?? 10, text: evt.message });
              } else if (evt.type === 'done') {
                finalPayload = evt;
              } else if (evt.type === 'error') {
                throw new Error(evt.error || 'Impor gagal');
              }
            }
          }
          if (done) break;
        }
      } else {
        finalPayload = await res.json();
      }

      if (!finalPayload || !finalPayload.ok) {
        throw new Error(finalPayload?.error || 'Gagal menyelesaikan impor');
      }

      if (Array.isArray(finalPayload.tracks)) setTracks(finalPayload.tracks);
      if (finalPayload.catalog) applyCatalogPayload(finalPayload.catalog);

      selectedVideoIds.clear();
      renderTracksGrid();
      renderPlaylistCatalogGrid();

      const added = finalPayload.importedTracks || [];
      const skipped = finalPayload.skipped || [];
      added.forEach((t) => {
        if (t?.id) newlyImportedIds.add(t.id);
      });
      const instCount = added.filter((t) => t.lyricMode === 'instrumental').length;

      setProgressBarUi({
        active: true,
        percent: 100,
        text: `Selesai! ${added.length} ditambahkan${skipped.length ? ` (${skipped.length} dilewati)` : ''}${instCount ? ` · ${instCount} Mode Instrumental Aurora` : ''}.`,
      });
      setTimeout(() => setProgressBarUi({ active: false, percent: 0 }), 3500);

      renderTracksGrid();
      setActiveJukeboxTab('installed');
      showImportDonePopup(added, skipped.length);
    } catch (err) {
      console.warn('Selected import failed:', err);
      setProgressBarUi({ active: true, percent: 0, text: `⚠ Impor gagal: ${err.message}` });
      showToast('⚠ Gagal mengimpor lagu terpilih (pastikan mode dev server aktif)');
    } finally {
      isImportingSelected = false;
      updateSelectionActionBar();
      updateSignalStatusUi(getLyricSignalStatus());
    }
  });

  function renderPlaylistCatalogGrid() {
    if (!playlistGrid) return;
    playlistGrid.innerHTML = '';

    const tracksList = getTracks();
    const installedIds = new Set(tracksList.map((t) => t.id));
    const installedVideoIds = new Set(tracksList.map((t) => t.videoId).filter(Boolean));

    playlistCatalogItems.forEach((item) => {
      const isInstalled =
        Boolean(item.installed) ||
        installedVideoIds.has(item.videoId) ||
        (item.matchedTrackId && installedIds.has(item.matchedTrackId));
      const isSelected = !isInstalled && selectedVideoIds.has(item.videoId);

      const card = document.createElement('div');
      card.className = `track-card playlist-card ${isInstalled ? 'is-installed' : ''} ${isSelected ? 'is-selected' : ''}`;
      card.dataset.videoId = item.videoId;
      card.dataset.search = `${item.title} ${item.artist}`.toLowerCase();
      card.tabIndex = 0;
      card.setAttribute('role', isInstalled ? 'group' : 'checkbox');
      if (!isInstalled) card.setAttribute('aria-checked', String(isSelected));
      card.setAttribute('aria-label', `${item.title} oleh ${item.artist}`);

      const durText = item.duration > 0 ? formatLoopSec(item.duration) : '';

      card.innerHTML = `
        <div class="track-thumb-wrap">
          <img src="${escapeHtml(item.thumbnail)}" alt="" class="track-cover-img" loading="lazy" onerror="this.style.display='none'">
        </div>
        <div class="track-card-body">
          <div class="track-title">${escapeHtml(item.title)}</div>
          <div class="track-artist">${escapeHtml(item.artist)}</div>
          <div class="track-meta-row">
            ${
              isInstalled
                ? `<span class="playlist-installed-badge">Terpasang</span>`
                : `<span class="track-badge">YTM Playlist</span>`
            }
            ${durText ? `<span class="track-duration">${durText}</span>` : ''}
          </div>
        </div>
        ${
          isInstalled
            ? `<button type="button" class="playlist-quick-play-btn" title="Putar lagu ini sekarang">Putar</button>`
            : `<span class="playlist-check-box" aria-hidden="true">${isSelected ? '✓' : ''}</span>`
        }
      `;

      if (isInstalled) {
        card.querySelector('.playlist-quick-play-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          const curTracks = getTracks();
          const match =
            curTracks.find((t) => t.id === item.matchedTrackId || t.videoId === item.videoId) ||
            curTracks.find((t) => t.title.toLowerCase() === item.title.toLowerCase());
          if (match) selectTrack(match);
        });
      } else {
        const toggleSelect = () => {
          if (isImportingSelected) return;
          if (selectedVideoIds.has(item.videoId)) {
            selectedVideoIds.delete(item.videoId);
            card.classList.remove('is-selected');
            card.setAttribute('aria-checked', 'false');
            const cb = card.querySelector('.playlist-check-box');
            if (cb) cb.textContent = '';
          } else {
            selectedVideoIds.add(item.videoId);
            card.classList.add('is-selected');
            card.setAttribute('aria-checked', 'true');
            const cb = card.querySelector('.playlist-check-box');
            if (cb) cb.textContent = '✓';
          }
          updateSelectionActionBar();
        };
        card.addEventListener('click', toggleSelect);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleSelect();
          }
        });
      }

      playlistGrid.appendChild(card);
    });

    filterPlaylistCatalog();
  }

  function filterPlaylistCatalog() {
    if (!playlistGrid) return;
    const cards = Array.from(playlistGrid.querySelectorAll('.playlist-card'));
    const q = activeSearchQuery.trim().toLowerCase();
    let visible = 0;

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const show = !q || (c.dataset.search || '').includes(q);
      c.hidden = !show;
      if (show) visible += 1;
    }

    if (activeJukeboxTab === 'playlist' && jukeboxResultCountEl) {
      jukeboxResultCountEl.textContent =
        visible === cards.length ? `${visible} lagu` : `${visible} dari ${cards.length} lagu`;
    }
    if (playlistEmptyStateEl) playlistEmptyStateEl.hidden = visible > 0 || cards.length === 0;
  }

  function formatDisplayGenre(track) {
    const raw = String(track?.genre || '').trim();
    if (!raw || /^playlist/i.test(raw)) {
      return track?.lyricMode === 'instrumental' ? 'Instrumental Aurora' : 'Pop';
    }
    return raw;
  }

  const jukeboxGenreDropdown = enhanceGenreSelect(jukeboxGenreSelectEl, { allLabel: 'Semua Genre' });

  function refreshJukeboxGenreOptions(tracksList = getTracks()) {
    if (!jukeboxGenreSelectEl) return;
    const genreCounts = new Map();
    tracksList.forEach((t) => {
      const g = formatDisplayGenre(t);
      genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
    });
    const genres = Array.from(genreCounts.keys()).sort((a, b) => a.localeCompare(b));
    jukeboxGenreSelectEl.textContent = '';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'Semua Genre';
    allOpt.dataset.count = String(tracksList.length);
    jukeboxGenreSelectEl.appendChild(allOpt);
    genres.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      opt.dataset.count = String(genreCounts.get(g) || 0);
      jukeboxGenreSelectEl.appendChild(opt);
    });
    if (activeGenreFilter !== 'all' && !genres.includes(activeGenreFilter)) {
      activeGenreFilter = 'all';
    }
    jukeboxGenreSelectEl.value = activeGenreFilter;
    jukeboxGenreDropdown?.syncOptions();
  }

  function renderTracksGrid() {
    if (!tracksGrid) return;
    tracksGrid.innerHTML = '';
    const tracksList = getTracks();
    const activeId = getActiveTrackId();
    updateTabCountBadges();
    refreshJukeboxGenreOptions(tracksList);
    if (typeof onTracksUpdated === 'function') onTracksUpdated(tracksList);

    tracksList.forEach((track) => {
      const displayGenre = formatDisplayGenre(track);
      const card = document.createElement('div');
      card.className = `track-card ${track.id === activeId ? 'active' : ''}`;
      card.style.setProperty('--card-accent', track.accentPrimary || '#D65A70');
      card.dataset.trackId = track.id;
      card.dataset.mood = track.visualEnergy || 'calm';
      card.dataset.genre = displayGenre;
      card.dataset.search = `${track.title} ${track.artist} ${displayGenre} ${track.year}`.toLowerCase();
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Putar ${track.title} oleh ${track.artist}`);

      const durSec = getTrackDurationSeconds(track);
      const durText = durSec > 0 ? formatLoopSec(durSec) : '';
      const coverSrc = track.coverSrc || track.coverImage || `/assets/covers/${track.id}.jpg`;

      const originBadge = track.isOriginal
        ? `<span class="track-origin-badge is-curated" title="Koleksi Kurasi Utama (Dilindungi)">Kurasi Utama</span>`
        : track.lyricMode === 'instrumental'
          ? `<span class="track-origin-badge is-instrumental" title="Mode Instrumental Aurora">Instrumental Aurora</span>`
          : `<span class="track-origin-badge is-imported">Impor</span>`;

      const newBadgeHtml = newlyImportedIds.has(track.id)
        ? `<span class="track-new-badge">BARU</span>`
        : '';

      const replaceAudioBtnHtml = !track.isOriginal
        ? `<button type="button" class="track-replace-audio-btn" aria-label="Ganti sumber audio ${escapeHtml(track.title)}" title="Cari ulang &amp; ganti MP3 ke Official Audio">🔄 Ganti Audio</button>`
        : '';

      const deleteBtnHtml = !track.isOriginal
        ? `<button type="button" class="track-delete-btn" aria-label="Hapus ${escapeHtml(track.title)} dari koleksi" title="Hapus dari koleksi (×)">×</button>`
        : '';

      card.innerHTML = `
        <div class="track-card-top">
          <div class="track-thumb-wrap">
            <img src="${escapeHtml(coverSrc)}" alt="" class="track-cover-img" loading="lazy" onerror="this.style.display='none'">
            <div class="track-play-hover-btn" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
          <div class="track-card-body">
            <div class="track-title">${escapeHtml(track.title)}</div>
            <div class="track-artist">${escapeHtml(track.artist)}</div>
            <div class="track-meta-row">
              <span class="track-badge" title="${escapeHtml(displayGenre)}">${escapeHtml(displayGenre)}</span>
              ${originBadge}
              ${newBadgeHtml}
              ${durText ? `<span class="track-duration">${durText}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="track-card-actions">
          ${replaceAudioBtnHtml}
          <button type="button" class="track-queue-btn" aria-label="Tambahkan ${escapeHtml(track.title)} ke Antrean Putar Berikutnya" title="Putar Berikutnya (+ Antrean)">+ Antrean</button>
          ${deleteBtnHtml}
        </div>
      `;

      if (!track.isOriginal) {
        card.querySelector('.track-delete-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          handleDeleteTrack(track);
        });
        card.querySelector('.track-replace-audio-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          handleReplaceTrackAudio(track);
        });
      }

      card.querySelector('.track-queue-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof onEnqueueNext === 'function') onEnqueueNext(track);
        refreshQueueUi();
      });

      card.addEventListener('click', () => selectTrack(track));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectTrack(track);
        }
      });

      tracksGrid.appendChild(card);
    });
    filterTracksGrid();
    refreshQueueUi();
  }

  function refreshQueueUi() {
    const queue = typeof getUpNextQueue === 'function' ? getUpNextQueue() : [];
    const count = queue.length;
    if (jukeboxQueueBadgeEl) jukeboxQueueBadgeEl.hidden = count === 0;
    if (jukeboxQueueCountLabelEl) jukeboxQueueCountLabelEl.textContent = `Antrean: ${count}`;
    if (!tracksGrid) return;
    const queuedCounts = new Map();
    queue.forEach((t) => queuedCounts.set(t.id, (queuedCounts.get(t.id) || 0) + 1));
    tracksGrid.querySelectorAll('.track-card').forEach((card) => {
      const btn = card.querySelector('.track-queue-btn');
      if (!btn) return;
      const n = queuedCounts.get(card.dataset.trackId) || 0;
      btn.classList.toggle('is-queued', n > 0);
      btn.textContent = n > 0 ? `+ Antrean (${n})` : '+ Antrean';
    });
  }

  btnClearQueue?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof onClearQueue === 'function') onClearQueue(false);
    refreshQueueUi();
  });

  function filterTracksGrid() {
    if (!tracksGrid) return;
    const cards = Array.from(tracksGrid.querySelectorAll('.track-card'));
    const q = activeSearchQuery.trim().toLowerCase();
    let visible = 0;

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const moodMatch = activeMoodFilter === 'all' || c.dataset.mood === activeMoodFilter;
      const genreMatch = activeGenreFilter === 'all' || c.dataset.genre === activeGenreFilter;
      const textMatch = !q || (c.dataset.search || '').includes(q);
      const show = moodMatch && genreMatch && textMatch;
      c.hidden = !show;
      if (show) visible += 1;
    }

    if (activeJukeboxTab === 'installed' && jukeboxResultCountEl) {
      jukeboxResultCountEl.textContent =
        visible === cards.length ? `${visible} lagu` : `${visible} dari ${cards.length} lagu`;
    }
    if (jukeboxEmptyStateEl) jukeboxEmptyStateEl.hidden = visible > 0;
  }

  jukeboxSearchEl?.addEventListener('input', (e) => {
    activeSearchQuery = e.target.value || '';
    if (activeJukeboxTab === 'playlist') filterPlaylistCatalog();
    else filterTracksGrid();
  });

  moodPillBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeMoodFilter = btn.dataset.mood || 'all';
      moodPillBtns.forEach((p) => {
        const isActive = p === btn;
        p.classList.toggle('active', isActive);
        p.setAttribute('aria-pressed', String(isActive));
      });
      filterTracksGrid();
    });
  });

  jukeboxGenreSelectEl?.addEventListener('change', (e) => {
    activeGenreFilter = e.target.value || 'all';
    filterTracksGrid();
  });

  // Route mouse wheel scroll cleanly inside Jukebox when open
  overlay?.addEventListener(
    'wheel',
    (e) => {
      if (overlay.classList.contains('hidden')) return;
      e.stopPropagation();
      const targetGrid = activeJukeboxTab === 'playlist' ? playlistGrid : tracksGrid;
      if (targetGrid && !targetGrid.contains(e.target)) {
        targetGrid.scrollTop += e.deltaY;
      }
    },
    { passive: true }
  );

  // Local MP3 upload handler
  audioFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const cleanTitle = file.name.replace(/\.[^.]+$/, '');
    const dyn = generateDynamicTrackPalette(cleanTitle);
    await selectTrack(
      {
        id: 'custom-' + Date.now(),
        title: cleanTitle,
        artist: 'Local File',
        year: 'Custom',
        genre: 'User Audio',
        ...dyn,
        bgColor: '#0B0C10',
        lyricMode: 'instrumental',
        description: 'Custom Local Audio Playback',
      },
      file
    );
  });

  renderTracksGrid();
  syncInstalledTracksFromServer();

  return {
    setModalOpenState,
    isModalOpen: () => Boolean(overlay && !overlay.classList.contains('hidden')),
    renderTracksGrid,
    setActiveJukeboxTab,
    refreshQueueUi,
    showImportDonePopup,
    markNewlyImported: (ids = []) => ids.forEach((id) => id && newlyImportedIds.add(id)),
  };
}
