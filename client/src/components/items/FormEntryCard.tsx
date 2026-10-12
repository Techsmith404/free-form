import React, { useState, useEffect } from 'react';
import { Item, FormEntryMetadata, FormTemplate, FormFieldDefinition, DensityMode } from '../../types/index.js';
import {
  ClipboardList,
  Star,
  Pin,
  Trash2,
  Edit2,
  PenTool,
  Eye,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  XCircle,
  Calendar,
  Clock,
  Table as TableIcon,
  EyeOff,
  RotateCcw,
  Check,
  Copy,
  RotateCw
} from 'lucide-react';
import { hapticSuccess, hapticTap } from '../../services/native.js';

interface FormEntryCardProps {
  item: Item;
  density?: DensityMode;
  template?: FormTemplate | null;
  isExpanded?: boolean;
  isTrashMode?: boolean;
  onOpenForm: (item: Item) => void;
  onOpenMarkdown: (item: Item) => void;
  onToggleFavorite: (item: Item) => void;
  onTogglePin: (item: Item) => void;
  onToggleProcessed?: (item: Item) => void;
  onDelete: (id: string) => void;
  onRestore?: (item: Item) => void;
  onDuplicate?: (item: Item) => void;
  onRepeatLog?: (item: Item) => void;
  isSelected?: boolean;
  isSelectMode?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const FormEntryCard: React.FC<FormEntryCardProps> = ({
  item,
  density = 'cozy',
  template,
  isExpanded = false,
  isTrashMode = false,
  onOpenForm,
  onOpenMarkdown,
  onToggleFavorite,
  onTogglePin,
  onToggleProcessed,
  onDelete,
  onRestore,
  onDuplicate,
  onRepeatLog,
  isSelected = false,
  isSelectMode = false,
  onToggleSelect
}) => {
  const meta: FormEntryMetadata = item.metadata || { template_id: '', template_name: 'Form Entry', values: {} };
  const values = meta.values || {};
  const isProcessed = Boolean(meta.is_processed);

  // Local card expand override: null means inherit from parent isExpanded
  const [localExpanded, setLocalExpanded] = useState<boolean | null>(null);

  useEffect(() => {
    // Reset local override when global isExpanded changes
    setLocalExpanded(null);
  }, [isExpanded]);

  // When processed, default to compact view unless user explicitly expanded this specific card
  const defaultExpanded = isProcessed ? false : isExpanded;
  const expanded = localExpanded !== null ? localExpanded : defaultExpanded;

  // Schema fields to render
  const fields: FormFieldDefinition[] = template?.fields_schema || [];

  const hasSignature = Object.values(values).some(
    (v) => typeof v === 'string' && (v.startsWith('/uploads/') || v.startsWith('data:image'))
  );

  const handleToggleProcessed = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticTap();
    if (onToggleProcessed) {
      onToggleProcessed(item);
    }
  };

  const isTrash = isTrashMode || Boolean(item.is_archived);

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectMode || e.metaKey || e.ctrlKey || e.shiftKey) {
      e.stopPropagation();
      hapticTap();
      onToggleSelect?.(item.id);
      return;
    }
    hapticTap();
    if (isTrash) {
      onOpenMarkdown(item);
    } else {
      onOpenForm(item);
    }
  };

  const paddingClass =
    density === 'compact'
      ? 'p-3'
      : density === 'comfortable'
        ? 'p-3.5 sm:p-4'
        : 'p-4 sm:p-5';

  const titleClass =
    density === 'compact'
      ? 'text-base font-bold leading-snug transition-colors'
      : density === 'comfortable'
        ? 'text-base sm:text-lg font-bold leading-snug transition-colors'
        : 'text-lg sm:text-xl font-bold leading-snug transition-colors';

  const footerSpacingClass =
    density === 'compact' ? 'mt-3 pt-2.5' : density === 'comfortable' ? 'mt-4 pt-3' : 'mt-5 pt-3.5';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open form entry: ${item.title}`}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            handleCardClick(e as any);
          }
        }
      }}
      className={`flex flex-col justify-between ${paddingClass} rounded-2xl border transition-all duration-200 shadow-md shadow-black/30 cursor-pointer group active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-brand-500/50 ${
        isSelected
          ? 'border-brand-500 ring-2 ring-brand-500/40 bg-brand-500/5'
          : isProcessed
          ? 'opacity-65 grayscale-[35%] bg-zinc-950/40 border-dashed border-zinc-800/90 hover:opacity-100 hover:grayscale-0 ring-1 ring-white/5'
          : 'bg-zinc-900/95 border-zinc-800 hover:border-zinc-700/80 ring-1 ring-white/5'
      }`}
    >
      <div>
        {/* Card Header Bar */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
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
                <Check className="w-4 h-4 stroke-[3]" />
              </button>
            )}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold tracking-wide uppercase rounded-lg border shrink-0 ${
              isProcessed
                ? 'bg-zinc-800 text-zinc-400 border-zinc-700/60'
                : 'bg-brand-500/15 text-brand-400 border-brand-500/30'
            }`}>
              <ClipboardList className="w-3.5 h-3.5" />
              <span>{meta.template_name || 'Form'}</span>
            </span>
            {item.notebook_name && (
              <span className="text-xs font-medium text-zinc-400 truncate max-w-[130px]">
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

          <div
            className="flex items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {isTrash ? (
              <button
                type="button"
                onClick={() => {
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
              <>
                {/* 1-Tap Processed / Seen Toggle */}
                <button
                  type="button"
                  onClick={handleToggleProcessed}
                  aria-label={isProcessed ? `Mark ${item.title} as pending` : `Mark ${item.title} as processed`}
                  className={`min-h-[44px] px-2.5 sm:px-3 flex items-center gap-1.5 rounded-lg text-xs font-semibold transition-all touch-manipulation active:scale-95 shrink-0 ${
                    isProcessed
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                      : 'bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={isProcessed ? 'Marked as Processed / Seen (click to mark pending)' : 'Mark as Processed / Seen'}
                >
                  {isProcessed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20 shrink-0" />
                      <span className="text-[11px] font-bold">Seen</span>
                    </>
                  ) : (
                    <>
                      <Circle className="w-4 h-4 text-zinc-500 hover:text-emerald-400 shrink-0" />
                      <span className="text-[11px]">Mark Seen</span>
                    </>
                  )}
                </button>

                {/* Toggle Single Card Expand */}
                <button
                  type="button"
                  onClick={() => {
                    hapticTap();
                    setLocalExpanded(!expanded);
                  }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition touch-manipulation"
                  title={expanded ? 'Collapse details' : 'Show full details'}
                  aria-label={expanded ? `Collapse details for ${item.title}` : `Expand details for ${item.title}`}
                >
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticTap();
                    onToggleFavorite(item);
                  }}
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition touch-manipulation ${
                    item.is_favorite
                      ? 'text-amber-400 bg-amber-400/10'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                  }`}
                  title="Favorite"
                  aria-label={item.is_favorite ? `Unfavorite ${item.title}` : `Favorite ${item.title}`}
                >
                  <Star className={`w-4 h-4 ${item.is_favorite ? 'fill-amber-400' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    hapticTap();
                    onTogglePin(item);
                  }}
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition touch-manipulation ${
                    item.is_pinned
                      ? 'text-brand-400 bg-brand-400/10'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                  }`}
                  title="Pin to top"
                  aria-label={item.is_pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
                >
                  <Pin className={`w-4 h-4 ${item.is_pinned ? 'fill-brand-400' : ''}`} />
                </button>
                {onDuplicate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      hapticTap();
                      onDuplicate(item);
                    }}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition touch-manipulation"
                    title="Duplicate entry"
                    aria-label={`Duplicate ${item.title}`}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => {
                hapticTap();
                onDelete(item.id);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition touch-manipulation"
              title={isTrash ? 'Permanently Delete' : 'Delete'}
              aria-label={isTrash ? `Permanently delete ${item.title}` : `Move ${item.title} to trash`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 className={`${titleClass} ${
          isProcessed
            ? 'text-zinc-400 line-through decoration-zinc-600'
            : 'text-zinc-100 group-hover:text-brand-400'
        }`}>
          {item.title}
        </h3>

        {/* Badges Bar */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {isProcessed && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 font-semibold">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Processed</span>
            </span>
          )}

          {hasSignature && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
              <PenTool className="w-3 h-3" />
              <span>Signed</span>
            </span>
          )}

          {Object.keys(values).length > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-md bg-zinc-800 border border-zinc-700/60 text-zinc-300 font-medium">
              {Object.keys(values).length} fields
            </span>
          )}
        </div>

        {/* Detailed Form Elements Container */}
        {expanded ? (
          <div className="mt-4 pt-3.5 border-t border-zinc-800/80 space-y-3.5 text-xs sm:text-sm">
            {fields.length > 0 ? (
              fields.map((field) => {
                const val = values[field.id];

                if (field.type === 'header') {
                  return (
                    <div key={field.id} className="pt-2 border-t border-zinc-800/60 first:border-0 first:pt-0">
                      <span className="font-bold text-zinc-200 text-xs tracking-wide uppercase">
                        {field.label}
                      </span>
                    </div>
                  );
                }

                if (val === undefined || val === null || val === '') return null;

                if (field.type === 'rating') {
                  const num = Number(val) || 0;
                  return (
                    <div key={field.id} className="flex items-center justify-between p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                      <span className="text-zinc-400 font-medium">{field.label}:</span>
                      <div className="flex items-center gap-1 text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${s <= num ? 'fill-amber-400' : 'text-zinc-700'}`}
                          />
                        ))}
                        <span className="ml-1 text-xs font-bold text-zinc-300">({num}/5)</span>
                      </div>
                    </div>
                  );
                }

                if (field.type === 'checkbox') {
                  return (
                    <div key={field.id} className="flex items-center justify-between p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                      <span className="text-zinc-300 font-medium">{field.label}</span>
                      {val ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Yes</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                          <XCircle className="w-4 h-4" />
                          <span>No</span>
                        </span>
                      )}
                    </div>
                  );
                }

                if (field.type === 'signature') {
                  return (
                    <div key={field.id} className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                      <span className="text-xs text-zinc-400 font-medium block mb-1.5">{field.label}:</span>
                      {typeof val === 'string' && (val.startsWith('/uploads/') || val.startsWith('data:image')) ? (
                        <div className="h-20 max-w-[200px] rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center p-1">
                          <img src={val} alt="Signature" className="max-h-full object-contain filter drop-shadow" />
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-brand-400">Signed: {String(val)}</span>
                      )}
                    </div>
                  );
                }

                if (field.type === 'table') {
                  const rows = Array.isArray(val) ? val : [];
                  const columns = field.columns || [];
                  return (
                    <div key={field.id} className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <TableIcon className="w-3.5 h-3.5 text-teal-400" />
                          <span>{field.label}</span>
                        </span>
                        <span>{rows.length} {rows.length === 1 ? 'row' : 'rows'}</span>
                      </div>

                      {rows.length > 0 && columns.length > 0 && (
                        <div className="border border-zinc-800 rounded-xl overflow-x-auto bg-zinc-950/80 text-xs">
                          <table className="w-full text-left">
                            <thead className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800">
                              <tr>
                                {columns.map((c) => (
                                  <th key={c.id} className="py-1.5 px-2.5 font-semibold">
                                    {c.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                              {rows.map((row, rIdx) => (
                                <tr key={rIdx}>
                                  {columns.map((c) => (
                                    <td key={c.id} className="py-1.5 px-2.5 text-zinc-200">
                                      {c.type === 'checkbox' ? (row[c.id] ? '✓' : '✗') : String(row[c.id] ?? '')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={field.id} className="flex items-baseline justify-between gap-3 py-1 border-b border-zinc-800/50">
                    <span className="text-zinc-400 text-xs font-medium shrink-0">{field.label}:</span>
                    <span className="text-zinc-100 font-semibold text-right break-words">
                      {String(val)}{field.unit ? ` ${field.unit}` : ''}
                    </span>
                  </div>
                );
              })
            ) : (
              // Fallback if template is not loaded yet
              Object.entries(values).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-400 text-xs font-medium shrink-0">{k}:</span>
                  <span className="text-zinc-100 font-semibold text-right">{String(v)}</span>
                </div>
              ))
            )}
          </div>
        ) : (
          // Collapsed preview: show snippet of top fields
          <div className="mt-3 text-xs text-zinc-400 space-y-1">
            {Object.entries(values).slice(0, 2).map(([k, v]) => {
              if (typeof v === 'object') return null;
              const fieldDef = fields.find((f) => f.id === k);
              const label = fieldDef?.label || k;
              return (
                <div key={k} className="flex items-center gap-2 truncate">
                  <span className="text-zinc-500">•</span>
                  <span className="font-medium text-zinc-400">{label}:</span>
                  <span className="text-zinc-200 font-medium truncate">{String(v)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div
        className={`${footerSpacingClass} border-t border-zinc-800/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setLocalExpanded(!expanded)}
          aria-label={expanded ? `Collapse details for ${item.title}` : `Show full details for ${item.title}`}
          className="text-xs text-zinc-400 hover:text-zinc-200 font-semibold flex items-center gap-1 min-h-[44px] px-2 py-2.5 sm:py-1 justify-center sm:justify-start touch-manipulation"
        >
          <span>{expanded ? 'Less Details' : 'Show Details'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenMarkdown(item)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 text-xs font-semibold transition active:scale-95 touch-manipulation"
            title="View Rendered Markdown Document"
            aria-label={`View rendered markdown document for ${item.title}`}
          >
            <Eye className="w-3.5 h-3.5 text-zinc-400" />
            <span>Markdown</span>
          </button>

          {onRepeatLog && !isTrash && (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onRepeatLog(item);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-brand-400 hover:text-brand-300 border border-zinc-700/60 text-xs font-bold transition shadow-sm active:scale-95 touch-manipulation"
              title="Repeat Log: Pre-fill a new entry with this data"
              aria-label={`Repeat log for ${item.title}`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Repeat Log</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenForm(item)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition shadow-md shadow-brand-500/20 active:scale-95 touch-manipulation"
            aria-label={`Edit form for ${item.title}`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Form</span>
          </button>
        </div>
      </div>
    </div>
  );
};

