import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Item, NotePriority } from '../../types/index.js';
import { MarkdownViewerModal } from './MarkdownViewerModal.js';
import { NoteCard } from '../items/NoteCard.js';
import { ListCard } from '../items/ListCard.js';

describe('MarkdownViewerModal & Row-Synchronized Card Expansion', () => {
  const samplePriority: NotePriority = {
    id: 'p1',
    label: 'High Priority',
    color: '#ef4444'
  };

  const createSampleNote = (overrides: Partial<Item> = {}): Item => ({
    id: 'note-spec-1',
    title: 'Architecture Blueprint',
    type: 'note',
    content: `# Executive Summary
### System Components
This specification details **mission-critical** architecture and *real-time* pipelines with \`zero-copy\` streaming.

- [ ] Task 1: Complete schema migration
- [x] Task 2: Verify desktop row expansion`,
    notebook_id: 'nb-eng-1',
    notebook_name: 'Engineering Hub',
    priority: 'p1',
    tags: ['infra', 'review'],
    is_pinned: 1,
    is_favorite: 1,
    is_archived: 0,
    hide_from_all: 0,
    created_at: '2026-10-18T10:00:00Z',
    updated_at: '2026-10-18T12:00:00Z',
    ...overrides
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('MarkdownViewerModal Component Rendering', () => {
    it('renders full markdown preview content, headings, task list checkboxes, formatted text, and metadata', () => {
      const note = createSampleNote();
      const html = renderToStaticMarkup(
        React.createElement(MarkdownViewerModal, {
          item: note,
          priorities: [samplePriority],
          onClose: () => {},
          onEdit: () => {}
        })
      );

      // Dialog accessibility
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-labelledby="markdown-viewer-title"');
      expect(html).toContain('Architecture Blueprint');

      // Notebook name
      expect(html).toContain('in Engineering Hub');

      // Priority badge & styling
      expect(html).toContain('High Priority');
      expect(html).toContain('color:#ef4444');

      // Tags pills
      expect(html).toContain('#infra');
      expect(html).toContain('#review');

      // Formatted markdown elements
      expect(html).toContain('<h1>Executive Summary</h1>');
      expect(html).toContain('<h3>System Components</h3>');
      expect(html).toContain('<strong>mission-critical</strong>');
      expect(html).toContain('<em>real-time</em>');
      expect(html).toContain('<code>zero-copy</code>');

      // Interactive task checkboxes
      expect(html).toContain('data-checklist-index="0"');
      expect(html).toContain('data-checklist-index="1"');
      expect(html).toContain('checked');

      // Checklist badge showing 1 completed of 2
      expect(html).toContain('Checklist');
      expect(html).toContain('1/2');

      // Action buttons
      expect(html).toContain('aria-label="Copy note to clipboard"');
      expect(html).toContain('aria-label="Download as Markdown"');
      expect(html).toContain('aria-label="Print or save note as PDF"');
      expect(html).toContain('aria-label="Close dialog"');
    });

    it('renders Edit button when onEdit is provided and isTrashMode is false', () => {
      const note = createSampleNote({ is_archived: 0 });
      const html = renderToStaticMarkup(
        React.createElement(MarkdownViewerModal, {
          item: note,
          isTrashMode: false,
          onClose: () => {},
          onEdit: () => {}
        })
      );

      expect(html).toContain('aria-label="Edit note"');
      expect(html).toContain('<span>Edit</span>');
      expect(html).not.toContain('Restore Note');
      expect(html).not.toContain('aria-label="Restore note from trash"');
    });

    it('hides Edit button and shows Restore button when isTrashMode is true', () => {
      const note = createSampleNote();
      const html = renderToStaticMarkup(
        React.createElement(MarkdownViewerModal, {
          item: note,
          isTrashMode: true,
          onClose: () => {},
          onEdit: () => {},
          onRestore: () => {}
        })
      );

      expect(html).not.toContain('aria-label="Edit note"');
      expect(html).toContain('aria-label="Restore note from trash"');
      expect(html).toContain('Restore Note');
      expect(html).toContain('This item is in the trash. Restore it to edit or organize.');
    });

    it('hides Edit button and shows Restore button when item is archived even if isTrashMode is omitted', () => {
      const note = createSampleNote({ is_archived: 1 });
      const html = renderToStaticMarkup(
        React.createElement(MarkdownViewerModal, {
          item: note,
          onClose: () => {},
          onEdit: () => {},
          onRestore: () => {}
        })
      );

      expect(html).not.toContain('aria-label="Edit note"');
      expect(html).toContain('aria-label="Restore note from trash"');
      expect(html).toContain('Restore Note');
    });

    it('handles empty content gracefully with fallback notice', () => {
      const note = createSampleNote({
        content: '',
        notebook_name: undefined,
        priority: undefined,
        tags: []
      });
      const html = renderToStaticMarkup(
        React.createElement(MarkdownViewerModal, {
          item: note,
          onClose: () => {}
        })
      );

      expect(html).toContain('<em>No content</em>');
      expect(html).not.toContain('in Engineering Hub');
      expect(html).not.toContain('High Priority');
      expect(html).toContain('Note');
    });

    it('renders Hidden badge when hide_from_all is true', () => {
      const note = createSampleNote({ hide_from_all: 1 });
      const html = renderToStaticMarkup(
        React.createElement(MarkdownViewerModal, {
          item: note,
          onClose: () => {}
        })
      );

      expect(html).toContain('Hidden');
      expect(html).toContain('title="Hidden from All Items feed"');
    });
  });

  describe('Row-Synchronized Card Expansion Rendering', () => {
    describe('NoteCard expansion states', () => {
      const longNote = createSampleNote({
        title: 'Long Prose Documentation',
        content: `Paragraph 1: Background and rationale for architecture design decisions.\n\n` +
          `Paragraph 2: Comprehensive deep dive into data models and index layout.\n\n` +
          `Paragraph 3: Scalability invariants and fault recovery mechanisms.`
      });

      it('renders clamped preview when isExpanded is false', () => {
        const html = renderToStaticMarkup(
          React.createElement(NoteCard, {
            item: longNote,
            isExpanded: false,
            density: 'cozy',
            onOpen: () => {},
            onToggleFavorite: () => {},
            onTogglePin: () => {},
            onDelete: () => {}
          })
        );

        // Clamped styles applied
        expect(html).toContain('overflow-hidden relative after:absolute');
        expect(html).toContain('max-h-40 sm:max-h-48');

        // Expansion button is in "Show full note" state
        expect(html).toContain('aria-label="Show full note"');
        expect(html).not.toContain('aria-label="Collapse preview"');
      });

      it('renders un-clamped full content when isExpanded is true (row-synchronized)', () => {
        const html = renderToStaticMarkup(
          React.createElement(NoteCard, {
            item: longNote,
            isExpanded: true,
            density: 'cozy',
            onOpen: () => {},
            onToggleFavorite: () => {},
            onTogglePin: () => {},
            onDelete: () => {}
          })
        );

        // Clamped overlay classes are removed
        expect(html).not.toContain('after:pointer-events-none');
        expect(html).not.toContain('max-h-40 sm:max-h-48 overflow-hidden');

        // Expansion button is in "Collapse preview" state
        expect(html).toContain('aria-label="Collapse preview"');
        expect(html).not.toContain('aria-label="Show full note"');

        // Full content is present
        expect(html).toContain('Paragraph 1: Background');
        expect(html).toContain('Paragraph 3: Scalability invariants');
      });
    });

    describe('ListCard expansion states', () => {
      const checklistNote = createSampleNote({
        title: 'Sprint Checklist',
        content: `- [ ] Item 1: Alpha
- [ ] Item 2: Beta
- [ ] Item 3: Gamma
- [ ] Item 4: Delta
- [ ] Item 5: Epsilon
- [ ] Item 6: Zeta
- [ ] Item 7: Eta`
      });

      it('renders truncated item list with overflow indicator when isExpanded is false', () => {
        const html = renderToStaticMarkup(
          React.createElement(ListCard, {
            item: checklistNote,
            isExpanded: false,
            density: 'cozy',
            onOpen: () => {},
            onToggleFavorite: () => {},
            onTogglePin: () => {},
            onDelete: () => {}
          })
        );

        // Only first 5 items rendered
        expect(html).toContain('Item 1: Alpha');
        expect(html).toContain('Item 5: Epsilon');
        expect(html).not.toContain('Item 6: Zeta');
        expect(html).not.toContain('Item 7: Eta');

        // Overflow badge (+ 2 more items)
        expect(html).toContain('+ 2 more items (tap to show all)');

        // Button is in "Show all items" state
        expect(html).toContain('aria-label="Show all items"');
        expect(html).not.toContain('aria-label="Collapse preview"');
      });

      it('renders all items un-truncated without overflow pill when isExpanded is true (row-synchronized)', () => {
        const html = renderToStaticMarkup(
          React.createElement(ListCard, {
            item: checklistNote,
            isExpanded: true,
            density: 'cozy',
            onOpen: () => {},
            onToggleFavorite: () => {},
            onTogglePin: () => {},
            onDelete: () => {}
          })
        );

        // All 7 items rendered
        expect(html).toContain('Item 1: Alpha');
        expect(html).toContain('Item 5: Epsilon');
        expect(html).toContain('Item 6: Zeta');
        expect(html).toContain('Item 7: Eta');

        // No overflow badge
        expect(html).not.toContain('+2 more');

        // Button is in "Collapse preview" state
        expect(html).toContain('aria-label="Collapse preview"');
        expect(html).not.toContain('aria-label="Show all items"');
      });
    });
  });
});
