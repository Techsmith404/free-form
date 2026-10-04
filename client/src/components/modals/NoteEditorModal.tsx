import React, { useState } from 'react';
import { Notebook, Item, NotePriority } from '../../types/index.js';
import { createItem, updateItem } from '../../api/index.js';
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
  ArrowLeft
} from 'lucide-react';
import { hapticSuccess, hapticTap } from '../../services/native.js';

interface NoteEditorModalProps {
  existingNote?: Item | null;
  notebooks: Notebook[];
  defaultNotebookId?: string | null;
  priorities?: NotePriority[];
  onClose: () => void;
  onSaved: (item: Item) => void;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  existingNote,
  notebooks,
  defaultNotebookId,
  priorities = [],
  onClose,
  onSaved
}) => {
  const [title, setTitle] = useState(existingNote?.title || '');
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

  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (existingNote) {
        saved = await updateItem(existingNote.id, payload);
      } else {
        saved = await createItem(payload);
      }

      hapticSuccess();
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 lg:bg-black/80 lg:backdrop-blur-sm flex flex-col lg:items-center lg:justify-center lg:p-6 overflow-hidden pt-[max(env(safe-area-inset-top),0px)] pb-[max(env(safe-area-inset-bottom),0px)]">
      <div className="bg-zinc-900 lg:border border-zinc-800 lg:rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col h-full lg:h-[92vh] lg:max-h-[900px] overflow-hidden animate-in fade-in lg:zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-3 sm:px-5 py-2 sm:py-2.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/95 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 active:bg-zinc-700 transition touch-manipulation shrink-0"
              title="Close"
            >
              <ArrowLeft className="w-5 h-5 lg:hidden" />
              <X className="w-5 h-5 hidden lg:block" />
            </button>
            <FileText className="w-5 h-5 text-brand-400 shrink-0 hidden sm:block" />
            <h2 className="text-sm sm:text-base font-bold text-zinc-100 truncate">
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
              className={`h-9 px-2 sm:px-2.5 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold touch-manipulation ${
                hideFromAll
                  ? 'text-amber-400 bg-amber-400/10 border border-amber-400/30'
                  : 'text-zinc-400 hover:bg-zinc-800 active:bg-zinc-700'
              }`}
              title={hideFromAll ? 'Hidden from All Items feed' : 'Visible in All Items feed (click to hide)'}
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
              className={`h-9 w-9 flex items-center justify-center rounded-lg transition touch-manipulation ${
                isFavorite ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-400 hover:bg-zinc-800 active:bg-zinc-700'
              }`}
              title="Favorite"
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setIsPinned(!isPinned);
              }}
              className={`h-9 w-9 flex items-center justify-center rounded-lg transition touch-manipulation ${
                isPinned ? 'text-brand-400 bg-brand-400/10' : 'text-zinc-400 hover:bg-zinc-800 active:bg-zinc-700'
              }`}
              title="Pin note"
            >
              <Pin className={`w-4 h-4 ${isPinned ? 'fill-brand-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="hidden lg:flex h-9 px-3 text-zinc-400 hover:text-zinc-200 text-xs sm:text-sm font-medium transition touch-manipulation rounded-lg hover:bg-zinc-800 items-center justify-center"
            >
              Cancel
            </button>

            {/* Header Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 h-9 px-3.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md shadow-brand-500/20 active:scale-95 transition touch-manipulation ml-0.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Note'}</span>
            </button>
          </div>
        </div>

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
          />
        </div>
      </div>
    </div>
  );
};

