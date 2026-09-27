import React, { useState } from 'react';
import { Notebook, Item, BookmarkMetadata } from '../../types/index.js';
import { createItem, updateItem, scrapeUrl } from '../../api/index.js';
import { X, Globe, Save, Bookmark, Loader2, ExternalLink } from 'lucide-react';

interface NewBookmarkModalProps {
  existingItem?: Item | null;
  notebooks: Notebook[];
  defaultNotebookId?: string | null;
  onClose: () => void;
  onSaved: (item: Item) => void;
}

export const NewBookmarkModal: React.FC<NewBookmarkModalProps> = ({
  existingItem,
  notebooks,
  defaultNotebookId,
  onClose,
  onSaved
}) => {
  const existingMeta: BookmarkMetadata = existingItem?.metadata || { url: '' };
  const [url, setUrl] = useState(existingMeta.url || '');
  const [title, setTitle] = useState(existingItem?.title || '');
  const [notes, setNotes] = useState(existingItem?.content || '');
  const [notebookId, setNotebookId] = useState<string | null>(
    existingItem?.notebook_id ?? defaultNotebookId ?? null
  );

  const [metadata, setMetadata] = useState<BookmarkMetadata>(existingMeta);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchMetadata = async (targetUrl: string) => {
    if (!targetUrl.trim()) return;
    try {
      setFetching(true);
      setError(null);
      const data = await scrapeUrl(targetUrl);
      setMetadata(data);
      if (!title) {
        setTitle(data.title || data.siteName);
      }
    } catch (err: any) {
      console.warn('Scraping error', err);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        title: title.trim() || metadata.ogTitle || url.trim(),
        content: notes.trim(),
        notebook_id: notebookId || null,
        type: 'bookmark' as const,
        metadata: {
          ...metadata,
          url: url.trim()
        }
      };

      let saved: Item;
      if (existingItem) {
        saved = await updateItem(existingItem.id, payload);
      } else {
        saved = await createItem(payload);
      }

      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save bookmark');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 overflow-hidden">
      <div className="bg-zinc-900 border-t sm:border border-zinc-800 sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-zinc-100">
              {existingItem ? 'Edit Bookmark' : 'Add Webpage Bookmark'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Webpage URL *</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => handleFetchMetadata(url)}
                placeholder="https://example.com/article"
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => handleFetchMetadata(url)}
                disabled={fetching || !url}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 rounded-xl font-medium flex items-center gap-1.5 transition"
              >
                {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                <span>Fetch</span>
              </button>
            </div>
          </div>

          {/* Live Scraped Preview */}
          {(metadata.ogTitle || metadata.ogImage) && (
            <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl flex gap-3 items-center">
              {metadata.ogImage && (
                <img
                  src={metadata.ogImage}
                  alt=""
                  className="w-16 h-16 object-cover rounded-lg bg-zinc-900 shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wide block">
                  {metadata.siteName || 'Preview'}
                </span>
                <p className="text-xs font-semibold text-zinc-200 truncate">{metadata.ogTitle}</p>
                <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                  {metadata.ogDescription}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title for this bookmark..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notebook</label>
            <select
              value={notebookId || ''}
              onChange={(e) => setNotebookId(e.target.value || null)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 text-sm"
            >
              <option value="">Uncategorized (No Notebook)</option>
              {notebooks.map((nb) => (
                <option key={nb.id} value={nb.id}>
                  {nb.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Personal Notes / Summary</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why you saved this link, key insights..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold transition shadow-lg shadow-blue-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Bookmark'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
