import React from 'react';
import { Item, FormEntryMetadata } from '../../types/index.js';
import { ClipboardList, Star, Pin, Trash2, Edit2, PenTool, Eye } from 'lucide-react';

interface FormEntryCardProps {
  item: Item;
  onOpenForm: (item: Item) => void;
  onOpenMarkdown: (item: Item) => void;
  onToggleFavorite: (item: Item) => void;
  onTogglePin: (item: Item) => void;
  onDelete: (id: string) => void;
}

export const FormEntryCard: React.FC<FormEntryCardProps> = ({
  item,
  onOpenForm,
  onOpenMarkdown,
  onToggleFavorite,
  onTogglePin,
  onDelete
}) => {
  const meta: FormEntryMetadata = item.metadata || { template_id: '', template_name: 'Form Entry', values: {} };
  const values = meta.values || {};

  const hasSignature = Object.values(values).some(
    (v) => typeof v === 'string' && (v.startsWith('/uploads/') || v.startsWith('data:image'))
  );

  return (
    <div
      onClick={() => onOpenForm(item)}
      className="flex flex-col justify-between p-5 rounded-2xl bg-zinc-900 border border-zinc-750/80 hover:border-brand-500/60 transition-all duration-200 shadow-lg shadow-black/40 ring-1 ring-white/5 cursor-pointer group active:scale-[0.99]"
    >
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 truncate">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-brand-500/15 text-brand-400 border border-brand-500/30 rounded-lg">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>{meta.template_name || 'Form'}</span>
            </span>
            {item.notebook_name && (
              <span className="text-xs font-medium text-zinc-400 truncate max-w-[140px]">
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

        {/* Badges / Pill Summary */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {hasSignature && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
              <PenTool className="w-3.5 h-3.5" />
              <span>Signed</span>
            </span>
          )}

          {Object.keys(values).length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300 font-medium">
              {Object.keys(values).length} fields filled
            </span>
          )}
        </div>
      </div>

      {/* Footer Actions (Touch Friendly!) */}
      <div
        className="mt-5 pt-3.5 border-t border-zinc-800/90 flex items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-zinc-400 font-medium">
          {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenMarkdown(item)}
            className="flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 text-xs font-semibold transition active:scale-95"
            title="View Rendered Markdown Document"
          >
            <Eye className="w-3.5 h-3.5 text-zinc-400" />
            <span>Markdown</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenForm(item)}
            className="flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition shadow-md shadow-brand-500/20 active:scale-95"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Form</span>
          </button>
        </div>
      </div>
    </div>
  );
};
