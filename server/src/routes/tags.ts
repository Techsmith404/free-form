import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import crypto from 'crypto';

export async function tagRoutes(fastify: FastifyInstance) {
  // Get all tags with item count
  fastify.get('/api/tags', async () => {
    const tags = db.prepare(`
      SELECT 
        t.*,
        COUNT(it.item_id) as count
      FROM tags t
      LEFT JOIN item_tags it ON t.id = it.tag_id
      GROUP BY t.id
      ORDER BY count DESC, t.name ASC
    `).all();

    return tags;
  });

  // Create or get tag
  fastify.post('/api/tags', async (request, reply) => {
    const { name, color } = request.body as { name: string; color?: string };
    const cleanName = name?.trim();
    if (!cleanName) {
      return reply.code(400).send({ error: 'Tag name is required' });
    }

    let existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(cleanName);
    if (existing) {
      return existing;
    }

    const id = `tag-${crypto.randomUUID()}`;
    db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(
      id,
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
