import React, { useState } from 'react';
import { Item, PosterMetadata, PosterImage } from '../../types/index.js';
import { uploadFile } from '../../api/index.js';
import { Images, Plus, Trash2, Edit2, X, ZoomIn } from 'lucide-react';

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
    <div className="flex flex-col justify-between rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition shadow-lg overflow-hidden group">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/60 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md flex items-center gap-1">
              <Images className="w-3 h-3" />
              <span>Scrapbook</span>
            </span>
            {item.notebook_name && (
              <span className="text-xs text-zinc-400">
                in {item.notebook_name}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-zinc-100 text-base mt-1 line-clamp-1">
            {item.title}
          </h3>
          {item.content && (
            <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{item.content}</p>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
              title="Edit Poster"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition"
            title="Delete / Archive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Image Gallery Grid */}
      <div className="p-4 flex-1">
        {images.length === 0 ? (
          <div className="border-2 border-dashed border-zinc-800 rounded-xl p-6 text-center text-zinc-500 text-xs">
            <p className="mb-2">No photos in this scrapbook yet</p>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg cursor-pointer transition">
              <Plus className="w-3.5 h-3.5" />
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
          <div className="grid grid-cols-2 gap-2">
            {images.slice(0, 4).map((img, idx) => (
              <div
                key={img.id || idx}
                onClick={() => setActiveZoomImage(img)}
                className="group/img relative aspect-square rounded-xl overflow-hidden bg-zinc-950 cursor-pointer border border-zinc-800/80"
              >
                <img
                  src={img.url}
                  alt={img.name || 'Poster image'}
                  className="w-full h-full object-cover group-hover/img:scale-105 transition duration-300"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center gap-2">
                  <ZoomIn className="w-5 h-5 text-white drop-shadow" />
                  <button
                    type="button"
                    onClick={(e) => handleRemoveImage(img.id, e)}
                    className="p-1 rounded bg-black/60 text-red-400 hover:text-red-300 transition"
                    title="Remove Photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {img.caption && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[10px] text-zinc-200 px-1.5 py-0.5 truncate">
                    {img.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload more button if images exist */}
        {images.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
            <span>{images.length} {images.length === 1 ? 'photo' : 'photos'}</span>
            <label className="flex items-center gap-1 text-purple-400 hover:text-purple-300 cursor-pointer transition font-medium">
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
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActiveZoomImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveZoomImage(null)}
              className="absolute -top-10 right-0 text-zinc-400 hover:text-white p-1"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={activeZoomImage.url}
              alt={activeZoomImage.name}
              className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl border border-zinc-800"
            />
            {activeZoomImage.caption && (
              <p className="mt-3 text-sm text-zinc-300 text-center max-w-lg">
                {activeZoomImage.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
