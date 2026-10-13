import { FastifyInstance } from 'fastify';
import archiver from 'archiver';
import zlib from 'zlib';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { db, UPLOADS_DIR } from '../db/index.js';
import { refreshItemLinks } from '../services/links.js';

function extractBackupJsonFromZip(buf: Buffer): any {
  // 1. Try adm-zip first
  try {
    const zip = new AdmZip(buf);
    const jsonEntry = zip.getEntry('free-form-backup.json');
    if (jsonEntry) {
      return JSON.parse(zip.readAsText(jsonEntry));
    }
  } catch {
    // Fall back to direct ZIP buffer parsing if adm-zip fails on duplicates or structure
  }

  // 2. Direct ZIP buffer scanner looking for free-form-backup.json
  const targetName = 'free-form-backup.json';
  let offset = 0;
  while (offset < buf.length - 30) {
    if (buf.readUInt32LE(offset) === 0x04034b50) { // Local file header signature
      const compMethod = buf.readUInt16LE(offset + 8);
      const compSize = buf.readUInt32LE(offset + 18);
      const uncompSize = buf.readUInt32LE(offset + 22);
      const nameLen = buf.readUInt16LE(offset + 26);
      const extraLen = buf.readUInt16LE(offset + 28);
      const filename = buf.toString('utf8', offset + 30, offset + 30 + nameLen);
      const dataStart = offset + 30 + nameLen + extraLen;

      if (filename === targetName) {
        let content: Buffer;
        if (compMethod === 0) {
          content = buf.subarray(dataStart, dataStart + uncompSize);
        } else if (compMethod === 8) {
          const slice = compSize > 0 ? buf.subarray(dataStart, dataStart + compSize) : buf.subarray(dataStart);
          content = zlib.inflateRawSync(slice);
        } else {
          throw new Error(`Unsupported compression method ${compMethod} in ZIP`);
        }
        return JSON.parse(content.toString('utf8'));
      }
    }
    offset++;
  }

  throw new Error('Could not find free-form-backup.json in ZIP archive');
}

export async function exportRoutes(fastify: FastifyInstance) {
  fastify.get('/api/export', async (request, reply) => {
    const userId = (request as any).user?.id;
    const filterSql = userId ? 'WHERE user_id = ? OR user_id IS NULL' : '';
    const filterParams = userId ? [userId] : [];

    const notebooks = (userId
      ? db.prepare('SELECT * FROM notebooks WHERE user_id = ? OR user_id IS NULL').all(userId)
      : db.prepare('SELECT * FROM notebooks').all()) as any[];

    const items = (userId
      ? db.prepare('SELECT * FROM items WHERE is_archived = 0 AND (user_id = ? OR user_id IS NULL)').all(userId)
      : db.prepare('SELECT * FROM items WHERE is_archived = 0').all()) as any[];

    const templates = (userId
      ? db.prepare('SELECT * FROM templates WHERE user_id = ? OR user_id IS NULL').all(userId)
      : db.prepare('SELECT * FROM templates').all()) as any[];

    const tags = (userId
      ? db.prepare('SELECT * FROM tags WHERE user_id = ? OR user_id IS NULL').all(userId)
      : db.prepare('SELECT * FROM tags').all()) as any[];

    const itemTags = db.prepare('SELECT * FROM item_tags').all() as any[];

    const timers = (userId
      ? db.prepare('SELECT * FROM timers WHERE user_id = ? OR user_id IS NULL').all(userId)
      : db.prepare('SELECT * FROM timers').all()) as any[];

    const reminders = (userId
      ? db.prepare('SELECT * FROM reminders WHERE user_id = ? OR user_id IS NULL').all(userId)
      : db.prepare('SELECT * FROM reminders').all()) as any[];

    const settings = db.prepare('SELECT * FROM settings').all() as any[];

    const counterHistory = (userId
      ? db.prepare(`
          SELECT ch.* FROM counter_history ch
          JOIN items i ON ch.item_id = i.id
          WHERE i.user_id = ? OR i.user_id IS NULL
        `).all(userId)
      : db.prepare('SELECT * FROM counter_history').all()) as any[];

    // Notebook map for folder naming
    const notebookMap = new Map<string, string>();
    notebookMap.set('uncategorized', 'Uncategorized');
    for (const nb of notebooks) {
      // Clean folder name
      const safeName = nb.name.replace(/[/\\?%*:|"<>]/g, '-').trim();
      notebookMap.set(nb.id, safeName || 'Notebook');
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `free-form-export-${dateStr}.zip`;

    reply.raw.setHeader('Content-Type', 'application/zip');
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(reply.raw);

    // 1. Full JSON backup file
    const fullBackup = {
      exported_at: new Date().toISOString(),
      version: '1.0',
      notebooks,
      templates: templates.map((t) => ({
        ...t,
        fields_schema: JSON.parse(t.fields_schema || '[]')
      })),
      items: items.map((i) => ({
        ...i,
        metadata: JSON.parse(i.metadata || '{}')
      })),
      tags,
      itemTags,
      timers,
      reminders,
      settings,
      counter_history: counterHistory
    };
    archive.append(JSON.stringify(fullBackup, null, 2), { name: 'free-form-backup.json' });

    // 2. Individual Markdown files organized by folder
    const usedFilenames = new Set<string>();
    for (const item of items) {
      const folder = notebookMap.get(item.notebook_id || 'uncategorized') || 'Uncategorized';
      const safeTitle = (item.title || 'Untitled').replace(/[/\\?%*:|"<>]/g, '-').trim();
      let itemFilename = `${folder}/${safeTitle}-${item.id}.md`;
      let counter = 1;
      while (usedFilenames.has(itemFilename)) {
        itemFilename = `${folder}/${safeTitle}-${item.id}-${counter++}.md`;
      }
      usedFilenames.add(itemFilename);

      let mdContent = '';
      if (item.type === 'note' || item.type === 'form_entry') {
        mdContent = item.content || `# ${item.title}`;
      } else if (item.type === 'counter') {
        const meta = JSON.parse(item.metadata || '{}');
        mdContent = `# ${item.title}\n\n**Current Count**: ${meta.count ?? 0} ${meta.unit ?? ''}\n\n${item.content || ''}`;
      } else if (item.type === 'bookmark') {
        const meta = JSON.parse(item.metadata || '{}');
        mdContent = `# ${item.title}\n\nLink: [${meta.url}](${meta.url})\n\n${meta.ogDescription || ''}\n\n${item.content || ''}`;
      } else if (item.type === 'poster') {
        const meta = JSON.parse(item.metadata || '{}');
        mdContent = `# ${item.title}\n\n${(meta.images || []).map((img: any) => `![${img.name}](${img.url})`).join('\n\n')}\n\n${item.content || ''}`;
      }

      archive.append(mdContent, { name: itemFilename });
    }

    // 3. User upload attachments
    if (fs.existsSync(UPLOADS_DIR)) {
      try {
        const uploadFiles = fs.readdirSync(UPLOADS_DIR);
        for (const file of uploadFiles) {
          const filePath = path.join(UPLOADS_DIR, file);
          if (fs.statSync(filePath).isFile()) {
            archive.file(filePath, { name: `uploads/${file}` });
          }
        }
      } catch {}
    }

    await archive.finalize();
  });

  // POST /api/export/batch - Export selected notes as a ZIP of Markdown files
  fastify.post('/api/export/batch', async (request, reply) => {
    const { ids } = (request.body as any) || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({ error: 'ids array is required' });
    }
    const userId = (request as any).user?.id;
    const placeholders = ids.map(() => '?').join(',');
    const sql = `
      SELECT i.*, n.name as notebook_name
      FROM items i
      LEFT JOIN notebooks n ON i.notebook_id = n.id
      WHERE i.id IN (${placeholders}) ${userId ? 'AND (i.user_id = ? OR i.user_id IS NULL)' : ''}
    `;
    const params = userId ? [...ids, userId] : [...ids];
    const items = db.prepare(sql).all(...params) as any[];

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `free-form-selected-notes-${dateStr}.zip`;

    reply.raw.setHeader('Content-Type', 'application/zip');
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(reply.raw);

    const usedFilenames = new Map<string, number>();

    for (const item of items) {
      const folderName = item.notebook_name ? item.notebook_name.replace(/[/\\?%*:|"<>]/g, '-').trim() : 'General';
      const cleanTitle = (item.title || 'Untitled').replace(/[/\\?%*:|"<>]/g, '-').trim();
      const fileKey = `${folderName}/${cleanTitle}`;
      const count = usedFilenames.get(fileKey) || 0;
      usedFilenames.set(fileKey, count + 1);
      const uniqueName = count > 0 ? `${cleanTitle} (${count}).md` : `${cleanTitle}.md`;

      const tags = db.prepare(`
        SELECT t.name FROM tags t
        JOIN item_tags it ON t.id = it.tag_id
        WHERE it.item_id = ?
      `).all(item.id) as any[];

      const tagNames = tags.map((t) => t.name);

      let frontmatter = '---\n';
      frontmatter += `title: "${(item.title || 'Untitled').replace(/"/g, '\\"')}"\n`;
      frontmatter += `type: ${item.type}\n`;
      if (item.priority) frontmatter += `priority: ${item.priority}\n`;
      if (tagNames.length > 0) frontmatter += `tags: [${tagNames.map((t) => `"${t}"`).join(', ')}]\n`;
      frontmatter += `created: ${item.created_at}\n`;
      frontmatter += `updated: ${item.updated_at}\n`;
      frontmatter += '---\n\n';

      const fileContent = frontmatter + (item.content || '');
      archive.append(fileContent, { name: `${folderName}/${uniqueName}` });
    }

    await archive.finalize();
  });

  // POST /api/import - Import backup (ZIP or JSON)
  fastify.post('/api/import', async (request, reply) => {
    let userId = (request as any).user?.id || null;
    if (userId) {
      const userRow = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
      if (!userRow) {
        userId = null;
      }
    }
    let backupData: any = null;

    if (typeof request.isMultipart === 'function' && request.isMultipart()) {
      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ error: 'No backup file provided' });
      }

      const buffer = await file.toBuffer();

      if (file.filename.endsWith('.json') || file.mimetype === 'application/json') {
        try {
          backupData = JSON.parse(buffer.toString('utf-8'));
        } catch (err: any) {
          return reply.code(400).send({ error: 'Invalid JSON file: ' + err.message });
        }
      } else {
        // Handle ZIP file (with resilient fallback to direct parsing if duplicate entries exist)
        try {
          backupData = extractBackupJsonFromZip(buffer);
        } catch (err: any) {
          return reply.code(400).send({ error: 'Failed to extract ZIP archive: ' + err.message });
        }

        // Restore uploads from ZIP archive
        try {
          if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
          }
          const zip = new AdmZip(buffer);
          const zipEntries = zip.getEntries();
          for (const entry of zipEntries) {
            if (entry.entryName.startsWith('uploads/') && !entry.isDirectory) {
              const fileName = path.basename(entry.entryName);
              if (fileName && !fileName.includes('..') && !fileName.includes('/') && !fileName.includes('\\')) {
                const destPath = path.join(UPLOADS_DIR, fileName);
                fs.writeFileSync(destPath, entry.getData());
              }
            }
          }
        } catch {}
      }
    } else if (request.body && typeof request.body === 'object') {
      backupData = request.body;
    } else {
      return reply.code(400).send({ error: 'No backup file or payload provided' });
    }

    if (!backupData || typeof backupData !== 'object') {
      return reply.code(400).send({ error: 'Unrecognized backup structure' });
    }

    const notebooks = Array.isArray(backupData.notebooks) ? backupData.notebooks : [];
    const templates = Array.isArray(backupData.templates) ? backupData.templates : [];
    const items = Array.isArray(backupData.items) ? backupData.items : [];
    const tags = Array.isArray(backupData.tags) ? backupData.tags : [];
    const itemTags = Array.isArray(backupData.itemTags) ? backupData.itemTags : [];
    const timers = Array.isArray(backupData.timers) ? backupData.timers : [];
    const reminders = Array.isArray(backupData.reminders) ? backupData.reminders : [];
    const settings = Array.isArray(backupData.settings) ? backupData.settings : [];
    const counterHistory = Array.isArray(backupData.counter_history)
      ? backupData.counter_history
      : (Array.isArray(backupData.counterHistory) ? backupData.counterHistory : []);

    const stats = {
      notebooks: 0,
      templates: 0,
      items: 0,
      tags: 0,
      timers: 0,
      reminders: 0,
      settings: 0,
      counter_history: 0
    };

    const knownNotebookIds = new Set<string>(notebooks.map((n: any) => n.id));
    const existingNotebookRows = db.prepare('SELECT id FROM notebooks').all() as any[];
    for (const r of existingNotebookRows) {
      knownNotebookIds.add(r.id);
    }

    const knownTemplateIds = new Set<string>(templates.map((t: any) => t.id));
    const existingTemplateRows = db.prepare('SELECT id FROM templates').all() as any[];
    for (const r of existingTemplateRows) {
      knownTemplateIds.add(r.id);
    }

    const importTx = db.transaction(() => {
      // 1. Notebooks
      const insertNb = db.prepare(`
        INSERT INTO notebooks (id, user_id, name, description, color, icon, parent_id, default_template_id, view_mode, sort_order, hide_from_all, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          color = excluded.color,
          icon = excluded.icon,
          parent_id = excluded.parent_id,
          default_template_id = excluded.default_template_id,
          view_mode = excluded.view_mode,
          sort_order = excluded.sort_order,
          hide_from_all = excluded.hide_from_all,
          user_id = COALESCE(excluded.user_id, notebooks.user_id),
          updated_at = excluded.updated_at
      `);

      for (const nb of notebooks) {
        if (!nb.id || !nb.name) continue;
        const parentId = (nb.parent_id && nb.parent_id !== nb.id && knownNotebookIds.has(nb.parent_id)) ? nb.parent_id : null;
        insertNb.run(
          nb.id,
          userId,
          nb.name,
          nb.description || '',
          nb.color || '#22c55e',
          nb.icon || 'folder',
          parentId,
          nb.default_template_id || null,
          nb.view_mode || 'grid',
          nb.sort_order || 0,
          nb.hide_from_all ? 1 : 0,
          nb.created_at || new Date().toISOString(),
          nb.updated_at || new Date().toISOString()
        );
        stats.notebooks++;
      }

      // 2. Templates
      const insertTpl = db.prepare(`
        INSERT INTO templates (id, user_id, name, description, icon, color, default_notebook_id, fields_schema, enable_processed_tracking, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          icon = excluded.icon,
          color = excluded.color,
          default_notebook_id = excluded.default_notebook_id,
          fields_schema = excluded.fields_schema,
          enable_processed_tracking = excluded.enable_processed_tracking,
          user_id = COALESCE(excluded.user_id, templates.user_id),
          updated_at = excluded.updated_at
      `);

      for (const tpl of templates) {
        if (!tpl.id || !tpl.name) continue;
        const defaultNbId = (tpl.default_notebook_id && knownNotebookIds.has(tpl.default_notebook_id)) ? tpl.default_notebook_id : null;
        const schema = typeof tpl.fields_schema === 'object' ? JSON.stringify(tpl.fields_schema) : (tpl.fields_schema || '[]');
        insertTpl.run(
          tpl.id,
          userId,
          tpl.name,
          tpl.description || '',
          tpl.icon || 'file-text',
          tpl.color || '#3b82f6',
          defaultNbId,
          schema,
          tpl.enable_processed_tracking !== undefined ? (tpl.enable_processed_tracking ? 1 : 0) : 1,
          tpl.created_at || new Date().toISOString(),
          tpl.updated_at || new Date().toISOString()
        );
        stats.templates++;
      }

      // 3. Tags
      const insertTag = db.prepare(`
        INSERT INTO tags (id, user_id, name, color)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          color = excluded.color,
          user_id = COALESCE(excluded.user_id, tags.user_id)
      `);

      for (const tag of tags) {
        if (!tag.name) continue;
        insertTag.run(
          tag.id || `tag-${Math.random().toString(36).slice(2)}`,
          userId,
          tag.name,
          tag.color || '#22c55e'
        );
        stats.tags++;
      }

      // 4. Items
      const insertItem = db.prepare(`
        INSERT INTO items (id, user_id, notebook_id, title, type, content, metadata, priority, is_favorite, is_pinned, is_archived, hide_from_all, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          notebook_id = excluded.notebook_id,
          title = excluded.title,
          type = excluded.type,
          content = excluded.content,
          metadata = excluded.metadata,
          priority = excluded.priority,
          is_favorite = excluded.is_favorite,
          is_pinned = excluded.is_pinned,
          is_archived = excluded.is_archived,
          hide_from_all = excluded.hide_from_all,
          user_id = COALESCE(excluded.user_id, items.user_id),
          updated_at = excluded.updated_at
      `);

      for (const item of items) {
        if (!item.id || !item.type) continue;
        const notebookId = (item.notebook_id && knownNotebookIds.has(item.notebook_id)) ? item.notebook_id : null;
        const metaStr = typeof item.metadata === 'object' ? JSON.stringify(item.metadata) : (item.metadata || '{}');
        insertItem.run(
          item.id,
          userId,
          notebookId,
          item.title || 'Untitled',
          item.type,
          item.content || '',
          metaStr,
          item.priority || '',
          item.is_favorite ? 1 : 0,
          item.is_pinned ? 1 : 0,
          item.is_archived ? 1 : 0,
          item.hide_from_all ? 1 : 0,
          item.created_at || new Date().toISOString(),
          item.updated_at || new Date().toISOString()
        );
        refreshItemLinks(item.id);
        stats.items++;
      }

      // 5. Item tags
      const insertItemTag = db.prepare(`
        INSERT OR IGNORE INTO item_tags (item_id, tag_id)
        VALUES (?, ?)
      `);
      for (const it of itemTags) {
        if (it.item_id && it.tag_id) {
          try {
            insertItemTag.run(it.item_id, it.tag_id);
          } catch {}
        }
      }

      // 6. Counter History
      const insertCounterHistory = db.prepare(`
        INSERT OR IGNORE INTO counter_history (id, item_id, delta, new_value, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const ch of counterHistory) {
        if (!ch.id || !ch.item_id) continue;
        insertCounterHistory.run(
          ch.id,
          ch.item_id,
          ch.delta ?? 0,
          ch.new_value ?? 0,
          ch.note || '',
          ch.created_at || new Date().toISOString()
        );
        stats.counter_history++;
      }

      // 7. Timers
      const insertTimer = db.prepare(`
        INSERT INTO timers (id, user_id, title, duration_seconds, remaining_seconds, status, target_end_time, started_at, paused_at, completed_at, notebook_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          duration_seconds = excluded.duration_seconds,
          remaining_seconds = excluded.remaining_seconds,
          status = excluded.status,
          target_end_time = excluded.target_end_time,
          started_at = excluded.started_at,
          paused_at = excluded.paused_at,
          completed_at = excluded.completed_at,
          notebook_id = excluded.notebook_id,
          user_id = COALESCE(excluded.user_id, timers.user_id),
          updated_at = excluded.updated_at
      `);
      for (const tm of timers) {
        if (!tm.id || !tm.title) continue;
        const notebookId = (tm.notebook_id && knownNotebookIds.has(tm.notebook_id)) ? tm.notebook_id : null;
        insertTimer.run(
          tm.id,
          userId,
          tm.title,
          tm.duration_seconds ?? 0,
          tm.remaining_seconds ?? 0,
          tm.status || 'idle',
          tm.target_end_time || null,
          tm.started_at || null,
          tm.paused_at || null,
          tm.completed_at || null,
          notebookId,
          tm.created_at || new Date().toISOString(),
          tm.updated_at || new Date().toISOString()
        );
        stats.timers++;
      }

      // 8. Reminders
      const insertReminder = db.prepare(`
        INSERT INTO reminders (id, user_id, title, notes, due_date, status, priority, notebook_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          notes = excluded.notes,
          due_date = excluded.due_date,
          status = excluded.status,
          priority = excluded.priority,
          notebook_id = excluded.notebook_id,
          user_id = COALESCE(excluded.user_id, reminders.user_id),
          updated_at = excluded.updated_at
      `);
      for (const rem of reminders) {
        if (!rem.id || !rem.title || !rem.due_date) continue;
        const notebookId = (rem.notebook_id && knownNotebookIds.has(rem.notebook_id)) ? rem.notebook_id : null;
        insertReminder.run(
          rem.id,
          userId,
          rem.title,
          rem.notes || '',
          rem.due_date,
          rem.status || 'pending',
          rem.priority || 'normal',
          notebookId,
          rem.created_at || new Date().toISOString(),
          rem.updated_at || new Date().toISOString()
        );
        stats.reminders++;
      }

      // 9. Settings
      const insertSetting = db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `);
      for (const set of settings) {
        if (!set.key || set.value === undefined) continue;
        const valStr = typeof set.value === 'object' ? JSON.stringify(set.value) : String(set.value);
        insertSetting.run(
          set.key,
          valStr,
          set.updated_at || new Date().toISOString()
        );
        stats.settings++;
      }
    });

    // Bulk restore execution with foreign key pragma safeguarding
    db.pragma('foreign_keys = OFF');
    try {
      importTx();
    } finally {
      db.pragma('foreign_keys = ON');
    }

    return {
      success: true,
      stats,
      imported_for_user: userId
    };
  });
}
