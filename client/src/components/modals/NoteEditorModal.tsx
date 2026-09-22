import React, { useState } from 'react';
import { Notebook, Item } from '../../types/index.js';
import { createItem, updateItem } from '../../api/index.js';
import { TipTapEditor } from '../editor/TipTapEditor.js';
import { X, Save, Folder, Star, Pin, Tag as TagIcon, FileText } from 'lucide-react';

interface NoteEditorModalProps {
  existingNote?: Item | null;
  notebooks: Notebook[];
  defaultNotebookId?: string | null;
  onClose: () => void;
  onSaved: (item: Item) => void;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  existingNote,
  notebooks,
  defaultNotebookId,
  onClose,
  onSaved
}) => {
  const [title, setTitle] = useState(existingNote?.title || '');
  const [content, setContent] = useState(existingNote?.content || '');
  const [notebookId, setNotebookId] = useState<string | null>(
    existingNote?.notebook_id ?? defaultNotebookId ?? null
  );
  const [isFavorite, setIsFavorite] = useState(Boolean(existingNote?.is_favorite));
  const [isPinned, setIsPinned] = useState(Boolean(existingNote?.is_pinned));
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
        is_favorite: isFavorite ? 1 : 0,
        is_pinned: isPinned ? 1 : 0,
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col h-[94vh] max-h-[900px] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="px-6 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-zinc-100">
              {existingNote ? 'Edit Note' : 'Create Markdown Note'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFavorite(!isFavorite)}
              className={`p-1.5 rounded-lg transition ${
                isFavorite ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-400 hover:bg-zinc-800'
              }`}
              title="Favorite"
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              className={`p-1.5 rounded-lg transition ${
                isPinned ? 'text-brand-400 bg-brand-400/10' : 'text-zinc-400 hover:bg-zinc-800'
              }`}
              title="Pin note"
            >
              <Pin className={`w-4 h-4 ${isPinned ? 'fill-brand-400' : ''}`} />
            </button>
            <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs shrink-0">
            {error}
          </div>
        )}

        {/* Note Metadata Bar */}
        <div className="px-6 py-3 bg-zinc-950/40 border-b border-zinc-800/60 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs shrink-0">
          <div className="md:col-span-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 text-base font-semibold focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <select
                value={notebookId || ''}
                onChange={(e) => setNotebookId(e.target.value || null)}
                className="w-full px-2.5 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-brand-500 text-xs"
              >
                <option value="">Uncategorized</option>
                {notebooks.map((nb) => (
                  <option key={nb.id} value={nb.id}>
                    {nb.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Tags (comma-separated)..."
                className="w-full px-2.5 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-brand-500 text-xs"
              />
            </div>
          </div>
        </div>

        {/* TipTap Rich Editor */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          <TipTapEditor
            initialMarkdown={content}
            onChange={(md) => setContent(md)}
            placeholder="Write your note in Markdown or formatted text..."
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-brand-500/20"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Note'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
