import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { ConflictRecord, Item } from '../types/index.js';
import { broadcast } from '../services/realtime.js';
import crypto from 'crypto';

export const conflictsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/conflicts - List all unresolved conflicts
  fastify.get('/api/conflicts', async (request, reply) => {
    const rows = db.prepare(`
      SELECT * FROM conflicts WHERE status = 'unresolved' ORDER BY created_at DESC
    `).all() as any[];

    const conflicts: ConflictRecord[] = rows.map((r) => ({
      ...r,
      active_metadata: JSON.parse(r.active_metadata || '{}'),
      conflict_metadata: JSON.parse(r.conflict_metadata || '{}'),
    }));

    return conflicts;
  });

  // POST /api/conflicts/:id/resolve - Resolve a conflict
  fastify.post<{
    Params: { id: string };
    Body: {
      action: 'keep_active' | 'use_conflict' | 'keep_both' | 'custom_merge';
      title?: string;
      content?: string;
      metadata?: any;
    };
  }>('/api/conflicts/:id/resolve', async (request, reply) => {
    const { id } = request.params;
    const { action, title, content, metadata } = request.body || {};

    const conflictRow = db.prepare('SELECT * FROM conflicts WHERE id = ?').get(id) as any;
    if (!conflictRow) {
      return reply.code(404).send({ error: 'Conflict record not found' });
    }

    const now = new Date().toISOString();
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(conflictRow.item_id) as Item | undefined;

    const tx = db.transaction(() => {
      if (item) {
        if (action === 'use_conflict') {
          db.prepare(`
            UPDATE items
            SET title = ?, content = ?, metadata = ?, updated_at = ?
            WHERE id = ?
          `).run(
            conflictRow.conflict_title,
            conflictRow.conflict_content,
            conflictRow.conflict_metadata,
            now,
            conflictRow.item_id
          );
        } else if (action === 'keep_both') {
          const newId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO items (id, notebook_id, title, type, content, metadata, is_favorite, is_pinned, is_archived, hide_from_all, priority, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            newId,
            item.notebook_id,
            conflictRow.conflict_title || `${item.title} (Conflict Copy)`,
            item.type,
            conflictRow.conflict_content,
            conflictRow.conflict_metadata,
            item.is_favorite,
            0,
            0,
            item.hide_from_all || 0,
            item.priority || '',
            now,
            now
          );
        } else if (action === 'custom_merge') {
          db.prepare(`
            UPDATE items
            SET title = ?, content = ?, metadata = ?, updated_at = ?
            WHERE id = ?
          `).run(
            title ?? item.title,
            content ?? item.content,
            metadata ? JSON.stringify(metadata) : JSON.stringify(item.metadata),
            now,
            conflictRow.item_id
          );
        }
      }

      // Mark conflict resolved
      db.prepare(`
        UPDATE conflicts
        SET status = 'resolved', resolution = ?, resolved_at = ?
        WHERE id = ?
      `).run(action || 'keep_active', now, id);
    });

    tx();

    broadcast({
      type: 'CONFLICT_RESOLVED',
      payload: { conflictId: id }
    });

    return { success: true, conflictId: id, resolution: action };
  });
};
