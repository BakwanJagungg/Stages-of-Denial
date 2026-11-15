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
 * Render and trigger download of a 1080x1920 PNG lyric quote card.
 * @param {{ track: Object, words: Array, fallbackText?: string, currentTime?: number }} opts
 * @returns {Promise<{ filename: string, lineText: string }>}
 */
export function exportLyricQuoteCard({ track, words, fallbackText, currentTime = 0 }) {
  return new Promise((resolve, reject) => {
    const W = 1080;
    const H = 1920;
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

    const topGlow = ctx.createRadialGradient(W * 0.22, H * 0.26, 20, W * 0.22, H * 0.26, 620);
    topGlow.addColorStop(0, hexToRgba(accentPrimary, 0.24));
    topGlow.addColorStop(1, 'rgba(11, 12, 16, 0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, W, H);

    const botGlow = ctx.createRadialGradient(W * 0.8, H * 0.72, 20, W * 0.8, H * 0.72, 640);
    botGlow.addColorStop(0, hexToRgba(accentSecondary, 0.18));
    botGlow.addColorStop(1, 'rgba(11, 12, 16, 0)');
    ctx.fillStyle = botGlow;
    ctx.fillRect(0, 0, W, H);

    const grain = buildGrainPattern(ctx);
    if (grain) {
      ctx.fillStyle = grain;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.strokeStyle = 'rgba(242, 239, 233, 0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(56, 56, W - 112, H - 112);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hexToRgba(accentPrimary, 0.92);
    ctx.font = '700 22px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
    ctx.fillText('STAGES OF DENIAL · LYRIC MEMORY', W * 0.5, 196);

    ctx.strokeStyle = hexToRgba(accentPrimary, 0.35);
    ctx.beginPath();
    ctx.moveTo(W * 0.5 - 110, 238);
    ctx.lineTo(W * 0.5 + 110, 238);
    ctx.stroke();

    const safeWords =
      Array.isArray(words) && words.length > 0
        ? words
        : String(fallbackText || 'Setiap rasa yang tersisa menemukan bahasanya di sini.')
            .split(/\s+/)
            .filter(Boolean)
            .map((t) => ({ text: t, isHighlight: false }));

    const lines = layoutMixedWords(ctx, safeWords, W - 220);
    const lineHeight = 84;
    const totalHeight = lines.length * lineHeight;
    const startY = H * 0.46 - totalHeight * 0.5;

    ctx.textAlign = 'left';
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      let x = (W - line.width) * 0.5;
      const y = startY + li * lineHeight;

      for (let ti = 0; ti < line.tokens.length; ti++) {
        const tok = line.tokens[ti];
        if (tok.isHighlight) {
          ctx.font = 'italic 700 58px "Playfair Display", Georgia, serif';
          ctx.fillStyle = accentPrimary;
        } else {
          ctx.font = '700 56px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
          ctx.fillStyle = '#F2EFE9';
        }
        ctx.fillText(tok.text, x, y);
        x += tok.width + 14;
      }
    }

    const waveY = H * 0.72;
    const barCount = 33;
    const barSpacing = 18;
    const waveStartX = W * 0.5 - ((barCount - 1) * barSpacing) * 0.5;
    for (let i = 0; i < barCount; i++) {
      const env = Math.sin((i / (barCount - 1)) * Math.PI);
      const amp = 14 + Math.abs(Math.sin(i * 0.65)) * 52 * env;
      ctx.fillStyle = i % 3 === 0 ? hexToRgba(accentPrimary, 0.78) : 'rgba(242, 239, 233, 0.34)';
      ctx.fillRect(waveStartX + i * barSpacing - 2, waveY - amp * 0.5, 4, amp);
    }

    ctx.textAlign = 'center';
    const title = track?.title || 'Penyangkalan';
    const artist = track?.artist || 'For Revenge';

    ctx.fillStyle = '#F2EFE9';
    ctx.font = '700 38px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
    ctx.fillText(`${title} · ${artist}`, W * 0.5, H - 310);

    ctx.fillStyle = '#9898A6';
    ctx.font = '500 24px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
    ctx.fillText(`Momen Terabadikan • ${formatTimestamp(currentTime)}`, W * 0.5, H - 252);

    ctx.fillStyle = 'rgba(242, 239, 233, 0.45)';
    ctx.font = '600 20px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
    ctx.fillText('Stages of Denial — Interactive Experience', W * 0.5, H - 150);

    const safeSlug = String(track?.id || 'lyric-quote').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    const filename = `quote-${safeSlug}.png`;

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode PNG blob'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1200);
      resolve({ filename, lineText: safeWords.map((w) => w.text).join(' ') });
    }, 'image/png');
  });
}
