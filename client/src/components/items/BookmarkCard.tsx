import React from 'react';
import { Item, BookmarkMetadata } from '../../types/index.js';
import { ExternalLink, Globe, Trash2, Edit2, Bookmark } from 'lucide-react';

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
    <div className="flex flex-col justify-between rounded-2xl bg-zinc-900 border border-zinc-750/80 hover:border-blue-500/50 transition-all duration-200 shadow-lg shadow-black/40 ring-1 ring-white/5 overflow-hidden group">
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
            <span className="px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-lg shrink-0">
              Bookmark
            </span>
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
        <div className="pt-3 border-t border-zinc-800/90 flex items-center justify-between">
          <a
            href={meta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-md shadow-blue-500/20 active:scale-95"
          >
            <span>Visit Link</span>
            <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
          </a>

          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
                title="Edit Bookmark"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition"
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
