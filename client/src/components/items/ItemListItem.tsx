import React from 'react';
import { Item, NotePriority, DensityMode } from '../../types/index.js';
import {
  FileText,
  ClipboardList,
  Hash,
  Bookmark,
  Images,
  Star,
  Pin,
  Trash2,
  EyeOff,
  ExternalLink,
  Plus,
  Minus,
  CheckCircle2,
  Circle,
  CheckSquare,
  List,
  RotateCcw,
  Check,
  Copy
} from 'lucide-react';
import { counterAction } from '../../api/index.js';
import { hapticMedium, hapticSuccess, hapticTap } from '../../services/native.js';
import { analyzeNoteContent } from '../../utils/markdownList.js';

interface ItemListItemProps {
  item: Item;
  density?: DensityMode;
  priorities?: NotePriority[];
  isTrashMode?: boolean;
  onOpen: (item: Item) => void;
  onUpdate: (item: Item) => void;
  onToggleFavorite: (item: Item) => void;
  onTogglePin: (item: Item) => void;
  onToggleProcessed?: (item: Item) => void;
  onDelete: (id: string) => void;
  onRestore?: (item: Item) => void;
  onDuplicate?: (item: Item) => void;
  onSelectTag?: (tag: string) => void;
  isSelected?: boolean;
  isSelectMode?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const ItemListItem: React.FC<ItemListItemProps> = ({
  item,
  density = 'cozy',
  priorities = [],
  isTrashMode = false,
  onOpen,
  onUpdate,
  onToggleFavorite,
  onTogglePin,
  onToggleProcessed,
  onDelete,
  onRestore,
  onDuplicate,
  onSelectTag,
  isSelected = false,
  isSelectMode = false,
  onToggleSelect
}) => {
  const isTrash = isTrashMode || Boolean(item.is_archived);
  const priority = priorities.find((p) => p.id === item.priority);
  const isProcessed = Boolean(item.metadata?.is_processed);

  // Type badge configurations
  const getTypeConfig = () => {
    switch (item.type) {
      case 'form_entry':
        return {
          icon: <ClipboardList className="w-4 h-4 text-brand-400" />,
          label: item.metadata?.template_name || 'Form',
          bg: isProcessed
            ? 'bg-zinc-800 text-zinc-400 border-zinc-700/60'
            : 'bg-brand-500/10 text-brand-400 border-brand-500/25'
        };
      case 'counter':
        return {
          icon: <Hash className="w-4 h-4 text-emerald-400" />,
          label: 'Counter',
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
        };
      case 'bookmark':
        return {
          icon: <Bookmark className="w-4 h-4 text-blue-400" />,
          label: 'Bookmark',
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/25'
        };
      case 'poster':
        return {
          icon: <Images className="w-4 h-4 text-purple-400" />,
          label: 'Poster',
          bg: 'bg-purple-500/10 text-purple-400 border-purple-500/25'
        };
      case 'note':
      default: {
        const analysis = analyzeNoteContent(item.content, item.title);
        if (analysis.isChecklist) {
          return {
            icon: <CheckSquare className="w-4 h-4 text-indigo-400" />,
            label: 'Checklist',
            bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25'
          };
        }
        if (analysis.isStandardList) {
          return {
            icon: <List className="w-4 h-4 text-sky-400" />,
            label: 'List',
            bg: 'bg-sky-500/10 text-sky-400 border-sky-500/25'
          };
        }
        return {
          icon: <FileText className="w-4 h-4 text-brand-400" />,
          label: 'Note',
          bg: 'bg-zinc-800 text-zinc-300 border-zinc-700/60'
        };
      }
    }
  };

  const typeConfig = getTypeConfig();

  // Quick Counter Adjustment
  const handleQuickAdjust = async (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    hapticMedium();
    try {
      const res = await counterAction(item.id, { delta });
      onUpdate({
        ...item,
        metadata: res.metadata
      });
    } catch (err) {
      console.error('Failed to adjust counter', err);
    }
  };

  const handleToggleProcessed = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticTap();
    if (onToggleProcessed) {
      onToggleProcessed(item);
    } else {
      onUpdate({
        ...item,
        metadata: {
          ...(item.metadata || {}),
          is_processed: !isProcessed,
          processed_at: !isProcessed ? new Date().toISOString() : null
        }
      });
    }
  };

  // Preview snippet
  const getSubtitle = () => {
    switch (item.type) {
      case 'counter':
        return `Count: ${item.metadata?.count ?? 0} ${item.metadata?.unit || ''}`.trim();
      case 'bookmark':
        return item.metadata?.url ? item.metadata.url.replace(/^https?:\/\//, '') : 'No URL';
      case 'poster':
        const count = item.metadata?.images?.length || 0;
        return `${count} photo${count === 1 ? '' : 's'}`;
      case 'form_entry':
        return item.metadata?.template_name ? `Form: ${item.metadata.template_name}` : 'Form entry';
      case 'note':
      default: {
        const analysis = analyzeNoteContent(item.content, item.title);
        return analysis.summaryText;
      }
    }
  };

  const noteAnalysis = item.type === 'note' ? analyzeNoteContent(item.content, item.title) : null;

  const handleItemClick = (e: React.MouseEvent) => {
    if (isSelectMode || e.metaKey || e.ctrlKey || e.shiftKey) {
      e.stopPropagation();
      hapticTap();
      onToggleSelect?.(item.id);
      return;
    }
    onOpen(item);
  };

  const paddingClass =
    density === 'compact'
      ? 'p-2 sm:py-1.5 sm:px-3'
      : density === 'comfortable'
        ? 'p-2.5 sm:py-2 sm:px-3.5'
        : 'p-3 sm:py-2.5 sm:px-4';

  const iconBoxClass =
    density === 'compact'
      ? 'w-8 h-8 rounded-lg border flex items-center justify-center shrink-0'
      : density === 'comfortable'
        ? 'w-8.5 h-8.5 rounded-lg border flex items-center justify-center shrink-0'
        : 'w-9 h-9 rounded-lg border flex items-center justify-center shrink-0';

  const titleClass =
    density === 'compact'
      ? 'font-bold text-xs sm:text-sm truncate transition-colors'
      : 'font-bold text-sm sm:text-base truncate transition-colors';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${typeConfig.label}: ${item.title}`}
      onClick={handleItemClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            handleItemClick(e as any);
          }
        }
      }}
      className={`group flex items-center justify-between gap-3 ${paddingClass} rounded-xl border transition-all duration-150 shadow-sm cursor-pointer active:scale-[0.99] touch-manipulation focus:outline-none focus:ring-2 focus:ring-brand-500/50 ${
        isSelected
          ? 'border-brand-500 ring-2 ring-brand-500/40 bg-brand-500/5'
          : isProcessed
          ? 'opacity-60 grayscale-[35%] bg-zinc-950/40 border-dashed border-zinc-800/90 hover:opacity-100 hover:grayscale-0'
          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
      }`}
      style={
        priority
          ? {
              borderLeftColor: priority.color,
              borderLeftWidth: '4px'
            }
          : undefined
      }
    >
      {/* Left: Icon & Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {isSelectMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              hapticTap();
              onToggleSelect?.(item.id);
            }}
            className={`min-h-[44px] min-w-[44px] p-2.5 rounded-md flex items-center justify-center border transition touch-manipulation shrink-0 ${
              isSelected
                ? 'bg-brand-500 border-brand-500 text-white shadow-sm'
                : 'bg-zinc-800 border-zinc-600 text-transparent hover:border-zinc-400'
            }`}
            title={isSelected ? 'Deselect' : 'Select'}
            aria-label={isSelected ? `Deselect ${item.title}` : `Select ${item.title}`}
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}
        {/* Type Icon Badge */}
        <div className={`${iconBoxClass} ${typeConfig.bg}`}>
          {typeConfig.icon}
        </div>

        {/* Title & Metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`${titleClass} ${
              isProcessed
                ? 'text-zinc-400 line-through decoration-zinc-600'
                : 'text-zinc-100 group-hover:text-brand-400'
            }`}>
              {item.title}
            </h4>

            {/* Checklist progress pill in List view */}
            {noteAnalysis && noteAnalysis.hasChecklist && (
              <span
                className={`h-5 px-1.5 rounded flex items-center gap-1 text-[11px] font-semibold border shrink-0 ${
                  noteAnalysis.checkedCount === noteAnalysis.checklistCount && noteAnalysis.checklistCount > 0
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700/60'
                }`}
              >
                <CheckSquare className="w-2.5 h-2.5 text-indigo-400" />
                <span>
                  {noteAnalysis.checkedCount}/{noteAnalysis.checklistCount}
                </span>
              </span>
            )}

            {/* 1-Tap Processed Button in List Row */}
            {item.type === 'form_entry' && (
              <button
                type="button"
                onClick={handleToggleProcessed}
                aria-label={isProcessed ? `Mark ${item.title} as pending` : `Mark ${item.title} as seen`}
                className={`min-h-[44px] px-2.5 rounded-md flex items-center gap-1 text-[11px] font-semibold transition active:scale-95 touch-manipulation shrink-0 ${
                  isProcessed
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 border border-zinc-700/60'
                }`}
                title={isProcessed ? 'Marked as Seen / Processed (click to unmark)' : 'Mark as Seen / Processed'}
              >
                {isProcessed ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20" />
                    <span>Seen</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Mark Seen</span>
                  </>
                )}
              </button>
            )}

            {/* Priority Pill */}
            {priority && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 border"
                style={{
                  backgroundColor: `${priority.color}15`,
                  color: priority.color,
                  borderColor: `${priority.color}35`
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priority.color }} />
                <span>{priority.label}</span>
              </span>
            )}

            {/* Hidden Flag */}
            {Boolean(item.hide_from_all) && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/25 rounded">
                <EyeOff className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">Hidden</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400 truncate">
            {item.notebook_name && (
              <span className="text-zinc-400 font-medium shrink-0">
                in {item.notebook_name} •
              </span>
            )}
            <span className="truncate text-zinc-500">
              {getSubtitle()}
            </span>
            {item.tags && item.tags.length > 0 && (
              <div className="hidden sm:flex items-center gap-1 shrink-0 ml-1">
                {item.tags.slice(0, 2).map((t, idx) => {
                  const name = typeof t === 'string' ? t : t.name;
                  const key = typeof t === 'string' ? `${t}-${idx}` : t.id;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticTap();
                        onSelectTag?.(name);
                      }}
                      className="text-[10px] text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700/60 font-medium transition cursor-pointer touch-manipulation min-h-[32px] flex items-center"
                      title={`Filter by #${name}`}
                      aria-label={`Filter by tag ${name}`}
                    >
                      #{name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Quick Actions & Details */}
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Counter Quick Stepper in List View */}
        {item.type === 'counter' && !isTrash && (
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={(e) => handleQuickAdjust(e, -(item.metadata?.step || 1))}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition touch-manipulation"
              title="Decrement"
              aria-label={`Subtract ${item.metadata?.step || 1} from ${item.title}`}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono font-bold text-xs text-zinc-200 px-1 min-w-[28px] text-center">
              {item.metadata?.count ?? 0}
            </span>
            <button
              type="button"
              onClick={(e) => handleQuickAdjust(e, item.metadata?.step || 1)}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition touch-manipulation"
              title="Increment"
              aria-label={`Add ${item.metadata?.step || 1} to ${item.title}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Date */}
        <span className="text-xs text-zinc-400 hidden sm:inline">
          {new Date(item.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </span>

        {/* Action Buttons */}
        <div className="flex items-center gap-0.5">
          {isTrash ? (
            <button
              type="button"
              onClick={() => {
                hapticSuccess();
                if (onRestore) onRestore(item);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition touch-manipulation"
              title="Restore from Trash"
              aria-label={`Restore ${item.title} from trash`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onToggleFavorite(item)}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition touch-manipulation ${
                  item.is_favorite
                    ? 'text-amber-400 bg-amber-400/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
                title="Favorite"
                aria-label={item.is_favorite ? `Unfavorite ${item.title}` : `Favorite ${item.title}`}
              >
                <Star className={`w-4 h-4 ${item.is_favorite ? 'fill-amber-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => onTogglePin(item)}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition touch-manipulation ${
                  item.is_pinned
                    ? 'text-brand-400 bg-brand-400/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
                title="Pin to top"
                aria-label={item.is_pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
              >
                <Pin className={`w-4 h-4 ${item.is_pinned ? 'fill-brand-400' : ''}`} />
              </button>
              {onDuplicate && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticTap();
                    onDuplicate(item);
                  }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition touch-manipulation"
                  title="Duplicate item"
                  aria-label={`Duplicate ${item.title}`}
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition touch-manipulation"
            title={isTrash ? 'Permanently Delete' : 'Delete'}
            aria-label={isTrash ? `Permanently delete ${item.title}` : `Move ${item.title} to trash`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
