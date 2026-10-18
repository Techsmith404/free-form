import React from 'react';
import {
  Folder,
  Star,
  Pin,
  Trash2,
  Download,
  FileDown,
  X,
  CheckSquare,
  Square
} from 'lucide-react';
import { hapticTap } from '../../services/native.js';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  isAllSelected: boolean;
  onToggleSelectAll: () => void;
  onOpenMoveModal: () => void;
  onBatchTogglePin: () => void;
  onBatchToggleFavorite: () => void;
  onBatchExport: () => void;
  onBatchExportPdf?: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
  isTrashMode?: boolean;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  totalCount,
  isAllSelected,
  onToggleSelectAll,
  onOpenMoveModal,
  onBatchTogglePin,
  onBatchToggleFavorite,
  onBatchExport,
  onBatchExportPdf,
  onBatchDelete,
  onClearSelection,
  isTrashMode = false
}) => {
  if (selectedCount === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions toolbar"
      className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[96vw] sm:max-w-2xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/80 rounded-2xl shadow-2xl p-1.5 sm:p-2 flex items-center gap-1 sm:gap-2 animate-in slide-in-from-bottom-5 duration-200"
    >
      {/* Selection count badge & toggle select all */}
      <div className="flex items-center gap-1.5 pl-2 pr-1 border-r border-zinc-800 shrink-0">
        <button
          type="button"
          onClick={() => {
            hapticTap();
            onToggleSelectAll();
          }}
          className="flex items-center gap-1.5 py-1 px-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition touch-manipulation min-h-[36px]"
          title={isAllSelected ? 'Deselect All' : 'Select All'}
        >
          {isAllSelected ? (
            <CheckSquare className="w-4 h-4 text-brand-400" />
          ) : (
            <Square className="w-4 h-4 text-zinc-400" />
          )}
          <span className="text-xs font-bold font-mono">
            {selectedCount} <span className="hidden sm:inline">of {totalCount}</span>
          </span>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar">
        {!isTrashMode && (
          <>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onOpenMoveModal();
              }}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800 transition touch-manipulation min-h-[44px] text-xs font-semibold"
              title="Move selected items to notebook"
            >
              <Folder className="w-4 h-4 text-brand-400 shrink-0" />
              <span className="hidden sm:inline">Move</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticTap();
                onBatchToggleFavorite();
              }}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800 transition touch-manipulation min-h-[44px] text-xs font-semibold"
              title="Toggle favorite for selected items"
            >
              <Star className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Fav</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticTap();
                onBatchTogglePin();
              }}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800 transition touch-manipulation min-h-[44px] text-xs font-semibold"
              title="Toggle pin for selected items"
            >
              <Pin className="w-4 h-4 text-brand-400 shrink-0" />
              <span className="hidden sm:inline">Pin</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => {
            hapticTap();
            onBatchExport();
          }}
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800 transition touch-manipulation min-h-[44px] text-xs font-semibold"
          title="Export selected notes as ZIP"
        >
          <Download className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="hidden sm:inline">ZIP</span>
        </button>

        {onBatchExportPdf && (
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onBatchExportPdf();
            }}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800 transition touch-manipulation min-h-[44px] text-xs font-semibold"
            title="Export selected notes as PDF"
          >
            <FileDown className="w-4 h-4 text-brand-400 shrink-0" />
            <span className="hidden sm:inline">PDF</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            hapticTap();
            onBatchDelete();
          }}
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition touch-manipulation min-h-[44px] text-xs font-semibold"
          title={isTrashMode ? 'Permanently Delete Selected' : 'Move Selected to Trash'}
        >
          <Trash2 className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">{isTrashMode ? 'Delete' : 'Trash'}</span>
        </button>
      </div>

      {/* Dismiss / Clear Selection */}
      <div className="pl-1 border-l border-zinc-800 shrink-0">
        <button
          type="button"
          onClick={() => {
            hapticTap();
            onClearSelection();
          }}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition touch-manipulation"
          title="Clear Selection"
          aria-label="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
