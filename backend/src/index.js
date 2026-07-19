import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sequelize, connectWithRetry } from './config/db.js';
import './models/index.js';

import authRoutes from './routes/auth.routes.js';
import customerRoutes from './routes/customers.routes.js';
import serviceRoutes from './routes/services.routes.js';
import templateRoutes from './routes/templates.routes.js';
import settingRoutes from './routes/settings.routes.js';
import quoteRoutes from './routes/quotes.routes.js';
import statsRoutes from './routes/stats.routes.js';
import { ensureSeed } from './seed/seed.js';

dotenv.config();

const app = express();
app.use(express.json({ limit: '2mb' }));

const origins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());
app.use(cors({ origin: origins.includes('*') ? true : origins }));

// Sağlık kontrolü (Kubernetes probe'ları için)
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/stats', statsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const PORT = Number(process.env.PORT || 4000);

async function start() {
  await connectWithRetry();
  if (String(process.env.DB_SYNC).toLowerCase() === 'true') {
    await sequelize.sync({ alter: true });
    console.log('[db] Tablolar senkronize edildi.');
  }
  await ensureSeed();
  app.listen(PORT, () => console.log(`[server] API http://0.0.0.0:${PORT} üzerinde çalışıyor`));
}

start().catch((err) => {
  console.error('[server] Başlatma hatası:', err);
  process.exit(1);
});
