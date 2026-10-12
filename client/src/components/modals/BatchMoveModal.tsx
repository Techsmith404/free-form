import React from 'react';
import { Notebook } from '../../types/index.js';
import { Folder, X, Check, Inbox } from 'lucide-react';
import { hapticTap } from '../../services/native.js';

interface BatchMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  notebooks: Notebook[];
  onMoveToNotebook: (notebookId: string | null) => void;
}

export const BatchMoveModal: React.FC<BatchMoveModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  notebooks,
  onMoveToNotebook
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Move {selectedCount} Item{selectedCount === 1 ? '' : 's'}</h2>
              <p className="text-xs text-zinc-400">Select destination notebook</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onClose();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notebooks List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-1.5 min-h-[160px]">
          {/* Option: Uncategorized / Root */}
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onMoveToNotebook(null);
            }}
            className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl flex items-center justify-between text-left hover:bg-zinc-800 transition border border-transparent hover:border-zinc-700/60 touch-manipulation active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <Inbox className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-semibold text-zinc-200">Uncategorized (No Notebook)</span>
            </div>
          </button>

          {notebooks.map((nb) => (
            <button
              key={nb.id}
              type="button"
              onClick={() => {
                hapticTap();
                onMoveToNotebook(nb.id);
              }}
              className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl flex items-center justify-between text-left hover:bg-zinc-800 transition border border-transparent hover:border-zinc-700/60 touch-manipulation active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 truncate min-w-0">
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: nb.color || '#22c55e' }}
                />
                <span className="text-sm font-semibold text-zinc-200 truncate">{nb.name}</span>
              </div>
              {nb.item_count !== undefined && (
                <span className="text-xs font-mono text-zinc-400 ml-2 shrink-0">
                  {nb.item_count} notes
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
