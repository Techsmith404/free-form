import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { db, DATA_DIR } from '../db/index.js';
import { getActiveClientCount } from '../services/realtime.js';

export async function healthRoutes(app: FastifyInstance) {
  // 1. Basic / Legacy Health Ping
  app.get('/api/health', async () => ({
    status: 'ok',
    app: 'Free Form',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));

  // 2. Process Liveness Probe (instant process heartbeat)
  app.get('/api/health/live', async () => ({
    status: 'live',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));

  // 3. Deep Readiness Probe (verifies SQLite query execution, disk write access, and WAL health)
  app.get('/api/health/ready', async (request, reply) => {
    try {
      // Check 1: Execute SQLite query
      const queryStart = process.hrtime.bigint();
      const dbRow = db.prepare('SELECT 1 as alive').get() as any;
      const queryDurationNs = process.hrtime.bigint() - queryStart;
      const queryDurationMs = Number(queryDurationNs) / 1_000_000;

      if (!dbRow || dbRow.alive !== 1) {
        throw new Error('SQLite database query test failed');
      }

      // Check 2: Verify DATA_DIR writability
      const probePath = path.join(DATA_DIR, `.health_probe_${Date.now()}`);
      fs.writeFileSync(probePath, 'probe', 'utf8');
      fs.unlinkSync(probePath);

      // Check 3: Check WAL file size if present
      const walPath = path.join(DATA_DIR, 'freeform.db-wal');
      let walBytes = 0;
      if (fs.existsSync(walPath)) {
        walBytes = fs.statSync(walPath).size;
      }

      const mem = process.memoryUsage();

      return reply.code(200).send({
        status: 'ready',
        database: {
          connected: true,
          query_latency_ms: Math.round(queryDurationMs * 100) / 100,
          wal_bytes: walBytes
        },
        storage: {
          writable: true,
          data_dir: DATA_DIR
        },
        memory: {
          rss_bytes: mem.rss,
          heap_used_bytes: mem.heapUsed,
          heap_total_bytes: mem.heapTotal
        },
        uptime_seconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      app.log.error(`Health readiness probe failed: ${err.message}`);
      return reply.code(503).send({
        status: 'unhealthy',
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // 4. Prometheus Metrics Exposition
  app.get('/api/metrics', async (request, reply) => {
    try {
      const mem = process.memoryUsage();
      const uptime = process.uptime();
      const wsClients = getActiveClientCount();

      // Database stats
      let itemsCount = 0;
      let notebooksCount = 0;
      try {
        const itemRow = db.prepare('SELECT count(*) as c FROM items WHERE is_archived = 0').get() as any;
        itemsCount = itemRow?.c || 0;
        const nbRow = db.prepare('SELECT count(*) as c FROM notebooks').get() as any;
        notebooksCount = nbRow?.c || 0;
      } catch {}

      const walPath = path.join(DATA_DIR, 'freeform.db-wal');
      let walBytes = 0;
      if (fs.existsSync(walPath)) {
        walBytes = fs.statSync(walPath).size;
      }

      const metrics = [
        '# HELP freeform_uptime_seconds Total application uptime in seconds',
        '# TYPE freeform_uptime_seconds counter',
        `freeform_uptime_seconds ${uptime.toFixed(1)}`,
        '',
        '# HELP freeform_websocket_clients_active Number of active connected WebSocket clients',
        '# TYPE freeform_websocket_clients_active gauge',
        `freeform_websocket_clients_active ${wsClients}`,
        '',
        '# HELP freeform_items_active_total Total active non-archived items in database',
        '# TYPE freeform_items_active_total gauge',
        `freeform_items_active_total ${itemsCount}`,
        '',
        '# HELP freeform_notebooks_total Total notebooks in database',
        '# TYPE freeform_notebooks_total gauge',
        `freeform_notebooks_total ${notebooksCount}`,
        '',
        '# HELP freeform_database_wal_bytes Current SQLite WAL file size in bytes',
        '# TYPE freeform_database_wal_bytes gauge',
        `freeform_database_wal_bytes ${walBytes}`,
        '',
        '# HELP process_resident_memory_bytes Resident memory size in bytes',
        '# TYPE process_resident_memory_bytes gauge',
        `process_resident_memory_bytes ${mem.rss}`,
        '',
        '# HELP nodejs_heap_used_bytes Node.js heap used in bytes',
        '# TYPE nodejs_heap_used_bytes gauge',
        `nodejs_heap_used_bytes ${mem.heapUsed}`,
        '',
        '# HELP nodejs_heap_total_bytes Node.js heap allocated in bytes',
        '# TYPE nodejs_heap_total_bytes gauge',
        `nodejs_heap_total_bytes ${mem.heapTotal}`,
        ''
      ].join('\n');

      return reply
        .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
        .send(metrics);
    } catch (err: any) {
      return reply.code(500).send(`# Error generating metrics: ${err.message}\n`);
    }
  });
}
