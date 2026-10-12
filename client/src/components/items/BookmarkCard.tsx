import React from 'react';
import { Item, BookmarkMetadata, DensityMode } from '../../types/index.js';
import { ExternalLink, Globe, Trash2, Edit2, Bookmark, EyeOff, RotateCcw, Check, Copy } from 'lucide-react';
import { hapticSuccess, hapticTap } from '../../services/native.js';

interface BookmarkCardProps {
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

export const BookmarkCard: React.FC<BookmarkCardProps> = ({
  item,
  density = 'cozy',
  isTrashMode = false,
  onDelete,
  onEdit,
  onRestore,
  onDuplicate,
  isSelected = false,
  isSelectMode = false,
  onToggleSelect
}) => {
  const isTrash = isTrashMode || Boolean(item.is_archived);
  const meta: BookmarkMetadata = item.metadata || { url: '#' };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectMode || e.metaKey || e.ctrlKey || e.shiftKey) {
      e.stopPropagation();
      hapticTap();
      onToggleSelect?.(item.id);
    }
  };

  const paddingClass = density === 'compact'
    ? 'p-3 space-y-2'
    : density === 'comfortable'
      ? 'p-4 space-y-3'
      : 'p-5 space-y-4';

  const imageHeightClass = density === 'compact'
    ? 'h-28'
    : density === 'comfortable'
      ? 'h-36'
      : 'h-44';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open bookmark: ${item.title}`}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            handleCardClick(e as any);
          }
        }
      }}
      className={`flex flex-col justify-between rounded-2xl bg-zinc-900/95 border transition-all duration-200 shadow-md shadow-black/30 overflow-hidden group cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${
        isSelected
          ? 'border-brand-500 ring-2 ring-brand-500/40 bg-brand-500/5'
          : 'border-zinc-800 hover:border-zinc-700/80 ring-1 ring-white/5'
      }`}
    >
      {/* Cover Image */}
      {meta.ogImage ? (
        <div className={`relative w-full ${imageHeightClass} bg-zinc-950 overflow-hidden border-b border-zinc-800`}>
          <img
            src={meta.ogImage}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-80" />
        </div>
      ) : (
        <div className="w-full h-20 bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border-b border-zinc-800/80 flex items-center px-5">
          <Bookmark className="w-7 h-7 text-blue-400" />
        </div>
      )}

      {/* Card Content */}
      <div className={`${paddingClass} flex-1 flex flex-col justify-between`}>
        <div>
          {/* Site Badge */}
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
              {isSelectMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticTap();
                    onToggleSelect?.(item.id);
                  }}
                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition touch-manipulation shrink-0 ${
                    isSelected
                      ? 'bg-brand-500 border-brand-500 text-white shadow-sm'
                      : 'bg-zinc-800 border-zinc-600 text-transparent hover:border-zinc-400'
                  }`}
                  title={isSelected ? 'Deselect' : 'Select'}
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              )}
              {meta.favicon ? (
                <img src={meta.favicon} alt="" className="w-4 h-4 rounded-sm shrink-0" />
              ) : (
                <Globe className="w-4 h-4 text-zinc-500 shrink-0" />
              )}
              <span className="truncate font-medium">{meta.siteName || meta.url}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {Boolean(item.hide_from_all) && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/25 rounded-md"
                  title="Hidden from All Items feed"
                >
                  <EyeOff className="w-3 h-3" />
                  <span className="hidden sm:inline">Hidden</span>
                </span>
              )}
              <span className="px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-lg">
                Bookmark
              </span>
            </div>
          </div>

          {/* Title */}
          <h3 className="font-bold text-zinc-100 text-lg leading-snug hover:text-blue-400 transition-colors">
            <a href={meta.url} target="_blank" rel="noopener noreferrer">
              {item.title || meta.ogTitle || meta.url}
            </a>
          </h3>

          {/* Description */}
          {(meta.ogDescription || item.content) && (
            <p className="text-sm text-zinc-300 mt-2 line-clamp-3 leading-relaxed">
              {item.content || meta.ogDescription}
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-zinc-800/90 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <a
            href={meta.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => hapticTap()}
            className="flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-md shadow-blue-500/20 active:scale-95 touch-manipulation"
          >
            <span>Visit Link</span>
            <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
          </a>

          <div className="flex items-center gap-1 sm:ml-auto">
            {isTrash ? (
              <button
                type="button"
                onClick={() => {
                  hapticSuccess();
                  if (onRestore) onRestore(item);
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition touch-manipulation"
                title="Restore from Trash"
                aria-label="Restore bookmark"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            ) : (
              onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    hapticTap();
                    onEdit(item);
                  }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition touch-manipulation"
                  title="Edit Bookmark"
                  aria-label="Edit bookmark"
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
                title="Duplicate Bookmark"
                aria-label="Duplicate bookmark"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onDelete(item.id);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition touch-manipulation"
              title={isTrash ? 'Permanently Delete' : 'Delete'}
              aria-label={isTrash ? 'Permanently Delete' : 'Delete bookmark'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
