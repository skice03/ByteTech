import express from 'express';
import cors from 'cors';

export function createApp({ db, corsOrigin = 'http://localhost:5173' }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/v1', (req, res) => {
    res.json({ name: 'ByteTech API', version: 'v1' });
  });
  app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/api/v1/ready', async (req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ready', database: 'connected' });
    } catch {
      res.status(503).json({ error: 'Database unavailable.' });
    }
  });

  app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body exceeds 100 KB.' });
    }
    res.status(500).json({ error: 'Internal server error.' });
  });
  return app;
}
