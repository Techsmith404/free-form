import React from 'react';
import { Item, BookmarkMetadata } from '../../types/index.js';
import { ExternalLink, Globe, Trash2, Edit2, Bookmark, EyeOff } from 'lucide-react';
import { hapticTap } from '../../services/native.js';

interface BookmarkCardProps {
  item: Item;
  onUpdate: (updated: Item) => void;
  onDelete: (id: string) => void;
  onEdit?: (item: Item) => void;
}

export const BookmarkCard: React.FC<BookmarkCardProps> = ({
  item,
  onDelete,
  onEdit
}) => {
  const meta: BookmarkMetadata = item.metadata || { url: '#' };

  return (
    <div className="flex flex-col justify-between rounded-2xl bg-zinc-900/95 border border-zinc-800 hover:border-zinc-700/80 transition-all duration-200 shadow-md shadow-black/30 ring-1 ring-white/5 overflow-hidden group">
      {/* Cover Image */}
      {meta.ogImage ? (
        <div className="relative w-full h-44 bg-zinc-950 overflow-hidden border-b border-zinc-800">
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
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Site Badge */}
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <div className="flex items-center gap-2 truncate">
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
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  onEdit(item);
                }}
                className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition touch-manipulation"
                title="Edit Bookmark"
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
              className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition touch-manipulation"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
