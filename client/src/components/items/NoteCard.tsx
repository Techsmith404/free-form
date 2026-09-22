import React from 'react';
import { Item } from '../../types/index.js';
import { FileText, Star, Pin, Trash2, Edit2 } from 'lucide-react';

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
    .slice(0, 140)
    .trim();

  return (
    <div
      onClick={() => onOpen(item)}
      className="flex flex-col justify-between p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 transition shadow-lg cursor-pointer group"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-zinc-800 text-zinc-300 rounded-md flex items-center gap-1">
              <FileText className="w-3 h-3 text-brand-400" />
              <span>Note</span>
            </span>
            {item.notebook_name && (
              <span className="text-xs text-zinc-500 truncate max-w-[120px]">
                in {item.notebook_name}
              </span>
            )}
          </div>

          <div
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onToggleFavorite(item)}
              className={`p-1.5 rounded-lg transition ${
                item.is_favorite ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Favorite"
            >
              <Star className={`w-3.5 h-3.5 ${item.is_favorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => onTogglePin(item)}
              className={`p-1.5 rounded-lg transition ${
                item.is_pinned ? 'text-brand-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Pin to top"
            >
              <Pin className={`w-3.5 h-3.5 ${item.is_pinned ? 'fill-brand-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 transition"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <h3 className="font-semibold text-zinc-100 text-base leading-snug line-clamp-2 group-hover:text-brand-400 transition">
          {item.title}
        </h3>

        <p className="text-xs text-zinc-400 mt-2 line-clamp-3 leading-relaxed font-sans">
          {snippet || <span className="italic text-zinc-600">Empty note</span>}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
        <span>{new Date(item.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
        {item.tags && item.tags.length > 0 && (
          <div className="flex gap-1 overflow-hidden">
            {item.tags.slice(0, 2).map((t, idx) => {
              const name = typeof t === 'string' ? t : t.name;
              const key = typeof t === 'string' ? `${t}-${idx}` : t.id;
              return (
                <span key={key} className="text-[10px] text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800">
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
