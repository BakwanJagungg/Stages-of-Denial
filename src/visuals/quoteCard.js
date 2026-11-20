/**
 * quoteCard.js - 1080x1920 (9:16 IG Story Ready) Lyric Quote Card PNG Exporter
 * Stages of Denial (v7.0 Modular Architecture)
 */

import { hexToRgba } from './canvasVisualizer.js';

function formatTimestamp(sec) {
  const safe = Math.max(0, Math.floor(sec || 0));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function buildGrainPattern(ctx) {
  const tile = document.createElement('canvas');
  tile.width = 96;
  tile.height = 96;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(96, 96);
  const data = img.data;
  let seed = 1337;
  for (let i = 0; i < data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = (seed >>> 24) & 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 11;
  }
  tctx.putImageData(img, 0, 0);
  return ctx.createPattern(tile, 'repeat');
}

function layoutMixedWords(ctx, words, maxWidth) {
  const lines = [];
  let currentLine = [];
  let currentWidth = 0;
  const spaceWidth = 14;

  for (let i = 0; i < words.length; i++) {
    const token = words[i];
    const cleanText = String(token.text || '').trim();
    if (!cleanText) continue;

    ctx.font = token.isHighlight
      ? 'italic 700 58px "Playfair Display", Georgia, serif'
      : '700 56px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
    const w = ctx.measureText(cleanText).width;
    const added = currentLine.length === 0 ? w : w + spaceWidth;

    if (currentLine.length > 0 && currentWidth + added > maxWidth) {
      lines.push({ tokens: currentLine, width: currentWidth });
      currentLine = [{ text: cleanText, isHighlight: Boolean(token.isHighlight), width: w }];
      currentWidth = w;
    } else {
      currentLine.push({ text: cleanText, isHighlight: Boolean(token.isHighlight), width: w });
      currentWidth += added;
    }
  }
  if (currentLine.length > 0) lines.push({ tokens: currentLine, width: currentWidth });
  return lines;
}

/**
 * Render and trigger download or clipboard copy of a 9:16 (Story) or 1:1 (Feed) PNG lyric quote card.
 * @param {{
 *   track: Object,
 *   words: Array,
 *   fallbackText?: string,
 *   currentTime?: number,
 *   aspectRatio?: '9:16'|'1:1',
 *   action?: 'download'|'copy',
 *   actLabel?: string
 * }} opts
 * @returns {Promise<{ filename: string, lineText: string, copied?: boolean }>}
 */
export function exportLyricQuoteCard({
  track,
  words,
  fallbackText,
  currentTime = 0,
  aspectRatio = '9:16',
  action = 'download',
  actLabel = '',
}) {
  return new Promise((resolve, reject) => {
    const isSquare = aspectRatio === '1:1';
    const W = 1080;
    const H = isSquare ? 1080 : 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D context unavailable'));
      return;
    }

    const bgColor = track?.bgColor || '#0B0C10';
    const accentPrimary = track?.accentPrimary || '#D65A70';
    const accentSecondary = track?.accentSecondary || '#D98A5C';

    const baseGrad = ctx.createLinearGradient(0, 0, W * 0.25, H);
    baseGrad.addColorStop(0, bgColor);
    baseGrad.addColorStop(0.45, '#0B0C10');
    baseGrad.addColorStop(1, '#07080B');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, W, H);

    const topGlow = ctx.createRadialGradient(W * 0.22, H * (isSquare ? 0.2 : 0.26), 20, W * 0.22, H * (isSquare ? 0.2 : 0.26), isSquare ? 420 : 620);
    topGlow.addColorStop(0, hexToRgba(accentPrimary, 0.24));
    topGlow.addColorStop(1, 'rgba(11, 12, 16, 0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, W, H);

    const botGlow = ctx.createRadialGradient(W * 0.8, H * (isSquare ? 0.8 : 0.72), 20, W * 0.8, H * (isSquare ? 0.8 : 0.72), isSquare ? 420 : 640);
    botGlow.addColorStop(0, hexToRgba(accentSecondary, 0.18));
    botGlow.addColorStop(1, 'rgba(11, 12, 16, 0)');
    ctx.fillStyle = botGlow;
    ctx.fillRect(0, 0, W, H);

    const grain = buildGrainPattern(ctx);
    if (grain) {
      ctx.fillStyle = grain;
      ctx.fillRect(0, 0, W, H);
    }

    const padding = isSquare ? 44 : 56;
    ctx.strokeStyle = 'rgba(242, 239, 233, 0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, padding, W - padding * 2, H - padding * 2);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hexToRgba(accentPrimary, 0.92);
    ctx.font = isSquare
      ? '700 20px "Plus Jakarta Sans", Inter, system-ui, sans-serif'
      : '700 22px "Plus Jakarta Sans", Inter, system-ui, sans-serif';

    const headerText = actLabel
      ? `STAGES OF DENIAL · ${String(actLabel).toUpperCase()}`
      : 'STAGES OF DENIAL · LYRIC MEMORY';
    const headerY = isSquare ? 110 : 196;
    ctx.fillText(headerText, W * 0.5, headerY);

    ctx.strokeStyle = hexToRgba(accentPrimary, 0.35);
    ctx.beginPath();
    ctx.moveTo(W * 0.5 - 120, headerY + 40);
    ctx.lineTo(W * 0.5 + 120, headerY + 40);
    ctx.stroke();

    const safeWords =
      Array.isArray(words) && words.length > 0
        ? words
        : String(fallbackText || 'Setiap rasa yang tersisa menemukan bahasanya di sini.')
            .split(/\s+/)
            .filter(Boolean)
            .map((t) => ({ text: t, isHighlight: false }));

    const lines = layoutMixedWords(ctx, safeWords, W - (isSquare ? 180 : 220));
    const lineHeight = isSquare ? 72 : 84;
    const totalHeight = lines.length * lineHeight;
    const startY = (isSquare ? H * 0.44 : H * 0.46) - totalHeight * 0.5;

    ctx.textAlign = 'left';
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      let x = (W - line.width) * 0.5;
      const y = startY + li * lineHeight;

      for (let ti = 0; ti < line.tokens.length; ti++) {
        const tok = line.tokens[ti];
        if (tok.isHighlight) {
          ctx.font = isSquare
            ? 'italic 700 48px "Playfair Display", Georgia, serif'
            : 'italic 700 58px "Playfair Display", Georgia, serif';
          ctx.fillStyle = accentPrimary;
        } else {
          ctx.font = isSquare
            ? '700 46px "Plus Jakarta Sans", Inter, system-ui, sans-serif'
            : '700 56px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
          ctx.fillStyle = '#F2EFE9';
        }
        ctx.fillText(tok.text, x, y);
        x += tok.width + 14;
      }
    }

    // Mini-waveform bars visualization
    const waveY = isSquare ? H * 0.71 : H * 0.72;
    const barCount = 33;
    const barSpacing = isSquare ? 16 : 18;
    const waveStartX = W * 0.5 - ((barCount - 1) * barSpacing) * 0.5;
    for (let i = 0; i < barCount; i++) {
      const env = Math.sin((i / (barCount - 1)) * Math.PI);
      const amp = (isSquare ? 10 : 14) + Math.abs(Math.sin(i * 0.65)) * (isSquare ? 36 : 52) * env;
      ctx.fillStyle = i % 3 === 0 ? hexToRgba(accentPrimary, 0.78) : 'rgba(242, 239, 233, 0.34)';
      ctx.fillRect(waveStartX + i * barSpacing - 2, waveY - amp * 0.5, 4, amp);
    }

    ctx.textAlign = 'center';
    const title = track?.title || 'Penyangkalan';
    const artist = track?.artist || 'For Revenge';

    const titleY = isSquare ? H - 195 : H - 310;
    const metaY = isSquare ? H - 150 : H - 252;
    const footerY = isSquare ? H - 90 : H - 150;

    ctx.fillStyle = '#F2EFE9';
    ctx.font = isSquare
      ? '700 32px "Plus Jakarta Sans", Inter, system-ui, sans-serif'
      : '700 38px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
    ctx.fillText(`${title} · ${artist}`, W * 0.5, titleY);

    ctx.fillStyle = '#9898A6';
    ctx.font = isSquare
      ? '500 20px "Plus Jakarta Sans", Inter, system-ui, sans-serif'
      : '500 24px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
    ctx.fillText(`Momen Terabadikan • ${formatTimestamp(currentTime)}`, W * 0.5, metaY);

    ctx.fillStyle = 'rgba(242, 239, 233, 0.45)';
    ctx.font = isSquare
      ? '600 17px "Plus Jakarta Sans", Inter, system-ui, sans-serif'
      : '600 20px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
    ctx.fillText('Stages of Denial — Interactive Experience', W * 0.5, footerY);

    const safeSlug = String(track?.id || 'lyric-quote').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    const ratioSuffix = isSquare ? '1x1' : '9x16';
    const filename = `quote-${safeSlug}-${ratioSuffix}.png`;

    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to encode PNG blob'));
        return;
      }

      if (action === 'copy' && navigator.clipboard && typeof navigator.clipboard.write === 'function') {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          resolve({ filename, lineText: safeWords.map((w) => w.text).join(' '), copied: true });
          return;
        } catch (copyErr) {
          console.warn('Clipboard writeItem failed, falling back to download:', copyErr);
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1200);
      resolve({ filename, lineText: safeWords.map((w) => w.text).join(' '), copied: false });
    }, 'image/png');
  });
}
