import { describe, it, expect } from 'vitest';
import {
  getGridColumnCount,
  getRowItemIds,
  resolveCardExpanded,
  toggleRowCardExpansion
} from './cardGrid.js';
import type { Item } from '../types/index.js';

describe('cardGrid utility', () => {
  const createMockItem = (id: string, type = 'note', metadata?: any): Item =>
    ({
      id,
      title: `Item ${id}`,
      type,
      content: 'Sample content',
      metadata,
      is_favorite: 0,
      is_pinned: 0,
      is_archived: 0,
      hide_from_all: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: []
    } as unknown as Item);

  describe('getGridColumnCount', () => {
    it('returns correct columns for compact density', () => {
      expect(getGridColumnCount(1400, 'compact')).toBe(5);
      expect(getGridColumnCount(1280, 'compact')).toBe(5);
      expect(getGridColumnCount(1100, 'compact')).toBe(4);
      expect(getGridColumnCount(1024, 'compact')).toBe(4);
      expect(getGridColumnCount(900, 'compact')).toBe(3);
      expect(getGridColumnCount(768, 'compact')).toBe(3);
      expect(getGridColumnCount(700, 'compact')).toBe(2);
      expect(getGridColumnCount(640, 'compact')).toBe(2);
      expect(getGridColumnCount(500, 'compact')).toBe(1);
    });

    it('returns correct columns for comfortable density', () => {
      expect(getGridColumnCount(1400, 'comfortable')).toBe(4);
      expect(getGridColumnCount(1280, 'comfortable')).toBe(4);
      expect(getGridColumnCount(1100, 'comfortable')).toBe(3);
      expect(getGridColumnCount(1024, 'comfortable')).toBe(3);
      expect(getGridColumnCount(800, 'comfortable')).toBe(2);
      expect(getGridColumnCount(768, 'comfortable')).toBe(2);
      expect(getGridColumnCount(600, 'comfortable')).toBe(1);
    });

    it('returns correct columns for cozy density (default)', () => {
      expect(getGridColumnCount(1400, 'cozy')).toBe(3);
      expect(getGridColumnCount(1280, 'cozy')).toBe(3);
      expect(getGridColumnCount(900, 'cozy')).toBe(2);
      expect(getGridColumnCount(768, 'cozy')).toBe(2);
      expect(getGridColumnCount(600, 'cozy')).toBe(1);
      expect(getGridColumnCount(1280)).toBe(3);
    });
  });

  describe('getRowItemIds', () => {
    const items = [
      createMockItem('1'),
      createMockItem('2'),
      createMockItem('3'),
      createMockItem('4'),
      createMockItem('5'),
      createMockItem('6'),
      createMockItem('7')
    ];

    it('returns items in the same row with 3 columns', () => {
      expect(getRowItemIds(items, '1', 3)).toEqual(['1', '2', '3']);
      expect(getRowItemIds(items, '2', 3)).toEqual(['1', '2', '3']);
      expect(getRowItemIds(items, '3', 3)).toEqual(['1', '2', '3']);

      expect(getRowItemIds(items, '4', 3)).toEqual(['4', '5', '6']);
      expect(getRowItemIds(items, '5', 3)).toEqual(['4', '5', '6']);
      expect(getRowItemIds(items, '6', 3)).toEqual(['4', '5', '6']);

      // Partial row at the end
      expect(getRowItemIds(items, '7', 3)).toEqual(['7']);
    });

    it('returns items in the same row with 1 column (mobile)', () => {
      expect(getRowItemIds(items, '1', 1)).toEqual(['1']);
      expect(getRowItemIds(items, '2', 1)).toEqual(['2']);
    });

    it('returns empty array when target item does not exist', () => {
      expect(getRowItemIds(items, 'non-existent', 3)).toEqual([]);
    });

    it('handles columnCount <= 0 safely by clamping to 1', () => {
      expect(getRowItemIds(items, '2', 0)).toEqual(['2']);
      expect(getRowItemIds(items, '2', -5)).toEqual(['2']);
    });
  });

  describe('resolveCardExpanded', () => {
    const note = createMockItem('note-1', 'note');
    const formUnprocessed = createMockItem('form-1', 'form_entry', { is_processed: false });
    const formProcessed = createMockItem('form-2', 'form_entry', { is_processed: true });

    it('respects explicit overrides first', () => {
      expect(resolveCardExpanded(note, { 'note-1': true }, false)).toBe(true);
      expect(resolveCardExpanded(note, { 'note-1': false }, true)).toBe(false);
      expect(resolveCardExpanded(formProcessed, { 'form-2': true }, false)).toBe(true);
    });

    it('collapses processed forms when no override is set regardless of expandAllCards', () => {
      expect(resolveCardExpanded(formProcessed, {}, true)).toBe(false);
      expect(resolveCardExpanded(formProcessed, {}, false)).toBe(false);
    });

    it('falls back to expandAllCards for unprocessed forms or notes without overrides', () => {
      expect(resolveCardExpanded(formUnprocessed, {}, true)).toBe(true);
      expect(resolveCardExpanded(formUnprocessed, {}, false)).toBe(false);
      expect(resolveCardExpanded(note, {}, true)).toBe(true);
      expect(resolveCardExpanded(note, {}, false)).toBe(false);
    });
  });

  describe('toggleRowCardExpansion', () => {
    const items = [
      createMockItem('1'),
      createMockItem('2'),
      createMockItem('3'),
      createMockItem('4')
    ];

    it('toggles and synchronizes all items in the target row to expanded', () => {
      const overrides = toggleRowCardExpansion(items, '1', 2, {}, false);
      expect(overrides).toEqual({
        '1': true,
        '2': true
      });
      // Items in other rows are not affected
      expect(overrides['3']).toBeUndefined();
      expect(overrides['4']).toBeUndefined();
    });

    it('toggles and synchronizes all items in the target row to collapsed when already expanded', () => {
      const initialOverrides = { '1': true, '2': true };
      const nextOverrides = toggleRowCardExpansion(items, '2', 2, initialOverrides, false);
      expect(nextOverrides).toEqual({
        '1': false,
        '2': false
      });
    });

    it('returns current overrides unmodified if target item is not found', () => {
      const initialOverrides = { '1': true };
      const nextOverrides = toggleRowCardExpansion(items, '999', 2, initialOverrides, false);
      expect(nextOverrides).toBe(initialOverrides);
    });
  });
});
