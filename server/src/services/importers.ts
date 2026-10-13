/**
 * Pure parsing helpers for the Obsidian / Google Keep importers.
 * Kept free of DB access so they are trivially unit-testable.
 */

export type FrontmatterValue = string | string[];
export type Frontmatter = Record<string, FrontmatterValue>;

function stripQuotes(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

/**
 * Parse a note's leading YAML frontmatter block. Supports the subset Obsidian emits:
 * scalars, inline lists (`tags: [a, b]`) and block lists (`tags:\n  - a\n  - b`).
 * Tolerates a UTF-8 BOM, CRLF line endings and an empty block. Never throws.
 */
export function parseFrontmatter(raw: string): { frontmatter: Frontmatter; content: string } {
  const text = raw.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  if (lines.length < 2 || lines[0].trim() !== '---') {
    return { frontmatter: {}, content: text };
  }

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '---' || t === '...') {
      end = i;
      break;
    }
  }
  if (end === -1) return { frontmatter: {}, content: text };

  const fm: Frontmatter = {};
  const block = lines.slice(1, end);
  for (let i = 0; i < block.length; i++) {
    const line = block[i];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;

    const key = m[1].toLowerCase();
    const value = m[2].trim();

    if (value === '') {
      const items: string[] = [];
      while (i + 1 < block.length && /^\s*-\s+/.test(block[i + 1])) {
        i++;
        items.push(stripQuotes(block[i].replace(/^\s*-\s+/, '')));
      }
      fm[key] = items;
    } else if (value.startsWith('[') && value.endsWith(']')) {
      fm[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => stripQuotes(s))
        .filter(Boolean);
    } else {
      fm[key] = stripQuotes(value);
    }
  }

  return { frontmatter: fm, content: lines.slice(end + 1).join('\n') };
}

/** Normalise a frontmatter `tags`/`tag`/`aliases` value into a clean, de-duplicated list. */
export function normalizeList(value: FrontmatterValue | undefined, { stripHash = false } = {}): string[] {
  if (value === undefined) return [];
  const parts = Array.isArray(value) ? value : value.split(stripHash ? /[,\s]+/ : /,/);
  const out = new Set<string>();
  for (const p of parts) {
    let t = String(p).trim();
    if (stripHash) t = t.replace(/^#+/, '');
    if (t) out.add(t.slice(0, 100));
  }
  return Array.from(out).slice(0, 50);
}

/** Parse a user-supplied date; returns an ISO string or null when invalid. */
export function parseIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  // Reject nonsense years (e.g. 0001 / 9999 parse artefacts)
  const year = d.getUTCFullYear();
  if (year < 1990 || year > 2100) return null;
  return d.toISOString();
}

/** Is any path segment hidden / tool metadata (.obsidian, .trash, .git, __MACOSX ...)? */
export function isIgnoredVaultPath(entryPath: string): boolean {
  return entryPath
    .replace(/\\/g, '/')
    .split('/')
    .some((seg) => seg.startsWith('.') || seg === '__MACOSX');
}

/** Google Keep timestamps are microseconds since epoch. */
export function keepUsecToIso(usec: unknown): string | null {
  const n = Number(usec);
  if (!Number.isFinite(n) || n <= 0) return null;
  return parseIsoDate(Math.floor(n / 1000));
}

export interface KeepNoteInput {
  title?: unknown;
  textContent?: unknown;
  text?: unknown;
  listContent?: unknown;
  labels?: unknown;
  isTrashed?: unknown;
  isArchived?: unknown;
  isPinned?: unknown;
  createdTimestampUsec?: unknown;
  userEditedTimestampUsec?: unknown;
}

export interface ConvertedKeepNote {
  title: string;
  content: string;
  labels: string[];
  isPinned: boolean;
  isTrashed: boolean;
  isArchived: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Convert one Google Takeout Keep note into Free Form fields. Returns null for empty notes. */
export function convertKeepNote(note: KeepNoteInput): ConvertedKeepNote | null {
  if (!note || typeof note !== 'object') return null;

  let content = '';
  if (Array.isArray(note.listContent)) {
    content = note.listContent
      .map((li: any) => `- [${li?.isChecked ? 'x' : ' '}] ${String(li?.text ?? '').trim()}`)
      .join('\n');
  } else if (typeof note.textContent === 'string') {
    content = note.textContent;
  } else if (typeof note.text === 'string') {
    content = note.text;
  }

  let title = typeof note.title === 'string' ? note.title.trim() : '';
  if (!title) {
    const firstLine = content
      .split('\n')
      .map((l) => l.replace(/^- \[[ x]\]\s*/, '').trim())
      .find(Boolean);
    title = firstLine ? firstLine.slice(0, 60) : '';
  }
  if (!title && !content.trim()) return null;

  const labels = Array.isArray(note.labels)
    ? Array.from(
        new Set(
          note.labels
            .map((l: any) => (typeof l === 'string' ? l : String(l?.name ?? '')).trim())
            .filter(Boolean)
            .map((l: string) => l.slice(0, 100))
        )
      )
    : [];

  return {
    title: title || 'Untitled Note',
    content,
    labels,
    isPinned: Boolean(note.isPinned),
    isTrashed: Boolean(note.isTrashed),
    isArchived: Boolean(note.isArchived),
    createdAt: keepUsecToIso(note.createdTimestampUsec),
    updatedAt: keepUsecToIso(note.userEditedTimestampUsec)
  };
}
