import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import crypto from 'crypto';
import { generateMarkdownFromForm } from '../services/markdown.js';
import { syncItemLinks, getBacklinks, getOutgoingLinks } from '../services/links.js';
import { FormTemplate, ItemType } from '../types/index.js';

function formatFtsQuery(q: string): string {
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';
  return tokens
    .map((t) => {
      const cleaned = t.replace(/["*^:()\-]/g, '');
      return cleaned ? `"${cleaned}"*` : '';
    })
    .filter(Boolean)
    .join(' ');
}

export async function itemRoutes(fastify: FastifyInstance) {
  // List items with filters and optional FTS5 full-text search
  fastify.get('/api/items', async (request) => {
    const userId = (request as any).user?.id;
    const query = request.query as {
      notebook_id?: string;
      type?: ItemType;
      is_favorite?: string;
      is_archived?: string;
      include_hidden?: string;
      search?: string;
      tag?: string;
    };

    const rawSearch = query.search?.trim();
    const ftsQuery = rawSearch ? formatFtsQuery(rawSearch) : '';

    let rows: any[] = [];
    let usedFts = false;

    if (ftsQuery) {
      try {
        let ftsSql = `
          SELECT 
            i.*,
            n.name as notebook_name,
            n.color as notebook_color,
            n.hide_from_all as notebook_hide_from_all,
            bm25(items_fts, 5.0, 1.0) as search_rank,
            snippet(items_fts, -1, '<mark class="ff-search-hl">', '</mark>', '...', 24) as search_snippet,
            COALESCE((
              SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color))
              FROM item_tags it
              JOIN tags t ON it.tag_id = t.id
              WHERE it.item_id = i.id
            ), '[]') as tags_json
          FROM items_fts
          JOIN items i ON items_fts.item_id = i.id
          LEFT JOIN notebooks n ON i.notebook_id = n.id
          WHERE items_fts MATCH ?
        `;
        const ftsParams: any[] = [ftsQuery];

        if (userId) {
          ftsSql += ` AND (i.user_id = ? OR i.user_id IS NULL OR i.id IN (SELECT item_id FROM item_shares WHERE shared_with_user_id = ?))`;
          ftsParams.push(userId, userId);
        }

        if (query.is_archived === '1') {
          ftsSql += ` AND i.is_archived = 1`;
        } else {
          ftsSql += ` AND i.is_archived = 0`;
        }

        if (query.notebook_id) {
          if (query.notebook_id === 'uncategorized') {
            ftsSql += ` AND i.notebook_id IS NULL`;
          } else {
            ftsSql += ` AND i.notebook_id = ?`;
            ftsParams.push(query.notebook_id);
          }
        } else if (query.include_hidden !== '1') {
          ftsSql += ` AND (i.hide_from_all = 0 OR i.hide_from_all IS NULL) AND (n.hide_from_all = 0 OR n.hide_from_all IS NULL)`;
        }

        if (query.type) {
          ftsSql += ` AND i.type = ?`;
          ftsParams.push(query.type);
        }

        if (query.is_favorite === '1') {
          ftsSql += ` AND i.is_favorite = 1`;
        }

        if (query.tag) {
          ftsSql += ` AND i.id IN (SELECT item_id FROM item_tags JOIN tags ON item_tags.tag_id = tags.id WHERE tags.name = ?)`;
          ftsParams.push(query.tag);
        }

        ftsSql += ` ORDER BY i.is_pinned DESC, search_rank ASC, i.updated_at DESC`;

        rows = db.prepare(ftsSql).all(...ftsParams) as any[];
        usedFts = true;
      } catch {
        usedFts = false;
      }
    }

    if (!usedFts) {
      let sql = `
        SELECT 
          i.*,
          n.name as notebook_name,
          n.color as notebook_color,
          n.hide_from_all as notebook_hide_from_all,
          COALESCE((
            SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color))
            FROM item_tags it
            JOIN tags t ON it.tag_id = t.id
            WHERE it.item_id = i.id
          ), '[]') as tags_json
        FROM items i
        LEFT JOIN notebooks n ON i.notebook_id = n.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (userId) {
        sql += ` AND (i.user_id = ? OR i.user_id IS NULL OR i.id IN (SELECT item_id FROM item_shares WHERE shared_with_user_id = ?))`;
        params.push(userId, userId);
      }

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

      if (rawSearch) {
        const term = `%${rawSearch}%`;
        sql += ` AND (i.title LIKE ? OR i.content LIKE ?)`;
        params.push(term, term);
      }

      if (query.tag) {
        sql += ` AND i.id IN (SELECT item_id FROM item_tags JOIN tags ON item_tags.tag_id = tags.id WHERE tags.name = ?)`;
        params.push(query.tag);
      }

      // Sort: Pinned first, then newest updated first
      sql += ` ORDER BY i.is_pinned DESC, i.updated_at DESC`;

      rows = db.prepare(sql).all(...params) as any[];
    }

    // Parse metadata JSON and tags JSON (zero N+1 queries)
    const items = rows.map((r) => {
      let meta = {};
      try {
        meta = JSON.parse(r.metadata || '{}');
      } catch {
        meta = {};
      }

      let tags = [];
      try {
        tags = JSON.parse(r.tags_json || '[]');
      } catch {
        tags = [];
      }

      const { tags_json, ...itemData } = r;

      return {
        ...itemData,
        metadata: meta,
        tags,
        ...(r.search_snippet ? { search_snippet: r.search_snippet } : {}),
        ...(r.search_rank !== undefined ? { search_rank: r.search_rank } : {})
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
        n.hide_from_all as notebook_hide_from_all,
        COALESCE((
          SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color))
          FROM item_tags it
          JOIN tags t ON it.tag_id = t.id
          WHERE it.item_id = i.id
        ), '[]') as tags_json
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

    let tags = [];
    try {
      tags = JSON.parse(row.tags_json || '[]');
    } catch {
      tags = [];
    }

    const { tags_json, ...itemData } = row;

    return {
      ...itemData,
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
    const userId = (request as any).user?.id || null;

    db.prepare(`
      INSERT INTO items (id, user_id, notebook_id, title, type, content, metadata, priority, is_favorite, is_pinned, is_archived, hide_from_all, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
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

    syncItemLinks(id, content);

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

    syncItemLinks(id, nextContent);

    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any;
    return {
      ...updated,
      metadata: JSON.parse(updated.metadata || '{}')
    };
  });

  // Linked References: items whose [[wikilinks]] point at this item's title
  fastify.get('/api/items/:id/backlinks', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.id;
    const exists = db.prepare('SELECT id FROM items WHERE id = ?').get(id);
    if (!exists) return reply.code(404).send({ error: 'Item not found' });
    return getBacklinks(id, userId);
  });

  // Outgoing wikilinks of an item, each resolved to a target item when one exists
  fastify.get('/api/items/:id/links', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.id;
    const exists = db.prepare('SELECT id FROM items WHERE id = ?').get(id);
    if (!exists) return reply.code(404).send({ error: 'Item not found' });
    return getOutgoingLinks(id, userId);
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

  // Empty trash (permanently delete all archived items)
  fastify.post('/api/items/trash/empty', async (request) => {
    const userId = (request as any).user?.id;
    let result;
    if (userId) {
      result = db.prepare('DELETE FROM items WHERE is_archived = 1 AND (user_id = ? OR user_id IS NULL)').run(userId);
    } else {
      result = db.prepare('DELETE FROM items WHERE is_archived = 1').run();
    }
    return { success: true, count: result.changes };
  });

  // Restore all trash (restore all archived items)
  fastify.post('/api/items/trash/restore-all', async (request) => {
    const userId = (request as any).user?.id;
    const now = new Date().toISOString();
    let result;
    if (userId) {
      result = db.prepare('UPDATE items SET is_archived = 0, updated_at = ? WHERE is_archived = 1 AND (user_id = ? OR user_id IS NULL)').run(now, userId);
    } else {
      result = db.prepare('UPDATE items SET is_archived = 0, updated_at = ? WHERE is_archived = 1').run(now);
    }
    return { success: true, count: result.changes };
  });

  // Batch update items
  fastify.post('/api/items/batch-update', async (request, reply) => {
    const userId = (request as any).user?.id;
    const { ids, updates } = (request.body as any) || {};
    if (!Array.isArray(ids) || ids.length === 0 || !updates || typeof updates !== 'object') {
      return reply.code(400).send({ error: 'ids array and updates object are required' });
    }

    const now = new Date().toISOString();
    const updateClauses: string[] = ['updated_at = ?'];
    const baseParams: any[] = [now];

    if (updates.notebook_id !== undefined) {
      updateClauses.push('notebook_id = ?');
      baseParams.push(updates.notebook_id);
    }
    if (updates.priority !== undefined) {
      updateClauses.push('priority = ?');
      baseParams.push(updates.priority);
    }
    if (updates.is_favorite !== undefined) {
      updateClauses.push('is_favorite = ?');
      baseParams.push(updates.is_favorite ? 1 : 0);
    }
    if (updates.is_pinned !== undefined) {
      updateClauses.push('is_pinned = ?');
      baseParams.push(updates.is_pinned ? 1 : 0);
    }
    if (updates.is_archived !== undefined) {
      updateClauses.push('is_archived = ?');
      baseParams.push(updates.is_archived ? 1 : 0);
    }
    if (updates.hide_from_all !== undefined) {
      updateClauses.push('hide_from_all = ?');
      baseParams.push(updates.hide_from_all ? 1 : 0);
    }

    const sql = `
      UPDATE items SET ${updateClauses.join(', ')}
      WHERE id = ? ${userId ? 'AND (user_id = ? OR user_id IS NULL)' : ''}
    `;
    const stmt = db.prepare(sql);

    let count = 0;
    const runTransaction = db.transaction(() => {
      for (const id of ids) {
        const params = userId ? [...baseParams, id, userId] : [...baseParams, id];
        const res = stmt.run(...params);
        count += res.changes;
      }
    });

    runTransaction();
    return { success: true, count };
  });

  // Batch delete items (soft archive or permanent purge)
  fastify.post('/api/items/batch-delete', async (request, reply) => {
    const userId = (request as any).user?.id;
    const { ids, permanent } = (request.body as any) || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({ error: 'ids array is required' });
    }

    let count = 0;
    if (permanent) {
      const sql = `DELETE FROM items WHERE id = ? ${userId ? 'AND (user_id = ? OR user_id IS NULL)' : ''}`;
      const stmt = db.prepare(sql);
      const runTransaction = db.transaction(() => {
        for (const id of ids) {
          const res = userId ? stmt.run(id, userId) : stmt.run(id);
          count += res.changes;
        }
      });
      runTransaction();
      return { success: true, count, permanent: true };
    } else {
      const now = new Date().toISOString();
      const sql = `UPDATE items SET is_archived = 1, updated_at = ? WHERE id = ? ${userId ? 'AND (user_id = ? OR user_id IS NULL)' : ''}`;
      const stmt = db.prepare(sql);
      const runTransaction = db.transaction(() => {
        for (const id of ids) {
          const res = userId ? stmt.run(now, id, userId) : stmt.run(now, id);
          count += res.changes;
        }
      });
      runTransaction();
      return { success: true, count, archived: true };
    }
  });

  // Batch move items to notebook
  fastify.post('/api/items/batch-move', async (request, reply) => {
    const userId = (request as any).user?.id;
    const { ids, notebook_id } = (request.body as any) || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({ error: 'ids array is required' });
    }
    const targetNotebookId = notebook_id || null;
    const now = new Date().toISOString();
    const sql = `UPDATE items SET notebook_id = ?, updated_at = ? WHERE id = ? ${userId ? 'AND (user_id = ? OR user_id IS NULL)' : ''}`;
    const stmt = db.prepare(sql);

    let count = 0;
    const runTransaction = db.transaction(() => {
      for (const id of ids) {
        const res = userId ? stmt.run(targetNotebookId, now, id, userId) : stmt.run(targetNotebookId, now, id);
        count += res.changes;
      }
    });

    runTransaction();
    return { success: true, count };
  });

  // Batch tag items (add or remove)
  fastify.post('/api/items/batch-tag', async (request, reply) => {
    const userId = (request as any).user?.id;
    const { ids, tag_ids, action } = (request.body as any) || {};
    if (!Array.isArray(ids) || ids.length === 0 || !Array.isArray(tag_ids) || tag_ids.length === 0) {
      return reply.code(400).send({ error: 'ids and tag_ids arrays are required' });
    }

    const addStmt = db.prepare(`
      INSERT OR IGNORE INTO item_tags (item_id, tag_id)
      SELECT ?, ?
      WHERE EXISTS (
        SELECT 1 FROM items WHERE id = ? ${userId ? 'AND (user_id = ? OR user_id IS NULL)' : ''}
      )
    `);
    const removeStmt = db.prepare(`
      DELETE FROM item_tags
      WHERE item_id = ? AND tag_id = ?
      AND EXISTS (
        SELECT 1 FROM items WHERE id = ? ${userId ? 'AND (user_id = ? OR user_id IS NULL)' : ''}
      )
    `);

    let count = 0;
    const runTransaction = db.transaction(() => {
      for (const id of ids) {
        for (const tagId of tag_ids) {
          if (action === 'remove') {
            const res = userId ? removeStmt.run(id, tagId, id, userId) : removeStmt.run(id, tagId, id);
            count += res.changes;
          } else {
            const res = userId ? addStmt.run(id, tagId, id, userId) : addStmt.run(id, tagId, id);
            count += res.changes;
          }
        }
      }
    });

    runTransaction();
    return { success: true, count };
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
