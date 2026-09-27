import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import crypto from 'crypto';
import { generateMarkdownFromForm } from '../services/markdown.js';
import { FormTemplate } from '../types/index.js';

export async function templateRoutes(fastify: FastifyInstance) {
  // List all templates
  fastify.get('/api/templates', async () => {
    const rows = db.prepare(`
      SELECT 
        t.*,
        (SELECT COUNT(*) FROM items WHERE items.type = 'form_entry' AND json_extract(items.metadata, '$.template_id') = t.id) as usage_count
      FROM templates t
      ORDER BY t.name ASC
    `).all() as any[];

    return rows.map((r) => ({
      ...r,
      enable_processed_tracking: Boolean(r.enable_processed_tracking ?? 1),
      fields_schema: JSON.parse(r.fields_schema || '[]')
    }));
  });

  // Get single template
  fastify.get('/api/templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;

    if (!row) {
      return reply.code(404).send({ error: 'Template not found' });
    }

    return {
      ...row,
      enable_processed_tracking: Boolean(row.enable_processed_tracking ?? 1),
      fields_schema: JSON.parse(row.fields_schema || '[]')
    };
  });

  // Create template
  fastify.post('/api/templates', async (request, reply) => {
    const body = request.body as any;
    const id = body.id || `tpl-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const name = body.name?.trim();
    if (!name) {
      return reply.code(400).send({ error: 'Template name is required' });
    }

    const description = body.description || '';
    const icon = body.icon || 'file-text';
    const color = body.color || '#3b82f6';
    const default_notebook_id = body.default_notebook_id || null;
    const enable_processed_tracking = body.enable_processed_tracking !== undefined ? (body.enable_processed_tracking ? 1 : 0) : 1;
    const fields_schema = JSON.stringify(body.fields_schema || []);

    db.prepare(`
      INSERT INTO templates (id, name, description, icon, color, default_notebook_id, fields_schema, enable_processed_tracking, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description, icon, color, default_notebook_id, fields_schema, enable_processed_tracking, now, now);

    const created = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
    return reply.code(201).send({
      ...created,
      enable_processed_tracking: Boolean(created.enable_processed_tracking ?? 1),
      fields_schema: JSON.parse(created.fields_schema || '[]')
    });
  });

  // Update template
  fastify.put('/api/templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    if (!existing) {
      return reply.code(404).send({ error: 'Template not found' });
    }

    db.prepare(`
      UPDATE templates SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        default_notebook_id = ?,
        fields_schema = COALESCE(?, fields_schema),
        enable_processed_tracking = COALESCE(?, enable_processed_tracking),
        updated_at = ?
      WHERE id = ?
    `).run(
      body.name !== undefined ? body.name.trim() : null,
      body.description !== undefined ? body.description : null,
      body.icon !== undefined ? body.icon : null,
      body.color !== undefined ? body.color : null,
      body.default_notebook_id !== undefined ? body.default_notebook_id : (existing as any).default_notebook_id,
      body.fields_schema !== undefined ? JSON.stringify(body.fields_schema) : null,
      body.enable_processed_tracking !== undefined ? (body.enable_processed_tracking ? 1 : 0) : null,
      now,
      id
    );

    const updated = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
    return {
      ...updated,
      enable_processed_tracking: Boolean(updated.enable_processed_tracking ?? 1),
      fields_schema: JSON.parse(updated.fields_schema || '[]')
    };
  });

  // Delete template
  fastify.delete('/api/templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = db.prepare('DELETE FROM templates WHERE id = ?').run(id);

    if (result.changes === 0) {
      return reply.code(404).send({ error: 'Template not found' });
    }

    return { success: true, id };
  });

  // Preview rendered markdown for template values
  fastify.post('/api/templates/:id/preview-markdown', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { values } = request.body as { values: Record<string, any> };

    const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
    if (!row) {
      return reply.code(404).send({ error: 'Template not found' });
    }

    const template: FormTemplate = {
      ...row,
      fields_schema: JSON.parse(row.fields_schema || '[]')
    };

    const markdown = generateMarkdownFromForm(template, values || {});
    return { markdown };
  });
}
