import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const MIME_MAP = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.lrc': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function catalogApiPlugin() {
  return {
    name: 'stages-of-denial-catalog-api',
    configureServer(server) {
      server.middlewares.use('/api/tracks', (req, res, next) => {
        if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'tracks.json'), 'utf8'));
            return sendJson(res, 200, data);
          } catch (err) {
            return sendJson(res, 500, { ok: false, error: err.message });
          }
        }
        if (req.method === 'DELETE') {
          return sendJson(res, 501, { ok: false, error: 'Track deletion API is disabled in public build.' });
        }
        return next();
      });

      server.middlewares.use('/api/playlist-catalog', (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'playlist_catalog.json'), 'utf8'));
          return sendJson(res, 200, data);
        } catch {
          return sendJson(res, 200, { items: [], totalEntries: 0 });
        }
      });

      server.middlewares.use('/api/load-playlist', (_req, res) => {
        return sendJson(res, 501, {
          ok: false,
          error: 'Playlist CLI importer is not included in the public web repository. Use Drag & Drop MP3/LRC.',
        });
      });

      server.middlewares.use('/api/import-selected-tracks', (_req, res) => {
        return sendJson(res, 501, {
          ok: false,
          error: 'Playlist CLI importer is not included in the public web repository. Use Drag & Drop MP3/LRC.',
        });
      });
    },
  };
}

/**
 * Live media streaming middleware: provides instant HTTP Range (206)
 * support for local MP3/MP4 audio and video files during local preview.
 */
function liveMediaStreamingPlugin() {
  return {
    name: 'live-media-streaming-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url || '';
        const pathname = rawUrl.split('?')[0];

        if (!/^\/assets\/(audio|covers|video|lyrics)\//i.test(pathname)) {
          return next();
        }

        const decodedPath = decodeURIComponent(pathname.replace(/^\/+/, ''));
        const candidatePaths = [
          path.join(ROOT, 'public', decodedPath),
          path.join(ROOT, decodedPath),
        ];

        let targetFile = null;
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            try {
              const st = fs.statSync(p);
              if (st.isFile()) {
                targetFile = { path: p, stat: st };
                break;
              }
            } catch {}
          }
        }

        if (!targetFile) {
          return next();
        }

        const ext = path.extname(targetFile.path).toLowerCase();
        const mimeType = MIME_MAP[ext] || 'application/octet-stream';
        const total = targetFile.stat.size;
        const range = req.headers.range;

        if (range && (/audio|video/i.test(mimeType) || ext === '.mp3' || ext === '.mp4')) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10) || 0;
          const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

          if (start >= total || end >= total) {
            res.writeHead(416, { 'Content-Range': `bytes */${total}` });
            return res.end();
          }

          const chunksize = end - start + 1;
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': mimeType,
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            Pragma: 'no-cache',
            Expires: '0',
          });

          const stream = fs.createReadStream(targetFile.path, { start, end });
          stream.pipe(res);
          return;
        }

        res.writeHead(200, {
          'Content-Length': total,
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        });

        const stream = fs.createReadStream(targetFile.path);
        stream.pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: './',
  root: './',
  plugins: [catalogApiPlugin(), liveMediaStreamingPlugin()],
  esbuild: {
    legalComments: 'none',
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: true,
    cors: true,
    watch: {
      ignored: ['**/config/**', '**/public/assets/**'],
    },
  },
});
