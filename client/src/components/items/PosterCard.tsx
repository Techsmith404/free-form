import React, { useState } from 'react';
import { Item, PosterMetadata, PosterImage, DensityMode } from '../../types/index.js';
import { uploadFile, resolveAssetUrl } from '../../api/index.js';
import { Images, Plus, Trash2, Edit2, X, ZoomIn, EyeOff, RotateCcw, Check, Copy } from 'lucide-react';
import { hapticTap, hapticSuccess } from '../../services/native.js';

interface PosterCardProps {
  item: Item;
  density?: DensityMode;
  isTrashMode?: boolean;
  onUpdate: (updated: Item) => void;
  onDelete: (id: string) => void;
  onEdit?: (item: Item) => void;
  onRestore?: (item: Item) => void;
  onDuplicate?: (item: Item) => void;
  isSelected?: boolean;
  isSelectMode?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const PosterCard: React.FC<PosterCardProps> = ({
  item,
  density = 'cozy',
  isTrashMode = false,
  onUpdate,
  onDelete,
  onEdit,
  onRestore,
  onDuplicate,
  isSelected = false,
  isSelectMode = false,
  onToggleSelect
}) => {
  const isTrash = isTrashMode || Boolean(item.is_archived);
  const meta: PosterMetadata = item.metadata || { images: [] };
  const images = meta.images || [];
  const [activeZoomImage, setActiveZoomImage] = useState<PosterImage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      setUploadError(null);
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
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image. Please try again.');
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectMode || e.metaKey || e.ctrlKey || e.shiftKey) {
      e.stopPropagation();
      hapticTap();
      onToggleSelect?.(item.id);
    }
  };

  const headerPaddingClass =
    density === 'compact'
      ? 'p-3'
      : density === 'comfortable'
        ? 'p-3.5 sm:p-4'
        : 'p-4 sm:p-5';

  const bodyPaddingClass =
    density === 'compact'
      ? 'p-3'
      : density === 'comfortable'
        ? 'p-3.5 sm:p-4'
        : 'p-4 sm:p-5';

  const titleClass =
    density === 'compact'
      ? 'text-base font-bold text-zinc-100 leading-snug'
      : density === 'comfortable'
        ? 'text-base sm:text-lg font-bold text-zinc-100 leading-snug'
        : 'text-lg sm:text-xl font-bold text-zinc-100 leading-snug';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open scrapbook: ${item.title}`}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            if (onEdit && !isTrash) onEdit(item);
          }
        }
      }}
      className={`flex flex-col justify-between rounded-2xl bg-zinc-900/95 border transition-all duration-200 shadow-md shadow-black/30 overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/50 ${
        isSelected
          ? 'border-brand-500 ring-2 ring-brand-500/40 bg-brand-500/5'
          : 'border-zinc-800 hover:border-zinc-700/80 ring-1 ring-white/5'
      }`}
    >
      {/* Header */}
      <div className={`${headerPaddingClass} border-b border-zinc-800/80 flex items-start justify-between gap-2`}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            {isSelectMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  hapticTap();
                  onToggleSelect?.(item.id);
                }}
                className={`min-h-[44px] min-w-[44px] p-2.5 rounded-md flex items-center justify-center border transition touch-manipulation shrink-0 ${
                  isSelected
                    ? 'bg-brand-500 border-brand-500 text-white shadow-sm'
                    : 'bg-zinc-800 border-zinc-600 text-transparent hover:border-zinc-400'
                }`}
                title={isSelected ? 'Deselect' : 'Select'}
                aria-label={isSelected ? `Deselect ${item.title}` : `Select ${item.title}`}
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
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
          <h3 className={titleClass}>
            {item.title}
          </h3>
          {item.content && (
            <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{item.content}</p>
          )}
          {uploadError && (
            <p className="text-xs text-red-400 mt-1">{uploadError}</p>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {isTrash ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                hapticSuccess();
                if (onRestore) onRestore(item);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition touch-manipulation"
              title="Restore from Trash"
              aria-label={`Restore ${item.title} from trash`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          ) : (
            onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  hapticTap();
                  onEdit(item);
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition touch-manipulation"
                title="Edit Poster"
                aria-label={`Edit scrapbook ${item.title}`}
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )
          )}
          {onDuplicate && !isTrash && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                hapticTap();
                onDuplicate(item);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition touch-manipulation"
              title="Duplicate Scrapbook"
              aria-label={`Duplicate scrapbook ${item.title}`}
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              hapticTap();
              onDelete(item.id);
            }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition touch-manipulation"
            title={isTrash ? 'Permanently Delete' : 'Delete'}
            aria-label={isTrash ? `Permanently delete ${item.title}` : `Move ${item.title} to trash`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image Gallery Grid */}
      <div className={`${bodyPaddingClass} flex-1`}>
        {images.length === 0 ? (
          <div className="border-2 border-dashed border-zinc-800 rounded-2xl p-6 text-center text-zinc-400 text-sm">
            <p className="mb-3 font-medium">No photos in this scrapbook yet</p>
            {!isTrash && (
              <label className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl cursor-pointer text-xs font-bold transition active:scale-95 touch-manipulation">
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
            )}
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
                  src={resolveAssetUrl(img.url)}
                  alt={img.name || 'Poster image'}
                  className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center gap-3">
                  <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                  <button
                    type="button"
                    onClick={(e) => handleRemoveImage(img.id, e)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-black/70 text-red-400 hover:text-red-300 transition"
                    title="Remove Photo"
                    aria-label={`Remove photo ${img.name || idx + 1}`}
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
            <label className="flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 cursor-pointer font-bold transition active:scale-95 touch-manipulation">
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
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
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
              aria-label="Close image preview"
              className="absolute -top-12 right-0 text-zinc-400 hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-7 h-7" />
            </button>
            <img
              src={resolveAssetUrl(activeZoomImage.url)}
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
