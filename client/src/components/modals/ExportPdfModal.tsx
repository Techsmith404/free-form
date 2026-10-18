import React, { useState, useEffect, useMemo } from 'react';
import { Notebook, Item } from '../../types/index.js';
import { exportPdf } from '../../api/index.js';
import { renderItemToHtml } from '../../utils/export.js';
import { hapticTap, hapticMedium } from '../../services/native.js';
import {
  FileDown,
  X,
  CheckSquare,
  Square,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Loader2,
  Search,
  FileText,
  Hash,
  Bookmark,
  Images,
  RotateCcw,
  AlertCircle
} from 'lucide-react';

export interface ExportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  notebook?: Notebook | null;
  notes?: Item[];
  onSuccess?: () => void;
}

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  isOpen,
  onClose,
  notebook,
  notes = [],
  onSuccess
}) => {
  const [orderedNotes, setOrderedNotes] = useState<Item[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Drag and Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Initialize state when modal opens or notes change
  useEffect(() => {
    if (isOpen) {
      const initialSorted = [...notes].sort((a, b) => {
        if (Boolean(b.is_pinned) !== Boolean(a.is_pinned)) {
          return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
        }
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      setOrderedNotes(initialSorted);
      // Default: all notes selected (Requirement 2)
      setSelectedIds(new Set(initialSorted.map((n) => n.id)));
      setDocumentTitle(notebook?.name || 'Notebook Export');
      setSearchQuery('');
      setErrorMessage(null);
      setIsExporting(false);
      setDraggedIndex(null);
      setDragOverIndex(null);
    }
  }, [isOpen, notes, notebook]);

  // Filtered notes for search query
  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orderedNotes;
    return orderedNotes.filter((note) => {
      const matchTitle = (note.title || '').toLowerCase().includes(q);
      const matchContent = (note.content || '').toLowerCase().includes(q);
      const matchTags = Array.isArray(note.tags) && note.tags.some((t: any) => {
        const name = typeof t === 'string' ? t : t?.name;
        return name && name.toLowerCase().includes(q);
      });
      return matchTitle || matchContent || matchTags;
    });
  }, [orderedNotes, searchQuery]);

  if (!isOpen) return null;

  const allSelected = orderedNotes.length > 0 && selectedIds.size === orderedNotes.length;
  const someSelected = selectedIds.size > 0;
  const isFiltered = searchQuery.trim().length > 0;

  // Toggle selection for a single note
  const handleToggleSelect = (id: string) => {
    hapticTap();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all or deselect all
  const handleToggleSelectAll = () => {
    hapticTap();
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orderedNotes.map((n) => n.id)));
    }
  };

  // Reorder: Move Up
  const handleMoveUp = (fullIndex: number) => {
    if (fullIndex <= 0) return;
    hapticTap();
    setOrderedNotes((prev) => {
      const next = [...prev];
      const temp = next[fullIndex];
      next[fullIndex] = next[fullIndex - 1];
      next[fullIndex - 1] = temp;
      return next;
    });
  };

  // Reorder: Move Down
  const handleMoveDown = (fullIndex: number) => {
    if (fullIndex >= orderedNotes.length - 1) return;
    hapticTap();
    setOrderedNotes((prev) => {
      const next = [...prev];
      const temp = next[fullIndex];
      next[fullIndex] = next[fullIndex + 1];
      next[fullIndex + 1] = temp;
      return next;
    });
  };

  // Reset to initial order
  const handleResetOrder = () => {
    hapticTap();
    const initialSorted = [...notes].sort((a, b) => {
      if (Boolean(b.is_pinned) !== Boolean(a.is_pinned)) {
        return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    setOrderedNotes(initialSorted);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (isFiltered || isExporting) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent or ghost image
    try {
      e.dataTransfer.setData('text/plain', String(index));
    } catch {
      // ignore
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (isFiltered || isExporting || draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    if (isFiltered || isExporting) return;
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    hapticTap();
    setOrderedNotes((prev) => {
      const next = [...prev];
      const [item] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // PDF Export submission
  const handleExport = async () => {
    const selectedNotes = orderedNotes.filter((n) => selectedIds.has(n.id));
    if (selectedNotes.length === 0) return;

    setIsExporting(true);
    setErrorMessage(null);

    try {
      // Build note objects with pre-rendered TipTap-compatible HTML
      const payloadNotes = selectedNotes.map((note) => ({
        id: note.id,
        title: note.title,
        html: renderItemToHtml(note),
        content: note.content,
        type: note.type,
        metadata: note.metadata,
        tags: note.tags,
        created_at: note.created_at,
        updated_at: note.updated_at
      }));

      await exportPdf({
        notebookId: notebook?.id,
        notebookName: documentTitle.trim() || notebook?.name || 'Notebook Export',
        notes: payloadNotes,
        ids: selectedNotes.map((n) => n.id)
      });

      hapticMedium();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      setErrorMessage(err?.message || 'Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const getItemIcon = (type?: string) => {
    switch (type) {
      case 'counter':
        return <Hash className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'bookmark':
        return <Bookmark className="w-4 h-4 text-blue-400 shrink-0" />;
      case 'poster':
        return <Images className="w-4 h-4 text-purple-400 shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-brand-400 shrink-0" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={!isExporting ? onClose : undefined}
    >
      <div
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                Export Notebook as PDF
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {notebook?.name ? `Notebook: ${notebook.name}` : 'Select and order notes to export'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isExporting) {
                hapticTap();
                onClose();
              }
            }}
            disabled={isExporting}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition disabled:opacity-40"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-4 sm:px-6 bg-zinc-950/60 border-b border-zinc-800/80 space-y-3 shrink-0">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Document Title / Filename
            </label>
            <input
              type="text"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder="e.g. My Project Notes"
              disabled={isExporting}
              className="w-full h-10 px-3.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-brand-500 transition disabled:opacity-50"
            />
          </div>

          {/* Selection & Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                disabled={isExporting || orderedNotes.length === 0}
                className="flex items-center gap-1.5 py-1 px-2 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition touch-manipulation disabled:opacity-50"
              >
                {allSelected ? (
                  <CheckSquare className="w-4 h-4 text-brand-400" />
                ) : (
                  <Square className="w-4 h-4 text-zinc-500" />
                )}
                <span>
                  {allSelected
                    ? 'Deselect All'
                    : `Select All (${selectedIds.size}/${orderedNotes.length})`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleResetOrder}
                disabled={isExporting || orderedNotes.length === 0}
                className="flex items-center gap-1 py-1 px-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition touch-manipulation disabled:opacity-50"
                title="Reset note sequence to default order"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Order</span>
              </button>
            </div>

            {/* Quick search filter */}
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter notes..."
                disabled={isExporting}
                className="w-full h-8 pl-8 pr-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-brand-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-red-400 text-xs shrink-0 animate-in fade-in">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Export Failed</p>
              <p className="mt-0.5 text-red-400/90">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Notes Reordering & Selection List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 min-h-[220px]">
          {filteredNotes.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              {orderedNotes.length === 0 ? (
                <>
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 text-zinc-400" />
                  <p>No notes available in this notebook to export.</p>
                </>
              ) : (
                <p>No notes matching &quot;{searchQuery}&quot;.</p>
              )}
            </div>
          ) : (
            filteredNotes.map((note) => {
              const fullIndex = orderedNotes.findIndex((n) => n.id === note.id);
              const isSelected = selectedIds.has(note.id);
              const isFirst = fullIndex === 0;
              const isLast = fullIndex === orderedNotes.length - 1;
              const isBeingDragged = draggedIndex === fullIndex;
              const isBeingDragOver = dragOverIndex === fullIndex;

              // Plain text preview
              const snippet = (note.content || '')
                .replace(/[#*`_[\]()]/g, '')
                .replace(/\s+/g, ' ')
                .trim();

              return (
                <div
                  key={note.id}
                  draggable={!isFiltered && !isExporting}
                  onDragStart={(e) => handleDragStart(e, fullIndex)}
                  onDragOver={(e) => handleDragOver(e, fullIndex)}
                  onDrop={(e) => handleDrop(e, fullIndex)}
                  onDragEnd={handleDragEnd}
                  className={`group flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border transition select-none ${
                    isBeingDragOver
                      ? 'border-brand-500 bg-brand-500/10'
                      : isBeingDragged
                      ? 'opacity-40 border-dashed border-zinc-600 bg-zinc-800'
                      : isSelected
                      ? 'bg-zinc-800/80 border-zinc-700/80 hover:border-zinc-600'
                      : 'bg-zinc-900/60 border-zinc-800/80 opacity-60 hover:opacity-90'
                  }`}
                >
                  {/* Drag Handle & Order Badge */}
                  <div
                    className={`flex items-center gap-1.5 shrink-0 ${
                      isFiltered ? 'opacity-30' : 'cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300'
                    }`}
                    title={isFiltered ? 'Clear search filter to drag and reorder' : 'Drag to reorder note'}
                  >
                    <GripVertical className="w-4 h-4" />
                    <span className="text-[11px] font-mono font-bold text-zinc-500 group-hover:text-zinc-300 w-5 text-right">
                      #{fullIndex + 1}
                    </span>
                  </div>

                  {/* Inclusion Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggleSelect(note.id)}
                    disabled={isExporting}
                    className="p-1 rounded-md text-zinc-400 hover:text-white transition shrink-0 touch-manipulation"
                    title={isSelected ? 'Deselect note from export' : 'Select note for export'}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-brand-400" />
                    ) : (
                      <Square className="w-5 h-5 text-zinc-500" />
                    )}
                  </button>

                  {/* Note Type Icon */}
                  <div className="shrink-0">{getItemIcon(note.type)}</div>

                  {/* Note Details */}
                  <div className="flex-1 min-w-0" onClick={() => handleToggleSelect(note.id)}>
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-sm font-semibold truncate ${
                          isSelected ? 'text-zinc-100' : 'text-zinc-400'
                        }`}
                      >
                        {note.title?.trim() || <span className="italic text-zinc-500">Untitled Note</span>}
                      </h4>
                      {Boolean(note.is_pinned) && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                          Pinned
                        </span>
                      )}
                    </div>
                    {snippet && (
                      <p className="text-xs text-zinc-400 truncate mt-0.5">
                        {snippet}
                      </p>
                    )}
                  </div>

                  {/* Reorder Up / Down Controls */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(fullIndex)}
                      disabled={isFirst || isExporting}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/80 transition disabled:opacity-20 disabled:pointer-events-none touch-manipulation"
                      title="Move up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(fullIndex)}
                      disabled={isLast || isExporting}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/80 transition disabled:opacity-20 disabled:pointer-events-none touch-manipulation"
                      title="Move down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 sm:px-6 bg-zinc-950 border-t border-zinc-800 shrink-0">
          <div className="text-xs text-zinc-400">
            <span className="font-bold text-zinc-200">{selectedIds.size}</span> of{' '}
            <span>{orderedNotes.length}</span> notes will be exported
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onClose();
              }}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition touch-manipulation disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={!someSelected || isExporting}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-brand-500/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none touch-manipulation"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Export PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
