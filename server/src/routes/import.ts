import { FastifyInstance } from 'fastify';
import AdmZip from 'adm-zip';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { ownerIdOf } from '../services/owner.js';
import { syncItemLinks } from '../services/links.js';
import {
  parseFrontmatter,
  normalizeList,
  parseIsoDate,
  isIgnoredVaultPath,
  convertKeepNote
} from '../services/importers.js';

const MAX_VAULT_ENTRIES = 20000;
const MAX_NOTE_BYTES = 5 * 1024 * 1024; // 5 MB per markdown file
const MAX_VAULT_BYTES = 200 * 1024 * 1024; // 200 MB uncompressed total
const MAX_KEEP_NOTES = 20000;

/** Find-or-create a tag by name and link it to an item. Returns true when a new tag was created. */
function attachTag(itemId: string, tagName: string, color: string, ownerId: string | null): boolean {
  let created = false;
  let tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName) as { id: string } | undefined;
  if (!tag) {
    const id = `tag-${crypto.randomUUID()}`;
    db.prepare('INSERT INTO tags (id, user_id, name, color) VALUES (?, ?, ?, ?)').run(id, ownerId, tagName, color);
    tag = { id };
    created = true;
  }
  db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)').run(itemId, tag.id);
  return created;
}

export async function importRoutes(fastify: FastifyInstance) {
  // ==========================================
  // OBSIDIAN VAULT IMPORTER (ZIP of a vault folder)
  // ==========================================
  fastify.post('/api/import/obsidian', async (request, reply) => {
    const ownerId = ownerIdOf(request);

    if (typeof request.isMultipart !== 'function' || !request.isMultipart()) {
      return reply.code(400).send({ error: 'Expected a multipart/form-data upload with a vault .zip file' });
    }
    const upload = await request.file();
    if (!upload) {
      return reply.code(400).send({ error: 'No vault archive file uploaded' });
    }
    const buf = await upload.toBuffer();
    if (upload.file.truncated) {
      return reply.code(413).send({ error: 'Vault archive is too large (50 MB upload limit)' });
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(buf);
    } catch (e: any) {
      return reply.code(400).send({ error: `Invalid ZIP archive: ${e.message}` });
    }

    const entries = zip.getEntries();
    if (entries.length > MAX_VAULT_ENTRIES) {
      return reply.code(413).send({ error: `Vault has too many files (limit ${MAX_VAULT_ENTRIES})` });
    }
    const totalBytes = entries.reduce((sum, e) => sum + (e.header?.size || 0), 0);
    if (totalBytes > MAX_VAULT_BYTES) {
      return reply.code(413).send({ error: 'Vault is too large when extracted (limit 200 MB)' });
    }

    const now = new Date().toISOString();
    const stats = { notebooks: 0, notes: 0, tags: 0, skipped: 0 };

    // folder path -> notebook id (creating nested notebooks as needed)
    const folderToNotebookId = new Map<string, string>();
    const getOrCreateNotebook = (folderPath: string): string | null => {
      const segments = folderPath.split('/').filter(Boolean);
      let parentId: string | null = null;
      let cumulative = '';

      for (const seg of segments) {
        cumulative = cumulative ? `${cumulative}/${seg}` : seg;
        const cached = folderToNotebookId.get(cumulative);
        if (cached) {
          parentId = cached;
          continue;
        }

        const existing = db
          .prepare('SELECT id FROM notebooks WHERE name = ? AND parent_id IS ? AND (user_id IS ? OR user_id IS NULL)')
          .get(seg, parentId, ownerId) as { id: string } | undefined;

        let id: string;
        if (existing) {
          id = existing.id;
        } else {
          id = `nb-${crypto.randomUUID()}`;
          db.prepare(`
            INSERT INTO notebooks (id, user_id, name, description, parent_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(id, ownerId, seg.slice(0, 120), `Imported from Obsidian: /${cumulative}`, parentId, now, now);
          stats.notebooks++;
        }
        folderToNotebookId.set(cumulative, id);
        parentId = id;
      }
      return parentId;
    };

    const insertItem = db.prepare(`
      INSERT INTO items (id, user_id, notebook_id, title, type, content, metadata, priority, is_favorite, is_pinned, is_archived, hide_from_all, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'note', ?, '{}', '', 0, 0, 0, 0, ?, ?)
    `);

    db.transaction(() => {
      for (const entry of entries) {
        const entryName = entry.entryName.replace(/\\/g, '/');
        if (entry.isDirectory || !entryName.toLowerCase().endsWith('.md')) continue;
        if (isIgnoredVaultPath(entryName)) continue;
        if ((entry.header?.size || 0) > MAX_NOTE_BYTES) {
          stats.skipped++;
          continue;
        }

        try {
          const parts = entryName.split('/');
          const fileName = parts.pop() as string;
          const title = fileName.replace(/\.md$/i, '').trim() || 'Untitled';
          const notebookId = parts.length ? getOrCreateNotebook(parts.join('/')) : null;

          const { frontmatter, content } = parseFrontmatter(entry.getData().toString('utf8'));
          const createdAt = parseIsoDate(frontmatter.created ?? frontmatter.date) || now;
          const updatedAt = parseIsoDate(frontmatter.updated ?? frontmatter.modified) || createdAt;

          const itemId = `item-${crypto.randomUUID()}`;
          insertItem.run(itemId, ownerId, notebookId, title.slice(0, 300), content, createdAt, updatedAt);
          syncItemLinks(itemId, content);
          stats.notes++;

          const tags = normalizeList(frontmatter.tags ?? frontmatter.tag, { stripHash: true });
          for (const t of tags) {
            if (attachTag(itemId, t, '#22c55e', ownerId)) stats.tags++;
          }
        } catch {
          stats.skipped++;
        }
      }
    })();

    return {
      success: true,
      stats,
      message: `Imported ${stats.notes} notes into ${stats.notebooks} new notebooks from your Obsidian vault${
        stats.skipped ? ` (${stats.skipped} skipped)` : ''
      }.`
    };
  });

  // ==========================================
  // GOOGLE KEEP IMPORTER (Takeout JSON: one note, an array, or { notes: [...] })
  // ==========================================
  fastify.post('/api/import/keep', async (request, reply) => {
    const ownerId = ownerIdOf(request);
    const body = request.body as any;

    let notes: unknown[];
    if (Array.isArray(body)) notes = body;
    else if (body && Array.isArray(body.notes)) notes = body.notes;
    else if (body && typeof body === 'object' && ('title' in body || 'textContent' in body || 'listContent' in body)) notes = [body];
    else return reply.code(400).send({ error: 'Expected a Google Keep JSON note, an array of notes, or { "notes": [...] }' });

    if (notes.length > MAX_KEEP_NOTES) {
      return reply.code(413).send({ error: `Too many notes in one import (limit ${MAX_KEEP_NOTES})` });
    }

    const now = new Date().toISOString();
    const stats = { notes: 0, tags: 0, skipped: 0 };

    const insertItem = db.prepare(`
      INSERT INTO items (id, user_id, notebook_id, title, type, content, metadata, priority, is_favorite, is_pinned, is_archived, hide_from_all, created_at, updated_at)
      VALUES (?, ?, NULL, ?, 'note', ?, '{}', '', 0, ?, ?, 0, ?, ?)
    `);

    db.transaction(() => {
      for (const raw of notes) {
        const note = convertKeepNote(raw as any);
        if (!note) {
          stats.skipped++;
          continue;
        }
        try {
          const itemId = `item-${crypto.randomUUID()}`;
          const createdAt = note.createdAt || note.updatedAt || now;
          const updatedAt = note.updatedAt || createdAt;
          // Trashed Keep notes land in Free Form's trash (is_archived = 1) so they stay recoverable.
          const archived = note.isTrashed || note.isArchived ? 1 : 0;

          insertItem.run(itemId, ownerId, note.title.slice(0, 300), note.content, note.isPinned ? 1 : 0, archived, createdAt, updatedAt);
          syncItemLinks(itemId, note.content);
          stats.notes++;

          for (const label of note.labels) {
            if (attachTag(itemId, label, '#eab308', ownerId)) stats.tags++;
          }
        } catch {
          stats.skipped++;
        }
      }
    })();

    return {
      success: true,
      stats,
      message: `Imported ${stats.notes} Google Keep notes with ${stats.tags} new tags${
        stats.skipped ? ` (${stats.skipped} skipped)` : ''
      }.`
    };
  });
}
