import React, { useState, useEffect, useMemo } from 'react';
import { Item, Tag, NotePriority } from '../../types/index.js';
import { FileText, Star, Pin, Trash2, EyeOff, ChevronDown, ChevronUp, CheckSquare } from 'lucide-react';
import { updateItem } from '../../api/index.js';
import { hapticTap } from '../../services/native.js';
import {
  analyzeNoteContent,
  renderInteractiveMarkdownHtml,
  toggleChecklistItemByIndex
} from '../../utils/markdownList.js';
import { ListCard } from './ListCard.js';

interface NoteCardProps {
  item: Item;
  priorities?: NotePriority[];
  isExpanded?: boolean;
  onOpen: (item: Item) => void;
  onUpdate?: (updated: Item) => void;
  onToggleFavorite: (item: Item) => void;
  onTogglePin: (item: Item) => void;
  onDelete: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  item,
  priorities = [],
  isExpanded = false,
  onOpen,
  onUpdate,
  onToggleFavorite,
  onTogglePin,
  onDelete
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
        isExpanded={isExpanded}
        onOpen={onOpen}
        onUpdate={onUpdate}
        onToggleFavorite={onToggleFavorite}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
      />
    );
  }

  const priority = priorities.find((p) => p.id === item.priority);

  // Render markdown to formatted HTML with interactive checkboxes
  const parsedHtml = useMemo(() => {
    return renderInteractiveMarkdownHtml(localContent);
  }, [localContent]);

  // Handle clicking checklist checkboxes directly inside the note card preview
  const handleMarkdownClick = async (e: React.MouseEvent<HTMLDivElement>) => {
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
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 truncate">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg">
              <FileText className="w-3.5 h-3.5 text-brand-400" />
              <span>Note</span>
            </span>

            {/* Checklist progress badge if note contains any checklist items */}
            {analysis.hasChecklist && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md border bg-indigo-500/10 text-indigo-300 border-indigo-500/30 shrink-0">
                <CheckSquare className="w-3 h-3 text-indigo-400" />
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
              <span className="text-xs font-medium text-zinc-400 truncate max-w-[150px]">
                {item.notebook_name}
              </span>
            )}
            {Boolean(item.hide_from_all) && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/25 rounded-md"
                title="Hidden from All Items feed"
              >
                <EyeOff className="w-3 h-3" />
                <span className="hidden sm:inline">Hidden</span>
              </span>
            )}
          </div>

          <div
            className="flex items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Toggle Single Card Expand */}
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setLocalExpanded(!expanded);
              }}
              className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition touch-manipulation"
              title={expanded ? 'Collapse preview' : 'Show full note'}
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
        <h3 className="font-bold text-zinc-100 text-lg sm:text-xl leading-snug group-hover:text-brand-400 transition-colors">
          {item.title}
        </h3>

        {/* Formatted Markdown Preview with Clickable Checkboxes */}
        {parsedHtml ? (
          <div
            className={`mt-2.5 transition-all duration-200 ${
              expanded
                ? ''
                : 'max-h-40 sm:max-h-48 overflow-hidden relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-10 after:bg-gradient-to-t after:from-zinc-900/95 after:to-transparent after:pointer-events-none'
            }`}
          >
            <div
              className="note-markdown"
              onClick={handleMarkdownClick}
              dangerouslySetInnerHTML={{ __html: parsedHtml }}
            />
          </div>
        ) : (
          <p className="text-sm text-zinc-500 italic mt-2.5">
            Empty note
          </p>
        )}
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
