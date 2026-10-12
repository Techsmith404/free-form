import Database from 'better-sqlite3';
import { extractWikilinks } from '../services/wikilinks.js';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

export function tableExists(db: Database.Database, tableName: string): boolean {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName)
  );
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: '001_initial_schema',
    up: (db) => {
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
          enable_processed_tracking INTEGER DEFAULT 1,
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
          priority TEXT DEFAULT '',
          is_pinned INTEGER DEFAULT 0,
          is_favorite INTEGER DEFAULT 0,
          is_archived INTEGER DEFAULT 0,
          hide_from_all INTEGER DEFAULT 0,
          sort_order INTEGER DEFAULT 0,
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

        CREATE INDEX IF NOT EXISTS idx_counter_history_item ON counter_history(item_id);

        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          color TEXT DEFAULT '#3b82f6'
        );

        CREATE TABLE IF NOT EXISTS item_tags (
          item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
          tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (item_id, tag_id)
        );

        CREATE INDEX IF NOT EXISTS idx_items_notebook ON items(notebook_id);
        CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
        CREATE INDEX IF NOT EXISTS idx_items_archived ON items(is_archived);
        CREATE INDEX IF NOT EXISTS idx_items_pinned ON items(is_pinned);
        CREATE INDEX IF NOT EXISTS idx_items_favorite ON items(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_items_updated ON items(updated_at);
        CREATE INDEX IF NOT EXISTS idx_items_hide_all ON items(hide_from_all);
        CREATE INDEX IF NOT EXISTS idx_notebooks_hide_all ON notebooks(hide_from_all);
      `);
    }
  },
  {
    version: 2,
    name: '002_add_hide_from_all',
    up: (db) => {
      if (tableExists(db, 'items')) {
        const itemCols = db.prepare("PRAGMA table_info(items)").all() as any[];
        if (!itemCols.some((c) => c.name === 'hide_from_all')) {
          db.exec('ALTER TABLE items ADD COLUMN hide_from_all INTEGER DEFAULT 0;');
        }
      }
      if (tableExists(db, 'notebooks')) {
        const nbCols = db.prepare("PRAGMA table_info(notebooks)").all() as any[];
        if (!nbCols.some((c) => c.name === 'hide_from_all')) {
          db.exec('ALTER TABLE notebooks ADD COLUMN hide_from_all INTEGER DEFAULT 0;');
        }
      }
    }
  },
  {
    version: 3,
    name: '003_add_timers_and_reminders',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS timers (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL,
          remaining_seconds INTEGER NOT NULL,
          status TEXT NOT NULL,
          target_end_time TEXT,
          started_at TEXT,
          paused_at TEXT,
          completed_at TEXT,
          notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          notes TEXT DEFAULT '',
          due_date TEXT NOT NULL,
          status TEXT NOT NULL,
          priority TEXT DEFAULT 'normal',
          notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_timers_status ON timers(status);
        CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
        CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_date);
      `);
    }
  },
  {
    version: 4,
    name: '004_add_item_priority',
    up: (db) => {
      if (tableExists(db, 'items')) {
        const itemCols = db.prepare("PRAGMA table_info(items)").all() as any[];
        if (!itemCols.some((c) => c.name === 'priority')) {
          db.exec("ALTER TABLE items ADD COLUMN priority TEXT DEFAULT '';");
        }
      }
    }
  },
  {
    version: 5,
    name: '005_add_template_tracking',
    up: (db) => {
      if (tableExists(db, 'templates')) {
        const tplCols = db.prepare("PRAGMA table_info(templates)").all() as any[];
        if (!tplCols.some((c) => c.name === 'enable_processed_tracking')) {
          db.exec('ALTER TABLE templates ADD COLUMN enable_processed_tracking INTEGER DEFAULT 1;');
        }
      }
    }
  },
  {
    version: 6,
    name: '006_add_conflicts_and_settings',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS conflicts (
          id TEXT PRIMARY KEY,
          item_id TEXT NOT NULL,
          active_title TEXT NOT NULL,
          active_content TEXT NOT NULL,
          active_metadata TEXT DEFAULT '{}',
          active_updated_at TEXT NOT NULL,
          conflict_title TEXT NOT NULL,
          conflict_content TEXT NOT NULL,
          conflict_metadata TEXT DEFAULT '{}',
          conflict_updated_at TEXT NOT NULL,
          device_name TEXT DEFAULT '',
          status TEXT DEFAULT 'unresolved',
          resolution TEXT DEFAULT '',
          created_at TEXT NOT NULL,
          resolved_at TEXT,
          FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);
        CREATE INDEX IF NOT EXISTS idx_conflicts_item ON conflicts(item_id);

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
    }
  },
  {
    version: 7,
    name: '007_add_auth_and_user_scoping',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'member',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS invites (
          code TEXT PRIMARY KEY,
          created_by TEXT REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL DEFAULT 'member',
          max_uses INTEGER DEFAULT 1,
          uses_count INTEGER DEFAULT 0,
          expires_at TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT UNIQUE NOT NULL,
          user_agent TEXT,
          ip_address TEXT,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS item_shares (
          id TEXT PRIMARY KEY,
          item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
          shared_with_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          permission TEXT DEFAULT 'view',
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
        CREATE INDEX IF NOT EXISTS idx_item_shares_item ON item_shares(item_id);
        CREATE INDEX IF NOT EXISTS idx_item_shares_user ON item_shares(shared_with_user_id);
      `);

      const userScopedTables = ['notebooks', 'items', 'templates', 'timers', 'reminders', 'tags'];
      for (const table of userScopedTables) {
        if (tableExists(db, table)) {
          const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
          if (!cols.some((c) => c.name === 'user_id')) {
            db.exec(`ALTER TABLE ${table} ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;`);
            db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_user ON ${table}(user_id);`);
          }
        }
      }
    }
  },
  {
    version: 8,
    name: '008_add_fts5_fulltext_search',
    up: (db) => {
      if (!tableExists(db, 'items')) return;

      const tableInfo = db.prepare("PRAGMA table_info(items_fts)").all() as any[];
      const hasItemId = tableInfo.some((col: any) => col.name === 'item_id');
      if (tableInfo.length > 0 && !hasItemId) {
        db.exec(`
          DROP TRIGGER IF EXISTS items_ai;
          DROP TRIGGER IF EXISTS items_ad;
          DROP TRIGGER IF EXISTS items_au;
          DROP TABLE IF EXISTS items_fts;
        `);
      }

      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
          item_id UNINDEXED,
          title,
          content,
          tokenize='porter unicode61 remove_diacritics 2'
        );

        CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
          INSERT INTO items_fts(item_id, title, content) VALUES (new.id, new.title, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
          DELETE FROM items_fts WHERE item_id = old.id;
        END;

        CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
          DELETE FROM items_fts WHERE item_id = old.id;
          INSERT INTO items_fts(item_id, title, content) VALUES (new.id, new.title, new.content);
        END;
      `);

      const itemCols = db.prepare("PRAGMA table_info(items)").all() as any[];
      if (itemCols.some((c) => c.name === 'content')) {
        db.exec(`
          INSERT INTO items_fts(item_id, title, content)
          SELECT id, title, content FROM items
          WHERE id NOT IN (SELECT item_id FROM items_fts);
        `);
      }
    }
  },
  {
    version: 9,
    name: '009_add_item_links',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS item_links (
          source_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
          target_title TEXT NOT NULL,
          PRIMARY KEY (source_id, target_title)
        );
        CREATE INDEX IF NOT EXISTS idx_item_links_target ON item_links(target_title);
      `);

      // Backfill from existing note content
      const cols = db.prepare('PRAGMA table_info(items)').all() as any[];
      if (cols.some((c) => c.name === 'content')) {
        const insert = db.prepare('INSERT OR IGNORE INTO item_links (source_id, target_title) VALUES (?, ?)');
        const rows = db.prepare("SELECT id, content FROM items WHERE content LIKE '%[[%'").all() as any[];
        for (const row of rows) {
          for (const t of extractWikilinks(row.content)) insert.run(row.id, t);
        }
      }
    }
  }
];

function baselineLegacyDatabase(db: Database.Database): void {
  const insertBaseline = db.prepare(
    'INSERT OR IGNORE INTO _schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
  );
  const now = new Date().toISOString();

  // Check 1: Initial schema
  const hasItems = tableExists(db, 'items');
  if (hasItems) {
    insertBaseline.run(1, '001_initial_schema', now);
  }

  // Check 2: hide_from_all
  if (hasItems) {
    const itemCols = db.prepare("PRAGMA table_info(items)").all() as any[];
    if (itemCols.some((c) => c.name === 'hide_from_all')) {
      insertBaseline.run(2, '002_add_hide_from_all', now);
    }
    if (itemCols.some((c) => c.name === 'priority')) {
      insertBaseline.run(4, '004_add_item_priority', now);
    }
  }

  // Check 3: timers and reminders
  if (tableExists(db, 'timers')) {
    insertBaseline.run(3, '003_add_timers_and_reminders', now);
  }

  // Check 5: templates enable_processed_tracking
  if (tableExists(db, 'templates')) {
    const tplCols = db.prepare("PRAGMA table_info(templates)").all() as any[];
    if (tplCols.some((c) => c.name === 'enable_processed_tracking')) {
      insertBaseline.run(5, '005_add_template_tracking', now);
    }
  }

  // Check 6: conflicts and settings
  if (tableExists(db, 'conflicts')) {
    insertBaseline.run(6, '006_add_conflicts_and_settings', now);
  }

  // Check 7: users
  if (tableExists(db, 'users')) {
    insertBaseline.run(7, '007_add_auth_and_user_scoping', now);
  }

  // Check 8: items_fts
  if (tableExists(db, 'items_fts')) {
    insertBaseline.run(8, '008_add_fts5_fulltext_search', now);
  }
}

export function runMigrations(db: Database.Database): void {
  // 1. Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  // 2. Detect and baseline existing database if unversioned
  const migrationCount = (db.prepare('SELECT count(*) as c FROM _schema_migrations').get() as any)?.c || 0;
  if (migrationCount === 0) {
    const hasItemsTable = Boolean(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='items'").get()
    );
    if (hasItemsTable) {
      baselineLegacyDatabase(db);
    }
  }

  // 3. Execute all unapplied migrations transactionally
  const appliedRows = db.prepare('SELECT version FROM _schema_migrations').all() as any[];
  const appliedSet = new Set(appliedRows.map((r) => r.version));

  for (const m of migrations) {
    if (!appliedSet.has(m.version)) {
      const applyMigration = db.transaction(() => {
        m.up(db);
        db.prepare('INSERT INTO _schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
          m.version,
          m.name,
          new Date().toISOString()
        );
      });
      applyMigration();
    }
  }
}
