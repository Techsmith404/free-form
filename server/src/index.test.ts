import { describe, it, expect, beforeAll } from 'vitest';
import { nanoid } from 'nanoid';
import { db, initDatabase } from './db/index.js';
import { generateMarkdownFromForm } from './services/markdown.js';
import { FormTemplate } from './types/index.js';
import {
  createTimer,
  startTimer,
  pauseTimer,
  resetTimer,
  dismissTimer,
  createReminder,
  snoozeReminder,
  completeReminder
} from './services/realtime.js';

describe('Free Form Backend Core', () => {
  beforeAll(() => {
    initDatabase();
  });

  it('should seed starter notebooks and templates', () => {
    const notebooks = db.prepare('SELECT * FROM notebooks').all();
    expect(notebooks.length).toBeGreaterThan(0);

    const templates = db.prepare('SELECT * FROM templates').all();
    expect(templates.length).toBeGreaterThan(0);
  });

  it('should generate markdown from form template values', () => {
    const mockTemplate: FormTemplate = {
      id: 'test-tpl',
      name: 'Inspection Report',
      description: 'Vehicle safety check',
      icon: 'check',
      color: '#22c55e',
      default_notebook_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      fields_schema: [
        { id: 'technician', label: 'Technician Name', type: 'text' },
        { id: 'tires_ok', label: 'Tires Pass Inspection', type: 'checkbox' },
        { id: 'rating', label: 'Overall Condition', type: 'rating', min: 1, max: 5 },
        {
          id: 'measurements',
          label: 'Measurements',
          type: 'table',
          columns: [
            { id: 'part', name: 'Part', type: 'text' },
            { id: 'thickness', name: 'Thickness (mm)', type: 'number' }
          ]
        }
      ]
    };

    const values = {
      technician: 'Alex Mercer',
      tires_ok: true,
      rating: 5,
      measurements: [
        { part: 'Front Left Rotor', thickness: 24.5 },
        { part: 'Front Right Rotor', thickness: 24.2 }
      ]
    };

    const markdown = generateMarkdownFromForm(mockTemplate, values);

    expect(markdown).toContain('# Inspection Report');
    expect(markdown).toContain('**Technician Name**: Alex Mercer');
    expect(markdown).toContain('[x] **Tires Pass Inspection**');
    expect(markdown).toContain('★★★★★ (5/5)');
    expect(markdown).toContain('| Front Left Rotor | 24.5 |');
  });

  it('should record counter increments in history', () => {
    const item = db.prepare("SELECT * FROM items WHERE type = 'counter'").get() as any;
    expect(item).toBeDefined();

    const meta = JSON.parse(item.metadata);
    const initialCount = meta.count;

    const newCount = initialCount + 1;
    db.prepare('UPDATE items SET metadata = ? WHERE id = ?').run(
      JSON.stringify({ ...meta, count: newCount }),
      item.id
    );

    db.prepare(`
      INSERT INTO counter_history (id, item_id, delta, new_value, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(nanoid(), item.id, 1, newCount, 'Test increment', new Date().toISOString());

    const history = db.prepare('SELECT * FROM counter_history WHERE item_id = ?').all(item.id);
    expect(history.length).toBeGreaterThan(0);
  });

  it('should support both /counter/history and /counter-history endpoints', async () => {
    const { itemRoutes } = await import('./routes/items.js');
    const fastify = (await import('fastify')).default();
    await fastify.register(itemRoutes);

    const item = db.prepare("SELECT * FROM items WHERE type = 'counter'").get() as any;
    expect(item).toBeDefined();

    const res1 = await fastify.inject({
      method: 'GET',
      url: `/api/items/${item.id}/counter/history`
    });
    expect(res1.statusCode).toBe(200);

    const res2 = await fastify.inject({
      method: 'GET',
      url: `/api/items/${item.id}/counter-history`
    });
    expect(res2.statusCode).toBe(200);
    expect(JSON.parse(res1.body)).toEqual(JSON.parse(res2.body));
  });

  it('should support hide_from_all on notebooks and items', () => {
    const hiddenNbId = `nb-hidden-${nanoid()}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO notebooks (id, name, hide_from_all, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?)
    `).run(hiddenNbId, 'Secret Notebook', now, now);

    const hiddenItemInNbId = `item-in-hidden-${nanoid()}`;
    db.prepare(`
      INSERT INTO items (id, notebook_id, title, type, hide_from_all, created_at, updated_at)
      VALUES (?, ?, 'Inside Hidden Notebook', 'note', 0, ?, ?)
    `).run(hiddenItemInNbId, hiddenNbId, now, now);

    const soloHiddenItemId = `item-solo-hidden-${nanoid()}`;
    db.prepare(`
      INSERT INTO items (id, title, type, hide_from_all, created_at, updated_at)
      VALUES (?, 'Solo Hidden Note', 'note', 1, ?, ?)
    `).run(soloHiddenItemId, now, now);

    // Default global query (include_hidden = 0)
    const visibleItems = db.prepare(`
      SELECT i.id FROM items i
      LEFT JOIN notebooks n ON i.notebook_id = n.id
      WHERE (i.hide_from_all = 0 OR i.hide_from_all IS NULL)
        AND (n.hide_from_all = 0 OR n.hide_from_all IS NULL)
        AND i.id IN (?, ?)
    `).all(hiddenItemInNbId, soloHiddenItemId);

    expect(visibleItems.length).toBe(0);

    // Direct notebook query should still show items
    const inNotebook = db.prepare('SELECT id FROM items WHERE notebook_id = ?').all(hiddenNbId);
    expect(inNotebook.length).toBe(1);
    expect((inNotebook[0] as any).id).toBe(hiddenItemInNbId);
  });

  it('should create, start, pause, reset, and dismiss a synced timer', () => {
    const timer = createTimer({
      title: 'Pasta Timer',
      duration_seconds: 600,
      auto_start: false
    });

    expect(timer).toBeDefined();
    expect(timer.title).toBe('Pasta Timer');
    expect(timer.status).toBe('idle');
    expect(timer.duration_seconds).toBe(600);

    const started = startTimer(timer.id);
    expect(started?.status).toBe('running');
    expect(started?.target_end_time).toBeDefined();

    const paused = pauseTimer(timer.id);
    expect(paused?.status).toBe('paused');
    expect(paused?.target_end_time).toBeNull();

    const reset = resetTimer(timer.id);
    expect(reset?.status).toBe('idle');
    expect(reset?.remaining_seconds).toBe(600);

    const dismissed = dismissTimer(timer.id);
    expect(dismissed?.status).toBe('dismissed');
  });

  it('should create, snooze, and complete a reminder', () => {
    const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
    const reminder = createReminder({
      title: 'Call the doctor',
      notes: 'Confirm 2pm slot',
      due_date: futureDate,
      priority: 'high'
    });

    expect(reminder).toBeDefined();
    expect(reminder.title).toBe('Call the doctor');
    expect(reminder.status).toBe('pending');
    expect(reminder.priority).toBe('high');

    const snoozed = snoozeReminder(reminder.id, 10);
    expect(snoozed?.status).toBe('pending');
    expect(new Date(snoozed!.due_date).getTime()).toBeGreaterThan(new Date(futureDate).getTime());

    const completed = completeReminder(reminder.id);
    expect(completed?.status).toBe('completed');
  });

  it('should store and update user settings and item priority', () => {
    // Check initial seeded settings
    const themeRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('theme') as any;
    expect(themeRow).toBeDefined();
    expect(themeRow.value).toBe('system');

    const prioritiesRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('priorities') as any;
    expect(prioritiesRow).toBeDefined();
    const priorities = JSON.parse(prioritiesRow.value);
    expect(Array.isArray(priorities)).toBe(true);
    expect(priorities.length).toBeGreaterThanOrEqual(4);

    // Test item with custom priority
    const itemId = `item-priority-${nanoid()}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO items (id, title, type, priority, created_at, updated_at)
      VALUES (?, 'High Priority Task', 'note', 'urgent', ?, ?)
    `).run(itemId, now, now);

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as any;
    expect(item.priority).toBe('urgent');
  });

  it('should detect sync conflicts, keep most recent as active, and record conflict copy', async () => {
    const itemId = `item-conflict-${nanoid()}`;
    const baseTime = new Date(Date.now() - 60000).toISOString();
    const serverEditTime = new Date(Date.now() - 30000).toISOString();
    const clientEditTime = new Date(Date.now() - 10000).toISOString(); // Client is newer

    // 1. Initial item in database
    db.prepare(`
      INSERT INTO items (id, title, content, type, created_at, updated_at)
      VALUES (?, 'Original Title', 'Original Content', 'note', ?, ?)
    `).run(itemId, baseTime, baseTime);

    // 2. Server updates item concurrently
    db.prepare(`
      UPDATE items SET title = 'Server Title', content = 'Server Content', updated_at = ? WHERE id = ?
    `).run(serverEditTime, itemId);

    // 3. Client syncs with changes based on old baseTime, but with clientEditTime > serverEditTime
    // We simulate the sync logic
    const { syncRoutes } = await import('./routes/sync.js');
    const fastify = (await import('fastify')).default();
    await fastify.register(syncRoutes);

    const syncPayload = {
      device_name: 'Cassiopea (Pixel 8)',
      last_sync_timestamp: baseTime,
      mutations: [
        {
          id: `mut-${nanoid()}`,
          type: 'update_item' as const,
          data: {
            id: itemId,
            title: 'Client Mobile Title',
            content: 'Client Mobile Content'
          },
          client_timestamp: clientEditTime,
          base_timestamp: baseTime
        }
      ]
    };

    const res = await fastify.inject({
      method: 'POST',
      url: '/api/sync',
      payload: syncPayload
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.conflicts.length).toBe(1);

    // Since client was newer, active item should be Client's version
    const updatedItem = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as any;
    expect(updatedItem.title).toBe('Client Mobile Title');
    expect(updatedItem.content).toBe('Client Mobile Content');

    // Conflicting version in conflicts table should be Server's version
    const conflict = db.prepare('SELECT * FROM conflicts WHERE item_id = ?').get(itemId) as any;
    expect(conflict).toBeDefined();
    expect(conflict.active_title).toBe('Client Mobile Title');
    expect(conflict.conflict_title).toBe('Server Title');
    expect(conflict.status).toBe('unresolved');
  });

  it('should resolve conflicts via resolution endpoints', async () => {
    const { conflictsRoutes } = await import('./routes/conflicts.js');
    const fastify = (await import('fastify')).default();
    await fastify.register(conflictsRoutes);

    const conflict = db.prepare("SELECT * FROM conflicts WHERE status = 'unresolved' LIMIT 1").get() as any;
    expect(conflict).toBeDefined();

    // Resolve conflict by keeping both
    const res = await fastify.inject({
      method: 'POST',
      url: `/api/conflicts/${conflict.id}/resolve`,
      payload: {
        action: 'keep_both'
      }
    });

    expect(res.statusCode).toBe(200);
    const resolvedConflict = db.prepare('SELECT * FROM conflicts WHERE id = ?').get(conflict.id) as any;
    expect(resolvedConflict.status).toBe('resolved');
    expect(resolvedConflict.resolution).toBe('keep_both');

    // Verify copy was created
    const itemsWithConflictCopy = db.prepare("SELECT * FROM items WHERE title LIKE '%(Conflict Copy)%' OR title = ?").all(conflict.conflict_title);
    expect(itemsWithConflictCopy.length).toBeGreaterThan(0);
  });
});


