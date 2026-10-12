import { db } from '../db/index.js';
import { normalizeLinkTitle, extractWikilinks } from './wikilinks.js';

/**
 * Wikilink support: `[[Note Title]]`, `[[Note Title|alias]]`, `[[Note Title#heading]]`.
 * Links are stored by (lowercased) target title so they keep resolving when the
 * target note is created later or renamed back, and need no stale target IDs.
 */

export { normalizeLinkTitle, extractWikilinks };

/** Replace the outgoing links of an item with those parsed from its content. */
export function syncItemLinks(itemId: string, content: string | null | undefined): void {
  const targets = extractWikilinks(content);
  const run = db.transaction(() => {
    db.prepare('DELETE FROM item_links WHERE source_id = ?').run(itemId);
    const insert = db.prepare('INSERT OR IGNORE INTO item_links (source_id, target_title) VALUES (?, ?)');
    for (const t of targets) insert.run(itemId, t);
  });
  run();
}

/** Re-parse links for an item from its stored content, or all items if omitted. */
export function refreshItemLinks(itemId?: string): void {
  if (itemId) {
    const row = db.prepare('SELECT content FROM items WHERE id = ?').get(itemId) as { content: string } | undefined;
    if (!row) return;
    syncItemLinks(itemId, row.content);
  } else {
    const rows = db.prepare("SELECT id, content FROM items WHERE content LIKE '%[[%'").all() as { id: string; content: string }[];
    for (const r of rows) {
      syncItemLinks(r.id, r.content);
    }
  }
}

interface LinkedItemRow {
  id: string;
  title: string;
  type: string;
  notebook_id: string | null;
  notebook_name: string | null;
  updated_at: string;
}

function scope(userId?: string) {
  return userId
    ? {
        sql: ' AND (i.user_id = ? OR i.user_id IS NULL OR i.id IN (SELECT item_id FROM item_shares WHERE shared_with_user_id = ?))',
        params: [userId, userId]
      }
    : { sql: '', params: [] as string[] };
}

/** Items (non-archived) whose content links to the given item's title. */
export function getBacklinks(itemId: string, userId?: string): LinkedItemRow[] {
  const target = db.prepare('SELECT title FROM items WHERE id = ?').get(itemId) as { title: string } | undefined;
  if (!target) return [];
  const s = scope(userId);
  return db
    .prepare(
      `SELECT i.id, i.title, i.type, i.notebook_id, n.name AS notebook_name, i.updated_at
       FROM item_links l
       JOIN items i ON i.id = l.source_id
       LEFT JOIN notebooks n ON n.id = i.notebook_id
       WHERE l.target_title = ? AND i.id != ? AND i.is_archived = 0${s.sql}
       ORDER BY i.updated_at DESC`
    )
    .all(normalizeLinkTitle(target.title), itemId, ...s.params) as LinkedItemRow[];
}

/** Outgoing links of an item, with the resolved target (if any) for each title. */
export function getOutgoingLinks(
  itemId: string,
  userId?: string
): { target_title: string; target: LinkedItemRow | null }[] {
  const rows = db.prepare('SELECT target_title FROM item_links WHERE source_id = ?').all(itemId) as {
    target_title: string;
  }[];
  const s = scope(userId);
  const resolve = db.prepare(
    `SELECT i.id, i.title, i.type, i.notebook_id, n.name AS notebook_name, i.updated_at
     FROM items i LEFT JOIN notebooks n ON n.id = i.notebook_id
     WHERE lower(trim(i.title)) = ? AND i.is_archived = 0 AND i.id != ?${s.sql}
     ORDER BY i.updated_at DESC LIMIT 1`
  );
  return rows.map((r) => ({
    target_title: r.target_title,
    target: (resolve.get(r.target_title, itemId, ...s.params) as LinkedItemRow | undefined) ?? null
  }));
}
