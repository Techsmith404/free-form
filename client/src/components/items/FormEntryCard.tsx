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

  // Check if there is a signature or rating to highlight
  const hasSignature = Object.values(values).some(
    (v) => typeof v === 'string' && (v.startsWith('/uploads/') || v.startsWith('data:image'))
  );

  return (
    <div
      onClick={() => onOpenForm(item)}
      className="flex flex-col justify-between p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-brand-500/40 hover:bg-zinc-900 transition shadow-lg cursor-pointer group"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 truncate">
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-md flex items-center gap-1">
              <ClipboardList className="w-3 h-3" />
              <span>{meta.template_name || 'Form'}</span>
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

        {/* Form Quick Info Pills */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {hasSignature && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              <PenTool className="w-3 h-3" />
              <span>Signed</span>
            </span>
          )}

          {Object.keys(values).length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {Object.keys(values).length} fields recorded
            </span>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div
        className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[11px] text-zinc-500">
          {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenMarkdown(item)}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition py-0.5 px-1.5 rounded hover:bg-zinc-800"
            title="View Markdown Document"
          >
            <Eye className="w-3 h-3 text-zinc-400" />
            <span>Markdown</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenForm(item)}
            className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 font-medium transition py-0.5 px-1.5 rounded hover:bg-brand-500/10"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit Form</span>
          </button>
        </div>
      </div>
    </div>
  );
};
