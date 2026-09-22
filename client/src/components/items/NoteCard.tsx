import React from 'react';
import { Item, Tag } from '../../types/index.js';
import { FileText, Star, Pin, Trash2 } from 'lucide-react';

interface NoteCardProps {
  item: Item;
  onOpen: (item: Item) => void;
  onToggleFavorite: (item: Item) => void;
  onTogglePin: (item: Item) => void;
  onDelete: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  item,
  onOpen,
  onToggleFavorite,
  onTogglePin,
  onDelete
}) => {
  // Strip Markdown symbols for a clean card preview snippet
  const snippet = (item.content || '')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_`~>#]/g, '')
    .slice(0, 160)
    .trim();

  return (
    <div
      onClick={() => onOpen(item)}
      className="flex flex-col justify-between p-5 rounded-2xl bg-zinc-900 border border-zinc-750/70 hover:border-brand-500/50 transition-all duration-200 shadow-lg shadow-black/40 ring-1 ring-white/5 cursor-pointer group active:scale-[0.99]"
    >
      <div>
        {/* Card Header Bar */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 truncate">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg">
              <FileText className="w-3.5 h-3.5 text-brand-400" />
              <span>Note</span>
            </span>
            {item.notebook_name && (
              <span className="text-xs font-medium text-zinc-400 truncate max-w-[150px]">
                {item.notebook_name}
              </span>
            )}
          </div>

          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onToggleFavorite(item)}
              className={`p-2 rounded-lg transition ${
                item.is_favorite
                  ? 'text-amber-400 bg-amber-400/10'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
              title="Favorite"
            >
              <Star className={`w-4 h-4 ${item.is_favorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => onTogglePin(item)}
              className={`p-2 rounded-lg transition ${
                item.is_pinned
                  ? 'text-brand-400 bg-brand-400/10'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
              title="Pin to top"
            >
              <Pin className={`w-4 h-4 ${item.is_pinned ? 'fill-brand-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-zinc-100 text-lg sm:text-xl leading-snug group-hover:text-brand-400 transition-colors">
          {item.title}
        </h3>

        {/* Content Preview */}
        <p className="text-sm text-zinc-300 mt-2.5 line-clamp-3 leading-relaxed">
          {snippet || <span className="italic text-zinc-500">Empty note</span>}
        </p>
      </div>

      {/* Card Footer */}
      <div className="mt-5 pt-3 border-t border-zinc-800/90 flex items-center justify-between text-xs text-zinc-400">
        <span className="font-medium">
          {new Date(item.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        {item.tags && item.tags.length > 0 && (
          <div className="flex gap-1.5 overflow-hidden">
            {item.tags.slice(0, 2).map((t, idx) => {
              const name = typeof t === 'string' ? t : t.name;
              const key = typeof t === 'string' ? `${t}-${idx}` : t.id;
              return (
                <span key={key} className="text-xs text-zinc-300 px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700/60 font-medium">
                  #{name}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
