import React, { useState } from 'react';
import { Notebook, Item, NotePriority } from '../../types/index.js';
import { createItem, updateItem } from '../../api/index.js';
import { TipTapEditor } from '../editor/TipTapEditor.js';
import { X, Save, Folder, Star, Pin, Tag as TagIcon, FileText, EyeOff, AlertCircle } from 'lucide-react';

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

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 md:p-6 overflow-hidden">
      <div className="bg-zinc-900 border-t sm:border border-zinc-800 sm:rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col h-[97dvh] sm:h-[92vh] sm:max-h-[900px] overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-zinc-100">
              {existingNote ? 'Edit Note' : 'New Note'}
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setHideFromAll(!hideFromAll)}
              className={`h-9 px-2.5 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold touch-manipulation ${
                hideFromAll
                  ? 'text-amber-400 bg-amber-400/10 border border-amber-400/30'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
              title={hideFromAll ? 'Hidden from All Items feed' : 'Visible in All Items feed (click to hide)'}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{hideFromAll ? 'Hidden' : 'Hide'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsFavorite(!isFavorite)}
              className={`h-10 w-10 flex items-center justify-center rounded-lg transition touch-manipulation ${
                isFavorite ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-400 hover:bg-zinc-800'
              }`}
              title="Favorite"
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              className={`h-10 w-10 flex items-center justify-center rounded-lg transition touch-manipulation ${
                isPinned ? 'text-brand-400 bg-brand-400/10' : 'text-zinc-400 hover:bg-zinc-800'
              }`}
              title="Pin note"
            >
              <Pin className={`w-4 h-4 ${isPinned ? 'fill-brand-400' : ''}`} />
            </button>
            <div className="w-[1px] h-4 bg-zinc-800 mx-0.5" />
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition touch-manipulation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-4 sm:mx-6 mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs shrink-0">
            {error}
          </div>
        )}

        {/* Note Metadata Bar */}
        <div className="px-4 sm:px-6 py-3 bg-zinc-950/40 border-b border-zinc-800/60 space-y-2.5 shrink-0">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="w-full h-12 px-3.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-base font-semibold focus:outline-none focus:border-brand-500"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={notebookId || ''}
              onChange={(e) => setNotebookId(e.target.value || null)}
              className="w-full h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-brand-500 text-sm"
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
              className="w-full h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-brand-500 text-sm"
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
              className="w-full h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-brand-500 text-sm"
            />
          </div>
        </div>

        {/* TipTap Rich Editor */}
        <div className="flex-1 p-4 sm:p-6 overflow-hidden flex flex-col">
          <TipTapEditor
            initialMarkdown={content}
            onChange={(md) => setContent(md)}
            placeholder="Write your note in Markdown or formatted text..."
          />
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition touch-manipulation"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 h-11 px-5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-brand-500/20 touch-manipulation"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Note'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

