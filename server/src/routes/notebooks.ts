import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import crypto from 'crypto';

export async function notebookRoutes(fastify: FastifyInstance) {
  // Get all notebooks with item count
  fastify.get('/api/notebooks', async () => {
    const rows = db.prepare(`
      SELECT 
        n.*,
        (SELECT COUNT(*) FROM items WHERE items.notebook_id = n.id AND items.is_archived = 0) as item_count,
        t.name as default_template_name
      FROM notebooks n
      LEFT JOIN templates t ON n.default_template_id = t.id
      ORDER BY n.sort_order ASC, n.name ASC
    `).all();

    return rows;
  });

  // Get single notebook
  fastify.get('/api/notebooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const notebook = db.prepare(`
      SELECT n.*, t.name as default_template_name
      FROM notebooks n
      LEFT JOIN templates t ON n.default_template_id = t.id
      WHERE n.id = ?
    `).get(id);

    if (!notebook) {
      return reply.code(404).send({ error: 'Notebook not found' });
    }

    return notebook;
  });

  // Create notebook
  fastify.post('/api/notebooks', async (request, reply) => {
    const body = request.body as any;
    const id = body.id || `nb-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const name = body.name?.trim();
    if (!name) {
      return reply.code(400).send({ error: 'Name is required' });
    }

    const description = body.description || '';
    const color = body.color || '#22c55e';
    const icon = body.icon || 'folder';
    const parent_id = body.parent_id || null;
    const default_template_id = body.default_template_id || null;
    const view_mode = body.view_mode || 'grid';
    const sort_order = body.sort_order || 0;
    const hide_from_all = body.hide_from_all ? 1 : 0;

    db.prepare(`
      INSERT INTO notebooks (id, name, description, color, icon, parent_id, default_template_id, view_mode, sort_order, hide_from_all, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description, color, icon, parent_id, default_template_id, view_mode, sort_order, hide_from_all, now, now);

    const created = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(id);
    return reply.code(201).send(created);
  });

  // Update notebook
  fastify.put('/api/notebooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(id);
    if (!existing) {
      return reply.code(404).send({ error: 'Notebook not found' });
    }

    db.prepare(`
      UPDATE notebooks SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        color = COALESCE(?, color),
        icon = COALESCE(?, icon),
        parent_id = ?,
        default_template_id = ?,
        view_mode = COALESCE(?, view_mode),
        sort_order = COALESCE(?, sort_order),
        hide_from_all = COALESCE(?, hide_from_all),
        updated_at = ?
      WHERE id = ?
    `).run(
      body.name !== undefined ? body.name.trim() : null,
      body.description !== undefined ? body.description : null,
      body.color !== undefined ? body.color : null,
      body.icon !== undefined ? body.icon : null,
      body.parent_id !== undefined ? body.parent_id : (existing as any).parent_id,
      body.default_template_id !== undefined ? body.default_template_id : (existing as any).default_template_id,
      body.view_mode !== undefined ? body.view_mode : null,
      body.sort_order !== undefined ? body.sort_order : null,
      body.hide_from_all !== undefined ? (body.hide_from_all ? 1 : 0) : null,
      now,
      id
    );

    const updated = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(id);
    return updated;
  });

  // Delete notebook
  fastify.delete('/api/notebooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Move associated items to uncategorized (notebook_id = null)
    db.prepare('UPDATE items SET notebook_id = NULL WHERE notebook_id = ?').run(id);
    const result = db.prepare('DELETE FROM notebooks WHERE id = ?').run(id);

    if (result.changes === 0) {
      return reply.code(404).send({ error: 'Notebook not found' });
    }

    return { success: true, id };
  });
}
