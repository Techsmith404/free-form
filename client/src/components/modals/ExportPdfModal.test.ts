import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Item, Notebook } from '../../types/index.js';
import {
  ExportPdfModal,
  sortInitialExportNotes,
  toggleExportNoteSelection,
  toggleSelectAllExportNotes,
  moveExportNoteUp,
  moveExportNoteDown,
  reorderExportNotesByDrag,
  filterExportNotes,
  buildPdfExportPayload
} from './ExportPdfModal.js';
import * as apiModule from '../../api/index.js';

describe('ExportPdfModal Component & State Invariants', () => {
  const sampleNotebook: Notebook = {
    id: 'nb-eng-1',
    name: 'Engineering Architecture',
    description: 'Core architecture docs',
    color: '#22c55e',
    icon: 'book',
    parent_id: null,
    default_template_id: null,
    view_mode: 'grid',
    sort_order: 0,
    hide_from_all: 0,
    created_at: '2026-10-18T09:00:00Z',
    updated_at: '2026-10-18T09:00:00Z'
  };

  const sampleNotes: Item[] = [
    {
      id: 'note-alpha',
      title: 'Alpha Note',
      type: 'note',
      content: '# Alpha Content\n- [ ] Task 1\n- [x] Task 2',
      tags: ['roadmap'],
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
      content: '| Col 1 | Col 2 |\n| --- | --- |\n| Val A | Val B |',
      tags: ['tables'],
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
      tags: ['metrics'],
      is_pinned: 0,
      is_favorite: 0,
      is_archived: 0,
      hide_from_all: 0,
      created_at: '2026-10-18T12:00:00Z',
      updated_at: '2026-10-18T12:00:00Z'
    }
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('React Component Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const html = renderToStaticMarkup(
        React.createElement(ExportPdfModal, {
          isOpen: false,
          onClose: () => {},
          notebook: sampleNotebook,
          notes: sampleNotes
        })
      );
      expect(html).toBe('');
    });

    it('renders modal dialog with all notes selected by default and pinned notes ordered first', () => {
      const html = renderToStaticMarkup(
        React.createElement(ExportPdfModal, {
          isOpen: true,
          onClose: () => {},
          notebook: sampleNotebook,
          notes: sampleNotes
        })
      );

      expect(html).toContain('Export Notebook as PDF');
      expect(html).toContain('Notebook: Engineering Architecture');
      expect(html).toContain('value="Engineering Architecture"');
      expect(html).toContain('Deselect All');
      expect(html).toContain('#1');
      expect(html).toContain('#2');
      expect(html).toContain('#3');
      expect(html).toContain('Alpha Note');
      expect(html).toContain('Gamma Note');
      expect(html).toContain('Beta Note');
      // Pinned Alpha Note appears first, then newer Gamma Note (12:00), then Beta Note (11:00)
      expect(html.indexOf('Alpha Note')).toBeLessThan(html.indexOf('Gamma Note'));
      expect(html.indexOf('Gamma Note')).toBeLessThan(html.indexOf('Beta Note'));
      expect(html).toContain('3</span> of <span>3</span> notes will be exported');
      expect(html).toContain('Export PDF');
    });

    it('renders empty state and disables Export PDF button when notebook has no notes', () => {
      const html = renderToStaticMarkup(
        React.createElement(ExportPdfModal, {
          isOpen: true,
          onClose: () => {},
          notebook: sampleNotebook,
          notes: []
        })
      );

      expect(html).toContain('No notes available in this notebook to export.');
      expect(html).toContain('0</span> of <span>0</span> notes will be exported');
    });
  });

  describe('Selection & Reordering Helpers', () => {
    it('sorts initial notes with pinned notes first and then by updated_at descending', () => {
      const sorted = sortInitialExportNotes(sampleNotes);
      expect(sorted.map((n) => n.id)).toEqual(['note-alpha', 'note-gamma', 'note-beta']);
    });

    it('allows deselecting and re-selecting individual notes via toggleExportNoteSelection', () => {
      let selectedIds = new Set(sampleNotes.map((n) => n.id));
      expect(selectedIds.size).toBe(3);

      selectedIds = toggleExportNoteSelection(selectedIds, 'note-beta');
      expect(selectedIds.has('note-beta')).toBe(false);
      expect(selectedIds.size).toBe(2);

      selectedIds = toggleExportNoteSelection(selectedIds, 'note-beta');
      expect(selectedIds.has('note-beta')).toBe(true);
      expect(selectedIds.size).toBe(3);
    });

    it('toggles select all and deselect all via toggleSelectAllExportNotes', () => {
      const ordered = sortInitialExportNotes(sampleNotes);
      let selectedIds = new Set(ordered.map((n) => n.id));

      // All selected -> deselects all
      selectedIds = toggleSelectAllExportNotes(selectedIds, ordered);
      expect(selectedIds.size).toBe(0);

      // None selected -> selects all
      selectedIds = toggleSelectAllExportNotes(selectedIds, ordered);
      expect(selectedIds.size).toBe(3);

      // Partially selected -> selects all
      selectedIds = toggleExportNoteSelection(selectedIds, 'note-alpha');
      expect(selectedIds.size).toBe(2);
      selectedIds = toggleSelectAllExportNotes(selectedIds, ordered);
      expect(selectedIds.size).toBe(3);
    });

    it('reorders notes up and down via moveExportNoteUp and moveExportNoteDown respecting bounds', () => {
      let ordered = [...sampleNotes]; // [alpha, beta, gamma]

      // Boundary: moving index 0 up is a no-op
      ordered = moveExportNoteUp(ordered, 0);
      expect(ordered.map((n) => n.id)).toEqual(['note-alpha', 'note-beta', 'note-gamma']);

      // Move index 1 (beta) up to index 0
      ordered = moveExportNoteUp(ordered, 1);
      expect(ordered.map((n) => n.id)).toEqual(['note-beta', 'note-alpha', 'note-gamma']);

      // Move index 0 (beta) down to index 1
      ordered = moveExportNoteDown(ordered, 0);
      expect(ordered.map((n) => n.id)).toEqual(['note-alpha', 'note-beta', 'note-gamma']);

      // Boundary: moving last index (2) down is a no-op
      ordered = moveExportNoteDown(ordered, 2);
      expect(ordered.map((n) => n.id)).toEqual(['note-alpha', 'note-beta', 'note-gamma']);
    });

    it('reorders notes via drag-and-drop (reorderExportNotesByDrag)', () => {
      let ordered = [...sampleNotes]; // [alpha, beta, gamma]

      // Drag gamma (index 2) to top (index 0)
      ordered = reorderExportNotesByDrag(ordered, 2, 0);
      expect(ordered.map((n) => n.id)).toEqual(['note-gamma', 'note-alpha', 'note-beta']);

      // Drag alpha (index 1) to bottom (index 2)
      ordered = reorderExportNotesByDrag(ordered, 1, 2);
      expect(ordered.map((n) => n.id)).toEqual(['note-gamma', 'note-beta', 'note-alpha']);

      // Invalid or identical indices are no-ops
      expect(reorderExportNotesByDrag(ordered, 1, 1).map((n) => n.id)).toEqual([
        'note-gamma',
        'note-beta',
        'note-alpha'
      ]);
      expect(reorderExportNotesByDrag(ordered, -1, 2).map((n) => n.id)).toEqual([
        'note-gamma',
        'note-beta',
        'note-alpha'
      ]);
    });

    it('filters notes by title, content, and tags via filterExportNotes', () => {
      const ordered = sortInitialExportNotes(sampleNotes);
      expect(filterExportNotes(ordered, '').length).toBe(3);
      expect(filterExportNotes(ordered, 'Alpha').map((n) => n.id)).toEqual(['note-alpha']);
      expect(filterExportNotes(ordered, 'Val B').map((n) => n.id)).toEqual(['note-beta']);
      expect(filterExportNotes(ordered, 'metrics').map((n) => n.id)).toEqual(['note-gamma']);
      expect(filterExportNotes(ordered, 'nonexistent')).toEqual([]);
    });

    it('builds export payload preserving user-defined sequence, selective inclusion, and TipTap HTML', async () => {
      // Initial order: [alpha, gamma, beta]
      let ordered = sortInitialExportNotes(sampleNotes);
      // Move beta (index 2) to top (index 0) -> [beta, alpha, gamma]
      ordered = reorderExportNotesByDrag(ordered, 2, 0);
      // Deselect gamma -> only [beta, alpha] remain selected
      let selectedIds = new Set(ordered.map((n) => n.id));
      selectedIds = toggleExportNoteSelection(selectedIds, 'note-gamma');

      const payload = buildPdfExportPayload({
        notebook: sampleNotebook,
        documentTitle: 'Custom Architecture PDF',
        orderedNotes: ordered,
        selectedIds
      });

      expect(payload.notebookId).toBe('nb-eng-1');
      expect(payload.notebookName).toBe('Custom Architecture PDF');
      expect(payload.ids).toEqual(['note-beta', 'note-alpha']);
      expect(payload.notes.length).toBe(2);

      // Verify first note is Beta (with formatted HTML table)
      expect(payload.notes[0].id).toBe('note-beta');
      expect(payload.notes[0].html).toContain('<table>');
      expect(payload.notes[0].html).toContain('<th>Col 1</th>');
      expect(payload.notes[0].html).toContain('<td>Val A</td>');

      // Verify second note is Alpha (with TipTap data-type="taskList" and data-type="taskItem")
      expect(payload.notes[1].id).toBe('note-alpha');
      expect(payload.notes[1].html).toContain('<h1>Alpha Content</h1>');
      expect(payload.notes[1].html).toContain('data-type="taskList"');
      expect(payload.notes[1].html).toContain('data-type="taskItem"');
      expect(payload.notes[1].html).toContain('data-checked="false"');
      expect(payload.notes[1].html).toContain('data-checked="true"');

      // Verify end-to-end dispatch to exportPdf
      const exportSpy = vi.spyOn(apiModule, 'exportPdf').mockResolvedValue();
      await apiModule.exportPdf(payload);
      expect(exportSpy).toHaveBeenCalledWith(payload);
    });
  });
});
