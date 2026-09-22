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
    <div className="flex flex-col justify-between rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition shadow-lg overflow-hidden group">
      {/* Cover Image */}
      {meta.ogImage ? (
        <div className="relative w-full h-36 bg-zinc-950 overflow-hidden">
          <img
            src={meta.ogImage}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
        </div>
      ) : (
        <div className="w-full h-16 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 flex items-center px-4">
          <Bookmark className="w-6 h-6 text-blue-400" />
        </div>
      )}

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Site Badge */}
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
            <div className="flex items-center gap-1.5 truncate">
              {meta.favicon ? (
                <img src={meta.favicon} alt="" className="w-3.5 h-3.5 rounded-sm" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-zinc-500" />
              )}
              <span className="truncate">{meta.siteName || meta.url}</span>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
              Bookmark
            </span>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-zinc-100 text-sm leading-snug line-clamp-2 hover:text-blue-400 transition">
            <a href={meta.url} target="_blank" rel="noopener noreferrer">
              {item.title || meta.ogTitle || meta.url}
            </a>
          </h3>

          {/* Description snippet */}
          {(meta.ogDescription || item.content) && (
            <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
              {item.content || meta.ogDescription}
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
          <a
            href={meta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition"
          >
            <span>Visit Site</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                title="Edit Bookmark"
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
      </div>
    </div>
  );
};
