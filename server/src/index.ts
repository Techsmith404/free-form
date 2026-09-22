import fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { initDatabase, UPLOADS_DIR } from './db/index.js';
import { notebookRoutes } from './routes/notebooks.js';
import { itemRoutes } from './routes/items.js';
import { templateRoutes } from './routes/templates.js';
import { tagRoutes } from './routes/tags.js';
import { uploadRoutes } from './routes/upload.js';
import { exportRoutes } from './routes/export.js';

const app = fastify({
  logger: true
});

async function main() {
  // 1. Initialize SQLite Database
  initDatabase();

  // 2. Plugins
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024 // 50MB
    }
  });

  // Serve static uploads
  await app.register(fastifyStatic, {
    root: UPLOADS_DIR,
    prefix: '/uploads/',
    decorateReply: false
  });

  // 3. API Routes
  await app.register(notebookRoutes);
  await app.register(itemRoutes);
  await app.register(templateRoutes);
  await app.register(tagRoutes);
  await app.register(uploadRoutes);
  await app.register(exportRoutes);

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
      decorateReply: false
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url && request.raw.url.startsWith('/api')) {
        reply.status(404).send({ error: 'Endpoint not found' });
      } else {
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
}

main();
