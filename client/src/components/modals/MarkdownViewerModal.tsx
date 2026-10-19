import React, { useState, useEffect, useMemo } from 'react';
import { Item, NotePriority } from '../../types/index.js';
import { fetchItemBacklinks, BacklinkItem, updateItem } from '../../api/index.js';
import {
  X,
  Copy,
  Check,
  Edit2,
  FileText,
  RotateCcw,
  Trash2,
  Download,
  Printer,
  Link2,
  Star,
  Pin,
  EyeOff,
  CheckSquare,
  ListOrdered,
  ClipboardList
} from 'lucide-react';
import { hapticSuccess, hapticTap } from '../../services/native.js';
import { downloadAsMarkdown, printFormattedNote, copyFormattedRichText } from '../../utils/export.js';
import {
  analyzeNoteContent,
  renderInteractiveMarkdownHtml,
  toggleChecklistItemByIndex
} from '../../utils/markdownList.js';
import { wikilinkFromEvent } from '../../utils/wikilinks.js';

export interface MarkdownViewerModalProps {
  item: Item;
  items?: Item[];
  priorities?: NotePriority[];
  isTrashMode?: boolean;
  onClose: () => void;
  onEdit?: (item: Item) => void;
  onUpdate?: (updated: Item) => void;
  onRestore?: (item: Item) => void;
  onToggleFavorite?: (item: Item) => void;
  onTogglePin?: (item: Item) => void;
  onSelectTag?: (tag: string) => void;
  onNavigateWikilink?: (title: string) => void;
  onNavigateItem?: (item: Item) => void;
}

export const MarkdownViewerModal: React.FC<MarkdownViewerModalProps> = ({
  item,
  items = [],
  priorities = [],
  isTrashMode = false,
  onClose,
  onEdit,
  onUpdate,
  onRestore,
  onToggleFavorite,
  onTogglePin,
  onSelectTag,
  onNavigateWikilink,
  onNavigateItem
}) => {
  const [copied, setCopied] = useState(false);
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [localContent, setLocalContent] = useState<string>(item.content || '');

  const isTrash = isTrashMode || Boolean(item.is_archived);

  // Sync localContent when item.content changes
  useEffect(() => {
    setLocalContent(item.content || '');
  }, [item.content]);

  // Escape key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Backlinks
  useEffect(() => {
    if (!item?.id) {
      setBacklinks([]);
      return;
    }
    let active = true;
    fetchItemBacklinks(item.id)
      .then((res) => {
        if (active) {
          setBacklinks(res || []);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch backlinks:', err);
      });
    return () => {
      active = false;
    };
  }, [item?.id]);

  const priority = useMemo(() => {
    if (!item.priority || !priorities) return null;
    return priorities.find((p) => p.id === item.priority) || null;
  }, [item.priority, priorities]);

  const analysis = useMemo(
    () => analyzeNoteContent(localContent, item.title),
    [localContent, item.title]
  );

  const html = useMemo(() => {
    return renderInteractiveMarkdownHtml(localContent || '*No content*');
  }, [localContent]);

  const handleContentClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const wikilink = wikilinkFromEvent(e);
    if (wikilink) {
      e.preventDefault();
      e.stopPropagation();
      hapticTap();
      if (onNavigateWikilink) {
        onNavigateWikilink(wikilink);
      }
      return;
    }

    const target = e.target as HTMLElement;
    const checkboxInput = target.closest('input[type="checkbox"][data-checklist-index]') as HTMLInputElement | null;
    if (!checkboxInput) return;

    if (isTrash) return;

    e.preventDefault();
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
      console.error('Failed to toggle checklist item in preview', err);
      setLocalContent(item.content || '');
      if (onUpdate) onUpdate(item);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="markdown-viewer-title"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 sm:p-6 overflow-hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 border-t sm:border border-zinc-800 sm:rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        style={
          priority
            ? {
                borderLeftColor: priority.color,
                borderLeftWidth: '4px'
              }
            : undefined
        }
      >
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-brand-400 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="markdown-viewer-title" className="text-lg font-bold text-zinc-100 truncate">
                  {item.title}
                </h2>

                {/* Type / Checklist Badge */}
                {item.type === 'form_entry' ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold tracking-wide uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg shrink-0">
                    <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Form</span>
                  </span>
                ) : analysis.checklistCount > 0 ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold tracking-wide uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded-lg">
                      <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Checklist</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md border bg-zinc-800 text-zinc-300 border-zinc-700/60">
                      <span>
                        {analysis.checkedCount}/{analysis.checklistCount}
                      </span>
                    </span>
                  </div>
                ) : analysis.isMajorityList ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold tracking-wide uppercase bg-sky-500/15 text-sky-300 border border-sky-500/30 rounded-lg">
                      <ListOrdered className="w-3.5 h-3.5 text-sky-400" />
                      <span>List</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border bg-zinc-800 text-zinc-300 border-zinc-700/60">
                      <span>{analysis.totalListCount} items</span>
                    </span>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold tracking-wide uppercase bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg shrink-0">
                    <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Note</span>
                  </span>
                )}

                {/* Priority Pill */}
                {priority && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md border shrink-0"
                    style={{
                      backgroundColor: `${priority.color}18`,
                      color: priority.color,
                      borderColor: `${priority.color}35`
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priority.color }} />
                    <span>{priority.label}</span>
                  </span>
                )}

                {/* Hidden Pill */}
                {Boolean(item.hide_from_all) && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-amber-500 dark:text-amber-400 bg-amber-400/10 border border-amber-400/25 rounded-md shrink-0"
                    title="Hidden from All Items feed"
                  >
                    <EyeOff className="w-3 h-3" />
                    <span>Hidden</span>
                  </span>
                )}
              </div>

              {item.notebook_name && (
                <p className="text-xs text-zinc-400 mt-0.5">in {item.notebook_name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {!isTrash && onToggleFavorite && (
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
            )}

            {!isTrash && onTogglePin && (
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
            )}

            <button
              type="button"
              onClick={async () => {
                hapticTap();
                const ok = await copyFormattedRichText(localContent || '');
                if (ok) {
                  hapticSuccess();
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="flex items-center gap-1.5 min-h-[44px] px-2.5 sm:px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition touch-manipulation"
              title="Copy Rich Text & Markdown to Clipboard"
              aria-label="Copy note to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-brand-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticTap();
                downloadAsMarkdown(item.title, localContent || '');
              }}
              className="flex items-center gap-1.5 min-h-[44px] px-2.5 sm:px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition touch-manipulation"
              title="Download as Markdown (.md)"
              aria-label="Download as Markdown"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden md:inline">Download</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticTap();
                printFormattedNote(item.title, localContent || '', item.notebook_name);
              }}
              className="flex items-center gap-1.5 min-h-[44px] px-2.5 sm:px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition touch-manipulation"
              title="Print or Save as PDF"
              aria-label="Print or save note as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden md:inline">Print / PDF</span>
            </button>

            {(isTrashMode || Boolean(item.is_archived)) && onRestore ? (
              <button
                type="button"
                onClick={() => {
                  hapticSuccess();
                  onRestore(item);
                  onClose();
                }}
                className="flex items-center gap-1.5 min-h-[44px] px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition shadow-sm touch-manipulation"
                aria-label="Restore note from trash"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore</span>
              </button>
            ) : (
              onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    hapticTap();
                    onClose();
                    onEdit(item);
                  }}
                  className="flex items-center gap-1.5 min-h-[44px] px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold transition touch-manipulation shadow-sm"
                  aria-label="Edit note"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )
            )}

            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 transition touch-manipulation"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Trashed Item Banner */}
        {(isTrashMode || Boolean(item.is_archived)) && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>This item is in the trash. Restore it to edit or organize.</span>
            </div>
            {onRestore && (
              <button
                type="button"
                onClick={() => {
                  hapticSuccess();
                  onRestore(item);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-lg text-xs transition shadow-sm touch-manipulation ml-2 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Note</span>
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950/40" onClick={handleContentClick}>
          <div
            className="note-markdown prose dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        {/* Footer with updated_at date and clickable tags */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 shrink-0">
          <div className="flex items-center gap-2">
            <span>
              Updated {new Date(item.updated_at).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>

          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((t, idx) => {
                const name = typeof t === 'string' ? t : t.name;
                const key = typeof t === 'string' ? `${t}-${idx}` : t.id;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      hapticTap();
                      onSelectTag?.(name);
                      onClose();
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

        {/* Linked References / Backlinks footer */}
        {backlinks.length > 0 && (
          <div className="border-t border-zinc-800 bg-zinc-950/80 px-6 py-3 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 mb-2">
              <Link2 className="w-3.5 h-3.5 text-brand-400" />
              <span>Linked References ({backlinks.length})</span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {backlinks.map((bl) => {
                const linkedItem = items?.find((i) => i.id === bl.id);
                return (
                  <button
                    key={bl.id}
                    type="button"
                    onClick={() => {
                      hapticTap();
                      if (linkedItem && onNavigateItem) {
                        onNavigateItem(linkedItem);
                      } else if (onNavigateWikilink) {
                        onNavigateWikilink(bl.title);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-brand-300 transition touch-manipulation group"
                    title={`Referenced by "${bl.title}"`}
                  >
                    <FileText className="w-3.5 h-3.5 text-zinc-500 group-hover:text-brand-400" />
                    <span className="font-medium truncate max-w-[220px]">{bl.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
