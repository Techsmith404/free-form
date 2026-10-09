import React, { useState, useEffect, useMemo } from 'react';
import { Item, NotePriority } from '../../types/index.js';
import {
  CheckSquare,
  List,
  ListOrdered,
  Star,
  Pin,
  Trash2,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';
import { updateItem } from '../../api/index.js';
import { hapticTap } from '../../services/native.js';
import {
  analyzeNoteContent,
  toggleChecklistItemByLine,
  renderInlineMarkdownHtml,
  ChecklistItemData,
  BulletItemData,
  HeadingItemData,
  BlockquoteItemData,
  TextItemData
} from '../../utils/markdownList.js';

interface ListCardProps {
  item: Item;
  priorities?: NotePriority[];
  isExpanded?: boolean;
  onOpen: (item: Item) => void;
  onUpdate?: (updated: Item) => void;
  onToggleFavorite: (item: Item) => void;
  onTogglePin: (item: Item) => void;
  onDelete: (id: string) => void;
}

export const ListCard: React.FC<ListCardProps> = ({
  item,
  priorities = [],
  isExpanded = false,
  onOpen,
  onUpdate,
  onToggleFavorite,
  onTogglePin,
  onDelete
}) => {
  const priority = priorities.find((p) => p.id === item.priority);

  // Local content state to provide instant optimistic feedback when ticking checkboxes
  const [localContent, setLocalContent] = useState<string>(item.content || '');

  useEffect(() => {
    setLocalContent(item.content || '');
  }, [item.content]);

  // Local card expand override: null means inherit from parent isExpanded
  const [localExpanded, setLocalExpanded] = useState<boolean | null>(null);

  useEffect(() => {
    // Reset local override when global isExpanded changes
    setLocalExpanded(null);
  }, [isExpanded]);

  const expanded = localExpanded !== null ? localExpanded : isExpanded;

  // Analyze content
  const analysis = useMemo(
    () => analyzeNoteContent(localContent, item.title),
    [localContent, item.title]
  );

  const {
    isChecklist,
    checklistCount,
    checkedCount,
    totalListCount,
    parsedLines,
    preamble
  } = analysis;

  const isAllCompleted = checklistCount > 0 && checkedCount === checklistCount;
  const progressPercent = checklistCount > 0 ? Math.round((checkedCount / checklistCount) * 100) : 0;

  // Filter lines to display in the list body
  const displayLines = useMemo(() => {
    return parsedLines.filter((l) => {
      if (l.type === 'heading') {
        // Only omit heading if it's identical to item.title to avoid duplicate header
        if (item.title && l.text.toLowerCase() === item.title.trim().toLowerCase()) return false;
      }
      if (l.type === 'text' && preamble && l.text.toLowerCase() === preamble.trim().toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [parsedLines, item.title, preamble]);

  // Toggle checklist checkbox
  const handleToggleLine = async (lineIndex: number) => {
    hapticTap();
    const nextContent = toggleChecklistItemByLine(localContent, lineIndex);
    setLocalContent(nextContent);

    const optimisticItem: Item = {
      ...item,
      content: nextContent,
      updated_at: new Date().toISOString()
    };
    if (onUpdate) onUpdate(optimisticItem);

    try {
      const updated = await updateItem(item.id, { content: nextContent });
      if (onUpdate) onUpdate(updated);
    } catch (err) {
      console.error('Failed to toggle checklist item', err);
      // Revert optimistic change
      setLocalContent(item.content);
      if (onUpdate) onUpdate(item);
    }
  };

  // Visible items when collapsed vs expanded
  const MAX_COLLAPSED_ITEMS = 5;
  const hasOverflow = displayLines.length > MAX_COLLAPSED_ITEMS;
  const visibleLines = expanded ? displayLines : displayLines.slice(0, MAX_COLLAPSED_ITEMS);
  const remainingCount = displayLines.length - MAX_COLLAPSED_ITEMS;

  return (
    <div
      onClick={() => onOpen(item)}
      className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-zinc-900/95 border border-zinc-800 hover:border-zinc-700/80 transition-all duration-200 shadow-md shadow-black/30 ring-1 ring-white/5 cursor-pointer group active:scale-[0.99]"
      style={
        priority
          ? {
              borderLeftColor: priority.color,
              borderLeftWidth: '4px'
            }
          : undefined
      }
    >
      <div>
        {/* Card Header Bar */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden">
            {isChecklist ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 rounded-lg shrink-0">
                <CheckSquare className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Checklist</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30 rounded-lg shrink-0">
                <ListOrdered className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                <span>List</span>
              </span>
            )}

            {/* Checklist progress pill or list item count */}
            {isChecklist ? (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md border shrink-0 transition-colors ${
                  isAllCompleted
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                    : 'bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-700/60'
                }`}
              >
                {isAllCompleted ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                    <span>All completed</span>
                  </>
                ) : (
                  <span>
                    {checkedCount}/{checklistCount} done
                  </span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-700/60 shrink-0">
                <span>{totalListCount} items</span>
              </span>
            )}

            {priority && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md border shrink-0"
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

            {item.notebook_name && (
              <span className="text-xs font-medium text-zinc-400 truncate min-w-0 max-w-[130px]">
                {item.notebook_name}
              </span>
            )}

            {Boolean(item.hide_from_all) && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-amber-500 dark:text-amber-400 bg-amber-400/10 border border-amber-400/25 rounded-md shrink-0"
                title="Hidden from All Items feed"
              >
                <EyeOff className="w-3 h-3" />
                <span className="hidden sm:inline">Hidden</span>
              </span>
            )}
          </div>

          <div
            className="flex items-center gap-0.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Toggle Card Expand */}
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setLocalExpanded(!expanded);
              }}
              className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition touch-manipulation"
              title={expanded ? 'Collapse preview' : 'Show all items'}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                hapticTap();
                onToggleFavorite(item);
              }}
              className={`h-10 w-10 flex items-center justify-center rounded-lg transition touch-manipulation ${
                item.is_favorite
                  ? 'text-amber-400 bg-amber-400/10'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
              title="Favorite"
            >
              <Star className={`w-4 h-4 ${item.is_favorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onTogglePin(item);
              }}
              className={`h-10 w-10 flex items-center justify-center rounded-lg transition touch-manipulation ${
                item.is_pinned
                  ? 'text-brand-400 bg-brand-400/10'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
              title="Pin to top"
            >
              <Pin className={`w-4 h-4 ${item.is_pinned ? 'fill-brand-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onDelete(item.id);
              }}
              className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition touch-manipulation"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3
          className={`font-bold text-zinc-100 text-lg sm:text-xl leading-snug transition-colors ${
            isChecklist ? 'group-hover:text-indigo-400' : 'group-hover:text-sky-400'
          }`}
        >
          {item.title}
        </h3>

        {/* Checklist Completion Progress Bar */}
        {isChecklist && checklistCount > 0 && (
          <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden ring-1 ring-white/5 my-2.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                isAllCompleted
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-indigo-500 to-indigo-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Optional Preamble / Subtitle */}
        {preamble && (
          <div
            className="note-markdown text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 italic mb-2 [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100 [&_em]:text-zinc-800 dark:[&_em]:text-zinc-200"
            dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(preamble) }}
          />
        )}

        {/* List Content Rows */}
        <div className="mt-2 space-y-1">
          {visibleLines.map((line, idx) => {
            if (line.type === 'checklist') {
              return (
                <div
                  key={`check-${line.lineIndex}-${idx}`}
                  style={{ paddingLeft: `${Math.min(line.indent * 8, 24)}px` }}
                  className="flex items-start gap-2.5 py-1 px-1.5 rounded-xl hover:bg-zinc-800/40 transition-colors group/item"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLine(line.lineIndex);
                    }}
                    aria-label={line.checked ? 'Mark uncompleted' : 'Mark completed'}
                    className={`w-5 h-5 min-w-[20px] mt-0.5 rounded-md border flex items-center justify-center transition-all duration-150 touch-manipulation cursor-pointer ${
                      line.checked
                        ? isAllCompleted
                          ? 'bg-emerald-500/25 border-emerald-500/70 text-emerald-600 dark:text-emerald-300'
                          : 'bg-indigo-600/30 border-indigo-500 text-indigo-600 dark:text-indigo-300 shadow-sm shadow-indigo-500/20'
                        : 'border-zinc-400 dark:border-zinc-600 bg-zinc-800/80 hover:border-zinc-500 dark:hover:border-zinc-400 group-hover/item:border-zinc-500'
                    }`}
                  >
                    {line.checked && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  </button>
                  <span
                    className={`note-markdown inline text-sm leading-relaxed select-none transition-colors ${
                      line.checked
                        ? 'line-through text-zinc-500 decoration-zinc-500/70 [&_strong]:text-zinc-500 [&_em]:text-zinc-500 [&_code]:text-zinc-500'
                        : 'text-zinc-800 dark:text-zinc-200'
                    }`}
                    dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(line.text) }}
                  />
                </div>
              );
            }

            if (line.type === 'bullet') {
              return (
                <div
                  key={`bullet-${line.lineIndex}-${idx}`}
                  style={{ paddingLeft: `${Math.min(line.indent * 8, 24)}px` }}
                  className="flex items-start gap-2.5 py-1 px-2 rounded-xl bg-zinc-800/40 dark:bg-zinc-800/20 border border-zinc-200 dark:border-zinc-800/40 transition-colors"
                >
                  {line.isOrdered ? (
                    <span className="w-5 h-5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-300 font-mono text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      {line.marker.replace('.', '')}
                    </span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400 shrink-0 mt-2 shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
                  )}
                  <span
                    className="note-markdown inline text-sm leading-relaxed text-zinc-800 dark:text-zinc-200"
                    dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(line.text) }}
                  />
                </div>
              );
            }

            if (line.type === 'heading') {
              const isH1 = line.level === 1;
              const isH2 = line.level === 2;
              return (
                <div
                  key={`head-${line.lineIndex}-${idx}`}
                  className={`note-markdown ${
                    isH1
                      ? 'pt-3 pb-1 text-base font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 border-b border-zinc-200 dark:border-zinc-800'
                      : isH2
                      ? 'pt-2 pb-0.5 text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-100 border-b border-zinc-200/60 dark:border-zinc-800/60'
                      : 'pt-1.5 pb-0.5 text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300'
                  }`}
                  dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(line.text) }}
                />
              );
            }

            if (line.type === 'blockquote') {
              return (
                <div
                  key={`quote-${line.lineIndex}-${idx}`}
                  className="note-markdown my-1.5 pl-3 pr-2 py-1 rounded-r-lg border-l-[3px] border-emerald-500 bg-zinc-200/60 dark:bg-zinc-800/50 text-xs sm:text-sm italic text-zinc-700 dark:text-zinc-300"
                  dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(line.text) }}
                />
              );
            }

            // Paragraph / text
            if (line.text.startsWith('>')) {
              const quoteText = line.text.replace(/^>\s*/, '');
              return (
                <div
                  key={`text-quote-${line.lineIndex}-${idx}`}
                  className="note-markdown my-1.5 pl-3 pr-2 py-1 rounded-r-lg border-l-[3px] border-emerald-500 bg-zinc-200/60 dark:bg-zinc-800/50 text-xs sm:text-sm italic text-zinc-700 dark:text-zinc-300"
                  dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(quoteText) }}
                />
              );
            }

            return (
              <div
                key={`text-${line.lineIndex}-${idx}`}
                className="note-markdown text-xs text-zinc-700 dark:text-zinc-300 py-0.5 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(line.text) }}
              />
            );
          })}

          {/* Collapsed + More Items pill */}
          {!expanded && hasOverflow && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                hapticTap();
                setLocalExpanded(true);
              }}
              className="pt-1 flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <span className="px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 hover:bg-zinc-700 transition">
                + {remainingCount} more {remainingCount === 1 ? 'item' : 'items'} (tap to show all)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="mt-5 pt-3 border-t border-zinc-800/90 flex items-center justify-between text-xs text-zinc-400">
        <span className="font-medium">
          {new Date(item.updated_at).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </span>
        {item.tags && item.tags.length > 0 && (
          <div className="flex gap-1.5 overflow-hidden">
            {item.tags.slice(0, 2).map((t, idx) => {
              const name = typeof t === 'string' ? t : t.name;
              const key = typeof t === 'string' ? `${t}-${idx}` : t.id;
              return (
                <span
                  key={key}
                  className="text-xs text-zinc-300 px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700/60 font-medium"
                >
                  #{name}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
