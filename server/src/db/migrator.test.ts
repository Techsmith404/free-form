import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, migrations } from './migrator.js';

describe('Schema Migrator', () => {
  it('executes all migrations on a fresh in-memory database', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    const applied = db.prepare('SELECT version, name FROM _schema_migrations ORDER BY version ASC').all() as any[];
    expect(applied.length).toBe(migrations.length);
    expect(applied[0].version).toBe(1);
    expect(applied[applied.length - 1].version).toBe(migrations[migrations.length - 1].version);

    // Verify core tables exist
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).map(t => t.name);
    expect(tables).toContain('notebooks');
    expect(tables).toContain('items');
    expect(tables).toContain('templates');
    expect(tables).toContain('timers');
    expect(tables).toContain('reminders');
    expect(tables).toContain('conflicts');
    expect(tables).toContain('settings');
    expect(tables).toContain('users');
    expect(tables).toContain('items_fts');
    db.close();
  });

  it('is completely idempotent when run multiple times', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    // Second execution should do nothing and not throw
    expect(() => runMigrations(db)).not.toThrow();

    const count = (db.prepare('SELECT count(*) as c FROM _schema_migrations').get() as any).c;
    expect(count).toBe(migrations.length);
    db.close();
  });

  it('correctly baselines a legacy database that pre-existed before migration versioning', () => {
    const db = new Database(':memory:');
    // Simulate legacy DB: create items and timers table without _schema_migrations
    db.exec(`
      CREATE TABLE notebooks (id TEXT PRIMARY KEY, name TEXT);
      CREATE TABLE items (id TEXT PRIMARY KEY, title TEXT, type TEXT, content TEXT);
      CREATE TABLE timers (id TEXT PRIMARY KEY, title TEXT);
    `);

    runMigrations(db);

    const applied = db.prepare('SELECT version FROM _schema_migrations').all() as any[];
    const appliedVersions = applied.map(a => a.version);

    // Baseline should have registered versions 1, 3, etc.
    expect(appliedVersions).toContain(1);
    expect(appliedVersions).toContain(3);
    db.close();
  });
});
