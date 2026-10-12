import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Notebook, Item, NotePriority, Tag } from '../../types/index.js';
import { createItem, updateItem, fetchItemBacklinks, BacklinkItem } from '../../api/index.js';
import { TipTapEditor } from '../editor/TipTapEditor.js';
import {
  X,
  Save,
  Folder,
  Star,
  Pin,
  Tag as TagIcon,
  FileText,
  EyeOff,
  AlertCircle,
  ChevronDown,
  ArrowLeft,
  CheckCircle2,
  Check,
  Clock,
  Share2,
  Download,
  Printer,
  Copy,
  Link2
} from 'lucide-react';
import { hapticSuccess, hapticTap } from '../../services/native.js';
import { downloadAsMarkdown, printFormattedNote, copyFormattedRichText } from '../../utils/export.js';

interface NoteEditorModalProps {
  existingNote?: Item | null;
  initialTitle?: string;
  notebooks: Notebook[];
  defaultNotebookId?: string | null;
  priorities?: NotePriority[];
  items?: Item[];
  tags?: Tag[];
  onClose: () => void;
  onSaved: (item: Item) => void;
  onNavigateWikilink?: (title: string) => void;
  onNavigateItem?: (item: Item) => void;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  existingNote,
  initialTitle,
  notebooks,
  defaultNotebookId,
  priorities = [],
  items = [],
  tags = [],
  onClose,
  onSaved,
  onNavigateWikilink,
  onNavigateItem
}) => {
  const [title, setTitle] = useState(existingNote?.title || initialTitle || '');
  const [content, setContent] = useState(existingNote?.content || '');
  const [notebookId, setNotebookId] = useState<string | null>(
    existingNote?.notebook_id ?? defaultNotebookId ?? null
  );
  const [priority, setPriority] = useState<string>(existingNote?.priority || '');
  const [isFavorite, setIsFavorite] = useState(Boolean(existingNote?.is_favorite));
  const [isPinned, setIsPinned] = useState(Boolean(existingNote?.is_pinned));
  const [hideFromAll, setHideFromAll] = useState(Boolean(existingNote?.hide_from_all));
  const [tagsInput, setTagsInput] = useState(
    (existingNote?.tags || []).map((t) => (typeof t === 'string' ? t : t.name)).join(', ')
  );

  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [showBacklinks, setShowBacklinks] = useState(true);

  useEffect(() => {
    if (!existingNote?.id) {
      setBacklinks([]);
      return;
    }
    let active = true;
    fetchItemBacklinks(existingNote.id)
      .then((res) => {
        if (active) {
          setBacklinks(res || []);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch note backlinks:', err);
      });
    return () => {
      active = false;
    };
  }, [existingNote?.id]);

  const availableNotes = useMemo(() => {
    return items
      .filter((it) => it.type === 'note' && it.id !== existingNote?.id)
      .map((it) => ({
        id: it.id,
        title: it.title || 'Untitled',
        notebook_name: it.notebook_name || undefined
      }));
  }, [items, existingNote?.id]);

  const availableTags = useMemo(() => {
    const tagNames = new Set<string>();
    tags.forEach((t) => tagNames.add(t.name));
    items.forEach((it) => {
      (it.tags || []).forEach((t) => tagNames.add(typeof t === 'string' ? t : t.name));
    });
    return Array.from(tagNames);
  }, [tags, items]);

  const handleAddTagFromEditor = (newTag: string) => {
    const current = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (!current.some((t) => t.toLowerCase() === newTag.toLowerCase())) {
      const updated = current.length > 0 ? `${tagsInput.trim()}, ${newTag}` : newTag;
      setTagsInput(updated);
    }
  };

  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  interface NoteDraftData {
    title: string;
    content: string;
    notebookId: string | null;
    priority: string;
    tagsInput: string;
    isFavorite: boolean;
    isPinned: boolean;
    hideFromAll: boolean;
    savedAt: string;
  }

  const draftKey = existingNote ? `ff_draft_note_${existingNote.id}` : 'ff_draft_note_new';
  const [draftAvailable, setDraftAvailable] = useState<NoteDraftData | null>(null);
  const [draftRestored, setDraftRestored] = useState<boolean>(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedFormatted, setCopiedFormatted] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed: NoteDraftData = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const hasChanges = existingNote
            ? (parsed.content !== undefined && parsed.content !== (existingNote.content || '')) ||
              (parsed.title !== undefined && parsed.title !== (existingNote.title || ''))
            : Boolean(parsed.content?.trim() || parsed.title?.trim());
          if (hasChanges) {
            setDraftAvailable(parsed);
          }
        }
      }
    } catch {}
  }, [draftKey, existingNote]);

  // Debounced auto-save as user types or edits metadata
  useEffect(() => {
    const isDirty = existingNote
      ? title !== (existingNote.title || '') ||
        content !== (existingNote.content || '') ||
        notebookId !== (existingNote.notebook_id ?? null) ||
        priority !== (existingNote.priority || '') ||
        isFavorite !== Boolean(existingNote.is_favorite) ||
        isPinned !== Boolean(existingNote.is_pinned) ||
        hideFromAll !== Boolean(existingNote.hide_from_all) ||
        tagsInput !== ((existingNote.tags || []).map((t) => (typeof t === 'string' ? t : t.name)).join(', '))
      : Boolean(title.trim() || content.trim());

    if (!isDirty) {
      return;
    }

    setAutoSaveStatus('saving');
    const timer = setTimeout(() => {
      try {
        const draftPayload: NoteDraftData = {
          title,
          content,
          notebookId,
          priority,
          tagsInput,
          isFavorite,
          isPinned,
          hideFromAll,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(draftKey, JSON.stringify(draftPayload));
        setAutoSaveStatus('saved');
      } catch (err) {
        console.warn('Failed to auto-save note draft', err);
        setAutoSaveStatus('idle');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [draftKey, title, content, notebookId, priority, tagsInput, isFavorite, isPinned, hideFromAll, existingNote]);

  const handleResumeDraft = () => {
    if (!draftAvailable) return;
    if (draftAvailable.title !== undefined) setTitle(draftAvailable.title);
    if (draftAvailable.content !== undefined) setContent(draftAvailable.content);
    if (draftAvailable.notebookId !== undefined) setNotebookId(draftAvailable.notebookId);
    if (draftAvailable.priority !== undefined) setPriority(draftAvailable.priority);
    if (draftAvailable.tagsInput !== undefined) setTagsInput(draftAvailable.tagsInput);
    if (draftAvailable.isFavorite !== undefined) setIsFavorite(draftAvailable.isFavorite);
    if (draftAvailable.isPinned !== undefined) setIsPinned(draftAvailable.isPinned);
    if (draftAvailable.hideFromAll !== undefined) setHideFromAll(draftAvailable.hideFromAll);
    setDraftRestored(true);
    setDraftAvailable(null);
    hapticSuccess();
  };

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    setDraftAvailable(null);
    hapticTap();
  };

  const formatDraftTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' on ' + d.toLocaleDateString();
    } catch {
      return 'earlier session';
    }
  };

  const tagList = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const selectedNotebook = notebooks.find((nb) => nb.id === notebookId);
  const selectedPriority = priorities.find((p) => p.id === priority);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title: title.trim() || 'Untitled Note',
        content,
        notebook_id: notebookId || null,
        type: 'note' as const,
        priority: priority || '',
        is_favorite: isFavorite ? 1 : 0,
        is_pinned: isPinned ? 1 : 0,
        hide_from_all: hideFromAll ? 1 : 0,
        tags
      };

      let saved: Item;
      if (existingNote && existingNote.id) {
        saved = await updateItem(existingNote.id, payload);
      } else {
        saved = await createItem(payload);
      }

      hapticSuccess();
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        handleSaveRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleSaveRef.current();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-editor-title"
      className="fixed inset-0 z-50 bg-zinc-950 lg:bg-black/80 lg:backdrop-blur-sm flex flex-col lg:items-center lg:justify-center lg:p-6 overflow-hidden pt-[max(env(safe-area-inset-top),0px)] pb-[max(env(safe-area-inset-bottom),0px)]"
    >
      <div className="bg-zinc-900 lg:border border-zinc-800 lg:rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col h-full lg:h-[92vh] lg:max-h-[900px] overflow-hidden animate-in fade-in lg:zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-3 sm:px-5 py-2 sm:py-2.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/95 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 active:bg-zinc-700 transition touch-manipulation shrink-0"
              title="Close"
              aria-label="Close note editor"
            >
              <ArrowLeft className="w-5 h-5 lg:hidden" />
              <X className="w-5 h-5 hidden lg:block" />
            </button>
            <FileText className="w-5 h-5 text-brand-400 shrink-0 hidden sm:block" />
            <h2 id="note-editor-title" className="text-sm sm:text-base font-bold text-zinc-100 truncate">
              {existingNote ? 'Edit Note' : 'New Note'}
            </h2>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setHideFromAll(!hideFromAll);
              }}
              className={`min-h-[44px] px-2.5 sm:px-3 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold touch-manipulation ${
                hideFromAll
                  ? 'text-amber-400 bg-amber-400/10 border border-amber-400/30'
                  : 'text-zinc-400 hover:bg-zinc-800 active:bg-zinc-700'
              }`}
              title={hideFromAll ? 'Hidden from All Items feed' : 'Visible in All Items feed (click to hide)'}
              aria-label={hideFromAll ? 'Show in All Items feed' : 'Hide from All Items feed'}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{hideFromAll ? 'Hidden' : 'Hide'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setIsFavorite(!isFavorite);
              }}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition touch-manipulation ${
                isFavorite ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-400 hover:bg-zinc-800 active:bg-zinc-700'
              }`}
              title="Favorite"
              aria-label={isFavorite ? 'Unfavorite note' : 'Favorite note'}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setIsPinned(!isPinned);
              }}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition touch-manipulation ${
                isPinned ? 'text-brand-400 bg-brand-400/10' : 'text-zinc-400 hover:bg-zinc-800 active:bg-zinc-700'
              }`}
              title="Pin note"
              aria-label={isPinned ? 'Unpin note' : 'Pin note'}
            >
              <Pin className={`w-4 h-4 ${isPinned ? 'fill-brand-400' : ''}`} />
            </button>

            {/* Export / Share Dropdown Menu */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setShowExportMenu(!showExportMenu);
                }}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition touch-manipulation ${
                  showExportMenu
                    ? 'text-brand-400 bg-brand-500/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700'
                }`}
                title="Export or Share Note (Markdown, Print, Copy)"
                aria-label="Export or share note"
              >
                <Share2 className="w-4 h-4" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1 border-b border-zinc-800/80 mb-1">
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Export & Share</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      hapticTap();
                      const ok = await copyFormattedRichText(content);
                      if (ok) {
                        hapticSuccess();
                        setCopiedFormatted(true);
                        setTimeout(() => {
                          setCopiedFormatted(false);
                          setShowExportMenu(false);
                        }, 1500);
                      }
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5 transition touch-manipulation min-h-[44px]"
                  >
                    {copiedFormatted ? <Check className="w-4 h-4 text-brand-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                    <span>{copiedFormatted ? 'Copied to Clipboard!' : 'Copy Formatted Text'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      downloadAsMarkdown(title, content);
                      setShowExportMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5 transition touch-manipulation min-h-[44px]"
                  >
                    <Download className="w-4 h-4 text-zinc-400" />
                    <span>Download Markdown (.md)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      printFormattedNote(title, content, selectedNotebook?.name);
                      setShowExportMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5 transition touch-manipulation min-h-[44px]"
                  >
                    <Printer className="w-4 h-4 text-zinc-400" />
                    <span>Print / Save as PDF</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="hidden lg:flex min-h-[44px] px-3 text-zinc-400 hover:text-zinc-200 text-xs sm:text-sm font-medium transition touch-manipulation rounded-lg hover:bg-zinc-800 items-center justify-center"
            >
              Cancel
            </button>

            {/* Auto-save status indicator */}
            {autoSaveStatus === 'saved' && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400 font-medium mr-1.5 animate-in fade-in duration-150">
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Draft saved</span>
              </span>
            )}
            {autoSaveStatus === 'saving' && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400 font-medium mr-1.5 animate-in fade-in duration-150">
                <Clock className="w-3 h-3 text-zinc-400 animate-spin" />
                <span>Saving...</span>
              </span>
            )}

            {/* Header Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              title="Save Note (Ctrl+S / Cmd+Enter)"
              aria-label="Save Note"
              className="flex items-center gap-1.5 min-h-[44px] px-3.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md shadow-brand-500/20 active:scale-95 transition touch-manipulation ml-0.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Note'}</span>
            </button>
          </div>
        </div>

        {/* Unsaved Draft Detection Banner */}
        {draftAvailable && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-200 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">
                You have an unsaved draft from {formatDraftTime(draftAvailable.savedAt)}.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResumeDraft}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg text-xs transition active:scale-95"
              >
                Resume Draft
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg text-xs transition active:scale-95"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Draft Restored Confirmation Badge */}
        {draftRestored && !draftAvailable && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-3 sm:px-6 py-2 flex items-center justify-between text-xs text-emerald-300 shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Draft restored from local auto-save.</span>
            </div>
            <button
              type="button"
              onClick={() => setDraftRestored(false)}
              className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold px-2 py-0.5"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="mx-3 sm:mx-6 mt-2 p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs shrink-0 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Note Metadata Bar */}
        <div className="px-3 sm:px-5 py-2 bg-zinc-950/40 border-b border-zinc-800/60 space-y-1.5 shrink-0">
          {/* Borderless Sleek Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="w-full text-base sm:text-xl font-bold bg-transparent text-zinc-100 placeholder:text-zinc-600 border-0 focus:outline-none px-1 py-0.5"
          />

          {/* Compact Chips & Properties Toggle */}
          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs flex-1">
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setShowMobileDetails(!showMobileDetails);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 active:bg-zinc-700 shrink-0 font-medium transition"
              >
                <Folder className="w-3 h-3 text-brand-400" />
                <span className="max-w-[130px] truncate">{selectedNotebook?.name || 'Uncategorized'}</span>
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${showMobileDetails ? 'rotate-180' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setShowMobileDetails(!showMobileDetails);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 active:bg-zinc-700 shrink-0 font-medium transition"
              >
                {priority ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>{selectedPriority?.label || priority}</span>
                  </>
                ) : (
                  <span className="text-zinc-500">No Priority</span>
                )}
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${showMobileDetails ? 'rotate-180' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setShowMobileDetails(!showMobileDetails);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 active:bg-zinc-700 shrink-0 font-medium transition"
              >
                <TagIcon className="w-3 h-3 text-cyan-400" />
                <span>
                  {tagList.length > 0 ? `${tagList.length} tag${tagList.length > 1 ? 's' : ''}` : 'Tags'}
                </span>
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${showMobileDetails ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                hapticTap();
                setShowMobileDetails(!showMobileDetails);
              }}
              className="text-xs text-brand-400 hover:text-brand-300 px-2 py-1 rounded hover:bg-zinc-800 font-medium shrink-0 flex items-center gap-1 touch-manipulation ml-1"
            >
              <span>{showMobileDetails ? 'Hide' : 'Properties'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMobileDetails ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Form Fields: Collapsible across all devices */}
          {showMobileDetails && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
              <select
                value={notebookId || ''}
                onChange={(e) => setNotebookId(e.target.value || null)}
                className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-brand-500 text-sm"
              >
                <option value="">Uncategorized</option>
                {notebooks.map((nb) => (
                  <option key={nb.id} value={nb.id}>
                    {nb.name}
                  </option>
                ))}
              </select>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-brand-500 text-sm"
              >
                <option value="">No Priority</option>
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} Priority
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Tags (comma-separated)..."
                className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-brand-500 text-sm"
              />
            </div>
          )}
        </div>

        {/* TipTap Rich Editor */}
        <div className="flex-1 p-0 lg:p-4 overflow-hidden flex flex-col min-h-0">
          <TipTapEditor
            initialMarkdown={content}
            onChange={(md) => setContent(md)}
            placeholder="Write your note in Markdown or formatted text..."
            availableNotes={availableNotes}
            availableTags={availableTags}
            onAddTag={handleAddTagFromEditor}
            onNavigateWikilink={onNavigateWikilink}
          />
        </div>

        {/* Linked References / Backlinks footer */}
        {existingNote?.id && backlinks.length > 0 && (
          <div className="border-t border-zinc-800 bg-zinc-950/70 px-4 py-2.5 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                <Link2 className="w-3.5 h-3.5 text-brand-400" />
                <span>Linked References ({backlinks.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setShowBacklinks(!showBacklinks)}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 font-medium touch-manipulation px-1 py-0.5"
              >
                {showBacklinks ? 'Collapse' : 'Expand'}
              </button>
            </div>
            {showBacklinks && (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto py-0.5">
                {backlinks.map((bl) => {
                  const linkedItem = items.find((i) => i.id === bl.id);
                  return (
                    <button
                      key={bl.id}
                      type="button"
                      onClick={() => {
                        if (linkedItem && onNavigateItem) {
                          onNavigateItem(linkedItem);
                        } else if (onNavigateWikilink) {
                          onNavigateWikilink(bl.title);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-brand-300 transition touch-manipulation group"
                      title={`Referenced by "${bl.title}"`}
                    >
                      <FileText className="w-3 h-3 text-zinc-500 group-hover:text-brand-400" />
                      <span className="font-medium truncate max-w-[200px]">{bl.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

