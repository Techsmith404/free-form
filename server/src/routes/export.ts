import { FastifyInstance } from 'fastify';
import archiver from 'archiver';
import { db } from '../db/index.js';

export async function exportRoutes(fastify: FastifyInstance) {
  fastify.get('/api/export', async (request, reply) => {
    const notebooks = db.prepare('SELECT * FROM notebooks').all() as any[];
    const items = db.prepare('SELECT * FROM items WHERE is_archived = 0').all() as any[];
    const templates = db.prepare('SELECT * FROM templates').all() as any[];
    const tags = db.prepare('SELECT * FROM tags').all() as any[];
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
}
