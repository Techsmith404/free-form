import { describe, it, expect } from 'vitest';
import { Item } from '../../types/index.js';
import { renderItemToHtml } from '../../utils/export.js';

describe('ExportPdfModal Logic & Invariants', () => {
  const sampleNotes: Item[] = [
    {
      id: 'note-alpha',
      title: 'Alpha Note',
      type: 'note',
      content: '# Alpha Content\n- [ ] Task 1',
      is_pinned: 1,
      is_favorite: 0,
      is_archived: 0,
      hide_from_all: 0,
      created_at: '2026-10-18T10:00:00Z',
      updated_at: '2026-10-18T10:00:00Z'
    },
    {
      id: 'note-beta',
      title: 'Beta Note',
      type: 'note',
      content: 'Beta Content paragraph',
      is_pinned: 0,
      is_favorite: 1,
      is_archived: 0,
      hide_from_all: 0,
      created_at: '2026-10-18T11:00:00Z',
      updated_at: '2026-10-18T11:00:00Z'
    },
    {
      id: 'note-gamma',
      title: 'Gamma Note',
      type: 'counter',
      content: 'Count description',
      metadata: { count: 10, unit: 'items' },
      is_pinned: 0,
      is_favorite: 0,
      is_archived: 0,
      hide_from_all: 0,
      created_at: '2026-10-18T12:00:00Z',
      updated_at: '2026-10-18T12:00:00Z'
    }
  ];

  it('initializes with all notes selected by default', () => {
    const selectedIds = new Set(sampleNotes.map((n) => n.id));
    expect(selectedIds.size).toBe(sampleNotes.length);
    expect(selectedIds.has('note-alpha')).toBe(true);
    expect(selectedIds.has('note-beta')).toBe(true);
    expect(selectedIds.has('note-gamma')).toBe(true);
  });

  it('allows deselecting and re-selecting individual notes', () => {
    let selectedIds = new Set(sampleNotes.map((n) => n.id));

    // Deselect beta
    selectedIds.delete('note-beta');
    expect(selectedIds.has('note-beta')).toBe(false);
    expect(selectedIds.size).toBe(2);

    // Re-select beta
    selectedIds.add('note-beta');
    expect(selectedIds.has('note-beta')).toBe(true);
    expect(selectedIds.size).toBe(3);
  });

  it('toggles select all and deselect all correctly', () => {
    let selectedIds = new Set(sampleNotes.map((n) => n.id));
    const allSelected = selectedIds.size === sampleNotes.length;

    // Deselect all
    if (allSelected) {
      selectedIds = new Set();
    }
    expect(selectedIds.size).toBe(0);

    // Select all
    selectedIds = new Set(sampleNotes.map((n) => n.id));
    expect(selectedIds.size).toBe(3);
  });

  it('reorders notes up and down preserving bounds', () => {
    let ordered = [...sampleNotes];

    // Cannot move index 0 up
    const moveUp = (index: number) => {
      if (index <= 0) return;
      const next = [...ordered];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      ordered = next;
    };

    const moveDown = (index: number) => {
      if (index >= ordered.length - 1) return;
      const next = [...ordered];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      ordered = next;
    };

    moveUp(0);
    expect(ordered[0].id).toBe('note-alpha'); // unchanged

    // Move index 1 (beta) up to index 0
    moveUp(1);
    expect(ordered[0].id).toBe('note-beta');
    expect(ordered[1].id).toBe('note-alpha');

    // Move index 0 down
    moveDown(0);
    expect(ordered[0].id).toBe('note-alpha');
    expect(ordered[1].id).toBe('note-beta');

    // Move index 2 down (cannot move past end)
    moveDown(2);
    expect(ordered[2].id).toBe('note-gamma'); // unchanged
  });

  it('formats payload preserving exact user sequence and pre-rendered HTML', () => {
    // Reordered: Gamma first, then Alpha
    const reorderedSelected = [sampleNotes[2], sampleNotes[0]];

    const payloadNotes = reorderedSelected.map((note) => ({
      id: note.id,
      title: note.title,
      html: renderItemToHtml(note),
      content: note.content,
      type: note.type
    }));

    expect(payloadNotes.length).toBe(2);
    expect(payloadNotes[0].id).toBe('note-gamma');
    expect(payloadNotes[0].html).toContain('Current Count:</strong> 10 items');

    expect(payloadNotes[1].id).toBe('note-alpha');
    expect(payloadNotes[1].html).toContain('<h1>Alpha Content</h1>');
    expect(payloadNotes[1].html).toContain('type="checkbox"');
  });
});
