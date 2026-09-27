import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';

export async function settingsRoutes(fastify: FastifyInstance) {
  // Get all settings
  fastify.get('/api/settings', async () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const result: Record<string, any> = {
      theme: 'system',
      priorities: [
        { id: 'low', label: 'Low', color: '#3b82f6' },
        { id: 'medium', label: 'Medium', color: '#22c55e' },
        { id: 'high', label: 'High', color: '#f59e0b' },
        { id: 'urgent', label: 'Urgent', color: '#ef4444' }
      ]
    };

    for (const r of rows) {
      if (r.key === 'priorities') {
        try {
          result.priorities = JSON.parse(r.value);
        } catch {}
      } else {
        result[r.key] = r.value;
      }
    }

    return result;
  });

  // Update settings
  fastify.put('/api/settings', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const now = new Date().toISOString();

    const upsertStmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    db.transaction(() => {
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined) {
          const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
          upsertStmt.run(key, serialized, now);
        }
      }
    })();

    // Return updated settings
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const result: Record<string, any> = {};
    for (const r of rows) {
      if (r.key === 'priorities') {
        try {
          result.priorities = JSON.parse(r.value);
        } catch {
          result.priorities = [];
        }
      } else {
        result[r.key] = r.value;
      }
    }

    return reply.send(result);
  });
}
