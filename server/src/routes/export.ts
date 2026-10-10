import { FastifyInstance } from 'fastify';
import archiver from 'archiver';
import { db } from '../db/index.js';

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
      itemTags
    };
    archive.append(JSON.stringify(fullBackup, null, 2), { name: 'free-form-backup.json' });

    // 2. Individual Markdown files organized by folder
    for (const item of items) {
      const folder = notebookMap.get(item.notebook_id || 'uncategorized') || 'Uncategorized';
      const safeTitle = (item.title || 'Untitled').replace(/[/\\?%*:|"<>]/g, '-').trim();
      const itemFilename = `${folder}/${safeTitle}-${item.id.slice(0, 6)}.md`;

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
        // Handle ZIP file
        try {
          const AdmZip = (await import('adm-zip')).default;
          const zip = new AdmZip(buffer);
          const jsonEntry = zip.getEntry('free-form-backup.json');
          if (!jsonEntry) {
            return reply.code(400).send({ error: 'ZIP does not contain free-form-backup.json' });
          }
          const jsonText = zip.readAsText(jsonEntry);
          backupData = JSON.parse(jsonText);
        } catch (err: any) {
          return reply.code(400).send({ error: 'Failed to extract ZIP archive: ' + err.message });
        }
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

    const stats = {
      notebooks: 0,
      templates: 0,
      items: 0,
      tags: 0
    };

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
        insertNb.run(
          nb.id,
          userId,
          nb.name,
          nb.description || '',
          nb.color || '#22c55e',
          nb.icon || 'folder',
          nb.parent_id || null,
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
        const schema = typeof tpl.fields_schema === 'object' ? JSON.stringify(tpl.fields_schema) : (tpl.fields_schema || '[]');
        insertTpl.run(
          tpl.id,
          userId,
          tpl.name,
          tpl.description || '',
          tpl.icon || 'file-text',
          tpl.color || '#3b82f6',
          tpl.default_notebook_id || null,
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
        const metaStr = typeof item.metadata === 'object' ? JSON.stringify(item.metadata) : (item.metadata || '{}');
        insertItem.run(
          item.id,
          userId,
          item.notebook_id || null,
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
    });

    importTx();

    return {
      success: true,
      stats,
      imported_for_user: userId
    };
  });
}
