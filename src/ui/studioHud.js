/**
 * studioHud.js - Top Minimalist Cinema Bar, Studio Popover, Signal Status Pill & Pro Controls
 * Stages of Denial (v7.0 Modular Architecture)
 */

import {
  getAudioTime,
  cycleAudioProfile,
  isAudioPlaying,
  togglePlayPause,
  setTrackEndedHandler,
  setPlaybackSpeed,
  setSleepTimer,
  getSleepTimerState,
  triggerFilterSweep,
  resetFilterSweep,
  resetCrossfadeFilter,
} from '../audio/audioEngine.js';
import {
  setSceneIntensity,
  setScene2DArchetype,
  getScene2DArchetype,
  generateDynamicTrackPalette,
  SCENE_ARCHETYPES,
  setExtraReactiveEffects,
  getExtraReactiveEffects,
} from '../visuals/canvasVisualizer.js';
import { exportLyricQuoteCard } from '../visuals/quoteCard.js';
import {
  getActiveLyricSnapshot,
  getPreloadedSubtitles,
  parseLrcText,
  setLyricSignalCallback,
  adjustLyricSyncOffset,
  getLyricSyncOffset,
  setLyricSyncOffset,
  setLyricOffsetChangeCallback,
  setTranslationEnabled,
  isTranslationEnabled,
} from '../lyrics/karaokeEngine.js';
import {
  setActiveTrack,
  seekPlayback,
  toggleLyricDrawer,
  clearABLoop,
  setUpNextSyncCallback,
} from '../scroll/scrollyDirector.js';
import { enhanceGenreSelect } from './customSelect.js';

/** Format seconds into `MM:SS`. */
export function formatLoopSec(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// Floating Audio Toast Notification
const audioToast = document.getElementById('audioToast');
let toastTimeout = null;
let lastToastMessage = '';

/** Display non-intrusive toast message at bottom center. */
export function showToast(message, duration = 2800) {
  if (!audioToast) return;
  let announced = message;
  if (announced === lastToastMessage) announced += '\u00A0';
  lastToastMessage = message;
  audioToast.textContent = announced;
  audioToast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    audioToast.classList.remove('show');
  }, duration);
}

// Chapter & Signal Progress Indicator Pill (#signalStatusPill)
const signalStatusPill = document.getElementById('signalStatusPill');
const signalStatusText = document.getElementById('signalStatusText');
const signalStatusDot = document.getElementById('signalStatusDot');

/**
 * Update the live audio/lyric signal pill next to the Chapter Timeline indicator.
 * @param {'synced'|'auto-plain'|'instrumental'|'loading'|'downloading'} mode
 * @param {string} [customText]
 */
export function updateSignalStatusUi(mode, customText = '') {
  if (!signalStatusPill || !signalStatusText) return;
  signalStatusPill.dataset.signal = mode;

  if (customText) {
    signalStatusText.textContent = customText;
    return;
  }

  switch (mode) {
    case 'downloading':
      if (signalStatusDot) signalStatusDot.textContent = '↻';
      signalStatusText.textContent = 'Mengunduh...';
      break;
    case 'loading':
      if (signalStatusDot) signalStatusDot.textContent = '↻';
      signalStatusText.textContent = 'Memuat Lirik...';
      break;
    case 'auto-searching':
      if (signalStatusDot) signalStatusDot.textContent = '↻';
      signalStatusText.textContent = 'Mencari Lirik Otomatis...';
      break;
    case 'instrumental':
      if (signalStatusDot) signalStatusDot.textContent = '◐';
      signalStatusText.textContent = 'Mode Instrumental (Klik untuk Cari Manual)';
      signalStatusPill.style.cursor = 'pointer';
      break;
    case 'auto-plain':
      if (signalStatusDot) signalStatusDot.textContent = '●';
      signalStatusText.textContent = 'Lirik Auto-Timing';
      break;
    case 'synced':
    default:
      if (signalStatusDot) signalStatusDot.textContent = '●';
      signalStatusText.textContent = 'Lirik Tersinkron';
      break;
  }
}

/**
 * Initialize HUD controls, Studio Popover, Quote Exporter, Share, Sleep Timer & Drag-and-Drop.
 * @param {{ getActiveTrack: Function, getTracks: Function, selectTrack: Function, setCustomTrack: Function }} ctx
 */
export function initStudioHud({
  getActiveTrack,
  getTracks,
  getQueueTracks,
  getUpNextQueue,
  consumeNextQueuedTrack,
  getActiveGenre,
  setGenreFilter,
  selectTrack,
  setCustomTrack,
  onOpenTapSync,
}) {
  setLyricSignalCallback((mode) => updateSignalStatusUi(mode));

  // 1. DSP Audiophile Profile Selector
  const btnAudioProfile = document.getElementById('btnAudioProfile');
  const audioProfileText = document.getElementById('audioProfileText');
  const audioProfileDot = document.getElementById('audioProfileDot');

  btnAudioProfile?.addEventListener('click', () => {
    const profile = cycleAudioProfile();
    if (audioProfileText) audioProfileText.textContent = profile.label;
    if (audioProfileDot) {
      audioProfileDot.style.background = profile.color;
      audioProfileDot.style.boxShadow = `0 0 10px ${profile.color}`;
    }
    showToast(`🎚 Profil Audio: ${profile.label} — ${profile.desc}`);
  });

  // 2. Fullscreen Cinema Mode
  const btnCinemaMode = document.getElementById('btnCinemaMode');
  const btnExitCinema = document.getElementById('btnExitCinema');
  let cinemaIdleTimer = null;
  let isCinemaMode = false;

  function resetCinemaIdleTimer() {
    if (!isCinemaMode) return;
    document.body.classList.remove('hud-hidden');
    clearTimeout(cinemaIdleTimer);
    cinemaIdleTimer = setTimeout(() => {
      if (isCinemaMode) document.body.classList.add('hud-hidden');
    }, 3200);
  }

  function enterCinemaMode() {
    isCinemaMode = true;
    document.body.classList.add('cinema-mode');
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    showToast('⛶ Mode Bioskop Aktif (Gerakkan mouse untuk memunculkan kontrol)');
    resetCinemaIdleTimer();
  }

  function exitCinemaMode() {
    isCinemaMode = false;
    document.body.classList.remove('cinema-mode', 'hud-hidden');
    clearTimeout(cinemaIdleTimer);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    showToast('✕ Keluar dari Mode Bioskop');
  }

  function toggleCinemaMode() {
    if (isCinemaMode) exitCinemaMode();
    else enterCinemaMode();
  }

  btnCinemaMode?.addEventListener('click', toggleCinemaMode);
  btnExitCinema?.addEventListener('click', exitCinemaMode);
  window.addEventListener('mousemove', () => {
    if (isCinemaMode) resetCinemaIdleTimer();
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && isCinemaMode) exitCinemaMode();
  });

  // Ambient Cinema Idle Mode: dim HUD & chapter strip after 25s of inactivity while playing
  let ambientIdleDelayMs = 25000;
  let ambientLastActivityMs = performance.now();

  const wakeAmbientCinemaHud = () => {
    ambientLastActivityMs = performance.now();
    document.body.classList.remove('cinema-idle-mode');
  };

  window.addEventListener('mousemove', wakeAmbientCinemaHud, { passive: true });
  window.addEventListener('keydown', wakeAmbientCinemaHud, { passive: true });
  window.addEventListener('pointerdown', wakeAmbientCinemaHud, { passive: true });

  const ambientIdleIntervalId = setInterval(() => {
    const gatewayHidden = document.getElementById('gatewayOverlay')?.classList.contains('hidden') ?? true;
    const popoverHidden = document.getElementById('studioPopover')?.hidden ?? true;
    const drawerHidden = document.getElementById('lyricDrawer')?.hidden ?? true;
    const tapSyncHidden = document.getElementById('tapSyncOverlay')?.classList.contains('hidden') ?? true;

    if (!isAudioPlaying() || !gatewayHidden || !popoverHidden || !drawerHidden || !tapSyncHidden) {
      wakeAmbientCinemaHud();
      return;
    }
    if (performance.now() - ambientLastActivityMs >= ambientIdleDelayMs) {
      document.body.classList.add('cinema-idle-mode');
    }
  }, 500);

  // 3. Progress Scrub Hover Tooltip
  const hudProgressBar = document.getElementById('hudProgressBar');
  const progressTooltip = document.getElementById('progressTooltip');
  if (hudProgressBar && progressTooltip) {
    hudProgressBar.addEventListener('mousemove', (e) => {
      const rect = hudProgressBar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const { duration } = getAudioTime();
      progressTooltip.textContent = formatLoopSec(ratio * duration);
      progressTooltip.style.left = `${(ratio * 100).toFixed(1)}%`;
      progressTooltip.classList.add('visible');
    });
    hudProgressBar.addEventListener('mouseleave', () => progressTooltip.classList.remove('visible'));
  }

  // 4. Auto-Next Queue, Genre Radio Filter & Smart "Up Next" Preview
  const btnAutoNext = document.getElementById('btnAutoNext');
  const mainGenreSelect = document.getElementById('mainGenreSelect');
  const upNextPillEl = document.getElementById('upNextPill');
  const upNextTrackLabelEl = document.getElementById('upNextTrackLabel');
  const btnUpNextPlayEl = document.getElementById('btnUpNextPlay');
  const btnUpNextSkipEl = document.getElementById('btnUpNextSkip');

  let isAutoNext = true;
  let upNextTrackIdRef = '';
  let upNextSkipOffset = 0;
  let upNextDismissedForTrackId = '';
  let lastRenderedUpNextVisible = false;
  let lastRenderedUpNextLabel = '';

  const mainGenreDropdown = enhanceGenreSelect(mainGenreSelect, { allLabel: 'Semua Genre', compact: true });

  function refreshGenreOptions() {
    if (!mainGenreSelect) return;
    const prevVal = typeof getActiveGenre === 'function' ? getActiveGenre() : mainGenreSelect.value || 'all';
    const allTracks = getTracks();
    const genreCounts = new Map();
    allTracks.forEach((t) => {
      const g = String(t.genre || '').trim();
      if (g && !/^playlist/i.test(g)) {
        genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
      }
    });
    const genres = Array.from(genreCounts.keys()).sort((a, b) => a.localeCompare(b));

    mainGenreSelect.textContent = '';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'Semua Genre';
    allOpt.dataset.count = String(allTracks.length);
    mainGenreSelect.appendChild(allOpt);

    genres.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      opt.dataset.count = String(genreCounts.get(g) || 0);
      mainGenreSelect.appendChild(opt);
    });

    const valid = prevVal === 'all' || genres.includes(prevVal) ? prevVal : 'all';
    mainGenreSelect.value = valid;
    mainGenreSelect.classList.toggle('is-filtered', valid !== 'all');
    mainGenreDropdown?.syncOptions();
  }

  mainGenreSelect?.addEventListener('change', (e) => {
    const chosen = e.target.value || 'all';
    mainGenreSelect.classList.toggle('is-filtered', chosen !== 'all');
    if (typeof setGenreFilter === 'function') {
      setGenreFilter(chosen);
    }
  });

  function resolveNextCandidate(extraOffset = 0) {
    const customQ = typeof getUpNextQueue === 'function' ? getUpNextQueue() : [];
    if (customQ.length > 0 && extraOffset < customQ.length) {
      return { track: customQ[extraOffset], isCustomQueue: true, queueLen: customQ.length };
    }
    const queue = typeof getQueueTracks === 'function' ? getQueueTracks() : getTracks();
    if (!queue.length) return { track: null, isCustomQueue: false, queueLen: 0 };
    const cur = getActiveTrack();
    const curIdx = queue.findIndex((t) => t.id === cur?.id);
    const baseNext = curIdx >= 0 ? curIdx + 1 : 0;
    const adjOffset = Math.max(0, extraOffset - customQ.length);
    return {
      track: queue[(baseNext + adjOffset) % queue.length] || null,
      isCustomQueue: false,
      queueLen: customQ.length,
    };
  }

  function formatUpNextText({ track, isCustomQueue, queueLen }) {
    if (!track) return '';
    if (isCustomQueue) return `Antrean Kustom (${queueLen}) · Berikutnya: ${track.title}`;
    const genreTag = track.genre || track.visualEnergy || 'Music';
    return `${track.title} · ${genreTag}`;
  }

  function playNextTrack() {
    let nextTrack = null;
    if (upNextSkipOffset === 0 && typeof consumeNextQueuedTrack === 'function') {
      nextTrack = consumeNextQueuedTrack();
    }
    if (!nextTrack) {
      nextTrack = resolveNextCandidate(upNextSkipOffset).track;
    }
    upNextSkipOffset = 0;
    upNextDismissedForTrackId = '';
    if (nextTrack) {
      selectTrack(nextTrack);
      showToast(`⏭ Memutar Berikutnya: ${nextTrack.artist} · ${nextTrack.title}`);
    }
  }

  function playPreviousTrack() {
    const { currentTime } = getAudioTime();
    if (currentTime > 3.5) {
      seekPlayback(0);
      showToast('⏮ Mengulang lagu dari awal');
      return;
    }
    const queue = typeof getQueueTracks === 'function' ? getQueueTracks() : getTracks();
    if (!queue.length) return;
    const cur = getActiveTrack();
    const curIdx = queue.findIndex((t) => t.id === cur?.id);
    const prevIdx = curIdx >= 0 ? (curIdx - 1 + queue.length) % queue.length : 0;
    const prevTrack = queue[prevIdx];
    if (prevTrack) {
      selectTrack(prevTrack);
      showToast(`⏮ Memutar Sebelumnya: ${prevTrack.artist} · ${prevTrack.title}`);
    }
  }

  function hideUpNextPill() {
    if (!lastRenderedUpNextVisible || !upNextPillEl) return;
    lastRenderedUpNextVisible = false;
    lastRenderedUpNextLabel = '';
    upNextPillEl.hidden = true;
  }

  let filterSweepTriggered = false;
  let lastFilterTrackId = '';

  setUpNextSyncCallback(({ effectiveTime, duration, activeTrackId }) => {
    if (!upNextPillEl || !upNextTrackLabelEl) return;
    if (upNextTrackIdRef !== activeTrackId) {
      upNextTrackIdRef = activeTrackId;
      upNextSkipOffset = 0;
      upNextDismissedForTrackId = '';
    }

    if (lastFilterTrackId !== activeTrackId) {
      lastFilterTrackId = activeTrackId;
      filterSweepTriggered = false;
    }

    // Filter-Sweep Crossfade: gentle low-pass sweep over the final 2.5s before Auto-Next track transition
    if (isAutoNext && duration > 10 && duration - effectiveTime <= 2.5 && !filterSweepTriggered) {
      filterSweepTriggered = true;
      triggerFilterSweep(2.5);
    } else if (filterSweepTriggered && duration > 10 && duration - effectiveTime > 2.6) {
      // User seeked backward out of the filter sweep transition window
      filterSweepTriggered = false;
      resetCrossfadeFilter(0.2);
    }

    const customQ = typeof getUpNextQueue === 'function' ? getUpNextQueue() : [];
    const inWindow =
      (isAutoNext || customQ.length > 0) &&
      duration > 20 &&
      effectiveTime >= duration - 15 &&
      effectiveTime < duration - 0.1 &&
      upNextDismissedForTrackId !== activeTrackId;

    if (!inWindow) {
      hideUpNextPill();
      return;
    }

    const candidateInfo = resolveNextCandidate(upNextSkipOffset);
    const candidate = candidateInfo.track;
    if (!candidate || (candidate.id === activeTrackId && !candidateInfo.isCustomQueue)) {
      hideUpNextPill();
      return;
    }

    const nextLabel = formatUpNextText(candidateInfo);
    if (!lastRenderedUpNextVisible) {
      lastRenderedUpNextVisible = true;
      upNextPillEl.hidden = false;
    }
    if (lastRenderedUpNextLabel !== nextLabel) {
      lastRenderedUpNextLabel = nextLabel;
      upNextTrackLabelEl.textContent = nextLabel;
    }
  });

  btnUpNextPlayEl?.addEventListener('click', () => {
    hideUpNextPill();
    playNextTrack();
  });

  btnUpNextSkipEl?.addEventListener('click', () => {
    const queue = typeof getQueueTracks === 'function' ? getQueueTracks() : getTracks();
    const customLen = typeof getUpNextQueue === 'function' ? getUpNextQueue().length : 0;
    const curId = getActiveTrack()?.id;
    const maxCandidates = customLen + queue.filter((t) => t.id !== curId).length;
    if (maxCandidates > 1 && upNextSkipOffset + 1 < maxCandidates) {
      upNextSkipOffset += 1;
      const altInfo = resolveNextCandidate(upNextSkipOffset);
      if (altInfo.track) {
        const nextLabel = formatUpNextText(altInfo);
        lastRenderedUpNextLabel = nextLabel;
        if (upNextTrackLabelEl) upNextTrackLabelEl.textContent = nextLabel;
        showToast(`⏭ Antrean digeser ke: ${altInfo.track.title}`);
        return;
      }
    }
    upNextDismissedForTrackId = curId || '__dismissed__';
    hideUpNextPill();
    showToast('⏭ Pratinjau Berikutnya disembunyikan');
  });

  setTrackEndedHandler(() => {
    if (isAutoNext) playNextTrack();
  });

  btnAutoNext?.addEventListener('click', () => {
    isAutoNext = !isAutoNext;
    btnAutoNext.classList.toggle('active', isAutoNext);
    btnAutoNext.setAttribute('aria-pressed', String(isAutoNext));
    if (!isAutoNext) hideUpNextPill();
    showToast(isAutoNext ? '🔁 Auto-Next: AKTIF' : '⏸ Auto-Next: NONAKTIF');
  });

  refreshGenreOptions();

  // 5. Quote Card PNG Exporter & Share Moment
  let quoteCardRatio = '9:16'; // '9:16' | '1:1'

  async function handleExportQuoteCard(action = 'download') {
    try {
      const activeTrack = getActiveTrack();
      const snap = getActiveLyricSnapshot();
      const actStepEl = document.querySelector('.chapter-step.active');
      const actLabel = actStepEl ? actStepEl.textContent.trim() : '';

      const { filename, copied } = await exportLyricQuoteCard({
        track: activeTrack,
        words: snap.words,
        fallbackText: snap.text || activeTrack?.description,
        currentTime: snap.currentTime,
        aspectRatio: quoteCardRatio,
        action,
        actLabel,
      });

      if (copied) {
        showToast('📋 Gambar Quote Card berhasil disalin ke Clipboard!');
      } else {
        showToast(`🖼 Quote Card terunduh (${quoteCardRatio}): ${filename}`);
      }
    } catch (err) {
      console.warn('Quote card export failed:', err);
      showToast('⚠ Gagal membuat Quote Card PNG');
    }
  }

  function toggleQuoteRatio() {
    quoteCardRatio = quoteCardRatio === '9:16' ? '1:1' : '9:16';
    const labelEl = document.getElementById('quoteRatioLabel');
    if (labelEl) {
      labelEl.textContent = `📐 Rasio: ${quoteCardRatio === '9:16' ? '9:16 (Story)' : '1:1 (Feed)'}`;
    }
    showToast(`📐 Rasio Quote Card: ${quoteCardRatio === '9:16' ? '9:16 (Story)' : '1:1 (Feed)'}`);
  }

  function legacyCopyText(text) {
    const field = Object.assign(document.createElement('textarea'), { value: text });
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;top:0;opacity:0';
    document.body.append(field);
    field.select();
    try {
      return document.execCommand('copy');
    } finally {
      field.remove();
    }
  }

  async function handleShareMoment() {
    const activeTrack = getActiveTrack();
    const sec = Math.max(0, Math.floor(getAudioTime().currentTime));
    const shareUrl = new URL(window.location.href);
    if (activeTrack && !String(activeTrack.id).startsWith('custom-')) {
      shareUrl.searchParams.set('track', activeTrack.id);
    }
    shareUrl.searchParams.set('t', String(sec));
    const finalStr = shareUrl.toString();

    try {
      await navigator.clipboard.writeText(finalStr);
      showToast(`🔗 Tautan momen disalin (${formatLoopSec(sec)})`);
    } catch {
      if (legacyCopyText(finalStr)) showToast(`🔗 Tautan momen disalin (${formatLoopSec(sec)})`);
      else showToast('⚠ Gagal menyalin tautan momen');
    }
  }

  document.getElementById('btnQuoteCard')?.addEventListener('click', () => handleExportQuoteCard('download'));
  document.getElementById('btnCopyQuoteCard')?.addEventListener('click', () => handleExportQuoteCard('copy'));
  document.getElementById('btnQuoteRatio')?.addEventListener('click', toggleQuoteRatio);
  document.getElementById('btnShareMoment')?.addEventListener('click', handleShareMoment);

  // 6. Studio Popover Toggle
  const btnStudioPopover = document.getElementById('btnStudioPopover');
  const studioPopoverEl = document.getElementById('studioPopover');

  function setStudioPopoverOpen(isOpen, silent = false) {
    if (!studioPopoverEl) return;
    studioPopoverEl.hidden = !isOpen;
    if (btnStudioPopover) {
      btnStudioPopover.classList.toggle('active', isOpen);
      btnStudioPopover.setAttribute('aria-pressed', String(isOpen));
      btnStudioPopover.setAttribute('aria-expanded', String(isOpen));
    }
    if (!silent) showToast(isOpen ? '🎛 Panel Studio: TERBUKA' : '🎛 Panel Studio: TERTUTUP');
  }

  function toggleDirectorHud() {
    if (!studioPopoverEl) return;
    setStudioPopoverOpen(studioPopoverEl.hidden);
  }

  btnStudioPopover?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDirectorHud();
  });

  document.addEventListener('pointerdown', (e) => {
    if (!studioPopoverEl || studioPopoverEl.hidden) return;
    if (studioPopoverEl.contains(e.target) || btnStudioPopover?.contains(e.target)) return;
    setStudioPopoverOpen(false, true);
  });

  // 6b. Studio Popover 3-Tab Navigation (v16.0)
  const tabNavBtns = Array.from(document.querySelectorAll('[data-studio-tab]'));
  const tabPanels = {
    audio: document.getElementById('studioTabAudio'),
    visual: document.getElementById('studioTabVisual'),
    export: document.getElementById('studioTabExport'),
  };
  const STORAGE_KEY_STUDIO_TAB = 'stages_of_denial_studio_tab';

  function switchStudioTab(tabKey) {
    const valid = ['audio', 'visual', 'export'].includes(tabKey) ? tabKey : 'audio';
    tabNavBtns.forEach((btn) => {
      const active = btn.dataset.studioTab === valid;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    Object.entries(tabPanels).forEach(([key, panel]) => {
      if (!panel) return;
      const isTarget = key === valid;
      panel.hidden = !isTarget;
      panel.classList.toggle('active', isTarget);
    });
    try {
      localStorage.setItem(STORAGE_KEY_STUDIO_TAB, valid);
    } catch {}
  }

  tabNavBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchStudioTab(btn.dataset.studioTab);
    });
  });

  // Restore persisted tab on init
  const initialTab = localStorage.getItem(STORAGE_KEY_STUDIO_TAB) || 'audio';
  switchStudioTab(initialTab);

  // Close button inside studio popover header
  document.getElementById('btnCloseStudioPopover')?.addEventListener('click', () => {
    setStudioPopoverOpen(false);
  });

  // 7. Babak IV Outro, Lyric Drawer & A-B Loop HUD buttons
  document.getElementById('btnOutroReplay')?.addEventListener('click', () => {
    seekPlayback(0);
    if (!isAudioPlaying()) togglePlayPause();
    showToast('↻ Memutar ulang lagu dari awal');
  });
  document.getElementById('btnOutroNext')?.addEventListener('click', playNextTrack);
  document.getElementById('btnOutroQuote')?.addEventListener('click', handleExportQuoteCard);
  document.getElementById('btnOutroShare')?.addEventListener('click', handleShareMoment);

  document.getElementById('btnLyricDrawer')?.addEventListener('click', () => {
    const open = toggleLyricDrawer();
    showToast(open ? '📜 Panel Lirik: TERBUKA' : '📜 Panel Lirik: TERTUTUP');
  });

  document.getElementById('btnClearLoop')?.addEventListener('click', () => {
    clearABLoop();
    showToast('✕ Loop A–B dibatalkan');
  });

  // 7b. Live Lyric Sync Offset Fine-Tuner (±50ms) & Translation Toggle
  const syncReadoutEls = Array.from(document.querySelectorAll('.studio-sync-readout'));
  const formatOffsetSec = (sec) => {
    const v = Math.round((Number(sec) || 0) * 100) / 100;
    if (v === 0) return '0.00s';
    return `${v > 0 ? '+' : ''}${v.toFixed(2)}s`;
  };
  const renderSyncOffsetReadouts = (sec) => {
    const label = formatOffsetSec(sec);
    syncReadoutEls.forEach((el) => {
      el.textContent = label;
    });
  };
  setLyricOffsetChangeCallback((sec) => renderSyncOffsetReadouts(sec));
  renderSyncOffsetReadouts(getLyricSyncOffset());

  document.querySelectorAll('[data-sync-delta]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = adjustLyricSyncOffset(Number(btn.dataset.syncDelta) || 0);
      showToast(`⏱ Sync Lirik: ${formatOffsetSec(next)}`);
    });
  });

  document.querySelectorAll('[data-sync-reset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = setLyricSyncOffset(0);
      showToast(`⏱ Sync Lirik direset (${formatOffsetSec(next)})`);
    });
  });

  const btnToggleTranslation = document.getElementById('btnToggleTranslation');
  const syncTranslationBtnUi = (enabled) => {
    if (!btnToggleTranslation) return;
    btnToggleTranslation.classList.toggle('active', enabled);
    btnToggleTranslation.setAttribute('aria-pressed', String(enabled));
    const span = btnToggleTranslation.querySelector('span');
    if (span) span.textContent = enabled ? '🌐 Terjemahan: ON' : '🌐 Terjemahan: OFF';
  };
  syncTranslationBtnUi(isTranslationEnabled());
  btnToggleTranslation?.addEventListener('click', () => {
    const next = setTranslationEnabled(!isTranslationEnabled());
    syncTranslationBtnUi(next);
    showToast(next ? '🌐 Terjemahan Lirik: AKTIF' : '🌐 Terjemahan Lirik: NONAKTIF');
  });

  // Dynamic 35mm Cinema Letterbox Toggle
  const btnToggleLetterbox = document.getElementById('btnToggleLetterbox');
  let letterboxPref = (() => {
    try {
      return localStorage.getItem('sod_letterbox_enabled') !== 'false';
    } catch {
      return true;
    }
  })();

  const syncLetterboxBtnUi = (enabled) => {
    document.body.classList.toggle('letterbox-disabled', !enabled);
    if (!btnToggleLetterbox) return;
    btnToggleLetterbox.classList.toggle('active', enabled);
    btnToggleLetterbox.setAttribute('aria-pressed', String(enabled));
    const span = btnToggleLetterbox.querySelector('span');
    if (span) span.textContent = enabled ? '🎬 Letterbox: ON' : '🎬 Letterbox: OFF';
  };
  syncLetterboxBtnUi(letterboxPref);

  btnToggleLetterbox?.addEventListener('click', () => {
    letterboxPref = !letterboxPref;
    syncLetterboxBtnUi(letterboxPref);
    try {
      localStorage.setItem('sod_letterbox_enabled', letterboxPref ? 'true' : 'false');
    } catch {}
    showToast(letterboxPref ? '🎬 Dynamic Letterbox: AKTIF' : '🎬 Dynamic Letterbox: NONAKTIF');
  });

  // Visual Eye-Comfort Extra Reactive Effects Toggle
  const btnToggleExtraReactive = document.getElementById('btnToggleExtraReactive');
  const syncExtraReactiveBtnUi = (enabled) => {
    if (!btnToggleExtraReactive) return;
    btnToggleExtraReactive.classList.toggle('active', enabled);
    btnToggleExtraReactive.setAttribute('aria-pressed', String(enabled));
    const span = document.getElementById('extraReactiveStatusText');
    if (span) span.textContent = enabled ? '✨ Efek Ekstra: ON' : '✨ Efek Ekstra: OFF';
  };
  syncExtraReactiveBtnUi(getExtraReactiveEffects());

  btnToggleExtraReactive?.addEventListener('click', () => {
    const nextState = !getExtraReactiveEffects();
    setExtraReactiveEffects(nextState);
    syncExtraReactiveBtnUi(nextState);
    showToast(nextState ? '✨ Efek Reaktif Ekstra: AKTIF (Beat Flash ON)' : '✨ Efek Reaktif Ekstra: NONAKTIF (Clean & Eye-Comfort)');
  });

  document.getElementById('btnExportLrc')?.addEventListener('click', () => {
    const subs = getPreloadedSubtitles().filter((s) => s && !s.isInstrumental && s.text);
    if (!subs.length) {
      showToast('⚠ Belum ada lirik vokal untuk diekspor (.LRC)');
      return;
    }
    const lrcText = subs
      .map((s) => {
        const safe = Math.max(0, Number(s.start) || 0);
        const mins = String(Math.floor(safe / 60)).padStart(2, '0');
        const rem = safe - Math.floor(safe / 60) * 60;
        const secs = String(Math.floor(rem)).padStart(2, '0');
        const cs = String(Math.min(99, Math.round((rem - Math.floor(rem)) * 100))).padStart(2, '0');
        const plain = String(s.text).replace(/<[^>]+>/g, '').trim();
        return `[${mins}:${secs}.${cs}] ${plain}`;
      })
      .join('\n');
    const track = getActiveTrack?.();
    const slug = String(track?.id || 'lyrics').replace(/[^a-z0-9-_]+/gi, '-');
    const blob = new Blob([lrcText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.lrc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`📄 Mengunduh ${slug}.lrc (${subs.length} baris)`);
  });

  document.getElementById('btnOpenTapSyncPopover')?.addEventListener('click', () => {
    setStudioPopoverOpen(false, true);
    onOpenTapSync?.();
  });

  // 8. Scene Intensity, Playback Speed & Sleep Timer controls
  const sceneSegBtns = Array.from(document.querySelectorAll('[data-scene]'));
  sceneSegBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = setSceneIntensity(btn.dataset.scene);
      document.body.classList.toggle('scene-mode-ambient', mode === 'ambient');
      sceneSegBtns.forEach((b) => {
        const active = b.dataset.scene === mode;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      const labels = { cinema: 'Cinema Standard', pure: 'Pure Visualizer', ambient: 'Ambient Focus' };
      showToast(`🎬 Scene Mode: ${labels[mode] || mode}`);
    });
  });

  // 8b. 2D Cinematic Scene Archetype controls (v16.0 18-Archetype System)
  const scene2dSegBtns = Array.from(document.querySelectorAll('[data-scene-2d]'));
  const btnRandomScene2d = document.getElementById('btnRandomScene2d');

  function syncScene2dUi(activeMode, userSetting) {
    scene2dSegBtns.forEach((b) => {
      const mode = b.getAttribute('data-scene-2d');
      const active = mode === userSetting;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  }

  if (scene2dSegBtns.length) {
    const { userSetting, activeMode } = getScene2DArchetype();
    syncScene2dUi(activeMode, userSetting);

    scene2dSegBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = btn.getAttribute('data-scene-2d');
        const newActive = setScene2DArchetype(chosen);
        syncScene2dUi(newActive, chosen);
        const meta = SCENE_ARCHETYPES.find((s) => s.id === chosen);
        const activeMeta = SCENE_ARCHETYPES.find((s) => s.id === newActive);
        const chosenLabel = chosen === 'auto' ? 'Auto (Adaptif)' : (meta ? meta.name : chosen);
        const activeLabel = activeMeta ? activeMeta.name : newActive;
        showToast(`🎨 Panggung 2D: ${chosenLabel} (Aktif: ${activeLabel})`);
      });
    });

    btnRandomScene2d?.addEventListener('click', () => {
      const candidates = SCENE_ARCHETYPES.map((s) => s.id);
      const randomChosen = candidates[Math.floor(Math.random() * candidates.length)];
      const newActive = setScene2DArchetype(randomChosen);
      syncScene2dUi(newActive, randomChosen);
      const meta = SCENE_ARCHETYPES.find((s) => s.id === randomChosen);
      showToast(`🎲 Acak Panggung: ${meta ? `${meta.icon} ${meta.name}` : randomChosen}`);
    });
  }

  const directorSpeedEl = document.getElementById('directorSpeed');
  const speedSegBtns = Array.from(document.querySelectorAll('[data-speed]'));
  speedSegBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const rate = setPlaybackSpeed(Number(btn.dataset.speed));
      speedSegBtns.forEach((b) => {
        const active = Number(b.dataset.speed) === rate;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      if (directorSpeedEl) {
        directorSpeedEl.textContent = `${rate}x`;
      }
      showToast(`⏩ Kecepatan Putar: ${rate}x`);
    });
  });

  const sleepSegBtns = Array.from(document.querySelectorAll('[data-sleep]'));
  const sleepBadgeEl = document.getElementById('sleepRemainingBadge');
  let sleepUiIntervalId = 0;

  function updateSleepBadgeUi() {
    const { mode, remainingSeconds } = getSleepTimerState();
    if (!sleepBadgeEl) return;
    if (mode === 'off' || remainingSeconds === null) {
      sleepBadgeEl.hidden = true;
      if (sleepUiIntervalId) {
        clearInterval(sleepUiIntervalId);
        sleepUiIntervalId = 0;
      }
      sleepSegBtns.forEach((b) => {
        const active = b.dataset.sleep === 'off';
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      return;
    }
    sleepBadgeEl.hidden = false;
    sleepBadgeEl.textContent = formatLoopSec(remainingSeconds);
  }

  sleepSegBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.sleep || 'off';
      setSleepTimer(mode, () => {
        updateSleepBadgeUi();
        showToast('🌙 Sleep Timer selesai — audio dijeda');
      });
      sleepSegBtns.forEach((b) => {
        const active = b.dataset.sleep === mode;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      if (sleepUiIntervalId) {
        clearInterval(sleepUiIntervalId);
        sleepUiIntervalId = 0;
      }
      if (mode !== 'off') {
        updateSleepBadgeUi();
        sleepUiIntervalId = window.setInterval(updateSleepBadgeUi, 1000);
        showToast(`🌙 Sleep Timer: ${mode === 'end' ? 'Akhir Lagu' : mode}`);
      } else {
        updateSleepBadgeUi();
        showToast('🌙 Sleep Timer dimatikan');
      }
    });
  });

  // 9. Drag & Drop Custom .MP3 + .LRC Studio
  const dropOverlay = document.getElementById('dropOverlay');
  let dragDepth = 0;
  const isAudioFile = (file) => file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name);
  const isLrcFile = (file) => /\.lrc$/i.test(file.name) || file.type === 'text/plain';

  window.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragDepth += 1;
    dropOverlay?.classList.add('visible');
    dropOverlay?.setAttribute('aria-hidden', 'false');
  });

  window.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
  });

  window.addEventListener('dragleave', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      dropOverlay?.classList.remove('visible');
      dropOverlay?.setAttribute('aria-hidden', 'true');
    }
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragDepth = 0;
    dropOverlay?.classList.remove('visible');
    dropOverlay?.setAttribute('aria-hidden', 'true');

    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.length) return;
    const audioFile = files.find(isAudioFile);
    const lrcFile = files.find((f) => /\.lrc$/i.test(f.name)) || (!audioFile ? files.find(isLrcFile) : null);

    let parsedLrc = null;
    if (lrcFile) {
      const rawLrc = await lrcFile.text();
      parsedLrc = parseLrcText(rawLrc, (audioFile || lrcFile).name.replace(/\.[^.]+$/, ''));
    }

    if (audioFile) {
      const cleanTitle = audioFile.name.replace(/\.[^.]+$/, '');
      const dyn = generateDynamicTrackPalette(cleanTitle);
      const customTrack = {
        id: `custom-${Date.now()}`,
        title: cleanTitle,
        artist: 'Custom Studio',
        year: 'Studio',
        genre: parsedLrc ? 'MP3 + LRC' : 'User Audio',
        ...dyn,
        bgColor: '#0B0C10',
        videoSrc: '',
        subtitles: parsedLrc ? parsedLrc.subtitles : [],
        lyricMode: parsedLrc ? 'synced' : 'instrumental',
        acts: parsedLrc ? parsedLrc.acts : [],
        description: 'Custom Local Studio Playback',
      };
      await selectTrack(customTrack, audioFile);
      showToast(`🎧 Custom Studio: ${cleanTitle}${parsedLrc ? ` (${parsedLrc.subtitles.length} baris LRC)` : ''}`);
    } else if (parsedLrc && parsedLrc.subtitles.length > 0) {
      const merged = {
        ...getActiveTrack(),
        subtitles: parsedLrc.subtitles,
        lyricMode: 'synced',
        acts: parsedLrc.acts,
      };
      setCustomTrack(merged);
      setActiveTrack(merged);
      showToast(`📝 Lirik LRC disinkronkan (${parsedLrc.subtitles.length} baris)`);
    }
  });

  return {
    toggleCinemaMode,
    exitCinemaMode,
    isCinemaActive: () => isCinemaMode,
    toggleDirectorHud,
    closeStudioPopover: () => setStudioPopoverOpen(false, true),
    isStudioPopoverOpen: () => Boolean(studioPopoverEl && !studioPopoverEl.hidden),
    handleExportQuoteCard,
    handleShareMoment,
    refreshGenreOptions,
    playNextTrack,
    playPreviousTrack,
    setAmbientIdleDelayMs: (ms) => {
      ambientIdleDelayMs = Math.max(200, Number(ms) || 25000);
      ambientLastActivityMs = performance.now();
    },
    destroy: () => clearInterval(ambientIdleIntervalId),
  };
}
