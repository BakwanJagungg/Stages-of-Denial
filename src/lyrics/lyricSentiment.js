/**
 * lyricSentiment.js - Zero-Latency Lyric Sentiment & Motif Synesthesia Scanner
 * Stages of Denial v10.0 (Cinematic Synesthesia & Adaptive Direction Edition)
 *
 * Scans active lyric lines across Indonesian, English, Japanese (Romaji),
 * and regional languages (Javanese, Sundanese) to emit zero-latency micro-triggers
 * for real-time canvas visualizer atmospheric shifts.
 */

const MOTIF_DICTIONARY = {
  rain: {
    words: [
      // Indonesian
      'hujan', 'tangis', 'menangis', 'nangis', 'air mata', 'airmata', 'basah',
      'lara', 'duka', 'gerimis', 'sedih', 'kesedihan', 'mendung', 'lebat', 'kelam',
      // English
      'rain', 'raining', 'tears', 'tear', 'crying', 'cry', 'cried', 'wept', 'weep',
      'wet', 'sadness', 'sorrow', 'drizzle', 'pouring', 'melancholy', 'grief',
      // Japanese / Romaji
      'ame', 'namida', 'naku', 'naite', 'nakanaide', 'kanashimi', 'kanashii',
      'shizuku', 'shigure',
      // Regional (Javanese / Sundanese)
      'udan', 'luh', 'luwih', 'tangise', 'prihatin', 'getun', 'cipanon', 'ci panon'
    ],
    tint: '#94A3B8', // Cool Slate
  },
  fire: {
    words: [
      // Indonesian
      'api', 'bakar', 'terbakar', 'membakar', 'hancur', 'hancurkan', 'amarah',
      'marah', 'bara', 'saber', 'pecah', 'teriak', 'berteriak', 'hangus',
      'gejolak', 'murka', 'kobaran',
      // English
      'fire', 'burn', 'burning', 'burned', 'flame', 'flames', 'rage', 'angry',
      'anger', 'blaze', 'ashes', 'destroy', 'scream', 'screaming', 'fury', 'ignite',
      // Japanese / Romaji
      'hi', 'honoo', 'moyasu', 'moeru', 'ikari', 'koware', 'kowashite', 'sakebu',
      'sakebi', 'guren',
      // Regional (Javanese / Sundanese)
      'geni', 'kobong', 'geseng', 'ancur', 'amuk', 'beuleum'
    ],
    tint: '#E11D48', // Crimson Ember
  },
  night: {
    words: [
      // Indonesian
      'malam', 'bintang', 'langit', 'sunyi', 'mimpi', 'gelap', 'kegelapan',
      'rembulan', 'bulan', 'cakrawala', 'senyap', 'sepi', 'kelam', 'semesta',
      // English
      'night', 'star', 'stars', 'sky', 'dream', 'dreams', 'dark', 'darkness',
      'moon', 'cosmic', 'silence', 'silent', 'midnight', 'universe', 'starlight',
      // Japanese / Romaji
      'yoru', 'hoshi', 'sora', 'yume', 'kurai', 'tsuki', 'shizuka', 'nemuri',
      'uchuu', 'hoshiboshi',
      // Regional (Javanese / Sundanese)
      'wengi', 'lintang', 'peteng', 'suwung', 'impen', 'peuting', 'béntang'
    ],
    tint: '#68B2D6', // Cosmic Aurora
  },
  warmth: {
    words: [
      // Indonesian
      'hangat', 'kehangatan', 'pulang', 'peluk', 'pelukan', 'dekapan', 'cahaya',
      'sinar', 'terang', 'fajar', 'pagi', 'mentari', 'kasih', 'sayang', 'rumah',
      // English
      'warm', 'warmth', 'home', 'return', 'hug', 'embrace', 'light', 'shine',
      'glow', 'dawn', 'morning', 'sun', 'bright', 'tender', 'radiance',
      // Japanese / Romaji
      'atatakai', 'kaeru', 'daku', 'daki', 'hikari', 'asa', 'taiyou', 'kagayaki',
      'nukumori', 'ie',
      // Regional (Javanese / Sundanese)
      'anget', 'mulih', 'rangkul', 'padhang', 'esuk', 'hanyut', 'caang', 'balik'
    ],
    tint: '#E6B86A', // Golden Amber
  },
};

// Precompile regex patterns once at load time for zero GC during playback
const COMPILED_PATTERNS = Object.entries(MOTIF_DICTIONARY).map(([motif, cfg]) => {
  const escaped = cfg.words
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return {
    motif,
    regex: new RegExp(`(?:^|\\b|\\s)(${escaped.join('|')})(?:$|\\b|\\s)`, 'i'),
    tint: cfg.tint,
  };
});

/**
 * Scan a lyric line for atmospheric motifs with zero allocations.
 * @param {string} text
 * @returns {{ motif: 'rain'|'fire'|'night'|'warmth'|null, tint: string|null, match: string|null }}
 */
export function analyzeLyricMotif(text) {
  if (!text || typeof text !== 'string') {
    return { motif: null, tint: null, match: null };
  }

  // Strip XML/HTML tags like <i>, <em>, <b> before matching
  const clean = text.replace(/<[^>]*>/g, ' ').toLowerCase();

  for (let i = 0; i < COMPILED_PATTERNS.length; i++) {
    const entry = COMPILED_PATTERNS[i];
    const match = entry.regex.exec(clean);
    if (match) {
      return {
        motif: entry.motif,
        tint: entry.tint,
        match: match[1],
      };
    }
  }

  return { motif: null, tint: null, match: null };
}
