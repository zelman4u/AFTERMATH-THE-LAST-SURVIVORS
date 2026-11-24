import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { COLLECTION_NAMES, database } from './backend/config/database';
import { ENV } from './backend/config/environment';
import { getAdminOverview } from './backend/controllers/playerController';
import {
  optionalAuthMiddleware,
  requireAdmin,
  requireAuth,
} from './backend/middlewares/authMiddleware';
import { sanitizeNoSqlPayload } from './backend/middlewares/validationMiddleware';
import { authRoutes } from './backend/routes/authRoutes';
import { characterRoutes } from './backend/routes/characterRoutes';
import { inventoryRoutes } from './backend/routes/inventoryRoutes';
import { playerRoutes } from './backend/routes/playerRoutes';
import { saveRoutes } from './backend/routes/saveRoutes';
import { worldRoutes } from './backend/routes/worldRoutes';

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Verify auth token when supplied and block NoSQL $-key/.-key injection globally
  app.use('/api', optionalAuthMiddleware, sanitizeNoSqlPayload);

  app.get('/api/health', (_req, res) => {
    const store = database.getStore();
    res.json({
      ok: true,
      service: 'aftermath-survivors-api',
      databaseMode: database.mode,
      collections: COLLECTION_NAMES.length,
      totalSaves: Object.keys(store.gamesaves).length,
      autoSaveIntervalSec: ENV.autoSaveIntervalSec,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/players', playerRoutes);
  app.use('/api/characters', characterRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/world', worldRoutes);
  app.use('/api/saves', saveRoutes);
  app.get('/api/admin/overview', requireAuth, requireAdmin, getAdminOverview);

  if (ENV.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output missing. Run npm run build first.');
      }
    });
  }

  app.listen(ENV.port, '0.0.0.0', () => {
    console.log(
      `[AFTERMATH Server] Listening on http://0.0.0.0:${ENV.port} (${ENV.nodeEnv}, DB: ${database.mode})`,
    );
  });
}

startServer().catch((err) => {
  console.error('[AFTERMATH Server] Startup failure:', err);
  process.exit(1);
});
