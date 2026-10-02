import React from 'react';
import { Item, NotePriority } from '../../types/index.js';
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
  List
} from 'lucide-react';
import { counterAction } from '../../api/index.js';
import { hapticMedium, hapticTap } from '../../services/native.js';
import { analyzeNoteContent } from '../../utils/markdownList.js';

interface ItemListItemProps {
  item: Item;
  priorities?: NotePriority[];
  onOpen: (item: Item) => void;
  onUpdate: (item: Item) => void;
  onToggleFavorite: (item: Item) => void;
  onTogglePin: (item: Item) => void;
  onToggleProcessed?: (item: Item) => void;
  onDelete: (id: string) => void;
}

export const ItemListItem: React.FC<ItemListItemProps> = ({
  item,
  priorities = [],
  onOpen,
  onUpdate,
  onToggleFavorite,
  onTogglePin,
  onToggleProcessed,
  onDelete
}) => {
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

  return (
    <div
      onClick={() => onOpen(item)}
      className={`group flex items-center justify-between gap-3 p-3 sm:py-2.5 sm:px-4 rounded-xl border transition-all duration-150 shadow-sm cursor-pointer active:scale-[0.99] touch-manipulation ${
        isProcessed
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
        {/* Type Icon Badge */}
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${typeConfig.bg}`}>
          {typeConfig.icon}
        </div>

        {/* Title & Metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`font-bold text-sm sm:text-base truncate transition-colors ${
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
                className={`h-6 px-2 rounded-md flex items-center gap-1 text-[11px] font-semibold transition active:scale-95 touch-manipulation shrink-0 ${
                  isProcessed
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 border border-zinc-700/60'
                }`}
                title={isProcessed ? 'Marked as Seen / Processed (click to unmark)' : 'Mark as Seen / Processed'}
              >
                {isProcessed ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 fill-emerald-400/20" />
                    <span>Seen</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-3 h-3 text-zinc-500" />
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
          </div>
        </div>
      </div>

      {/* Right: Quick Actions & Details */}
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Counter Quick Stepper in List View */}
        {item.type === 'counter' && (
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={(e) => handleQuickAdjust(e, -(item.metadata?.step || 1))}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              title="Decrement"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-mono font-bold text-xs text-zinc-200 px-1 min-w-[28px] text-center">
              {item.metadata?.count ?? 0}
            </span>
            <button
              type="button"
              onClick={(e) => handleQuickAdjust(e, item.metadata?.step || 1)}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              title="Increment"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Date */}
        <span className="text-xs text-zinc-400 hidden sm:inline">
          {new Date(item.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </span>

        {/* Action Buttons */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onToggleFavorite(item)}
            className={`h-9 w-9 flex items-center justify-center rounded-lg transition touch-manipulation ${
              item.is_favorite
                ? 'text-amber-400 bg-amber-400/10'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="Favorite"
          >
            <Star className={`w-3.5 h-3.5 ${item.is_favorite ? 'fill-amber-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => onTogglePin(item)}
            className={`h-9 w-9 flex items-center justify-center rounded-lg transition touch-manipulation ${
              item.is_pinned
                ? 'text-brand-400 bg-brand-400/10'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="Pin to top"
          >
            <Pin className={`w-3.5 h-3.5 ${item.is_pinned ? 'fill-brand-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition touch-manipulation"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
