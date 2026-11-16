<div align="center">

# Stages of Denial

**An eye-comfort 60 FPS audiovisual scrollytelling experience powered by Web Audio API, adaptive Canvas 2D physics, and 50ms precision kinetic karaoke.**

[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Web Audio API](https://img.shields.io/badge/Web_Audio-DSP_Engine-D65A70?style=flat-square)](#architecture)
[![Canvas 2D](https://img.shields.io/badge/Canvas_2D-Zero--Allocation_60FPS-68B2D6?style=flat-square)](#architecture)
[![License: MIT](https://img.shields.io/badge/License-MIT-A7A29C?style=flat-square)](LICENSE)

</div>

---

## Overview

**Stages of Denial** blends synchronized music playback, real-time audio spectrum analysis, and 4-act scroll choreography into a distraction-free, low-glare cinema interface (`#0B0C10` / `#F2EFE9`).

Because large `.mp3` and `.mp4` media files are excluded from this public repository, cloning and running the project works **immediately out of the box** via a built-in **Generative Ambient Pad** audio fallback and **Pure Silk Aurora** canvas renderer—with full support for loading your own local `.mp3` and `.lrc` files via Drag & Drop.

---

## Key Features

- **4-Act Scroll Choreography** — Smooth **Lenis** + **GSAP ScrollTrigger** transitions across *Verse → Rising → Climax → Outro* with subtle camera depth zoom and optical scrim contrast protection.
- **Context-Aware & Real-Time Dynamic Visuals (Zero-Allocation 60 FPS)** — Pre-allocated Canvas 2D layers that adapt automatically to track genre, live percussion beat flux, and spectral tone:
  - `high-tempo` (*J-Pop / Rock / Ska / Anime*): Prismatic Speed Streaks and beat-synced rhythmic pulse halos.
  - `dreamy` (*Indie / Alternative / Pop*): Interactive Constellation Starfield with proximity link lines.
  - `ballad` (*Folk / Acoustic / Ballad*): Volumetric Mist Layer and soft diagonal rain reflections.
  - `prism` (Custom User MP3s): Deterministic eye-comfort palette synthesis (`generateDynamicTrackPalette`) paired with *Prism Constellation & Aura*.
- **In-Browser Tap-to-Sync Lyric Studio** — Paste plain lyrics, tap `Space` in real time as vocals enter, undo lines, apply 50ms karaoke timings live, or export `.lrc` and `.json` files directly from the browser.
- **50ms Precision Kinetic Karaoke & Dual-Language Subtitles** — Lazy-loaded word schedules (`public/assets/lyrics/<id>.json`) with *Click-to-Seek*, per-track **Live Sync Offset (`±0.05s`)**, and toggleable Indonesian translations for foreign & regional lyrics.
- **Virtual Acoustic Room DSP (5 Modes)** — Cycle cleanly through *Studio Master*, *Midnight Lo-Fi*, *8D Spatial*, *Cathedral Hall* (algorithmic `2.4s` stereo `ConvolverNode`), and *Warm Vinyl* (band-pass analog warmth with subtle crackle generator).
- **Select2-Style Genre Filter & Studio Suite** — Searchable dark-cinema genre dropdown with icons and track counts, custom **Up-Next Queue (`+ Antrean`)**, **Ambient Cinema Idle Mode**, **Browser Media Session API**, pitch-preserved speed (`0.85x–1.15x`), Smart A-B Loop, Midnight Sleep Timer, and `1080×1920` Quote Card PNG export.
- **Zero-Media Graceful Fallback** — Automatically synthesizes an atmospheric **Generative Ambient Pad** routed through the Web Audio analyser when local MP3s are absent, while switching `#bgVideo` errors cleanly to Pure Silk Aurora.

---

## Quick Start

**Prerequisites:** Node.js `20+` and `npm`.

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd 01-stages-of-denial-public

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Other available scripts:

```bash
npm run build     # Build optimized production bundle to dist/
npm run preview   # Preview production build locally
```

You can also deep-link directly to any curated track and timestamp:  
`http://localhost:5173/?track=tarot&t=72`

---

## Loading Your Own Audio & Lyrics

1. **Instant Drag & Drop (Recommended)**
   - Drag and drop any `.mp3` file—or an `.mp3` + `.lrc` pair—directly onto the browser window to start synchronized playback immediately.
   - Alternatively, open the Jukebox (`L`) and click **Unggah MP3**.

2. **Local Assets Directory**
   - Place matching audio files in `public/assets/audio/<track-id>.mp3` (e.g., `public/assets/audio/penyangkalan.mp3`) and optional background loops in `public/assets/video/<track-id>.mp4`.
   - When local media files are absent, the experience automatically runs in ambient preview mode without errors.

---

## Architecture

```text
├── config/
│   ├── tracks.json               # 14 curated anthology tracks & visual themes
│   ├── timeline.json             # 4-act narrative structure
│   └── playlist_catalog.json     # Optional catalog metadata
├── css/
│   └── style.css                 # Eye-comfort cinema palette & responsive HUD
├── public/assets/
│   ├── audio/                    # Drop optional local .mp3 files here (gitignored)
│   ├── covers/                   # Track cover thumbnails
│   ├── lyrics/                   # Lazy-loaded 50ms karaoke schedules (.json)
│   └── video/                    # Drop optional local .mp4 loops here (gitignored)
├── src/
│   ├── audio/audioEngine.js      # Web Audio DSP, precision clock, ambient pad, Media Session
│   ├── lyrics/karaokeEngine.js   # Lazy loader, LRC parser, word sweep, sync offset & translation
│   ├── scroll/scrollyDirector.js # Lenis + GSAP 4-act choreography, lyric drawer, A-B loop
│   ├── ui/jukeboxModal.js        # Jukebox modal, mood/genre filter, custom queue
│   ├── ui/studioHud.js           # Cinema HUD, Studio popover, Quote Card trigger
│   ├── visuals/canvasVisualizer.js # Zero-allocation 60 FPS particles & Silk Aurora
│   ├── visuals/quoteCard.js      # 1080×1920 Quote Card PNG renderer
│   └── main.js                   # Application bootstrap & state orchestrator
├── index.html
├── package.json
└── vite.config.js
```

---

## Keyboard Shortcuts

| Key | Action |
|:---|:---|
| `Space` | Play / Pause |
| `←` / `→` | Seek `-5s` / `+5s` |
| `↑` / `↓` | Master volume `±10%` |
| `M` | Mute / Unmute |
| `L` | Toggle Jukebox library |
| `T` | Toggle Lyric Timeline & Live Sync drawer |
| `D` | Toggle Studio Popover & telemetry |
| `[` / `]` / `\` | Set Loop A / Set Loop B / Clear A-B Loop |
| `Q` | Export Lyric Quote Card PNG (`1080×1920`) |
| `F` | Toggle Fullscreen Cinema mode |
| `Esc` | Close active modal / drawer or exit Cinema mode |

---

## License

Released under the [MIT License](LICENSE).
