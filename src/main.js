/**
 * main.js - Modular Application Entry Point & State Orchestrator
 * Stages of Denial (v7.0 Modular Architecture & Universal Playlist Edition)
 */

import initialTracksData from '../config/tracks.json';
import {
  initAudio,
  switchTrack,
  getAudioTime,
  cycleAudioProfile,
  getCurrentAudioProfile,
  getAcousticState,
  isAudioPlaying,
  togglePlayPause,
  setVolume,
  getVolume,
  getFrequencyLevels,
  getVocalEnergy,
  setPlaybackSpeed,
  getPlaybackSpeed,
  setSleepTimer,
  getSleepTimerState,
  registerMediaSessionHandlers,
  updateMediaSessionMetadata,
  setAudioFallbackHandler,
  setActiveAudioTrackMeta,
} from './audio/audioEngine.js';
import {
  startVisualizer,
  setSceneIntensity,
  getSceneIntensity,
  getVisualPhysicsMode,
  getVisualContextMode,
  getLiveAudioDynamics,
  generateDynamicTrackPalette,
} from './visuals/canvasVisualizer.js';
import {
  loadTrackLyrics,
  autoResolveMissingLyrics,
  getLyricSignalStatus,
  getLyricsCacheStats,
  setTrackSubtitles,
  parseLrcText,
  getActiveLyricSnapshot,
  setLyricOffsetTrack,
  getLyricSyncOffset,
  setLyricSyncOffset,
  setTranslationEnabled,
  isTranslationEnabled,
} from './lyrics/karaokeEngine.js';
import {
  lenis,
  activateSection,
  setActiveTrack,
  seekPlayback,
  toggleLyricDrawer,
  setLoopPointA,
  setLoopPointB,
  clearABLoop,
  getABLoopState,
  startSyncLoop,
} from './scroll/scrollyDirector.js';
import { initStudioHud, showToast, formatLoopSec } from './ui/studioHud.js';
import { initJukeboxModal } from './ui/jukeboxModal.js';
import { initTapSyncStudio } from './lyrics/tapSyncStudio.js';
import { initLyricSearchModal } from './lyrics/lyricSearchModal.js';

let tracksData = [...initialTracksData];
let currentActiveTrackId = 'penyangkalan';
let currentActiveTrack = tracksData[0];
let activeGenreFilter = 'all';
let upNextQueue = [];

let jukeboxCtrl = null;
let hudCtrl = null;
let tapSyncCtrl = null;
let lyricSearchCtrl = null;

function getUpNextQueue() {
  return [...upNextQueue];
}

function enqueueTrackNext(track) {
  if (!track) return;
  upNextQueue.push(track);
  showToast(`➕ Ditambahkan ke Antrean (#${upNextQueue.length}): ${track.title}`);
}

function consumeNextQueuedTrack() {
  if (!upNextQueue.length) return null;
  const next = upNextQueue.shift() || null;
  jukeboxCtrl?.refreshQueueUi();
  return next;
}

function clearUpNextQueue(silent = false) {
  if (!upNextQueue.length) return;
  upNextQueue = [];
  jukeboxCtrl?.refreshQueueUi();
  if (!silent) showToast('🗑 Antrean putar berikutnya dikosongkan');
}

function removeQueueTrackById(trackId) {
  upNextQueue = upNextQueue.filter((t) => t.id !== trackId);
  jukeboxCtrl?.refreshQueueUi();
}

function getGenreFilteredTracks() {
  if (activeGenreFilter === 'all') return tracksData;
  const matched = tracksData.filter((t) => String(t.genre || '').trim() === activeGenreFilter);
  if (matched.length === 0) {
    activeGenreFilter = 'all';
    return tracksData;
  }
  return matched;
}

function setGenreFilter(nextGenre = 'all') {
  activeGenreFilter = nextGenre || 'all';
  if (activeGenreFilter === 'all') {
    showToast('🎵 Radio Genre: Semua Lagu');
    return;
  }
  const filtered = getGenreFilteredTracks();
  if (filtered.length > 0 && String(currentActiveTrack?.genre || '').trim() !== activeGenreFilter) {
    selectTrack(filtered[0]);
    showToast(`🎧 Genre "${activeGenreFilter}" (${filtered.length} lagu) — memutar ${filtered[0].title}`);
  } else {
    showToast(`🎧 Auto-Next disaring ke genre "${activeGenreFilter}" (${filtered.length} lagu)`);
  }
}

/**
 * Select a track from library, URL, deep-link, or custom file, lazy-load its decoupled lyrics,
 * start audio/visuals, and jump to `initialTime` when provided.
 */
async function selectTrack(track, customFile = null, initialTime = 0, autoStartPlayback = true) {
  currentActiveTrackId = track.id;
  currentActiveTrack = track;

  setLyricOffsetTrack(track.id);
  setActiveTrack(track);

  const outroTitleEl = document.getElementById('outroTrackTitle');
  if (outroTitleEl) outroTitleEl.textContent = `${track.title} · Selesai`;

  document.querySelectorAll('.track-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.trackId === track.id);
  });

  if (autoStartPlayback) {
    startVisualizer();
  }
  jukeboxCtrl?.setModalOpenState(false);

  const [resolvedSubs] = await Promise.all([
    Array.isArray(track.subtitles) ? Promise.resolve(track.subtitles) : loadTrackLyrics(track),
    switchTrack(track, customFile, initialTime),
  ]);

  if (currentActiveTrackId === track.id && !Array.isArray(track.subtitles)) {
    currentActiveTrack = { ...track, subtitles: resolvedSubs };
    const hasVocal = resolvedSubs.some((s) => s && !s.isInstrumental);
    if (!hasVocal && !customFile && import.meta.env.DEV) {
      setTrackSubtitles(resolvedSubs, 'auto-searching');
      autoResolveMissingLyrics(track).then((resolved) => {
        if (resolved?.found && currentActiveTrackId === track.id) {
          if (Array.isArray(resolved.tracks)) tracksData = resolved.tracks;
          currentActiveTrack = {
            ...(resolved.track || track),
            subtitles: resolved.subtitles,
            lyricMode: resolved.lyricMode || 'synced',
            hasLyrics: true,
          };
          jukeboxCtrl?.renderTracksGrid();
          showToast(`✨ Lirik ditemukan otomatis (${resolved.subtitles.length} baris)`);
        }
      });
    } else {
      const mode = track.lyricMode === 'instrumental' || !hasVocal ? 'instrumental' : track.lyricMode || 'synced';
      setTrackSubtitles(resolvedSubs, mode);
    }
  }

  if (initialTime > 0) {
    seekPlayback(initialTime);
  }
}

// Initialize Modular UI Controllers
setLyricOffsetTrack(currentActiveTrackId);

hudCtrl = initStudioHud({
  getActiveTrack: () => currentActiveTrack,
  getTracks: () => tracksData,
  getQueueTracks: getGenreFilteredTracks,
  getUpNextQueue,
  consumeNextQueuedTrack,
  getActiveGenre: () => activeGenreFilter,
  setGenreFilter,
  selectTrack,
  setCustomTrack: (t) => {
    currentActiveTrack = t;
  },
  onOpenTapSync: () => tapSyncCtrl?.open(),
});

jukeboxCtrl = initJukeboxModal({
  getTracks: () => tracksData,
  setTracks: (next) => {
    tracksData = Array.isArray(next) ? next : tracksData;
    hudCtrl?.refreshGenreOptions();
  },
  getActiveTrackId: () => currentActiveTrackId,
  selectTrack,
  onTracksUpdated: () => hudCtrl?.refreshGenreOptions(),
  getUpNextQueue,
  onEnqueueNext: enqueueTrackNext,
  onClearQueue: clearUpNextQueue,
  onTrackDeleted: removeQueueTrackById,
});

tapSyncCtrl = initTapSyncStudio({
  getActiveTrack: () => currentActiveTrack,
  onApplySubtitles: (subs) => {
    currentActiveTrack = {
      ...currentActiveTrack,
      subtitles: subs,
      lyricMode: 'synced',
      hasLyrics: true,
    };
  },
  showToast,
});

document.getElementById('btnOpenTapSyncJukebox')?.addEventListener('click', () => {
  jukeboxCtrl?.setModalOpenState(false);
  tapSyncCtrl?.open();
});

document.getElementById('btnOpenTapSyncDrawer')?.addEventListener('click', () => {
  toggleLyricDrawer(false);
  tapSyncCtrl?.open();
});

lyricSearchCtrl = initLyricSearchModal({
  getActiveTrack: () => currentActiveTrack,
  onTrackLyricsApplied: (payload) => {
    if (Array.isArray(payload?.tracks)) tracksData = payload.tracks;
    if (payload?.track && currentActiveTrack?.id === payload.track.id) {
      currentActiveTrack = { ...payload.track, subtitles: payload.subtitles };
    }
    jukeboxCtrl?.renderTracksGrid();
  },
  showToast,
});

document.getElementById('btnOpenLyricSearchJukebox')?.addEventListener('click', () => {
  jukeboxCtrl?.setModalOpenState(false);
  lyricSearchCtrl?.open(currentActiveTrack, true);
});

document.getElementById('btnOpenLyricSearchDrawer')?.addEventListener('click', () => {
  toggleLyricDrawer(false);
  lyricSearchCtrl?.open(currentActiveTrack, true);
});

document.getElementById('signalStatusPill')?.addEventListener('click', () => {
  if (getLyricSignalStatus() === 'instrumental') {
    lyricSearchCtrl?.open(currentActiveTrack, true);
  }
});

if (import.meta.env.DEV) {
  fetch('/api/tracks')
    .then((r) => (r.ok ? r.json() : null))
    .then((fresh) => {
      if (Array.isArray(fresh) && fresh.length > 0) {
        tracksData = fresh;
        hudCtrl?.refreshGenreOptions();
        jukeboxCtrl?.renderTracksGrid();
      }
    })
    .catch(() => {});
}

const topPlayBtn = document.getElementById('btnPlayPause');
if (topPlayBtn) topPlayBtn.onclick = () => togglePlayPause();

registerMediaSessionHandlers({
  onNext: () => hudCtrl?.playNextTrack(),
  onPrevious: () => hudCtrl?.playPreviousTrack(),
  onSeek: (sec) => seekPlayback(sec),
});
setActiveAudioTrackMeta(currentActiveTrack);
setAudioFallbackHandler(() => {
  showToast('🎧 Audio MP3 lokal belum tersedia — memutar mode pratinjau ambient (Drag & Drop MP3 untuk lagu penuh)');
});
updateMediaSessionMetadata(currentActiveTrack);

// Start 60 FPS Choreography Loop
startSyncLoop();

// Startup Deep-Link Hydration (?track=<id>&t=<seconds>)
(function hydrateDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const trackParam = params.get('track');
  if (!trackParam) return;
  const matched = tracksData.find((t) => t.id === trackParam);
  if (!matched) return;
  const rawT = Number(params.get('t'));
  selectTrack(matched, null, Number.isFinite(rawT) && rawT > 0 ? rawT : 0, false);
})();

// Global Pro Audiophile Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  if (tapSyncCtrl?.isOpen()) {
    return;
  }
  const active = document.activeElement;
  if (active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable)) {
    if (e.code === 'Escape' && jukeboxCtrl?.isModalOpen()) {
      jukeboxCtrl.setModalOpenState(false);
    }
    return;
  }

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      togglePlayPause();
      break;
    case 'KeyF':
      e.preventDefault();
      hudCtrl?.toggleCinemaMode();
      break;
    case 'KeyL':
      e.preventDefault();
      jukeboxCtrl?.setModalOpenState(!jukeboxCtrl.isModalOpen());
      break;
    case 'KeyD':
      e.preventDefault();
      hudCtrl?.toggleDirectorHud();
      break;
    case 'KeyQ':
      e.preventDefault();
      hudCtrl?.handleExportQuoteCard();
      break;
    case 'KeyT':
      e.preventDefault();
      showToast(toggleLyricDrawer() ? '📜 Panel Lirik: TERBUKA' : '📜 Panel Lirik: TERTUTUP');
      break;
    case 'BracketLeft':
      e.preventDefault();
      showToast(`🔁 Titik A dikunci (${formatLoopSec(setLoopPointA().a)})`);
      break;
    case 'BracketRight': {
      e.preventDefault();
      const st = setLoopPointB();
      showToast(`🔁 Loop A–B Aktif (${formatLoopSec(st.a)} → ${formatLoopSec(st.b)})`);
      break;
    }
    case 'Backslash':
      e.preventDefault();
      clearABLoop();
      showToast('✕ Loop A–B dibatalkan');
      break;
    case 'KeyM': {
      e.preventDefault();
      const newVol = getVolume() > 0 ? 0 : 0.85;
      setVolume(newVol);
      const volSlider = document.getElementById('volumeSlider');
      if (volSlider) volSlider.value = String(newVol);
      showToast(newVol === 0 ? '🔇 Mute' : '🔊 Unmute');
      break;
    }
    case 'ArrowUp': {
      e.preventDefault();
      const nextVol = Math.min(1, Math.round((getVolume() + 0.1) * 100) / 100);
      setVolume(nextVol);
      const volSlider = document.getElementById('volumeSlider');
      if (volSlider) volSlider.value = String(nextVol);
      showToast(`🔊 Volume ${Math.round(nextVol * 100)}%`);
      break;
    }
    case 'ArrowDown': {
      e.preventDefault();
      const nextVol = Math.max(0, Math.round((getVolume() - 0.1) * 100) / 100);
      setVolume(nextVol);
      const volSlider = document.getElementById('volumeSlider');
      if (volSlider) volSlider.value = String(nextVol);
      showToast(`🔉 Volume ${Math.round(nextVol * 100)}%`);
      break;
    }
    case 'ArrowLeft':
      e.preventDefault();
      seekPlayback(Math.max(0, getAudioTime().currentTime - 5));
      showToast('⏪ -5s');
      break;
    case 'ArrowRight': {
      e.preventDefault();
      const { currentTime, duration } = getAudioTime();
      seekPlayback(Math.min(duration, currentTime + 5));
      showToast('⏩ +5s');
      break;
    }
    case 'Escape':
      if (hudCtrl?.isCinemaActive()) hudCtrl.exitCinemaMode();
      else if (hudCtrl?.isStudioPopoverOpen()) hudCtrl.closeStudioPopover();
      else if (jukeboxCtrl?.isModalOpen()) jukeboxCtrl.setModalOpenState(false);
      else if (document.getElementById('lyricDrawer') && !document.getElementById('lyricDrawer').hidden) {
        toggleLyricDrawer(false);
      }
      break;
  }
});

// Expose runtime diagnostics & automated E2E inspection helpers
if (typeof window !== 'undefined') {
  window.__audioAPI = {
    seekAudio: (seconds) => seekPlayback(seconds),
    getAudioTime,
    getFrequencyLevels,
    getVocalEnergy,
    isAudioPlaying,
    togglePlayPause,
    activateSection,
    lenis,
    switchTrack,
    initAudio,
    get tracksData() {
      return tracksData;
    },
    cycleAudioProfile,
    getCurrentAudioProfile,
    getAcousticState,
    setPlaybackSpeed,
    getPlaybackSpeed,
    setSleepTimer,
    getSleepTimerState,
    setSceneIntensity,
    getSceneIntensity,
    getVisualPhysicsMode,
    getVisualContextMode,
    getLiveAudioDynamics,
    generateDynamicTrackPalette,
  };
  window.__scrolly = {
    seekPlayback,
    setActiveTrack,
    setTrackSubtitles,
    loadTrackLyrics,
    autoResolveMissingLyrics,
    getLyricsCacheStats,
    selectTrack,
    parseLrcText,
    getActiveLyricSnapshot,
    toggleLyricDrawer,
    setLoopPointA,
    setLoopPointB,
    clearABLoop,
    getABLoopState,
    getUpNextQueue,
    enqueueTrackNext,
    clearUpNextQueue,
    getLyricSyncOffset,
    setLyricSyncOffset,
    setTranslationEnabled,
    isTranslationEnabled,
    playNextTrack: () => hudCtrl?.playNextTrack(),
    playPreviousTrack: () => hudCtrl?.playPreviousTrack(),
    openTapSyncStudio: () => tapSyncCtrl?.open(),
    openLyricSearchModal: (t = null, autoRun = true) => lyricSearchCtrl?.open(t, autoRun),
    showImportDonePopup: (added = [], skipped = 0) => jukeboxCtrl?.showImportDonePopup(added, skipped),
    markNewlyImported: (ids = []) => jukeboxCtrl?.markNewlyImported(ids),
    setTracksData: (next) => {
      if (Array.isArray(next)) {
        tracksData = next;
        hudCtrl?.refreshGenreOptions();
        jukeboxCtrl?.renderTracksGrid();
      }
    },
    setAmbientIdleDelayMs: (ms) => hudCtrl?.setAmbientIdleDelayMs?.(ms),
  };
}
