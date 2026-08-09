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
      if (String(process.env.DB_SYNC).toLowerCase() === 'true') {
        await sequelize.sync({ alter: true });
        console.log('[db] Tablolar senkronize edildi.');
      }
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
  app.listen(PORT, () => console.log(`[server] API http://0.0.0.0:${PORT} üzerinde çalışıyor`));
  bootstrapDb();
}

start().catch((err) => {
  console.error('[server] Fatal listen error:', err);
  process.exit(1);
});
