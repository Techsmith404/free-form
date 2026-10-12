import { describe, it, expect, beforeAll } from 'vitest';
import { db, initDatabase } from './db/index.js';
import {
  extractWikilinks,
  syncItemLinks,
  getBacklinks,
  getOutgoingLinks
} from './services/links.js';

function insertItem(id: string, title: string, content: string, archived = 0) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO items (id, title, type, content, metadata, is_archived, created_at, updated_at)
     VALUES (?, ?, 'note', ?, '{}', ?, ?, ?)`
  ).run(id, title, content, archived, now, now);
  syncItemLinks(id, content);
}

describe('Wikilinks', () => {
  beforeAll(() => {
    initDatabase();
  });

  it('extracts normalized, de-duplicated targets with alias/heading support', () => {
    const md = 'See [[Project Alpha]], [[project   alpha|the plan]], [[Ideas#Q3]] and [[ ]].';
    expect(extractWikilinks(md)).toEqual(['project alpha', 'ideas']);
  });

  it('ignores wikilinks inside code', () => {
    const md = 'Real [[Keep]]\n```\n[[Fenced]]\n```\nand `[[Inline]]`';
    expect(extractWikilinks(md)).toEqual(['keep']);
  });

  it('computes backlinks, excludes archived sources and self links', () => {
    insertItem('wl-target', 'Link Target', 'Self ref [[Link Target]]');
    insertItem('wl-a', 'Source A', 'points to [[link target]]');
    insertItem('wl-b', 'Source B', 'also [[Link Target|alias]]');
    insertItem('wl-trash', 'Trashed', '[[Link Target]]', 1);
    insertItem('wl-other', 'Unrelated', '[[Something Else]]');

    const ids = getBacklinks('wl-target').map((r) => r.id).sort();
    expect(ids).toEqual(['wl-a', 'wl-b']);
  });

  it('resyncs links when content changes and cascades on delete', () => {
    syncItemLinks('wl-a', 'now points to [[Something Else]]');
    expect(getBacklinks('wl-target').map((r) => r.id)).toEqual(['wl-b']);

    db.prepare('DELETE FROM items WHERE id = ?').run('wl-b');
    expect(getBacklinks('wl-target')).toEqual([]);
    const orphan = db.prepare("SELECT COUNT(*) c FROM item_links WHERE source_id = 'wl-b'").get() as any;
    expect(orphan.c).toBe(0);
  });

  it('resolves outgoing links to existing items and null for dangling ones', () => {
    insertItem('wl-out', 'Outgoing', '[[Link Target]] and [[Does Not Exist]]');
    const links = getOutgoingLinks('wl-out');
    const byTitle = Object.fromEntries(links.map((l) => [l.target_title, l.target?.id ?? null]));
    expect(byTitle['link target']).toBe('wl-target');
    expect(byTitle['does not exist']).toBeNull();
  });
});
