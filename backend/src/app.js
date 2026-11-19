import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createAccountStore } from './accounts/store.js';
import { createAccountRoutes } from './accounts/routes.js';
import { createSessionSecurity } from './accounts/security.js';
import { createCartStore } from './cart/store.js';
import { createCartRoutes } from './cart/routes.js';
import { HttpError } from './errors.js';

export function createApp({ db, corsOrigin = 'http://localhost:5173', sessionOptions = {}, stores = {}, attemptLimit = 20, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

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

  const accounts = stores.accounts ?? createAccountStore(db);
  const security = createSessionSecurity({ store: accounts, origin: corsOrigin, ...sessionOptions });
  const api = express.Router();
  api.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, security.trustedOrigin, security.attachSession);
  api.use(createAccountRoutes({ store: accounts, security, attemptLimit }));
  api.use('/cart', createCartRoutes({ store: stores.cart ?? createCartStore(db), security }));
  app.use('/api/v1', api);
  app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body exceeds 100 KB.' });
    }
    if (error.type === 'charset.unsupported' || error.type === 'encoding.unsupported') {
      return res.status(415).json({ error: 'Unsupported request body encoding.' });
    }
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message, ...(error.fields ? { fields: error.fields } : {}) });
    }
    if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ER_ACCESS_DENIED_ERROR',
      'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE', 'PROTOCOL_CONNECTION_LOST'].includes(error.code)) {
      return res.status(503).json({ error: 'Database unavailable. Check MySQL and apply the database migration.' });
    }
    logger.error({ code: error.code ?? 'UNEXPECTED_ERROR' });
    res.status(500).json({ error: 'Internal server error.' });
  });
  return app;
}
