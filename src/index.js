import 'dotenv/config';
import express      from 'express';
import cors         from 'cors';
import helmet       from 'helmet';
import rateLimit    from 'express-rate-limit';
import cron         from 'node-cron';
import logger       from './utils/logger.js';
import dashRoutes   from './routes/dashboard.js';
import authRoutes   from './routes/auth.js';
import { syncAll }  from './services/syncAll.js';

const app  = express();
const PORT = parseInt(process.env.PORT || '3000');

// ── Seguridad ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true }));

// ── Rutas ────────────────────────────────────────────────────
app.use('/api',  dashRoutes);
app.use('/auth', authRoutes);

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_, res) => res.json({
  status: 'ok',
  uptime: Math.floor(process.uptime()),
  timestamp: new Date().toISOString(),
  env: process.env.NODE_ENV,
}));

// ── Manejo de errores ────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

// ── Sincronización automática con cron ───────────────────────
const hours = parseInt(process.env.SYNC_INTERVAL_HOURS || '6');
cron.schedule(`0 */${hours} * * *`, async () => {
  logger.info(`⏰ Cron: sincronización automática (cada ${hours}h)`);
  try { await syncAll(); } catch (e) { logger.error('Cron sync: ' + e.message); }
});

// ── Arrancar ─────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`⚡ DOS RAYOS Backend corriendo en http://localhost:${PORT}`);
  logger.info(`📊 API:  http://localhost:${PORT}/api/summary`);
  logger.info(`🔌 Auth: http://localhost:${PORT}/auth/status`);
  logger.info(`⏰ Sync automático cada ${hours} horas`);

  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => syncAll().catch(e => logger.error('Sync inicial: ' + e.message)), 5000);
  }
});

export default app;
