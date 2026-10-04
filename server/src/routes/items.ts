import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import crypto from 'crypto';
import { generateMarkdownFromForm } from '../services/markdown.js';
import { FormTemplate, ItemType } from '../types/index.js';

export async function itemRoutes(fastify: FastifyInstance) {
  // List items with filters
  fastify.get('/api/items', async (request) => {
    const query = request.query as {
      notebook_id?: string;
      type?: ItemType;
      is_favorite?: string;
      is_archived?: string;
      include_hidden?: string;
      search?: string;
      tag?: string;
    };

    let sql = `
      SELECT 
        i.*,
        n.name as notebook_name,
        n.color as notebook_color,
        n.hide_from_all as notebook_hide_from_all
      FROM items i
      LEFT JOIN notebooks n ON i.notebook_id = n.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by archived status (default to active items, is_archived = 0)
    if (query.is_archived === '1') {
      sql += ` AND i.is_archived = 1`;
    } else {
      sql += ` AND i.is_archived = 0`;
    }

    if (query.notebook_id) {
      if (query.notebook_id === 'uncategorized') {
        sql += ` AND i.notebook_id IS NULL`;
      } else {
        sql += ` AND i.notebook_id = ?`;
        params.push(query.notebook_id);
      }
    } else if (query.include_hidden !== '1') {
      // Global feed: hide items flagged hide_from_all or belonging to a hidden notebook
      sql += ` AND (i.hide_from_all = 0 OR i.hide_from_all IS NULL) AND (n.hide_from_all = 0 OR n.hide_from_all IS NULL)`;
    }

    if (query.type) {
      sql += ` AND i.type = ?`;
      params.push(query.type);
    }

    if (query.is_favorite === '1') {
      sql += ` AND i.is_favorite = 1`;
    }

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      sql += ` AND (i.title LIKE ? OR i.content LIKE ?)`;
      params.push(term, term);
    }

    if (query.tag) {
      sql += ` AND i.id IN (SELECT item_id FROM item_tags JOIN tags ON item_tags.tag_id = tags.id WHERE tags.name = ?)`;
      params.push(query.tag);
    }

    // Sort: Pinned first, then newest updated first
    sql += ` ORDER BY i.is_pinned DESC, i.updated_at DESC`;

    const rows = db.prepare(sql).all(...params) as any[];

    // Parse metadata JSON and fetch tags
    const items = rows.map((r) => {
      let meta = {};
      try {
        meta = JSON.parse(r.metadata || '{}');
      } catch {
        meta = {};
      }

      const tags = db.prepare(`
        SELECT t.* FROM tags t
        JOIN item_tags it ON t.id = it.tag_id
        WHERE it.item_id = ?
      `).all(r.id);

      return {
        ...r,
        metadata: meta,
        tags
      };
    });

    return items;
  });

  // Get single item
  fastify.get('/api/items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = db.prepare(`
      SELECT 
        i.*,
        n.name as notebook_name,
        n.color as notebook_color,
        n.hide_from_all as notebook_hide_from_all
      FROM items i
      LEFT JOIN notebooks n ON i.notebook_id = n.id
      WHERE i.id = ?
    `).get(id) as any;

    if (!row) {
      return reply.code(404).send({ error: 'Item not found' });
    }

    let meta = {};
    try {
      meta = JSON.parse(row.metadata || '{}');
    } catch {
      meta = {};
    }

    const tags = db.prepare(`
      SELECT t.* FROM tags t
      JOIN item_tags it ON t.id = it.tag_id
      WHERE it.item_id = ?
    `).all(id);

    return {
      ...row,
      metadata: meta,
      tags
    };
  });

  // Create item
  fastify.post('/api/items', async (request, reply) => {
    const body = request.body as any;
    const id = body.id || `item-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const title = body.title?.trim() || 'Untitled';
    const type: ItemType = body.type || 'note';
    const notebook_id = body.notebook_id || null;
    let content = body.content || '';
    let metadata = body.metadata || {};

    // If type is form_entry, check if we need to auto-generate markdown
    if (type === 'form_entry') {
      const templateId = metadata.template_id;
      if (templateId) {
        const tplRow = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId) as any;
        if (tplRow) {
          const template: FormTemplate = {
            ...tplRow,
            fields_schema: JSON.parse(tplRow.fields_schema || '[]')
          };
          metadata.template_name = template.name;
          if (!content) {
            content = generateMarkdownFromForm(template, metadata.values || {});
          }
        }
      }
    }

    // Default metadata for counter if empty
    if (type === 'counter') {
      metadata = {
        count: Number(metadata.count) || 0,
        step: Number(metadata.step) || 1,
        min: metadata.min !== undefined ? metadata.min : null,
        max: metadata.max !== undefined ? metadata.max : null,
        unit: metadata.unit || '',
        resetValue: metadata.resetValue !== undefined ? Number(metadata.resetValue) : 0,
        ...metadata
      };
    }

    const is_favorite = body.is_favorite ? 1 : 0;
    const is_pinned = body.is_pinned ? 1 : 0;
    const hide_from_all = body.hide_from_all ? 1 : 0;
    const priority = body.priority || '';

    db.prepare(`
      INSERT INTO items (id, notebook_id, title, type, content, metadata, priority, is_favorite, is_pinned, is_archived, hide_from_all, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      notebook_id,
      title,
      type,
      content,
      JSON.stringify(metadata),
      priority,
      is_favorite,
      is_pinned,
      0,
      hide_from_all,
      now,
      now
    );

    // Initial counter log if counter
    if (type === 'counter' && metadata.count !== undefined) {
      db.prepare(`
        INSERT INTO counter_history (id, item_id, delta, new_value, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`ch-${crypto.randomUUID()}`, id, metadata.count, metadata.count, 'Initial count', now);
    }

    // Tag associations if provided
    if (Array.isArray(body.tags)) {
      for (const tagName of body.tags) {
        const cleanTag = String(tagName).trim();
        if (!cleanTag) continue;
        let tag = db.prepare('SELECT * FROM tags WHERE name = ?').get(cleanTag) as any;
        if (!tag) {
          const tagId = `tag-${crypto.randomUUID()}`;
          db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(tagId, cleanTag, '#22c55e');
          tag = { id: tagId, name: cleanTag, color: '#22c55e' };
        }
        db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)').run(id, tag.id);
      }
    }

    const created = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any;
    return reply.code(201).send({
      ...created,
      metadata: JSON.parse(created.metadata || '{}')
    });
  });

  // Update item
  fastify.put('/api/items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any;
    if (!existing) {
      return reply.code(404).send({ error: 'Item not found' });
    }

    let nextMetadata = existing.metadata ? JSON.parse(existing.metadata) : {};
    if (body.metadata !== undefined) {
      nextMetadata = { ...nextMetadata, ...body.metadata };
    }

    let nextContent = body.content !== undefined ? body.content : existing.content;

    // If form entry, update markdown content when values change
    if (existing.type === 'form_entry' && body.metadata?.values) {
      const templateId = nextMetadata.template_id;
      if (templateId) {
        const tplRow = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId) as any;
        if (tplRow) {
          const template: FormTemplate = {
            ...tplRow,
            fields_schema: JSON.parse(tplRow.fields_schema || '[]')
          };
          nextContent = generateMarkdownFromForm(template, nextMetadata.values);
        }
      }
    }

    db.prepare(`
      UPDATE items SET
        notebook_id = ?,
        title = COALESCE(?, title),
        content = ?,
        metadata = ?,
        priority = COALESCE(?, priority),
        is_favorite = COALESCE(?, is_favorite),
        is_pinned = COALESCE(?, is_pinned),
        is_archived = COALESCE(?, is_archived),
        hide_from_all = COALESCE(?, hide_from_all),
        updated_at = ?
      WHERE id = ?
    `).run(
      body.notebook_id !== undefined ? body.notebook_id : existing.notebook_id,
      body.title !== undefined ? body.title.trim() : null,
      nextContent,
      JSON.stringify(nextMetadata),
      body.priority !== undefined ? body.priority : null,
      body.is_favorite !== undefined ? (body.is_favorite ? 1 : 0) : null,
      body.is_pinned !== undefined ? (body.is_pinned ? 1 : 0) : null,
      body.is_archived !== undefined ? (body.is_archived ? 1 : 0) : null,
      body.hide_from_all !== undefined ? (body.hide_from_all ? 1 : 0) : null,
      now,
      id
    );

    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any;
    return {
      ...updated,
      metadata: JSON.parse(updated.metadata || '{}')
    };
  });

  // Delete item (permanent deletion or purge)
  fastify.delete('/api/items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { permanent?: string };

    if (query.permanent === '1') {
      const result = db.prepare('DELETE FROM items WHERE id = ?').run(id);
      if (result.changes === 0) {
        return reply.code(404).send({ error: 'Item not found' });
      }
      return { success: true, id, permanent: true };
    }

    // Soft delete / Move to trash
    const now = new Date().toISOString();
    db.prepare('UPDATE items SET is_archived = 1, updated_at = ? WHERE id = ?').run(now, id);
    return { success: true, id, archived: true };
  });

  // Counter actions: increment, decrement, reset
  fastify.post('/api/items/:id/counter', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { delta, reset, note, setValue } = request.body as {
      delta?: number;
      reset?: boolean;
      note?: string;
      setValue?: number;
    };

    const item = db.prepare("SELECT * FROM items WHERE id = ? AND type = 'counter'").get(id) as any;
    if (!item) {
      return reply.code(404).send({ error: 'Counter item not found' });
    }

    const meta = JSON.parse(item.metadata || '{}');
    const currentCount = Number(meta.count) || 0;
    const step = Number(meta.step) || 1;
    let newCount = currentCount;
    let appliedDelta = 0;

    if (reset) {
      newCount = Number(meta.resetValue) || 0;
      appliedDelta = newCount - currentCount;
    } else if (setValue !== undefined) {
      newCount = Number(setValue);
      appliedDelta = newCount - currentCount;
    } else {
      appliedDelta = delta !== undefined ? Number(delta) : step;
      newCount = currentCount + appliedDelta;
    }

    // Respect min / max bounds if defined
    if (meta.min !== undefined && meta.min !== null && newCount < meta.min) {
      newCount = meta.min;
      appliedDelta = newCount - currentCount;
    }
    if (meta.max !== undefined && meta.max !== null && newCount > meta.max) {
      newCount = meta.max;
      appliedDelta = newCount - currentCount;
    }

    meta.count = newCount;
    const now = new Date().toISOString();

    db.prepare('UPDATE items SET metadata = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(meta),
      now,
      id
    );

    const historyId = `ch-${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO counter_history (id, item_id, delta, new_value, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(historyId, id, appliedDelta, newCount, note || (reset ? 'Reset counter' : ''), now);

    return {
      success: true,
      count: newCount,
      delta: appliedDelta,
      metadata: meta,
      history_entry: {
        id: historyId,
        item_id: id,
        delta: appliedDelta,
        new_value: newCount,
        note: note || '',
        created_at: now
      }
    };
  });

  // Get counter history (supports both /counter/history and SSoT-standard /counter-history)
  const getCounterHistoryHandler = async (request: any) => {
    const { id } = request.params as { id: string };
    const history = db.prepare(`
      SELECT * FROM counter_history
      WHERE item_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).all(id);

    return history;
  };

  fastify.get('/api/items/:id/counter/history', getCounterHistoryHandler);
  fastify.get('/api/items/:id/counter-history', getCounterHistoryHandler);
}
