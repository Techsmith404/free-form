import React, { useState } from 'react';
import { Item, PosterMetadata, PosterImage } from '../../types/index.js';
import { uploadFile } from '../../api/index.js';
import { Images, Plus, Trash2, Edit2, X, ZoomIn, EyeOff } from 'lucide-react';
import { hapticTap, hapticSuccess } from '../../services/native.js';

interface PosterCardProps {
  item: Item;
  onUpdate: (updated: Item) => void;
  onDelete: (id: string) => void;
  onEdit?: (item: Item) => void;
}

export const PosterCard: React.FC<PosterCardProps> = ({
  item,
  onUpdate,
  onDelete,
  onEdit
}) => {
  const meta: PosterMetadata = item.metadata || { images: [] };
  const images = meta.images || [];
  const [activeZoomImage, setActiveZoomImage] = useState<PosterImage | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      const newImages: PosterImage[] = [...images];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploaded = await uploadFile(file);
        newImages.push({
          id: `img-${Date.now()}-${i}`,
          url: uploaded.url,
          name: uploaded.name,
          caption: ''
        });
      }

      hapticSuccess();
      onUpdate({
        ...item,
        metadata: {
          ...meta,
          images: newImages
        }
      });
    } catch (err) {
      console.error('Failed to upload image', err);
      alert('Failed to upload image');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (imgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    hapticTap();
    const updatedImages = images.filter((img) => img.id !== imgId);
    onUpdate({
      ...item,
      metadata: {
        ...meta,
        images: updatedImages
      }
    });
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl bg-zinc-900/95 border border-zinc-800 hover:border-zinc-700/80 transition-all duration-200 shadow-md shadow-black/30 ring-1 ring-white/5 overflow-hidden group">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-lg">
              <Images className="w-3.5 h-3.5" />
              <span>Scrapbook</span>
            </span>
            {item.notebook_name && (
              <span className="text-xs font-medium text-zinc-400 truncate max-w-[140px]">
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
          <h3 className="font-bold text-zinc-100 text-lg sm:text-xl leading-snug">
            {item.title}
          </h3>
          {item.content && (
            <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{item.content}</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onEdit(item);
              }}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition touch-manipulation"
              title="Edit Poster"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onDelete(item.id);
            }}
            className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition touch-manipulation"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image Gallery Grid */}
      <div className="p-5 flex-1">
        {images.length === 0 ? (
          <div className="border-2 border-dashed border-zinc-800 rounded-2xl p-6 text-center text-zinc-400 text-sm">
            <p className="mb-3 font-medium">No photos in this scrapbook yet</p>
            <label className="inline-flex items-center gap-2 h-10 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl cursor-pointer text-xs font-bold transition active:scale-95">
              <Plus className="w-4 h-4" />
              <span>Upload Photos</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleAddImage}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {images.slice(0, 4).map((img, idx) => (
              <div
                key={img.id || idx}
                onClick={() => setActiveZoomImage(img)}
                className="group/img relative aspect-square rounded-xl overflow-hidden bg-zinc-950 cursor-pointer border border-zinc-800 shadow-inner"
              >
                <img
                  src={img.url}
                  alt={img.name || 'Poster image'}
                  className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center gap-3">
                  <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                  <button
                    type="button"
                    onClick={(e) => handleRemoveImage(img.id, e)}
                    className="p-1.5 rounded-lg bg-black/70 text-red-400 hover:text-red-300 transition"
                    title="Remove Photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {img.caption && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/80 text-xs text-zinc-200 px-2 py-1 truncate">
                    {img.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {images.length > 0 && (
          <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium">{images.length} {images.length === 1 ? 'photo' : 'photos'}</span>
            <label className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 cursor-pointer font-bold transition active:scale-95">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Photos</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleAddImage}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {activeZoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActiveZoomImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveZoomImage(null)}
              className="absolute -top-12 right-0 text-zinc-400 hover:text-white p-2"
            >
              <X className="w-7 h-7" />
            </button>
            <img
              src={activeZoomImage.url}
              alt={activeZoomImage.name}
              className="max-w-full max-h-[82vh] rounded-2xl object-contain shadow-2xl border border-zinc-800"
            />
            {activeZoomImage.caption && (
              <p className="mt-3 text-sm text-zinc-200 text-center max-w-lg bg-zinc-900/90 px-4 py-2 rounded-xl border border-zinc-800">
                {activeZoomImage.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
