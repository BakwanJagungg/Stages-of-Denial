import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

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

export default defineConfig({
  base: './',
  root: './',
  plugins: [catalogApiPlugin()],
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
