import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, 'freeform.db');
export const db = new Database(dbPath);

// Enable WAL mode and foreign keys for high performance and integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#22c55e',
      icon TEXT DEFAULT 'folder',
      parent_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
      default_template_id TEXT,
      view_mode TEXT DEFAULT 'grid',
      sort_order INTEGER DEFAULT 0,
      hide_from_all INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      icon TEXT DEFAULT 'file-text',
      color TEXT DEFAULT '#3b82f6',
      default_notebook_id TEXT,
      fields_schema TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT DEFAULT '',
      metadata TEXT DEFAULT '{}',
      is_favorite INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      hide_from_all INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS counter_history (
      id TEXT PRIMARY KEY,
      item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
      delta REAL NOT NULL,
      new_value REAL NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#6b7280'
    );

    CREATE TABLE IF NOT EXISTS item_tags (
      item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
      tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (item_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_items_notebook ON items(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
    CREATE INDEX IF NOT EXISTS idx_counter_history_item ON counter_history(item_id);
  `);

  // Safe schema migrations for existing SQLite databases
  try {
    db.exec('ALTER TABLE notebooks ADD COLUMN hide_from_all INTEGER DEFAULT 0;');
  } catch {}
  try {
    db.exec('ALTER TABLE items ADD COLUMN hide_from_all INTEGER DEFAULT 0;');
  } catch {}

  seedInitialData();
}

function seedInitialData() {
  const notebookCount = (db.prepare('SELECT COUNT(*) as count FROM notebooks').get() as { count: number }).count;
  if (notebookCount > 0) return;

  const now = new Date().toISOString();

  // 1. Create a Starter Notebook
  const starterNotebookId = 'nb-starter-01';
  db.prepare(`
    INSERT INTO notebooks (id, name, description, color, icon, view_mode, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    starterNotebookId,
    'Welcome & Examples',
    'Getting started with Free Form notes, counters, bookmarks, and form templates',
    '#22c55e',
    'sparkles',
    'grid',
    0,
    now,
    now
  );

  // 2. Create Starter Templates
  const templateLogId = 'tpl-daily-log';
  const templateLogSchema = JSON.stringify([
    { id: 'f_title', label: 'Session / Day Summary', type: 'text', required: true, placeholder: 'e.g. Sprint Kickoff' },
    { id: 'f_mood', label: 'Energy / Rating (1-5)', type: 'rating', min: 1, max: 5, defaultValue: 4 },
    { id: 'f_notes', label: 'Observations & Notes', type: 'textarea', placeholder: 'Key takeaways and reflections...' },
    {
      id: 'f_action_items',
      label: 'Action Items',
      type: 'table',
      columns: [
        { id: 'task', name: 'Task', type: 'text' },
        { id: 'owner', name: 'Owner', type: 'text' },
        { id: 'done', name: 'Completed', type: 'checkbox' }
      ]
    },
    { id: 'f_signature', label: 'Sign-off', type: 'signature' }
  ]);

  db.prepare(`
    INSERT INTO templates (id, name, description, icon, color, fields_schema, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    templateLogId,
    'Daily Log & Sign-Off',
    'Quick review template with rating, dynamic task table, and signature block',
    'clipboard-check',
    '#3b82f6',
    templateLogSchema,
    now,
    now
  );

  const templateMaintenanceId = 'tpl-maintenance';
  const templateMaintenanceSchema = JSON.stringify([
    { id: 'f_equipment', label: 'Equipment / Asset Name', type: 'text', required: true, placeholder: 'e.g. 2018 Honda Civic or 3D Printer' },
    { id: 'f_odometer', label: 'Mileage / Hours', type: 'number', unit: 'mi', min: 0 },
    { id: 'f_cost', label: 'Cost', type: 'number', unit: '$', min: 0, step: 0.01 },
    { id: 'f_service_type', label: 'Service Category', type: 'select', options: ['Oil Change', 'Tire Rotation', 'Brake Service', 'Inspection', 'Custom Repair'] },
    { id: 'f_description', label: 'Service Description & Notes', type: 'textarea' },
    { id: 'f_verified', label: 'Passed Inspection', type: 'checkbox', defaultValue: true }
  ]);

  db.prepare(`
    INSERT INTO templates (id, name, description, icon, color, fields_schema, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    templateMaintenanceId,
    'Maintenance & Service Log',
    'Structured log for vehicle, equipment, or home maintenance tracking',
    'wrench',
    '#f59e0b',
    templateMaintenanceSchema,
    now,
    now
  );

  // 3. Create Sample Welcome Markdown Note
  const welcomeContent = `# Welcome to Free Form! 🚀

Free Form is your self-hostable workspace that blends **Markdown notes**, **interactive cards**, and **reusable form templates**.

### What makes Free Form special?
- **Markdown Native**: Write freely with rich WYSIWYG formatting or toggle to raw Markdown source code anytime.
- **Counters**: Tap to increment tallies (habits, inventory, sets, cups of coffee).
- **Webpage Bookmarks**: Paste any link and Free Form fetches rich titles, descriptions, and preview thumbnails automatically.
- **Image Posters / Scrapbooks**: Collect photo galleries and visual scrapbooks with captions.
- **The "Free Form" Template Engine**: Build custom structured forms (ratings, text, numbers, dynamic tables, and signature boxes) and fill them out repeatedly into any notebook.

Everything is stored locally in your single SQLite database with zero cloud telemetry. Enjoy taking notes!`;

  db.prepare(`
    INSERT INTO items (id, notebook_id, title, type, content, metadata, is_favorite, is_pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'item-welcome-note',
    starterNotebookId,
    'Welcome to Free Form',
    'note',
    welcomeContent,
    JSON.stringify({}),
    1,
    1,
    now,
    now
  );

  // 4. Create Sample Counter
  db.prepare(`
    INSERT INTO items (id, notebook_id, title, type, content, metadata, is_favorite, is_pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'item-coffee-counter',
    starterNotebookId,
    'Coffee Cups Today',
    'counter',
    'Keep track of daily caffeine intake',
    JSON.stringify({ count: 2, step: 1, min: 0, max: 10, unit: 'cups', resetValue: 0 }),
    1,
    0,
    now,
    now
  );

  // 5. Create Sample Bookmark
  db.prepare(`
    INSERT INTO items (id, notebook_id, title, type, content, metadata, is_favorite, is_pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'item-sample-bookmark',
    starterNotebookId,
    'Markdown Guide & Syntax',
    'bookmark',
    'Reference guide for markdown cheat sheet',
    JSON.stringify({
      url: 'https://www.markdownguide.org',
      ogTitle: 'Markdown Guide',
      ogDescription: 'A free and open-source reference guide that explains how to use Markdown.',
      ogImage: 'https://www.markdownguide.org/assets/images/markdown-mark-white.svg',
      siteName: 'markdownguide.org'
    }),
    0,
    0,
    now,
    now
  );
}

export { DATA_DIR, UPLOADS_DIR };
