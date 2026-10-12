import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { initDatabase } from './db/index.js';
import { healthRoutes } from './routes/health.js';

describe('Health and Telemetry Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    initDatabase();
    app = fastify();
    await app.register(healthRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns basic operational status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.app).toBe('Free Form');
    expect(body.uptime).toBeTypeOf('number');
  });

  it('GET /api/health/live returns fast liveness heartbeat', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health/live'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('live');
    expect(body.uptime).toBeTypeOf('number');
  });

  it('GET /api/health/ready executes deep probe verifying DB execution and disk write access', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health/ready'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ready');
    expect(body.database.connected).toBe(true);
    expect(body.database.query_latency_ms).toBeGreaterThanOrEqual(0);
    expect(body.database.wal_bytes).toBeTypeOf('number');
    expect(body.storage.writable).toBe(true);
    expect(body.memory.heap_used_bytes).toBeGreaterThan(0);
  });

  it('GET /api/metrics exports Prometheus text exposition format', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics'
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    const text = res.body;

    expect(text).toContain('freeform_uptime_seconds');
    expect(text).toContain('freeform_websocket_clients_active');
    expect(text).toContain('freeform_items_active_total');
    expect(text).toContain('freeform_notebooks_total');
    expect(text).toContain('freeform_database_wal_bytes');
    expect(text).toContain('process_resident_memory_bytes');
    expect(text).toContain('nodejs_heap_used_bytes');
  });
});
