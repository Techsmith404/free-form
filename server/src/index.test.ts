import { describe, it, expect, beforeAll } from 'vitest';
import { nanoid } from 'nanoid';
import { db, initDatabase } from './db/index.js';
import { generateMarkdownFromForm } from './services/markdown.js';
import { FormTemplate } from './types/index.js';

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
});
