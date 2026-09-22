import React, { useState } from 'react';
import { Notebook, Item, PosterMetadata, PosterImage } from '../../types/index.js';
import { createItem, updateItem, uploadFile } from '../../api/index.js';
import { X, Images, Save, Plus, Loader2 } from 'lucide-react';

interface NewPosterModalProps {
  existingItem?: Item | null;
  notebooks: Notebook[];
  defaultNotebookId?: string | null;
  onClose: () => void;
  onSaved: (item: Item) => void;
}

export const NewPosterModal: React.FC<NewPosterModalProps> = ({
  existingItem,
  notebooks,
  defaultNotebookId,
  onClose,
  onSaved
}) => {
  const existingMeta: PosterMetadata = existingItem?.metadata || { images: [] };
  const [title, setTitle] = useState(existingItem?.title || '');
  const [description, setDescription] = useState(existingItem?.content || '');
  const [images, setImages] = useState<PosterImage[]>(existingMeta.images || []);
  const [notebookId, setNotebookId] = useState<string | null>(
    existingItem?.notebook_id ?? defaultNotebookId ?? null
  );

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      const newImgs: PosterImage[] = [...images];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploaded = await uploadFile(file);
        newImgs.push({
          id: `img-${Date.now()}-${i}`,
          url: uploaded.url,
          name: uploaded.name,
          size: uploaded.size,
          caption: ''
        });
      }
      setImages(newImgs);
    } catch (err) {
      console.error(err);
      alert('Failed to upload image(s)');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (imgId: string) => {
    setImages(images.filter((img) => img.id !== imgId));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Scrapbook title is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        title: title.trim(),
        content: description.trim(),
        notebook_id: notebookId || null,
        type: 'poster' as const,
        metadata: {
          images
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
      setError(err.message || 'Failed to save scrapbook');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Images className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-zinc-100">
              {existingItem ? 'Edit Scrapbook Poster' : 'Create Scrapbook Poster'}
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
            <label className="block text-zinc-300 font-medium mb-1">Scrapbook Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Vacation Photos, Design Inspo, Mood Board..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notebook</label>
            <select
              value={notebookId || ''}
              onChange={(e) => setNotebookId(e.target.value || null)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-brand-500 text-sm"
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
            <label className="block text-zinc-300 font-medium mb-1">Description / Caption</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this scrapbook collects..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Uploaded Photos Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-zinc-300 font-medium">Photos ({images.length})</label>
              <label className="flex items-center gap-1 text-purple-400 hover:text-purple-300 cursor-pointer font-medium">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Add Photos</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleUploadImages}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
              {images.map((img) => (
                <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(img.id)}
                    className="absolute top-1 right-1 p-1 rounded bg-black/70 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
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
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-semibold transition shadow-lg shadow-purple-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Scrapbook'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
