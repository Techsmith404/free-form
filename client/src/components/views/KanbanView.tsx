import React, { useState, useMemo } from 'react';
import { Item, NotePriority, FormTemplate, ItemType } from '../../types/index.js';
import { updateItem } from '../../api/index.js';
import {
  Sparkles,
  AlertCircle,
  Clock,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronLeft,
  Star,
  Pin,
  Trash2,
  FileText,
  ClipboardList,
  Hash,
  Bookmark,
  Images,
  Check,
  Folder,
  SlidersHorizontal,
  MoveHorizontal,
  Copy
} from 'lucide-react';
import { hapticTap, hapticSuccess } from '../../services/native.js';

type GroupMode = 'priority' | 'status' | 'type';

interface KanbanViewProps {
  items: Item[];
  priorities: NotePriority[];
  templates: FormTemplate[];
  onOpenItem: (item: Item) => void;
  onUpdateItem: (item: Item) => void;
  onToggleFavorite: (item: Item) => void;
  onTogglePin: (item: Item) => void;
  onDelete: (id: string) => void;
  onRestore: (item: Item) => void;
  onDuplicate?: (item: Item) => void;
  onSelectTag?: (tag: string) => void;
  isTrashMode?: boolean;
  selectedIds?: Set<string>;
  isSelectMode?: boolean;
  onToggleSelect?: (id: string) => void;
}

interface ColumnDef {
  id: string;
  title: string;
  color: string;
  accentBg: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  items: Item[];
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  items,
  priorities,
  templates,
  onOpenItem,
  onUpdateItem,
  onToggleFavorite,
  onTogglePin,
  onDelete,
  onRestore,
  onDuplicate,
  onSelectTag,
  isTrashMode = false,
  selectedIds = new Set(),
  isSelectMode = false,
  onToggleSelect
}) => {
  const [groupMode, setGroupMode] = useState<GroupMode>('priority');
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Group columns based on active group mode
  const columns: ColumnDef[] = useMemo(() => {
    if (groupMode === 'priority') {
      const urgentItems = items.filter((i) => i.priority?.toLowerCase() === 'urgent');
      const highItems = items.filter((i) => i.priority?.toLowerCase() === 'high');
      const mediumItems = items.filter((i) => i.priority?.toLowerCase() === 'medium');
      const lowItems = items.filter((i) => i.priority?.toLowerCase() === 'low');
      const noneItems = items.filter((i) => !i.priority);

      return [
        {
          id: 'urgent',
          title: 'Urgent',
          color: '#ef4444',
          accentBg: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          badgeBg: 'bg-red-500/20',
          badgeText: 'text-red-400',
          items: urgentItems
        },
        {
          id: 'high',
          title: 'High Priority',
          color: '#f59e0b',
          accentBg: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
          badgeBg: 'bg-amber-500/20',
          badgeText: 'text-amber-400',
          items: highItems
        },
        {
          id: 'medium',
          title: 'Medium',
          color: '#22c55e',
          accentBg: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/30',
          badgeBg: 'bg-emerald-500/20',
          badgeText: 'text-emerald-400',
          items: mediumItems
        },
        {
          id: 'low',
          title: 'Low',
          color: '#3b82f6',
          accentBg: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
          badgeBg: 'bg-blue-500/20',
          badgeText: 'text-blue-400',
          items: lowItems
        },
        {
          id: 'none',
          title: 'No Priority',
          color: '#71717a',
          accentBg: 'bg-zinc-800/40',
          borderColor: 'border-zinc-800',
          badgeBg: 'bg-zinc-800',
          badgeText: 'text-zinc-400',
          items: noneItems
        }
      ];
    }

    if (groupMode === 'status') {
      const pendingItems = items.filter((i) => !i.metadata?.is_processed);
      const processedItems = items.filter((i) => Boolean(i.metadata?.is_processed));

      return [
        {
          id: 'pending',
          title: 'Pending Triage',
          color: '#f59e0b',
          accentBg: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
          badgeBg: 'bg-amber-500/20',
          badgeText: 'text-amber-400',
          items: pendingItems
        },
        {
          id: 'processed',
          title: 'Processed / Done',
          color: '#22c55e',
          accentBg: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/30',
          badgeBg: 'bg-emerald-500/20',
          badgeText: 'text-emerald-400',
          items: processedItems
        }
      ];
    }

    // Default: Group by item type
    const notes = items.filter((i) => i.type === 'note' || !i.type);
    const forms = items.filter((i) => i.type === 'form_entry');
    const counters = items.filter((i) => i.type === 'counter');
    const bookmarks = items.filter((i) => i.type === 'bookmark');
    const posters = items.filter((i) => i.type === 'poster');

    return [
      {
        id: 'note',
        title: 'Markdown Notes',
        color: '#22c55e',
        accentBg: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
        badgeBg: 'bg-emerald-500/20',
        badgeText: 'text-emerald-400',
        items: notes
      },
      {
        id: 'form_entry',
        title: 'Form Logs',
        color: '#8b5cf6',
        accentBg: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30',
        badgeBg: 'bg-purple-500/20',
        badgeText: 'text-purple-400',
        items: forms
      },
      {
        id: 'counter',
        title: 'Counters',
        color: '#10b981',
        accentBg: 'bg-teal-500/10',
        borderColor: 'border-teal-500/30',
        badgeBg: 'bg-teal-500/20',
        badgeText: 'text-teal-400',
        items: counters
      },
      {
        id: 'bookmark',
        title: 'Bookmarks',
        color: '#3b82f6',
        accentBg: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        badgeBg: 'bg-blue-500/20',
        badgeText: 'text-blue-400',
        items: bookmarks
      },
      {
        id: 'poster',
        title: 'Media Posters',
        color: '#ec4899',
        accentBg: 'bg-pink-500/10',
        borderColor: 'border-pink-500/30',
        badgeBg: 'bg-pink-500/20',
        badgeText: 'text-pink-400',
        items: posters
      }
    ];
  }, [items, groupMode]);

  // Handle drag and drop column change
  const handleItemMoveToColumn = async (itemId: string, targetColId: string) => {
    const targetItem = items.find((i) => i.id === itemId);
    if (!targetItem) return;

    if (groupMode === 'priority') {
      const nextPriority = targetColId === 'none' ? undefined : targetColId;
      if (targetItem.priority === nextPriority) return;

      const optimistic: Item = {
        ...targetItem,
        priority: nextPriority,
        updated_at: new Date().toISOString()
      };
      onUpdateItem(optimistic);
      hapticSuccess();

      try {
        await updateItem(itemId, { priority: nextPriority || undefined });
      } catch (err) {
        console.error('Failed to move item priority', err);
        onUpdateItem(targetItem);
      }
    } else if (groupMode === 'status') {
      const isProcessed = targetColId === 'processed' ? 1 : 0;
      const currentProcessed = targetItem.metadata?.is_processed ? 1 : 0;
      if (currentProcessed === isProcessed) return;

      const newMetadata = {
        ...(targetItem.metadata || {}),
        is_processed: isProcessed,
        processed_at: isProcessed ? new Date().toISOString() : null
      };

      const optimistic: Item = {
        ...targetItem,
        metadata: newMetadata,
        updated_at: new Date().toISOString()
      };
      onUpdateItem(optimistic);
      hapticSuccess();

      try {
        await updateItem(itemId, { metadata: newMetadata });
      } catch (err) {
        console.error('Failed to move item status', err);
        onUpdateItem(targetItem);
      }
    } else if (groupMode === 'type') {
      // Type is immutable for structural integrity, notify or skip
    }
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('text/plain', itemId);
    setDraggedItemId(itemId);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverColumnId(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumnId(null);
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    setDragOverColumnId(null);
    const itemId = e.dataTransfer.getData('text/plain') || draggedItemId;
    if (itemId) {
      handleItemMoveToColumn(itemId, targetColumnId);
    }
    setDraggedItemId(null);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Board Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-brand-400" />
            <span>Group By:</span>
          </span>

          <div className="inline-flex bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setGroupMode('priority');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition touch-manipulation ${
                groupMode === 'priority'
                  ? 'bg-zinc-800 text-brand-400 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Priority
            </button>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setGroupMode('status');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition touch-manipulation ${
                groupMode === 'status'
                  ? 'bg-zinc-800 text-brand-400 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Processing Status
            </button>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setGroupMode('type');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition touch-manipulation ${
                groupMode === 'type'
                  ? 'bg-zinc-800 text-brand-400 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Item Type
            </button>
          </div>
        </div>

        <div className="text-xs text-zinc-400 flex items-center gap-1.5">
          <MoveHorizontal className="w-3.5 h-3.5 text-zinc-500" />
          <span>Drag cards between lanes to update</span>
        </div>
      </div>

      {/* Kanban Horizontal Lanes Container */}
      <div className="flex-1 overflow-x-auto pb-4 snap-x snap-mandatory flex gap-4 min-h-[500px]">
        {columns.map((col, colIdx) => {
          const isDragTarget = dragOverColumnId === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex-1 min-w-[280px] sm:min-w-[320px] max-w-[380px] rounded-2xl border transition-all duration-150 flex flex-col snap-start ${
                isDragTarget
                  ? 'border-brand-500 bg-brand-500/5 ring-2 ring-brand-500/20'
                  : 'border-zinc-800/80 bg-zinc-900/40'
              }`}
            >
              {/* Lane Header */}
              <div className="p-3.5 border-b border-zinc-800/80 flex items-center justify-between sticky top-0 bg-zinc-900/90 backdrop-blur-md rounded-t-2xl z-10">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: col.color }}
                  />
                  <h3 className="text-sm font-bold text-zinc-100 truncate">{col.title}</h3>
                </div>
                <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded-lg ${col.badgeBg} ${col.badgeText}`}>
                  {col.items.length}
                </span>
              </div>

              {/* Lane Cards List */}
              <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto">
                {col.items.length === 0 ? (
                  <div className="h-36 border-2 border-dashed border-zinc-800/60 rounded-xl flex flex-col items-center justify-center p-4 text-center">
                    <p className="text-xs text-zinc-400">Drop cards here</p>
                  </div>
                ) : (
                  col.items.map((item) => {
                    const isSelected = selectedIds.has(item.id);
                    const isBeingDragged = draggedItemId === item.id;

                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => {
                          if (isSelectMode || e.metaKey || e.ctrlKey || e.shiftKey) {
                            e.stopPropagation();
                            hapticTap();
                            onToggleSelect?.(item.id);
                            return;
                          }
                          hapticTap();
                          onOpenItem(item);
                        }}
                        className={`p-3.5 rounded-xl border transition-all duration-150 cursor-pointer shadow-md select-none group relative ${
                          isBeingDragged ? 'opacity-40 scale-95' : ''
                        } ${
                          isSelected
                            ? 'bg-brand-500/10 border-brand-500 ring-2 ring-brand-500/40'
                            : 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700/80 hover:bg-zinc-900'
                        }`}
                      >
                        {/* Card Top Row */}
                        <div className="flex items-center justify-between gap-1.5 mb-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {isSelectMode && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  hapticTap();
                                  onToggleSelect?.(item.id);
                                }}
                                className={`w-4 h-4 rounded flex items-center justify-center border transition shrink-0 ${
                                  isSelected
                                    ? 'bg-brand-500 border-brand-500 text-white'
                                    : 'bg-zinc-800 border-zinc-600 text-transparent'
                                }`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </button>
                            )}

                            {/* Type Icon Pill */}
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 shrink-0">
                              {item.type === 'counter' && <Hash className="w-3 h-3 text-emerald-400" />}
                              {item.type === 'bookmark' && <Bookmark className="w-3 h-3 text-blue-400" />}
                              {item.type === 'poster' && <Images className="w-3 h-3 text-pink-400" />}
                              {item.type === 'form_entry' && <ClipboardList className="w-3 h-3 text-brand-400" />}
                              {(item.type === 'note' || !item.type) && <FileText className="w-3 h-3 text-zinc-400" />}
                              <span>{item.type?.replace('_', ' ') || 'note'}</span>
                            </span>

                            {/* Notebook Badge */}
                            {item.notebook_name && (
                              <span className="text-[11px] text-zinc-400 truncate max-w-[100px] flex items-center gap-1">
                                <Folder className="w-3 h-3 text-zinc-500 shrink-0" />
                                <span className="truncate">{item.notebook_name}</span>
                              </span>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                hapticTap();
                                onTogglePin(item);
                              }}
                              className={`p-1 rounded transition ${
                                item.is_pinned
                                  ? 'text-brand-400 bg-brand-500/10'
                                  : 'text-zinc-400 hover:text-zinc-300'
                              }`}
                              title={item.is_pinned ? 'Unpin' : 'Pin to top'}
                            >
                              <Pin className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                hapticTap();
                                onToggleFavorite(item);
                              }}
                              className={`p-1 rounded transition ${
                                item.is_favorite
                                  ? 'text-amber-400 bg-amber-500/10'
                                  : 'text-zinc-400 hover:text-zinc-300'
                              }`}
                              title={item.is_favorite ? 'Favorited' : 'Add to favorites'}
                            >
                              <Star className={`w-3 h-3 ${item.is_favorite ? 'fill-amber-400' : ''}`} />
                            </button>

                            {onDuplicate && !isTrashMode && (
                              <button
                                type="button"
                                onClick={() => {
                                  hapticTap();
                                  onDuplicate(item);
                                }}
                                className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition touch-manipulation"
                                title="Duplicate item"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Title */}
                        <h4 className="text-xs font-bold text-zinc-100 group-hover:text-white line-clamp-2 mb-1.5">
                          {item.title || 'Untitled'}
                        </h4>

                        {/* Content preview or counter tally */}
                        {item.type === 'counter' ? (
                          <div className="flex items-center gap-2 my-1">
                            <span className="text-lg font-black text-emerald-400 font-mono">
                              {item.metadata?.value ?? 0}
                            </span>
                            <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                              {item.metadata?.step ? `Step: ±${item.metadata.step}` : 'Tally'}
                            </span>
                          </div>
                        ) : item.type === 'form_entry' ? (
                          <div className="text-[11px] text-zinc-400 bg-zinc-950/40 p-1.5 rounded-lg border border-zinc-800/60 mb-2 truncate">
                            <span className="text-brand-400 font-semibold">{item.metadata?.template_name || 'Form'}:</span>{' '}
                            {Object.entries(item.metadata?.values || {})
                              .slice(0, 2)
                              .map(([k, v]) => `${k}: ${String(v)}`)
                              .join(' • ') || 'Empty entry'}
                          </div>
                        ) : (
                          item.content && (
                            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed mb-2 font-mono">
                              {item.content.replace(/[#*`_\[\]()]/g, '')}
                            </p>
                          )
                        )}

                        {/* Card Footer: Tags & Nudge Arrow Buttons */}
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-800/60">
                          {/* Tags */}
                          <div className="flex items-center gap-1 overflow-hidden truncate">
                            {item.tags && item.tags.length > 0 ? (
                              item.tags.slice(0, 2).map((t, i) => {
                                const tagName = typeof t === 'string' ? t : t.name;
                                return (
                                  <span
                                    key={i}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectTag?.(tagName);
                                    }}
                                    className="text-[10px] text-zinc-400 hover:text-brand-400 bg-zinc-800/80 px-1.5 py-0.5 rounded truncate"
                                  >
                                    #{tagName.replace(/^#/, '')}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[10px] text-zinc-400">
                                {new Date(item.updated_at).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            )}
                          </div>

                          {/* Quick Mobile Column Nudge Buttons */}
                          {groupMode !== 'type' && (
                            <div
                              className="flex items-center gap-0.5 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {colIdx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleItemMoveToColumn(item.id, columns[colIdx - 1].id)}
                                  className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition touch-manipulation"
                                  title={`Move to ${columns[colIdx - 1].title}`}
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {colIdx < columns.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleItemMoveToColumn(item.id, columns[colIdx + 1].id)}
                                  className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition touch-manipulation"
                                  title={`Move to ${columns[colIdx + 1].title}`}
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
