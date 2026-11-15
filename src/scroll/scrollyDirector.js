/**
 * scrollyDirector.js - Lenis Smooth Scroll, 4-Act Choreography, Lyric Drawer & Smart A-B Loop
 * Stages of Denial (v7.0 Modular Architecture)
 *
 * Features:
 * - Dynamic Choreography per Babak (scale 1.0 Act I -> 1.06 Act II -> 1.10 Climax -> 1.0 Outro)
 * - Auto-Scroll pause countdown indicator ("Auto-Scroll dilanjutkan dalam 4d...") on manual wheel
 * - Chapter & Signal Progress Indicator synchronization + Lyric Timeline Drawer + A-B Loop
 */

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import timelineData from '../../config/timeline.json';
import {
  getAudioTime,
  seekAudio,
  isAudioPlaying,
  isAudioSeeking,
  togglePlayPause,
  getFrequencyLevels,
  getVocalEnergy,
  getCurrentAudioProfile,
} from '../audio/audioEngine.js';
import { setVisualMode, setTheme, setChoreographyState } from '../visuals/canvasVisualizer.js';
import {
  loadTrackLyrics,
  preloadTrackLyrics,
  setTrackSubtitles,
  syncKineticSubtitles,
  resetLyricPool,
  setLyricSeekCallback,
  setLyricPreloadCallback,
  setStoryDimCallback,
  setEndingOutroActive,
  getPreloadedSubtitles,
  getCurrentLyricSlot,
  getLyricSignalStatus,
} from '../lyrics/karaokeEngine.js';

gsap.registerPlugin(ScrollTrigger);

/** Smooth vertical Lenis scroller instance */
export const lenis = new Lenis({
  duration: 1.4,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: 'vertical',
  smoothWheel: true,
});

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// === DOM REFERENCES ===
const ambientGlow = document.getElementById('ambientGlow');
const btnToggleAutoScroll = document.getElementById('btnToggleAutoScroll');
const autoScrollStatusText = document.getElementById('autoScrollStatusText');
const autoScrollCountdownPill = document.getElementById('autoScrollCountdownPill');
const hudTimeCurrent = document.getElementById('hudTimeCurrent');
const hudTimeDuration = document.getElementById('hudTimeDuration');
const hudProgressBar = document.getElementById('hudProgressBar');
const hudProgressFill = document.getElementById('hudProgressFill');
const bgVideo = document.getElementById('bgVideo');
const cinematicTransition = document.getElementById('cinematicTransition');

const bassMeterBar = document.getElementById('bassMeterBar');
const midMeterBar = document.getElementById('midMeterBar');
const trebleMeterBar = document.getElementById('trebleMeterBar');

const directorHudEl = document.getElementById('studioPopover');
const directorDspEl = document.getElementById('directorDsp');
const directorTimeEl = document.getElementById('directorTime');
const directorRateEl = document.getElementById('directorRate');
const directorPhaseEl = document.getElementById('directorPhase');

const lyricDrawerEl = document.getElementById('lyricDrawer');
const lyricDrawerListEl = document.getElementById('lyricDrawerList');
const lyricDrawerTitleEl = document.getElementById('lyricDrawerTrackTitle');
const btnLyricDrawerEl = document.getElementById('btnLyricDrawer');
const btnCloseLyricDrawerEl = document.getElementById('btnCloseLyricDrawer');
const hudLoopRangeEl = document.getElementById('hudLoopRange');
const btnClearLoopEl = document.getElementById('btnClearLoop');
const hudLoopLabelEl = document.getElementById('hudLoopLabel');
const chapterStepBtns = Array.from(document.querySelectorAll('.chapter-step[data-act]'));

let drawerRowEls = [];
let lastDrawerActiveIdx = -1;
let loopStartA = null;
let loopEndB = null;

let activeActs = timelineData.acts;
let ACT_CONFIG = activeActs.reduce((acc, act) => {
  acc[act.id] = act;
  return acc;
}, {});

let isAutoScroll = true;
let isUserInteracting = false;
let userResumeAtMs = 0;
let userInteractionTimeout = 0;
let lastCountdownText = '';
let lastActId = null;
let lastScrollY = window.scrollY || 0;
let storyHiddenForVocal = false;
let endingOutroActive = false;
let lastDirectorUpdateMs = 0;
let upNextSyncCb = null;

/** Register Smart "Up Next" sync callback invoked cleanly inside main sync loop. */
export function setUpNextSyncCallback(cb) {
  upNextSyncCb = typeof cb === 'function' ? cb : null;
}

let activeTrack = {
  id: 'penyangkalan',
  title: 'Penyangkalan',
  artist: 'for Revenge',
};

const ACT_CAMERA_ZOOM = {
  act1: 1.0,
  act2: 1.06,
  act3: 1.1,
  act4: 1.0,
};

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function setStoryDimmedForVocal(shouldDim) {
  const effectiveDim = endingOutroActive ? false : shouldDim;
  if (storyHiddenForVocal === effectiveDim) return;
  storyHiddenForVocal = effectiveDim;
  document.body.classList.toggle('lyric-focus-active', effectiveDim);
  document.querySelectorAll('.story-section .section-content').forEach((sec) => {
    sec.classList.toggle('hidden-during-vocal', effectiveDim);
    sec.classList.toggle('dimmed', effectiveDim);
  });
}

setStoryDimCallback(setStoryDimmedForVocal);

function renderLyricDrawerList(subs = getPreloadedSubtitles()) {
  if (!lyricDrawerListEl) return;
  lyricDrawerListEl.textContent = '';
  drawerRowEls = [];
  lastDrawerActiveIdx = -1;

  const frag = document.createDocumentFragment();
  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    const row = document.createElement('button');
    row.type = 'button';
    row.className = sub.isInstrumental ? 'lyric-drawer-row is-instrumental' : 'lyric-drawer-row';
    row.dataset.subIdx = String(i);
    row.setAttribute('role', 'listitem');

    const timeSpan = document.createElement('span');
    timeSpan.className = 'lyric-drawer-time';
    timeSpan.textContent = formatTime(sub.start);

    const textSpan = document.createElement('span');
    textSpan.textContent = sub.words ? sub.words.map((w) => w.text).join(' ') : '';

    row.appendChild(timeSpan);
    row.appendChild(textSpan);
    drawerRowEls.push(row);
    frag.appendChild(row);
  }
  lyricDrawerListEl.appendChild(frag);
}

setLyricPreloadCallback((subs) => renderLyricDrawerList(subs));

/** @param {boolean|null} [forceState=null] */
export function toggleLyricDrawer(forceState = null) {
  if (!lyricDrawerEl) return false;
  const nextVisible = forceState !== null ? Boolean(forceState) : lyricDrawerEl.hidden;
  lyricDrawerEl.hidden = !nextVisible;
  if (btnLyricDrawerEl) {
    btnLyricDrawerEl.classList.toggle('active', nextVisible);
    btnLyricDrawerEl.setAttribute('aria-pressed', String(nextVisible));
  }
  if (nextVisible) {
    lastDrawerActiveIdx = -1;
    syncLyricDrawerActive(getAudioTime().currentTime);
  }
  return nextVisible;
}

function syncLyricDrawerActive(effectiveTime) {
  if (!lyricDrawerEl || lyricDrawerEl.hidden || drawerRowEls.length === 0) return;
  const subs = getPreloadedSubtitles();

  let activeIdx = -1;
  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    if (effectiveTime >= sub.start - 0.15 && effectiveTime <= sub.end) {
      activeIdx = i;
      break;
    }
  }
  if (activeIdx === -1 || activeIdx === lastDrawerActiveIdx) return;

  if (lastDrawerActiveIdx >= 0 && drawerRowEls[lastDrawerActiveIdx]) {
    drawerRowEls[lastDrawerActiveIdx].classList.remove('is-active');
    drawerRowEls[lastDrawerActiveIdx].removeAttribute('aria-current');
  }
  lastDrawerActiveIdx = activeIdx;
  const activeRow = drawerRowEls[activeIdx];
  if (activeRow) {
    activeRow.classList.add('is-active');
    activeRow.setAttribute('aria-current', 'true');
    activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

if (lyricDrawerListEl) {
  lyricDrawerListEl.addEventListener('click', (e) => {
    const row = e.target.closest('.lyric-drawer-row');
    if (!row) return;
    const sub = getPreloadedSubtitles()[Number(row.dataset.subIdx)];
    if (!sub) return;
    seekPlayback(sub.start);
    if (!isAudioPlaying()) togglePlayPause();
  });
}

btnCloseLyricDrawerEl?.addEventListener('click', () => {
  toggleLyricDrawer(false);
  btnLyricDrawerEl?.focus({ preventScroll: true });
});

function updateLoopHudVisuals(durationSec = 240) {
  const dur = Math.max(1, Number(durationSec) || 240);
  if (hudLoopRangeEl) {
    if (loopStartA !== null && loopEndB !== null && loopEndB > loopStartA) {
      const leftPct = Math.max(0, Math.min(100, (loopStartA / dur) * 100));
      const widthPct = Math.max(1, Math.min(100 - leftPct, ((loopEndB - loopStartA) / dur) * 100));
      hudLoopRangeEl.style.left = `${leftPct.toFixed(2)}%`;
      hudLoopRangeEl.style.width = `${widthPct.toFixed(2)}%`;
      hudLoopRangeEl.hidden = false;
    } else if (loopStartA !== null) {
      hudLoopRangeEl.style.left = `${Math.max(0, Math.min(100, (loopStartA / dur) * 100)).toFixed(2)}%`;
      hudLoopRangeEl.style.width = '3px';
      hudLoopRangeEl.hidden = false;
    } else {
      hudLoopRangeEl.hidden = true;
    }
  }

  if (btnClearLoopEl) {
    btnClearLoopEl.hidden = loopStartA === null;
    if (hudLoopLabelEl) {
      hudLoopLabelEl.textContent =
        loopEndB !== null ? `A–B ${formatTime(loopStartA)}×` : `A ${formatTime(loopStartA)}×`;
    }
  }
}

/** Lock Loop Point A to current vocal phrase or timestamp. */
export function setLoopPointA() {
  const { currentTime, duration } = getAudioTime();
  const subs = getPreloadedSubtitles();
  const slot = getCurrentLyricSlot();
  const activeSub = slot && slot.subIndex >= 0 ? subs[slot.subIndex] : null;
  const candidate =
    activeSub && !activeSub.isInstrumental && currentTime >= activeSub.start && currentTime <= activeSub.end
      ? activeSub.start
      : Math.max(0, currentTime);

  loopStartA = Number(candidate.toFixed(2));
  if (loopEndB !== null && loopEndB <= loopStartA + 0.4) loopEndB = null;
  updateLoopHudVisuals(duration);
  return getABLoopState();
}

/** Lock Loop Point B and start Smart A-B Loop. */
export function setLoopPointB() {
  const { currentTime, duration } = getAudioTime();
  let candidateB = Math.max(0.5, Number(currentTime.toFixed(2)));
  if (loopStartA === null) {
    const subs = getPreloadedSubtitles();
    const slot = getCurrentLyricSlot();
    const activeSub = slot && slot.subIndex >= 0 ? subs[slot.subIndex] : null;
    loopStartA =
      activeSub && activeSub.start < candidateB - 0.5
        ? Number(activeSub.start.toFixed(2))
        : Number(Math.max(0, candidateB - 8).toFixed(2));
  }
  if (candidateB <= loopStartA + 0.4) {
    candidateB = Math.min(duration || 240, Number((loopStartA + 4).toFixed(2)));
  }
  loopEndB = candidateB;
  updateLoopHudVisuals(duration);
  return getABLoopState();
}

/** Clear active A-B Loop points. */
export function clearABLoop() {
  loopStartA = null;
  loopEndB = null;
  updateLoopHudVisuals(getAudioTime().duration);
  return getABLoopState();
}

/** @returns {{ a: number|null, b: number|null, active: boolean }} */
export function getABLoopState() {
  return {
    a: loopStartA,
    b: loopEndB,
    active: loopStartA !== null && loopEndB !== null && loopEndB > loopStartA,
  };
}

/**
 * Apply color theme variables and HUD track title for the active song.
 * @param {Object} track
 */
export function applyThemeForTrack(track) {
  if (!track) return;
  const root = document.documentElement;
  if (track.accentPrimary) root.style.setProperty('--accent-primary', track.accentPrimary);
  if (track.accentSecondary) root.style.setProperty('--accent-secondary', track.accentSecondary);
  if (track.accentCold) root.style.setProperty('--accent-cold', track.accentCold);
  if (track.bgColor) root.style.setProperty('--bg-color', track.bgColor);

  const hudTrackName = document.getElementById('hudTrackName');
  if (hudTrackName) hudTrackName.textContent = `${track.artist} · ${track.title}`;

  if (ambientGlow && track.accentPrimary) {
    ambientGlow.style.background = `radial-gradient(ellipse 65% 55% at 50% 50%, ${track.accentPrimary}26 0%, transparent 75%)`;
  }

  setTheme(
    track.theme || 'crimson',
    track.accentPrimary,
    track.accentSecondary,
    track.particleStyle,
    track.visualEnergy || 'calm'
  );
}

/**
 * Bind track metadata, update 4 Story Acts, and lazy-load decoupled lyrics JSON.
 * @param {Object} track
 */
export function setActiveTrack(track) {
  activeTrack = { ...activeTrack, ...track };

  if (track.acts && track.acts.length > 0) {
    activeActs = track.acts;
    ACT_CONFIG = activeActs.reduce((acc, act) => {
      acc[act.id] = act;
      return acc;
    }, {});

    activeActs.forEach((act) => {
      const sec = document.getElementById(act.id);
      if (sec) {
        const badge = sec.querySelector('.chapter-badge');
        const heading = sec.querySelector('.cinematic-heading');
        const lead = sec.querySelector('.cinematic-lead');
        const watermark = sec.querySelector('.act-watermark');
        if (badge && act.chapterBadge) badge.textContent = act.chapterBadge;
        if (heading && act.heading) heading.textContent = act.heading;
        if (lead && act.lead) lead.textContent = act.lead;
        if (watermark && act.roman) watermark.textContent = act.roman;
      }
    });
  }

  if (Array.isArray(track.subtitles)) {
    setTrackSubtitles(track.subtitles, track.lyricMode);
  } else {
    setTrackSubtitles([], 'loading');
    loadTrackLyrics(track).then((subs) => {
      if (activeTrack.id === track.id) {
        const hasVocal = subs.some((s) => s && !s.isInstrumental);
        const mode = track.lyricMode === 'instrumental' || !hasVocal ? 'instrumental' : track.lyricMode || 'synced';
        setTrackSubtitles(subs, mode);
      }
    });
  }

  clearABLoop();
  if (lyricDrawerTitleEl) lyricDrawerTitleEl.textContent = `${track.artist} · ${track.title}`;
  applyThemeForTrack(track);
  activateSection(lastActId || 'act1');
}

// === SCROLL INTERACTION & AUTO-SCROLL PAUSE COUNTDOWN ===
function updateAutoScrollCountdownUi(nowMs) {
  if (!autoScrollCountdownPill) return;
  const shouldShow = isAutoScroll && isUserInteracting && isAudioPlaying();
  if (!shouldShow) {
    if (lastCountdownText !== '') {
      lastCountdownText = '';
      autoScrollCountdownPill.hidden = true;
    }
    return;
  }
  const secsLeft = Math.max(1, Math.ceil((userResumeAtMs - nowMs) / 1000));
  const msg = `Auto-Scroll dilanjutkan dalam ${secsLeft}d...`;
  if (lastCountdownText !== msg) {
    lastCountdownText = msg;
    autoScrollCountdownPill.textContent = msg;
    autoScrollCountdownPill.hidden = false;
  }
}

function handleUserScroll() {
  if (!document.getElementById('gatewayOverlay')?.classList.contains('hidden')) return;
  isUserInteracting = true;
  userResumeAtMs = performance.now() + 4000;
  clearTimeout(userInteractionTimeout);
  userInteractionTimeout = setTimeout(() => {
    isUserInteracting = false;
    updateAutoScrollCountdownUi(performance.now());
  }, 4000);
}

window.addEventListener('wheel', handleUserScroll, { passive: true });
window.addEventListener('touchmove', handleUserScroll, { passive: true });
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.code)) {
    handleUserScroll();
  }
});

if (btnToggleAutoScroll) {
  btnToggleAutoScroll.addEventListener('click', () => {
    isAutoScroll = !isAutoScroll;
    btnToggleAutoScroll.classList.toggle('active', isAutoScroll);
    btnToggleAutoScroll.setAttribute('aria-pressed', String(isAutoScroll));
    if (autoScrollStatusText) {
      autoScrollStatusText.textContent = isAutoScroll ? 'Auto-Scroll' : 'Auto-Scroll: OFF';
    }
    updateAutoScrollCountdownUi(performance.now());
  });
}

let lastSeekTargetTime = null;
let seekLockUntil = 0;

/**
 * Seek playback, reset subtitle mutex slot, update chapter & Lenis scroll position instantly.
 * @param {number} targetSeconds
 */
export function seekPlayback(targetSeconds) {
  seekAudio(targetSeconds);
  lastSeekTargetTime = targetSeconds;
  seekLockUntil = performance.now() + 250;
  resetLyricPool();

  const { duration } = getAudioTime();
  if (hudTimeCurrent) hudTimeCurrent.textContent = formatTime(targetSeconds);
  const pct = duration > 0 ? `${((targetSeconds / duration) * 100).toFixed(2)}%` : '0%';
  if (hudProgressFill) hudProgressFill.style.width = pct;
  const cinemaProgressFill = document.getElementById('cinemaProgressFill');
  if (cinemaProgressFill) cinemaProgressFill.style.width = pct;

  syncKineticSubtitles(targetSeconds, getVocalEnergy());

  const matchingAct = activeActs?.find(
    (act) => typeof act.startTime === 'number' && targetSeconds >= act.startTime && targetSeconds <= act.endTime
  );
  if (matchingAct) activateSection(matchingAct.id);

  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll > 0 && duration > 0) {
    lenis.scrollTo((targetSeconds / duration) * maxScroll, { immediate: true });
  }
}

setLyricSeekCallback(seekPlayback);

if (hudProgressBar) {
  let isScrubbing = false;
  let scrubRafId = null;
  let lastScrubRatio = 0;

  const performScrub = (ratio) => seekPlayback(ratio * getAudioTime().duration);
  const onScrub = (e) => {
    const rect = hudProgressBar.getBoundingClientRect();
    lastScrubRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (!scrubRafId) {
      scrubRafId = requestAnimationFrame(() => {
        performScrub(lastScrubRatio);
        scrubRafId = null;
      });
    }
  };

  hudProgressBar.addEventListener('mousedown', (e) => {
    isScrubbing = true;
    onScrub(e);
  });
  window.addEventListener('mousemove', (e) => {
    if (isScrubbing) onScrub(e);
  });
  window.addEventListener('mouseup', () => {
    if (!isScrubbing) return;
    isScrubbing = false;
    if (scrubRafId) {
      cancelAnimationFrame(scrubRafId);
      scrubRafId = null;
    }
    performScrub(lastScrubRatio);
  });
}

const cinemaProgressBar = document.getElementById('cinemaProgressBar');
if (cinemaProgressBar) {
  cinemaProgressBar.addEventListener('click', (e) => {
    const rect = cinemaProgressBar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekPlayback(ratio * getAudioTime().duration);
  });
}

// Clickable Chapter Indicator Pills (Babak I -> II -> III -> IV)
chapterStepBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const actId = btn.dataset.act;
    const cfg = ACT_CONFIG[actId];
    if (cfg && typeof cfg.startTime === 'number') {
      seekPlayback(cfg.startTime + 0.1);
      if (!isAudioPlaying()) togglePlayPause();
    } else {
      activateSection(actId);
    }
  });
});

/**
 * Activate story chapter (`act1`..`act4`) with camera depth zoom choreography and visual mode.
 * @param {'act1'|'act2'|'act3'|'act4'} id
 */
export function activateSection(id) {
  const cfg = ACT_CONFIG[id];
  if (!cfg) return;

  if (lastActId && lastActId !== id && cinematicTransition) {
    cinematicTransition.classList.remove('flash-leak');
    void cinematicTransition.offsetWidth;
    cinematicTransition.classList.add('flash-leak');
    setTimeout(() => cinematicTransition.classList.remove('flash-leak'), 750);
  }
  lastActId = id;

  document.querySelectorAll('.story-section').forEach((s) => s.classList.remove('active'));
  const currentSection = document.getElementById(id);
  if (currentSection) {
    currentSection.classList.add('active');
    const content = currentSection.querySelector('.section-content');
    if (content) {
      content.classList.toggle('hidden-during-vocal', storyHiddenForVocal);
      content.classList.toggle('dimmed', storyHiddenForVocal);
    }
  }

  chapterStepBtns.forEach((btn) => {
    const isCurrent = btn.dataset.act === id;
    btn.classList.toggle('active', isCurrent);
    btn.setAttribute('aria-current', isCurrent ? 'step' : 'false');
  });

  setVisualMode(cfg.visualMode);
  setChoreographyState({ zoomFactor: ACT_CAMERA_ZOOM[id] ?? 1.0 });
  setTheme(
    cfg.theme || activeTrack.theme || 'crimson',
    activeTrack.accentPrimary,
    activeTrack.accentSecondary,
    activeTrack.particleStyle
  );

  if (ambientGlow && cfg.glowColor) {
    ambientGlow.style.background = `radial-gradient(ellipse 65% 55% at 50% 50%, ${cfg.glowColor}26 0%, transparent 75%)`;
  }
  if (bgVideo && cfg.videoFilter) {
    bgVideo.style.filter = cfg.videoFilter;
    bgVideo.style.opacity = cfg.videoOpacity;
  }
}

document.querySelectorAll('.story-section').forEach((section) => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top 55%',
    end: 'bottom 45%',
    onEnter: () => activateSection(section.id),
    onEnterBack: () => activateSection(section.id),
  });
});

// Entrance animations per Act
gsap.from('#act1 .act-watermark', { scrollTrigger: { trigger: '#act1', start: 'top 70%' }, opacity: 0, scale: 0.85, duration: 1.5, ease: 'power3.out' });
gsap.from('#act1 .cinematic-heading', { scrollTrigger: { trigger: '#act1', start: 'top 65%' }, opacity: 0, y: 45, duration: 1.2, ease: 'power3.out' });
gsap.from('#act2 .act-watermark', { scrollTrigger: { trigger: '#act2', start: 'top 70%' }, opacity: 0, scale: 0.85, duration: 1.5, ease: 'power3.out' });
gsap.from('#act2 .cinematic-heading', { scrollTrigger: { trigger: '#act2', start: 'top 65%' }, opacity: 0, y: 40, duration: 1.1, ease: 'power3.out' });
gsap.from('#act3 .climax-heading', { scrollTrigger: { trigger: '#act3', start: 'top 60%' }, opacity: 0, scale: 0.88, duration: 1.0, ease: 'back.out(1.4)' });
gsap.from('#act3 .holographic-freq-hud', { scrollTrigger: { trigger: '#act3', start: 'top 50%' }, opacity: 0, y: 35, duration: 1.0, ease: 'power3.out' });
gsap.from('#act4 .cinematic-heading', { scrollTrigger: { trigger: '#act4', start: 'top 65%' }, opacity: 0, y: 40, duration: 1.1, ease: 'power3.out' });
gsap.from('#act4 .developer-note', { scrollTrigger: { trigger: '#act4', start: 'top 60%' }, opacity: 0, y: 25, duration: 1.0, ease: 'power2.out' });

document.getElementById('btnScrollTop')?.addEventListener('click', () => {
  seekPlayback(0);
  lenis.scrollTo(0, { duration: 2.2 });
});

activateSection('act1');

/** Main 60 FPS synchronization loop coordinating audio, subtitles, acts, scroll & choreography. */
function syncLoop() {
  try {
    const nowMs = performance.now();
    const { currentTime, duration, progress } = getAudioTime();
    const levels = getFrequencyLevels();
    const vocalTelemetry = getVocalEnergy();

    let effectiveTime = currentTime;
    let effectiveProgress = progress;
    if (lastSeekTargetTime !== null && (nowMs < seekLockUntil || isAudioSeeking())) {
      effectiveTime = lastSeekTargetTime;
      effectiveProgress = duration > 0 ? Math.min(1, Math.max(0, effectiveTime / duration)) : progress;
    } else {
      lastSeekTargetTime = null;
    }

    if (loopStartA !== null && loopEndB !== null && isAudioPlaying() && effectiveTime >= loopEndB) {
      seekPlayback(loopStartA);
      effectiveTime = loopStartA;
      effectiveProgress = duration > 0 ? Math.min(1, Math.max(0, effectiveTime / duration)) : progress;
    }

    if (hudTimeCurrent) hudTimeCurrent.textContent = formatTime(effectiveTime);
    if (hudTimeDuration) hudTimeDuration.textContent = formatTime(duration);
    if (hudProgressFill) hudProgressFill.style.width = `${(effectiveProgress * 100).toFixed(2)}%`;

    syncLyricDrawerActive(effectiveTime);

    const cinemaProgressFill = document.getElementById('cinemaProgressFill');
    if (cinemaProgressFill) cinemaProgressFill.style.width = `${(effectiveProgress * 100).toFixed(2)}%`;

    if (bassMeterBar) bassMeterBar.style.width = `${((levels.bass / 255) * 100).toFixed(1)}%`;
    if (midMeterBar) midMeterBar.style.width = `${((levels.mid / 255) * 100).toFixed(1)}%`;
    if (trebleMeterBar) trebleMeterBar.style.width = `${((levels.treble / 255) * 100).toFixed(1)}%`;

    // Track scroll velocity for stardust trails + auto-scroll countdown badge
    const curScrollY = window.scrollY || 0;
    const scrollDelta = curScrollY - lastScrollY;
    lastScrollY = curScrollY;

    updateAutoScrollCountdownUi(nowMs);

    if (isAudioPlaying() && isAutoScroll && !isUserInteracting) {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll > 0) lenis.scrollTo(effectiveProgress * maxScroll, { immediate: false, lerp: 0.05 });
    }

    if (getPreloadedSubtitles().length > 0) {
      syncKineticSubtitles(effectiveTime, vocalTelemetry);
    }

    if (activeActs) {
      const matchingAct = activeActs.find(
        (act) => typeof act.startTime === 'number' && effectiveTime >= act.startTime && effectiveTime <= act.endTime
      );
      if (matchingAct && lastActId !== matchingAct.id) activateSection(matchingAct.id);

      // Compute continuous scroll-linked camera depth interpolation per Babak
      const actZoom = ACT_CAMERA_ZOOM[lastActId] ?? 1.0;
      const clampedDelta = Math.max(-25, Math.min(25, scrollDelta));
      setChoreographyState({ zoomFactor: actZoom, scrollVelocity: clampedDelta });
    }

    const isEnding = duration > 12 && effectiveTime >= duration - 8;
    if (endingOutroActive !== isEnding) {
      endingOutroActive = isEnding;
      if (isEnding) resetLyricPool();
      setEndingOutroActive(isEnding);
      document.body.classList.toggle('ending-outro-active', isEnding);
    }

    if (upNextSyncCb) {
      upNextSyncCb({ effectiveTime, duration, activeTrackId: activeTrack.id });
    }

    if (directorHudEl && !directorHudEl.hidden && nowMs - lastDirectorUpdateMs >= 65) {
      lastDirectorUpdateMs = nowMs;
      const slot = getCurrentLyricSlot();
      const subs = getPreloadedSubtitles();
      const activeSub = slot && slot.subIndex >= 0 ? subs[slot.subIndex] : null;
      const profile = getCurrentAudioProfile();
      if (directorDspEl) directorDspEl.textContent = profile.label;
      if (directorTimeEl) directorTimeEl.textContent = `${effectiveTime.toFixed(2)}s`;
      if (directorPhaseEl) directorPhaseEl.textContent = slot ? slot.phase : 'idle';
      if (directorRateEl) {
        if (activeSub && !activeSub.isInstrumental) {
          const span = Math.max(0.4, activeSub.end - activeSub.start);
          directorRateEl.textContent = `${((activeSub.totalSyllables || 1) / span).toFixed(1)}/s`;
        } else {
          directorRateEl.textContent = '0.0/s';
        }
      }
    }
  } catch (err) {
    console.warn('Exception caught in syncLoop:', err);
  }

  requestAnimationFrame(syncLoop);
}

/** Start the 60 FPS scrollytelling & subtitle choreography loop. */
export function startSyncLoop() {
  preloadTrackLyrics(timelineData);
  syncLoop();
}

export { getLyricSignalStatus };
