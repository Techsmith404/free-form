import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import crypto from 'crypto';

export async function tagRoutes(fastify: FastifyInstance) {
  // Get all tags with item count
  fastify.get('/api/tags', async (request) => {
    const userId = (request as any).user?.id;
    let sql = `
      SELECT 
        t.*,
        COUNT(it.item_id) as count
      FROM tags t
      LEFT JOIN item_tags it ON t.id = it.tag_id
    `;
    const params: any[] = [];
    if (userId) {
      sql += ` WHERE (t.user_id = ? OR t.user_id IS NULL)`;
      params.push(userId);
    }
    sql += `
      GROUP BY t.id
      ORDER BY count DESC, t.name ASC
    `;

    const tags = db.prepare(sql).all(...params);
    return tags;
  });

  // Create or get tag
  fastify.post('/api/tags', async (request, reply) => {
    const { name, color } = request.body as { name: string; color?: string };
    const userId = (request as any).user?.id || null;
    const cleanName = name?.trim();
    if (!cleanName) {
      return reply.code(400).send({ error: 'Tag name is required' });
    }

    let existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(cleanName);
    if (existing) {
      return existing;
    }

    const id = `tag-${crypto.randomUUID()}`;
    db.prepare('INSERT INTO tags (id, user_id, name, color) VALUES (?, ?, ?, ?)').run(
      id,
      userId,
      cleanName,
      color || '#22c55e'
    );

    return reply.code(201).send({ id, name: cleanName, color: color || '#22c55e' });
  });

  // Delete tag
  fastify.delete('/api/tags/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);
    return { success: true, id };
  });
}
