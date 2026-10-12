import React, { useState, useEffect, useMemo } from 'react';
import { Item, Tag, NotePriority, DensityMode } from '../../types/index.js';
import { FileText, Star, Pin, Trash2, EyeOff, ChevronDown, ChevronUp, CheckSquare, RotateCcw, Check, Copy } from 'lucide-react';
import { updateItem } from '../../api/index.js';
import { hapticSuccess, hapticTap } from '../../services/native.js';
import {
  analyzeNoteContent,
  renderInteractiveMarkdownHtml,
  toggleChecklistItemByIndex
} from '../../utils/markdownList.js';
import { wikilinkFromEvent } from '../../utils/wikilinks.js';
import { ListCard } from './ListCard.js';

interface NoteCardProps {
  item: Item;
  priorities?: NotePriority[];
  density?: DensityMode;
  isExpanded?: boolean;
  isTrashMode?: boolean;
  onOpen: (item: Item) => void;
  onUpdate?: (updated: Item) => void;
  onToggleFavorite: (item: Item) => void;
  onTogglePin: (item: Item) => void;
  onDelete: (id: string) => void;
  onRestore?: (item: Item) => void;
  onDuplicate?: (item: Item) => void;
  onSelectTag?: (tag: string) => void;
  onNavigateWikilink?: (title: string) => void;
  isSelected?: boolean;
  isSelectMode?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  item,
  priorities = [],
  density = 'cozy',
  isExpanded = false,
  isTrashMode = false,
  onOpen,
  onUpdate,
  onToggleFavorite,
  onTogglePin,
  onDelete,
  onRestore,
  onDuplicate,
  onSelectTag,
  onNavigateWikilink,
  isSelected = false,
  isSelectMode = false,
  onToggleSelect
}) => {
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

  // Analyze content to see if it qualifies for the special List/Checklist Card presentation
  const analysis = useMemo(
    () => analyzeNoteContent(localContent, item.title),
    [localContent, item.title]
  );

  // If the note is predominantly a checklist or list, elevate to the special ListCard presentation
  if (analysis.isMajorityList) {
    return (
      <ListCard
        item={item}
        priorities={priorities}
        density={density}
        isExpanded={isExpanded}
        isTrashMode={isTrashMode}
        onOpen={onOpen}
        onUpdate={onUpdate}
        onToggleFavorite={onToggleFavorite}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
        onRestore={onRestore}
        onDuplicate={onDuplicate}
        onSelectTag={onSelectTag}
        onNavigateWikilink={onNavigateWikilink}
        isSelected={isSelected}
        isSelectMode={isSelectMode}
        onToggleSelect={onToggleSelect}
      />
    );
  }

  const priority = priorities.find((p) => p.id === item.priority);
  const isTrash = isTrashMode || Boolean(item.is_archived);

  // Render markdown to formatted HTML with interactive checkboxes
  const parsedHtml = useMemo(() => {
    return renderInteractiveMarkdownHtml(localContent);
  }, [localContent]);

  // Handle clicking checklist checkboxes or wikilinks directly inside the note card preview
  const handleMarkdownClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTrash) return;

    const wikilink = wikilinkFromEvent(e);
    if (wikilink) {
      e.stopPropagation();
      e.preventDefault();
      hapticTap();
      onNavigateWikilink?.(wikilink);
      return;
    }

    const target = e.target as HTMLElement;
    const checkboxInput = target.closest('input[type="checkbox"][data-checklist-index]') as HTMLInputElement | null;
    if (!checkboxInput) return;

    // Stop event propagation so card open modal is not triggered
    e.stopPropagation();
    const rawIdx = checkboxInput.getAttribute('data-checklist-index');
    if (rawIdx === null) return;

    const checklistIndex = parseInt(rawIdx, 10);
    if (isNaN(checklistIndex)) return;

    hapticTap();
    const nextContent = toggleChecklistItemByIndex(localContent, checklistIndex);
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
      console.error('Failed to toggle checklist item in note preview', err);
      // Revert optimistic change
      setLocalContent(item.content);
      if (onUpdate) onUpdate(item);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectMode || e.metaKey || e.ctrlKey || e.shiftKey) {
      e.stopPropagation();
      hapticTap();
      onToggleSelect?.(item.id);
      return;
    }
    onOpen(item);
  };

  const paddingClass = density === 'compact'
    ? 'p-2.5 sm:p-3'
    : density === 'comfortable'
      ? 'p-3.5 sm:p-4'
      : 'p-4 sm:p-5';

  const titleClass = density === 'compact'
    ? 'font-bold text-zinc-100 text-base leading-snug group-hover:text-brand-400 transition-colors'
    : density === 'comfortable'
      ? 'font-bold text-zinc-100 text-base sm:text-lg leading-snug group-hover:text-brand-400 transition-colors'
      : 'font-bold text-zinc-100 text-lg sm:text-xl leading-snug group-hover:text-brand-400 transition-colors';

  const previewClampClass = density === 'compact'
    ? 'max-h-20 sm:max-h-24'
    : density === 'comfortable'
      ? 'max-h-32 sm:max-h-36'
      : 'max-h-40 sm:max-h-48';

  const footerClass = density === 'compact'
    ? 'mt-2.5 pt-1.5 border-t border-zinc-800/90 flex items-center justify-between text-xs text-zinc-400'
    : density === 'comfortable'
      ? 'mt-3.5 pt-2 border-t border-zinc-800/90 flex items-center justify-between text-xs text-zinc-400'
      : 'mt-5 pt-3 border-t border-zinc-800/90 flex items-center justify-between text-xs text-zinc-400';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open note: ${item.title || 'Untitled'}`}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            handleCardClick(e as any);
          }
        }
      }}
      className={`flex flex-col justify-between ${paddingClass} rounded-2xl bg-zinc-900/95 border transition-all duration-200 shadow-md shadow-black/30 cursor-pointer group active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${
        isSelected
          ? 'border-brand-500 ring-2 ring-brand-500/40 bg-brand-500/5'
          : 'border-zinc-800 hover:border-zinc-700/80 ring-1 ring-white/5'
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
      <div>
        {/* Card Header Bar */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden">
            {isSelectMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  hapticTap();
                  onToggleSelect?.(item.id);
                }}
                className={`w-5 h-5 rounded-md flex items-center justify-center border transition touch-manipulation shrink-0 ${
                  isSelected
                    ? 'bg-brand-500 border-brand-500 text-white shadow-sm'
                    : 'bg-zinc-800 border-zinc-600 text-transparent hover:border-zinc-400'
                }`}
                title={isSelected ? 'Deselect' : 'Select'}
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-700 rounded-lg shrink-0">
              <FileText className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400" />
              <span>Note</span>
            </span>

            {/* Checklist progress badge if note contains any checklist items */}
            {analysis.hasChecklist && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md border bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/30 shrink-0">
                <CheckSquare className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                <span>
                  {analysis.checkedCount}/{analysis.checklistCount}
                </span>
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
              <span className="text-xs font-medium text-zinc-400 truncate min-w-0 max-w-[150px]">
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
            {/* Toggle Single Card Expand */}
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setLocalExpanded(!expanded);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition touch-manipulation"
              title={expanded ? 'Collapse preview' : 'Show full note'}
              aria-label={expanded ? 'Collapse preview' : 'Show full note'}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isTrash ? (
              <button
                type="button"
                onClick={() => {
                  hapticSuccess();
                  if (onRestore) onRestore(item);
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition touch-manipulation"
                title="Restore from Trash"
                aria-label="Restore item"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    hapticTap();
                    onToggleFavorite(item);
                  }}
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition touch-manipulation ${
                    item.is_favorite
                      ? 'text-amber-400 bg-amber-400/10'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                  }`}
                  title={item.is_favorite ? 'Remove favorite' : 'Mark as favorite'}
                  aria-label={item.is_favorite ? 'Remove favorite' : 'Mark as favorite'}
                >
                  <Star className={`w-4 h-4 ${item.is_favorite ? 'fill-amber-400' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    hapticTap();
                    onTogglePin(item);
                  }}
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition touch-manipulation ${
                    item.is_pinned
                      ? 'text-brand-400 bg-brand-400/10'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                  }`}
                  title={item.is_pinned ? 'Unpin note' : 'Pin to top'}
                  aria-label={item.is_pinned ? 'Unpin note' : 'Pin to top'}
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
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition touch-manipulation"
                    title="Duplicate note"
                    aria-label="Duplicate note"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onDelete(item.id);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition touch-manipulation"
              title={isTrash ? 'Permanently Delete' : 'Delete'}
              aria-label={isTrash ? 'Permanently Delete' : 'Delete note'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 className={titleClass}>
          {item.title}
        </h3>

        {/* Formatted Markdown Preview with Clickable Checkboxes */}
        {parsedHtml ? (
          <div
            className={`mt-2 transition-all duration-200 ${
              expanded
                ? ''
                : `${previewClampClass} overflow-hidden relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-10 after:bg-gradient-to-t after:from-zinc-900/95 after:to-transparent after:pointer-events-none`
            }`}
          >
            <div
              className="note-markdown"
              onClick={handleMarkdownClick}
              dangerouslySetInnerHTML={{ __html: parsedHtml }}
            />
          </div>
        ) : (
          <p className="text-sm text-zinc-500 italic mt-2">
            Empty note
          </p>
        )}
      </div>

      {/* Card Footer */}
      <div className={footerClass}>
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
                <button
                  key={key}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticTap();
                    onSelectTag?.(name);
                  }}
                  className="text-xs text-zinc-300 hover:text-white px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 hover:border-zinc-500 font-medium transition cursor-pointer touch-manipulation"
                  title={`Filter by #${name}`}
                >
                  #{name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
