import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { SyncRequestBody, SyncResponseBody, Item, ConflictRecord, Notebook, FormTemplate, Reminder } from '../types/index.js';
import { generateMarkdownFromForm } from '../services/markdown.js';
import { broadcast } from '../services/realtime.js';
import crypto from 'crypto';

export const syncRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: SyncRequestBody }>('/api/sync', async (request, reply) => {
    const { device_name = 'Unknown Device', last_sync_timestamp, mutations = [] } = request.body || {};
    const serverTime = new Date().toISOString();
    const processedIds: string[] = [];
    const newConflicts: ConflictRecord[] = [];

    const syncTransaction = db.transaction(() => {
      for (const mutation of mutations) {
        try {
          const { id: mutationId, type, data, client_timestamp, base_timestamp } = mutation;

          if (type === 'create_item') {
            const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(data.id) as Item | undefined;
            if (!existing) {
              let content = data.content || '';
              if (data.type === 'form_entry' && data.metadata?.template_id && data.metadata?.values) {
                const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(data.metadata.template_id) as any;
                if (template) {
                  const schema = typeof template.fields_schema === 'string' ? JSON.parse(template.fields_schema) : template.fields_schema;
                  content = generateMarkdownFromForm({ ...template, fields_schema: schema }, data.metadata.values);
                }
              }

              db.prepare(`
                INSERT INTO items (id, notebook_id, title, type, content, metadata, is_favorite, is_pinned, is_archived, hide_from_all, priority, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                data.id,
                data.notebook_id ?? null,
                data.title || 'Untitled',
                data.type,
                content,
                JSON.stringify(data.metadata || {}),
                data.is_favorite ? 1 : 0,
                data.is_pinned ? 1 : 0,
                data.is_archived ? 1 : 0,
                data.hide_from_all ? 1 : 0,
                data.priority || '',
                data.created_at || client_timestamp || serverTime,
                data.updated_at || client_timestamp || serverTime
              );
            }
            processedIds.push(mutationId);
          } else if (type === 'update_item') {
            const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(data.id) as any;
            if (existing) {
              const existingUpdated = existing.updated_at;
              const hasServerConflict = base_timestamp && existingUpdated > base_timestamp;
              const isDifferentContent =
                existing.title !== data.title ||
                existing.content !== data.content ||
                existing.metadata !== (typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}));

              let content = data.content ?? existing.content;
              if (data.type === 'form_entry' && data.metadata?.template_id && data.metadata?.values) {
                const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(data.metadata.template_id) as any;
                if (template) {
                  const schema = typeof template.fields_schema === 'string' ? JSON.parse(template.fields_schema) : template.fields_schema;
                  content = generateMarkdownFromForm({ ...template, fields_schema: schema }, data.metadata.values);
                }
              }

              if (hasServerConflict && isDifferentContent) {
                // Conflict detected!
                const isClientNewer = client_timestamp >= existingUpdated;
                const conflictId = crypto.randomUUID();

                let activeTitle: string;
                let activeContent: string;
                let activeMetadataStr: string;
                let activeUpdatedAt: string;

                let conflictTitle: string;
                let conflictContent: string;
                let conflictMetadataStr: string;
                let conflictUpdatedAt: string;

                if (isClientNewer) {
                  // Client wins active slot; server becomes conflict
                  activeTitle = data.title ?? existing.title;
                  activeContent = content;
                  activeMetadataStr = typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {});
                  activeUpdatedAt = client_timestamp || serverTime;

                  conflictTitle = existing.title;
                  conflictContent = existing.content;
                  conflictMetadataStr = existing.metadata;
                  conflictUpdatedAt = existing.updated_at;

                  // Update active item in DB
                  db.prepare(`
                    UPDATE items
                    SET notebook_id = ?, title = ?, content = ?, metadata = ?, is_favorite = ?, is_pinned = ?, is_archived = ?, hide_from_all = ?, priority = ?, updated_at = ?
                    WHERE id = ?
                  `).run(
                    data.notebook_id !== undefined ? data.notebook_id : existing.notebook_id,
                    activeTitle,
                    activeContent,
                    activeMetadataStr,
                    data.is_favorite !== undefined ? (data.is_favorite ? 1 : 0) : existing.is_favorite,
                    data.is_pinned !== undefined ? (data.is_pinned ? 1 : 0) : existing.is_pinned,
                    data.is_archived !== undefined ? (data.is_archived ? 1 : 0) : existing.is_archived,
                    data.hide_from_all !== undefined ? (data.hide_from_all ? 1 : 0) : existing.hide_from_all,
                    data.priority !== undefined ? data.priority : existing.priority,
                    activeUpdatedAt,
                    data.id
                  );
                } else {
                  // Server stays active; client becomes conflict
                  activeTitle = existing.title;
                  activeContent = existing.content;
                  activeMetadataStr = existing.metadata;
                  activeUpdatedAt = existing.updated_at;

                  conflictTitle = data.title ?? existing.title;
                  conflictContent = content;
                  conflictMetadataStr = typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {});
                  conflictUpdatedAt = client_timestamp || serverTime;
                }

                // Insert conflict record
                db.prepare(`
                  INSERT INTO conflicts (
                    id, item_id, active_title, active_content, active_metadata, active_updated_at,
                    conflict_title, conflict_content, conflict_metadata, conflict_updated_at,
                    device_name, status, created_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unresolved', ?)
                `).run(
                  conflictId,
                  data.id,
                  activeTitle,
                  activeContent,
                  activeMetadataStr,
                  activeUpdatedAt,
                  conflictTitle,
                  conflictContent,
                  conflictMetadataStr,
                  conflictUpdatedAt,
                  device_name,
                  serverTime
                );

                const createdConflict: ConflictRecord = {
                  id: conflictId,
                  item_id: data.id,
                  active_title: activeTitle,
                  active_content: activeContent,
                  active_metadata: JSON.parse(activeMetadataStr || '{}'),
                  active_updated_at: activeUpdatedAt,
                  conflict_title: conflictTitle,
                  conflict_content: conflictContent,
                  conflict_metadata: JSON.parse(conflictMetadataStr || '{}'),
                  conflict_updated_at: conflictUpdatedAt,
                  device_name,
                  status: 'unresolved',
                  created_at: serverTime
                };

                newConflicts.push(createdConflict);
                broadcast({
                  type: 'CONFLICT_CREATED',
                  payload: { conflict: createdConflict }
                });
              } else {
                // Clean Fast-Forward update
                db.prepare(`
                  UPDATE items
                  SET notebook_id = ?, title = ?, content = ?, metadata = ?, is_favorite = ?, is_pinned = ?, is_archived = ?, hide_from_all = ?, priority = ?, updated_at = ?
                  WHERE id = ?
                `).run(
                  data.notebook_id !== undefined ? data.notebook_id : existing.notebook_id,
                  data.title ?? existing.title,
                  content,
                  typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata ?? JSON.parse(existing.metadata || '{}')),
                  data.is_favorite !== undefined ? (data.is_favorite ? 1 : 0) : existing.is_favorite,
                  data.is_pinned !== undefined ? (data.is_pinned ? 1 : 0) : existing.is_pinned,
                  data.is_archived !== undefined ? (data.is_archived ? 1 : 0) : existing.is_archived,
                  data.hide_from_all !== undefined ? (data.hide_from_all ? 1 : 0) : existing.hide_from_all,
                  data.priority !== undefined ? data.priority : existing.priority,
                  client_timestamp || serverTime,
                  data.id
                );
              }
            }
            processedIds.push(mutationId);
          } else if (type === 'delete_item') {
            db.prepare(`
              UPDATE items SET is_archived = 1, updated_at = ? WHERE id = ?
            `).run(client_timestamp || serverTime, data.id);
            processedIds.push(mutationId);
          } else if (type === 'counter_adjust') {
            const item = db.prepare('SELECT * FROM items WHERE id = ?').get(data.id) as any;
            if (item) {
              const meta = JSON.parse(item.metadata || '{}');
              const currentVal = Number(meta.count ?? 0);
              let nextVal = currentVal;

              if (data.delta !== undefined) {
                nextVal = currentVal + Number(data.delta);
              } else if (data.setValue !== undefined) {
                nextVal = Number(data.setValue);
              } else if (data.reset) {
                nextVal = Number(meta.resetValue ?? 0);
              }

              meta.count = nextVal;
              db.prepare('UPDATE items SET metadata = ?, updated_at = ? WHERE id = ?').run(
                JSON.stringify(meta),
                client_timestamp || serverTime,
                data.id
              );

              // Record history
              db.prepare(`
                INSERT INTO counter_history (id, item_id, delta, new_value, note, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `).run(
                crypto.randomUUID(),
                data.id,
                data.delta ?? 0,
                nextVal,
                data.note || `Sync from ${device_name}`,
                client_timestamp || serverTime
              );
            }
            processedIds.push(mutationId);
          } else if (type === 'create_notebook') {
            const existingNb = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(data.id);
            if (!existingNb) {
              db.prepare(`
                INSERT INTO notebooks (id, name, description, color, icon, parent_id, default_template_id, view_mode, sort_order, hide_from_all, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                data.id,
                data.name,
                data.description || '',
                data.color || '#22c55e',
                data.icon || 'folder',
                data.parent_id ?? null,
                data.default_template_id ?? null,
                data.view_mode || 'grid',
                data.sort_order || 0,
                data.hide_from_all ? 1 : 0,
                data.created_at || client_timestamp || serverTime,
                data.updated_at || client_timestamp || serverTime
              );
            }
            processedIds.push(mutationId);
          } else if (type === 'update_notebook') {
            db.prepare(`
              UPDATE notebooks
              SET name = ?, description = ?, color = ?, icon = ?, parent_id = ?, default_template_id = ?, view_mode = ?, sort_order = ?, hide_from_all = ?, updated_at = ?
              WHERE id = ?
            `).run(
              data.name,
              data.description || '',
              data.color || '#22c55e',
              data.icon || 'folder',
              data.parent_id ?? null,
              data.default_template_id ?? null,
              data.view_mode || 'grid',
              data.sort_order || 0,
              data.hide_from_all ? 1 : 0,
              client_timestamp || serverTime,
              data.id
            );
            processedIds.push(mutationId);
          } else if (type === 'delete_notebook') {
            db.prepare('DELETE FROM notebooks WHERE id = ?').run(data.id);
            processedIds.push(mutationId);
          } else if (type === 'create_template') {
            const existingTpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(data.id);
            if (!existingTpl) {
              db.prepare(`
                INSERT INTO templates (id, name, description, icon, color, default_notebook_id, fields_schema, enable_processed_tracking, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                data.id,
                data.name,
                data.description || '',
                data.icon || 'file-text',
                data.color || '#3b82f6',
                data.default_notebook_id ?? null,
                typeof data.fields_schema === 'string' ? data.fields_schema : JSON.stringify(data.fields_schema || []),
                data.enable_processed_tracking !== undefined ? (data.enable_processed_tracking ? 1 : 0) : 1,
                data.created_at || client_timestamp || serverTime,
                data.updated_at || client_timestamp || serverTime
              );
            }
            processedIds.push(mutationId);
          } else if (type === 'update_template') {
            db.prepare(`
              UPDATE templates
              SET name = ?, description = ?, icon = ?, color = ?, default_notebook_id = ?, fields_schema = ?, enable_processed_tracking = ?, updated_at = ?
              WHERE id = ?
            `).run(
              data.name,
              data.description || '',
              data.icon || 'file-text',
              data.color || '#3b82f6',
              data.default_notebook_id ?? null,
              typeof data.fields_schema === 'string' ? data.fields_schema : JSON.stringify(data.fields_schema || []),
              data.enable_processed_tracking !== undefined ? (data.enable_processed_tracking ? 1 : 0) : 1,
              client_timestamp || serverTime,
              data.id
            );
            processedIds.push(mutationId);
          } else if (type === 'delete_template') {
            db.prepare('DELETE FROM templates WHERE id = ?').run(data.id);
            processedIds.push(mutationId);
          } else if (type === 'create_reminder') {
            const existingRem = db.prepare('SELECT * FROM reminders WHERE id = ?').get(data.id);
            if (!existingRem) {
              db.prepare(`
                INSERT INTO reminders (id, title, notes, due_date, status, priority, notebook_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                data.id,
                data.title,
                data.notes || '',
                data.due_date,
                data.status || 'pending',
                data.priority || 'normal',
                data.notebook_id ?? null,
                data.created_at || client_timestamp || serverTime,
                data.updated_at || client_timestamp || serverTime
              );
            }
            processedIds.push(mutationId);
          } else if (type === 'update_reminder') {
            db.prepare(`
              UPDATE reminders
              SET title = ?, notes = ?, due_date = ?, status = ?, priority = ?, notebook_id = ?, updated_at = ?
              WHERE id = ?
            `).run(
              data.title,
              data.notes || '',
              data.due_date,
              data.status || 'pending',
              data.priority || 'normal',
              data.notebook_id ?? null,
              client_timestamp || serverTime,
              data.id
            );
            processedIds.push(mutationId);
          } else if (type === 'delete_reminder') {
            db.prepare('DELETE FROM reminders WHERE id = ?').run(data.id);
            processedIds.push(mutationId);
          } else if (type === 'update_settings') {
            if (data.key && data.value !== undefined) {
              const valStr = typeof data.value === 'string' ? data.value : JSON.stringify(data.value);
              db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(
                data.key,
                valStr,
                client_timestamp || serverTime
              );
            }
            processedIds.push(mutationId);
          }
        } catch (err) {
          fastify.log.error({ err, mutation }, 'Error processing sync mutation');
        }
      }
    });

    syncTransaction();

    // Now gather server changes since last_sync_timestamp
    let itemRows: any[];
    let notebookRows: any[];
    let templateRows: any[];
    let reminderRows: any[];
    let settingsRows: any[];
    let conflictRows: any[];

    if (last_sync_timestamp) {
      itemRows = db.prepare('SELECT * FROM items WHERE updated_at > ?').all(last_sync_timestamp) as any[];
      notebookRows = db.prepare('SELECT * FROM notebooks WHERE updated_at > ?').all(last_sync_timestamp) as any[];
      templateRows = db.prepare('SELECT * FROM templates WHERE updated_at > ?').all(last_sync_timestamp) as any[];
      reminderRows = db.prepare('SELECT * FROM reminders WHERE updated_at > ?').all(last_sync_timestamp) as any[];
      settingsRows = db.prepare('SELECT * FROM settings WHERE updated_at > ?').all(last_sync_timestamp) as any[];
    } else {
      itemRows = db.prepare('SELECT * FROM items').all() as any[];
      notebookRows = db.prepare('SELECT * FROM notebooks').all() as any[];
      templateRows = db.prepare('SELECT * FROM templates').all() as any[];
      reminderRows = db.prepare('SELECT * FROM reminders').all() as any[];
      settingsRows = db.prepare('SELECT * FROM settings').all() as any[];
    }

    conflictRows = db.prepare(`
      SELECT * FROM conflicts WHERE status = 'unresolved' ORDER BY created_at DESC
    `).all() as any[];

    const items: Item[] = itemRows.map((r) => ({
      ...r,
      metadata: JSON.parse(r.metadata || '{}')
    }));

    const notebooks: Notebook[] = notebookRows;

    const templates: FormTemplate[] = templateRows.map((r) => ({
      ...r,
      fields_schema: typeof r.fields_schema === 'string' ? JSON.parse(r.fields_schema || '[]') : r.fields_schema,
      enable_processed_tracking: r.enable_processed_tracking !== 0
    }));

    const reminders: Reminder[] = reminderRows;

    const settings: Record<string, any> = {};
    for (const s of settingsRows) {
      try {
        settings[s.key] = JSON.parse(s.value);
      } catch {
        settings[s.key] = s.value;
      }
    }

    const conflicts: ConflictRecord[] = conflictRows.map((r) => ({
      ...r,
      active_metadata: JSON.parse(r.active_metadata || '{}'),
      conflict_metadata: JSON.parse(r.conflict_metadata || '{}')
    }));

    const response: SyncResponseBody = {
      success: true,
      server_time: serverTime,
      processed_mutation_ids: processedIds,
      conflicts,
      server_changes: {
        items,
        notebooks,
        templates,
        reminders,
        settings
      }
    };

    return response;
  });
};
