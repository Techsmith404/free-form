import { Item, DensityMode } from '../types/index.js';

/**
 * Returns the number of CSS Grid columns active for the given viewport width and density mode,
 * matching the Tailwind grid classes in App.tsx:
 * - compact: grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
 * - comfortable: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
 * - cozy: grid-cols-1 md:grid-cols-2 xl:grid-cols-3
 */
export function getGridColumnCount(viewportWidth: number, density: DensityMode = 'cozy'): number {
  if (density === 'compact') {
    if (viewportWidth >= 1280) return 5;
    if (viewportWidth >= 1024) return 4;
    if (viewportWidth >= 768) return 3;
    if (viewportWidth >= 640) return 2;
    return 1;
  }
  if (density === 'comfortable') {
    if (viewportWidth >= 1280) return 4;
    if (viewportWidth >= 1024) return 3;
    if (viewportWidth >= 768) return 2;
    return 1;
  }
  if (viewportWidth >= 1280) return 3;
  if (viewportWidth >= 768) return 2;
  return 1;
}

/**
 * Returns the IDs of all items located in the same grid row as `targetItemId`.
 */
export function getRowItemIds(items: Item[], targetItemId: string, columnCount: number): string[] {
  const safeCols = Math.max(1, Math.floor(columnCount));
  const index = items.findIndex((i) => i.id === targetItemId);
  if (index === -1) return [];
  const rowStart = Math.floor(index / safeCols) * safeCols;
  const rowEnd = Math.min(items.length, rowStart + safeCols);
  return items.slice(rowStart, rowEnd).map((i) => i.id);
}

/**
 * Resolves whether an individual card should be expanded given row overrides and global expandAllCards.
 */
export function resolveCardExpanded(
  item: Item,
  overrides: Record<string, boolean>,
  expandAllCards: boolean
): boolean {
  if (overrides[item.id] !== undefined) {
    return overrides[item.id];
  }
  if (item.type === 'form_entry' && Boolean(item.metadata?.is_processed)) {
    return false;
  }
  return expandAllCards;
}

/**
 * Toggles the expanded state for `targetItemId` and synchronizes that state across all items in the same grid row.
 */
export function toggleRowCardExpansion(
  items: Item[],
  targetItemId: string,
  columnCount: number,
  currentOverrides: Record<string, boolean>,
  expandAllCards: boolean
): Record<string, boolean> {
  const targetItem = items.find((i) => i.id === targetItemId);
  if (!targetItem) return currentOverrides;

  const isCurrentlyExpanded = resolveCardExpanded(targetItem, currentOverrides, expandAllCards);
  const nextExpanded = !isCurrentlyExpanded;
  const rowIds = getRowItemIds(items, targetItemId, columnCount);

  const nextOverrides = { ...currentOverrides };
  for (const id of rowIds) {
    nextOverrides[id] = nextExpanded;
  }
  return nextOverrides;
}