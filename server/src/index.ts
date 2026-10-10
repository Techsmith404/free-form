import fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import path from 'path';
import fs from 'fs';
import { initDatabase, UPLOADS_DIR } from './db/index.js';
import { notebookRoutes } from './routes/notebooks.js';
import { itemRoutes } from './routes/items.js';
import { templateRoutes } from './routes/templates.js';
import { tagRoutes } from './routes/tags.js';
import { uploadRoutes } from './routes/upload.js';
import { exportRoutes } from './routes/export.js';
import { timerRoutes } from './routes/timers.js';
import { reminderRoutes } from './routes/reminders.js';
import { settingsRoutes } from './routes/settings.js';
import { syncRoutes } from './routes/sync.js';
import { conflictsRoutes } from './routes/conflicts.js';
import { addClient, startRealtimeTicker, stopRealtimeTicker } from './services/realtime.js';

import fastifyCookie from '@fastify/cookie';
import { hashToken } from './services/auth.js';
import { authRoutes } from './routes/auth.js';
import { db } from './db/index.js';
import { User } from './types/index.js';

const app = fastify({
  logger: true,
  trustProxy: true
});

async function main() {
  // 1. Initialize SQLite Database
  initDatabase();

  // 2. Plugins
  await app.register(fastifyCookie);

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['*'],
    credentials: true
  });

  await app.register(websocket);

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024 // 50MB
    }
  });

  // Global Auth hook
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request, reply) => {
    const accountsEnabled = process.env.ACCOUNTS_ENABLED === 'true';
    const authRequired = process.env.AUTH_REQUIRED === 'true' || accountsEnabled;

    // Check token from cookie or Authorization header
    const token = (request.cookies as any)?.ff_session || request.headers.authorization?.replace(/^Bearer\s+/i, '');
    let resolvedUser: User | null = null;

    if (token) {
      const tokenHash = hashToken(token);
      const sessionRow = db.prepare(`
        SELECT s.*, u.id as user_id, u.username, u.email, u.role, u.created_at, u.updated_at
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token_hash = ? AND s.expires_at > ?
      `).get(tokenHash, new Date().toISOString()) as any;

      if (sessionRow) {
        resolvedUser = {
          id: sessionRow.user_id,
          username: sessionRow.username,
          email: sessionRow.email,
          role: sessionRow.role,
          created_at: sessionRow.created_at,
          updated_at: sessionRow.updated_at
        };
      }
    }

    // Default mock user if auth is disabled for single-user mode
    if (!resolvedUser && !authRequired) {
      resolvedUser = {
        id: 'usr-default',
        username: 'default',
        role: 'owner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    (request as any).user = resolvedUser;

    // Check auth requirement for protected /api routes
    const pathname = request.url.split('?')[0];
    const isPublic =
      pathname.startsWith('/api/auth') ||
      pathname === '/api/health' ||
      pathname === '/api/ws' ||
      !pathname.startsWith('/api');

    if (authRequired && !resolvedUser && !isPublic) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
  });

  // Serve static uploads
  await app.register(fastifyStatic, {
    root: UPLOADS_DIR,
    prefix: '/uploads/',
    decorateReply: false
  });

  // WebSocket real-time broadcast endpoint
  app.get('/api/ws', { websocket: true }, (socket, req) => {
    addClient(socket);
  });

  // 3. API Routes
  await app.register(authRoutes);
  await app.register(notebookRoutes);
  await app.register(itemRoutes);
  await app.register(templateRoutes);
  await app.register(tagRoutes);
  await app.register(uploadRoutes);
  await app.register(exportRoutes);
  await app.register(timerRoutes);
  await app.register(reminderRoutes);
  await app.register(settingsRoutes);
  await app.register(syncRoutes);
  await app.register(conflictsRoutes);

  // Start background timer/reminder ticker
  startRealtimeTicker();

  // Health check endpoint
  app.get('/api/health', async () => ({
    status: 'ok',
    app: 'Free Form',
    timestamp: new Date().toISOString()
  }));

  // 4. In production, serve the built Vite SPA static files
  const clientDistDir = path.resolve(process.cwd(), '../client/dist');
  const localClientDistDir = path.resolve(process.cwd(), 'client/dist');
  const staticDir = fs.existsSync(clientDistDir)
    ? clientDistDir
    : fs.existsSync(localClientDistDir)
    ? localClientDistDir
    : null;

  if (staticDir) {
    app.log.info(`Serving client static assets from ${staticDir}`);
    await app.register(fastifyStatic, {
      root: staticDir,
      prefix: '/',
      decorateReply: false,
      setHeaders: (res, pathName) => {
        // Cache-busting: never cache index.html, service worker, or manifest
        if (
          pathName.endsWith('index.html') ||
          pathName.endsWith('sw.js') ||
          pathName.endsWith('registerSW.js') ||
          pathName.endsWith('manifest.webmanifest')
        ) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (pathName.includes('/assets/')) {
          // Vite hashed assets are immutable
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url && request.raw.url.startsWith('/api')) {
        reply.status(404).send({ error: 'Endpoint not found' });
      } else {
        reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        reply.header('Pragma', 'no-cache');
        reply.header('Expires', '0');
        reply.sendFile('index.html', staticDir);
      }
    });
  }

  const PORT = Number(process.env.PORT) || 3001;
  const HOST = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Free Form Server running on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      stopRealtimeTicker();
      await app.close();
      const { db } = await import('./db/index.js');
      db.close();
      app.log.info('Closed database connection.');
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
