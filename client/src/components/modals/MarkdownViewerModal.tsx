import React, { useState, useEffect, useMemo } from 'react';
import { Item } from '../../types/index.js';
import { fetchItemBacklinks, BacklinkItem } from '../../api/index.js';
import { X, Copy, Check, Edit2, FileText, RotateCcw, Trash2, Download, Printer, Link2 } from 'lucide-react';
import { hapticSuccess, hapticTap } from '../../services/native.js';
import { downloadAsMarkdown, printFormattedNote, copyFormattedRichText } from '../../utils/export.js';
import { renderInteractiveMarkdownHtml } from '../../utils/markdownList.js';
import { wikilinkFromEvent } from '../../utils/wikilinks.js';

interface MarkdownViewerModalProps {
  item: Item;
  items?: Item[];
  isTrashMode?: boolean;
  onClose: () => void;
  onEdit?: (item: Item) => void;
  onRestore?: (item: Item) => void;
  onNavigateWikilink?: (title: string) => void;
  onNavigateItem?: (item: Item) => void;
}

export const MarkdownViewerModal: React.FC<MarkdownViewerModalProps> = ({
  item,
  items = [],
  isTrashMode = false,
  onClose,
  onEdit,
  onRestore,
  onNavigateWikilink,
  onNavigateItem
}) => {
  const [copied, setCopied] = useState(false);
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);

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

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(item.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const html = useMemo(() => {
    return renderInteractiveMarkdownHtml(item.content || '*No content*');
  }, [item.content]);

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const wikilink = wikilinkFromEvent(e);
    if (wikilink) {
      e.preventDefault();
      e.stopPropagation();
      hapticTap();
      if (onNavigateWikilink) {
        onNavigateWikilink(wikilink);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="markdown-viewer-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 sm:p-6 overflow-hidden"
    >
      <div className="bg-zinc-900 border-t sm:border border-zinc-800 sm:rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-400" />
            <div>
              <h2 id="markdown-viewer-title" className="text-lg font-bold text-zinc-100">{item.title}</h2>
              {item.notebook_name && (
                <p className="text-xs text-zinc-400">in {item.notebook_name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={async () => {
                hapticTap();
                const ok = await copyFormattedRichText(item.content || '');
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
                downloadAsMarkdown(item.title, item.content || '');
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
                printFormattedNote(item.title, item.content || '', item.notebook_name);
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
                  onClick={() => onEdit(item)}
                  className="flex items-center gap-1.5 min-h-[44px] px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-medium transition touch-manipulation"
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
            className="prose dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans"
            dangerouslySetInnerHTML={{ __html: html }}
          />
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
