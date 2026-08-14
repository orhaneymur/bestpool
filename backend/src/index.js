import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sequelize, connectWithRetry } from './config/db.js';
import './models/index.js';
import { ensureSchemaPatches } from './config/ensureSchema.js';

import authRoutes from './routes/auth.routes.js';
import customerRoutes from './routes/customers.routes.js';
import serviceRoutes from './routes/services.routes.js';
import serviceCategoryRoutes from './routes/serviceCategories.routes.js';
import templateRoutes from './routes/templates.routes.js';
import settingRoutes from './routes/settings.routes.js';
import definitionRoutes from './routes/definitions.routes.js';
import quoteRoutes from './routes/quotes.routes.js';
import seasonRoutes from './routes/season.routes.js';
import assetRoutes from './routes/assets.routes.js';
import statsRoutes from './routes/stats.routes.js';
import { ensureSeed } from './seed/seed.js';
import { warmUpRenderPool, shutdownRenderPool } from './services/renderPool.js';

dotenv.config();

// Fail loudly at boot instead of returning a confusing 500 on the first login:
// jwt.sign() throws "secretOrPrivateKey must have a value" when this is unset.
if (!process.env.JWT_SECRET) {
  console.error('[server] JWT_SECRET is not set. Refusing to start — every login would fail.');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '2mb' }));

const origins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());
app.use(cors({ origin: origins.includes('*') ? true : origins }));

let dbReady = false;

// Sağlık kontrolü (Kubernetes probe'ları için) — DB beklenmeden 200 dönmeli
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', db: dbReady ? 'up' : 'starting', time: new Date().toISOString() })
);
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', db: dbReady ? 'up' : 'starting' })
);

/**
 * Nothing that touches the database runs before the database is up.
 *
 * The server binds its port immediately so container probes never wait on
 * MySQL, but the routes were mounted at the same moment. A request arriving
 * during startup went straight to Sequelize, found no connection, and sat on the
 * pool's 30-second acquire timeout before failing — from the browser that is
 * indistinguishable from a page that simply never loads. An honest 503 lets the
 * client show something and retry.
 */
app.use('/api', (req, res, next) => {
  if (dbReady || req.path === '/health') return next();
  res.setHeader('Retry-After', '5');
  return res.status(503).json({ error: 'The server is still starting up. Please try again in a few seconds.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/service-categories', serviceCategoryRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/definitions', definitionRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/season', seasonRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/stats', statsRoutes);

// Anything a route forwards with next(err) lands here. Sequelize's data errors
// are the caller's fault, not the server's, so they get a 4xx with a usable
// message instead of a blanket 500.
app.use((err, req, res, _next) => {
  const name = err?.name || '';
  const detail = err?.parent?.message || err?.original?.message || err?.message || 'Server error';
  console.error(`[api] ${req.method} ${req.originalUrl} failed:`, detail);

  if (name === 'SequelizeValidationError' || name === 'SequelizeDatabaseError') {
    return res.status(400).json({ error: detail });
  }
  if (name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: detail });
  }
  if (name === 'SequelizeForeignKeyConstraintError') {
    return res.status(409).json({ error: 'That record is still referenced by other data.' });
  }
  return res.status(err?.status || 500).json({ error: detail });
});

/**
 * Last-resort net. Every route already goes through the async-safe Router, so
 * nothing should reach here — but an unhandled rejection anywhere else would
 * otherwise terminate Node and take the API down for every user at once. Log it
 * loudly and keep serving; a single broken request must never be an outage.
 */
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection (kept alive):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception (kept alive):', err);
});

const PORT = Number(process.env.PORT || 4000);

async function bootstrapDb() {
  // Never exit the process on DB errors — keep retrying so pods stay Running.
  for (;;) {
    try {
      await connectWithRetry(30, 2000);
      /**
       * Plain sync() is CREATE TABLE IF NOT EXISTS: it builds a brand-new
       * database and does nothing to an existing one. That is what makes it safe
       * to leave DB_SYNC off in production — a first boot still works, while
       * established installs are never rewritten.
       *
       * DB_SYNC=true additionally turns on alter, which rewrites live tables.
       * Useful in development, expensive and index-duplicating in production.
       */
      const alter = String(process.env.DB_SYNC).toLowerCase() === 'true';
      await sequelize.sync(alter ? { alter: true } : undefined);
      console.log(alter ? '[db] Tablolar senkronize edildi (alter).' : '[db] Eksik tablolar oluşturuldu.');
      await ensureSchemaPatches();
      await ensureSeed();
      dbReady = true;
      console.log('[server] Startup migrations/seed complete.');
      return;
    } catch (err) {
      dbReady = false;
      console.error('[server] DB bootstrap failed, retrying in 5s:', err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function start() {
  // Bind HTTP immediately so k8s readiness never blocks on MySQL.
  const server = app.listen(PORT, () =>
    console.log(`[server] API http://0.0.0.0:${PORT} üzerinde çalışıyor`)
  );
  // Starts one render thread now so the first export is not the slow one.
  warmUpRenderPool();

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      console.log(`[server] ${signal} received, shutting down.`);
      server.close(() => {
        shutdownRenderPool().finally(() => process.exit(0));
      });
    });
  }

  bootstrapDb();
}

start().catch((err) => {
  console.error('[server] Fatal listen error:', err);
  process.exit(1);
});
