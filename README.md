# Stages of Denial (`penyangkalan-scrollytelling`)

> Pengalaman *audiovisual scrollytelling* sinematik 60 FPS berbasis Web Audio API, kanvas partikel adaptif per genre (*zero-allocation*), karaoke kata presisi tinggi (`50ms`), subtitle dwibahasa, serta kontrol studio interaktif.

**Stack:** ES Modules (`src/`) · Vite (`^5.4.11`) · Web Audio API · Canvas 2D · AudioMotion-Analyzer (`^4.5.4`) · GSAP (`^3.12.5`) · Lenis (`^1.1.20`)

---

## Fitur Utama

- **4-Act Audiovisual Scrollytelling**: Koreografi scroll dinamis (*Babak I · Verse → Babak II · Rising → Babak III · Climax → Babak IV · Outro*) dengan *depth camera zoom*, pergeseran warna *Silk Aurora*, serta *Eye-Comfort Cinema Theme* (`#0B0C10` / `#F2EFE9`).
- **Genre-Specific Canvas Physics (60 FPS Zero-Allocation)**:
  - `intense`: Partikel bara api (*rising embers*) + distorsi harmonik gelombang aurora.
  - `groovy`: *Sonic Pulse Rings* konsentris yang selaras dengan transien bass/mid.
  - `calm`: Rintik hujan diagonal halus dan riak air tenang.
- **Karaoke Kata & Subtitle Dwibahasa**:
  - Data lirik dimuat *lazy-loaded* dari `public/assets/lyrics/<id>.json`.
  - *Click-to-Seek* langsung pada kata lirik aktif.
  - **Live Lyric Sync Offset (`±0.05s`)** yang tersimpan per lagu di `localStorage`.
  - Toggle **Terjemahan Lirik (`ON/OFF`)** di bawah baris lirik utama.
- **Kontrol Studio & Antrean Putar**:
  - **Custom Up-Next Queue (`+ Antrean`)** pada kartu lagu & pratinjau `#upNextPill`.
  - **Browser Media Session API**: Sinkronisasi metadata, artwork, dan tombol media perangkat keras (`play`, `pause`, `nexttrack`, `previoustrack`, `seekto`).
  - **Web Audio DSP**, *Playback Speed* (`0.85x–1.15x`), *Smart A-B Loop*, *Midnight Sleep Timer*, *Quote Card PNG Exporter* (`1080×1920`), serta *Deep-Linking* (`?track=<id>&t=<detik>`).

---

## Cara Menjalankan Website

**Prasyarat:** Node.js v20+ dan npm.

```bash
# 1. Instalasi dependensi
npm install

# 2. Jalankan server pengembangan lokal (Vite)
npm run dev

# 3. Build bundle produksi ke direktori dist/
npm run build

# 4. Pratinjau hasil build produksi secara lokal
npm run preview
```

---

## Cara Memuat Audio & Lirik Lagu

Karena repositori publik ini tidak menyertakan berkas media `.mp3` atau `.mp4` berukuran besar, Anda dapat memutar lagu dengan dua cara:

1. **Drag & Drop Langsung di Browser (Tanpa Konfigurasi)**
   - Tarik dan jatuhkan berkas `.mp3` (dan opsional berkas `.lrc` secara bersamaan atau terpisah) ke jendela browser untuk langsung memutar dan menyinkronkan lirik.
   - Anda juga bisa menekan tombol **Unggah MP3** di dalam modal Jukebox (`L`).

2. **Menempatkan Berkas Lokal ke Folder `public/assets/`**
   - Salin berkas audio Anda ke `public/assets/audio/<id>.mp3` (sesuai `audioSrc` pada `config/tracks.json`, misalnya `public/assets/audio/penyangkalan.mp3`).
   - *(Opsional)* Salin video latar ke `public/assets/video/<id>.mp4`. Jika video tidak tersedia, latar belakang otomatis menampilkan animasi kanvas *Silk Aurora* 60 FPS.

---

## Struktur Direktori

```text
├── config/                    # Katalog lagu (tracks.json), timeline, & metadata
├── css/                       # Tema Eye-Comfort Cinema & layout responsif
├── public/assets/
│   ├── audio/                 # Tempat menaruh berkas MP3 lokal (diabaikan Git)
│   ├── covers/                # Thumbnail sampul album
│   ├── lyrics/                # Data lirik karaoke lazy-loaded (.json)
│   └── video/                 # Tempat menaruh video latar MP4 opsional (diabaikan Git)
├── src/
│   ├── audio/audioEngine.js       # Web Audio DSP, crossfade, sleep timer, Media Session
│   ├── lyrics/karaokeEngine.js    # Lazy loader, LRC parser, word sweep, translation & sync offset
│   ├── scroll/scrollyDirector.js  # Lenis + GSAP choreography, lyric drawer, A-B loop
│   ├── ui/jukeboxModal.js         # Modal Jukebox, filter mood/genre, custom queue
│   ├── ui/studioHud.js            # Minimalist Cinema Bar, Studio Popover, Quote Card trigger
│   ├── visuals/canvasVisualizer.js# Canvas 2D zero-allocation physics & aurora
│   ├── visuals/quoteCard.js       # Ekspor Lyric Quote Card PNG (1080x1920)
│   └── main.js                    # Bootstrap & orchestrator
├── index.html
├── package.json
└── vite.config.js
```

---

## Pintasan Keyboard

| Pintasan | Aksi |
|:---------|:-----|
| `Space` | Play / Pause pemutaran |
| `←` / `→` | Mundur / maju `5` detik |
| `↑` / `↓` | Naikkan / turunkan volume `±10%` |
| `M` | Mute / Unmute |
| `L` | Buka / tutup Modal Jukebox |
| `T` | Buka / tutup Panel Timeline Lirik & Sync |
| `D` | Buka / tutup Panel Studio & Telemetri |
| `[` / `]` / `\` | Set Titik A / Titik B / Hapus A-B Loop |
| `Q` | Unduh Lyric Quote Card PNG (`1080×1920`) |
| `F` | Mode Bioskop Layar Penuh |
| `Esc` | Tutup modal / panel / keluar Mode Bioskop |

---

## Lisensi

Proyek ini dirilis di bawah lisensi [MIT](LICENSE).
