import React, { useState } from 'react';
import { Item, CounterMetadata, CounterHistoryEntry } from '../../types/index.js';
import { counterAction, fetchCounterHistory } from '../../api/index.js';
import { Plus, Minus, RotateCcw, History, Trash2, Edit2, Hash, EyeOff } from 'lucide-react';
import { ConfirmModal } from '../modals/ConfirmModal.js';

interface CounterCardProps {
  item: Item;
  onUpdate: (updated: Item) => void;
  onDelete: (id: string) => void;
  onEdit?: (item: Item) => void;
}

export const CounterCard: React.FC<CounterCardProps> = ({
  item,
  onUpdate,
  onDelete,
  onEdit
}) => {
  const meta: CounterMetadata = item.metadata || { count: 0, step: 1 };
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<CounterHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [customDelta, setCustomDelta] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleAdjust = async (delta: number) => {
    try {
      setLoading(true);
      const res = await counterAction(item.id, { delta });
      onUpdate({
        ...item,
        metadata: res.metadata
      });
    } catch (err) {
      console.error('Counter adjustment failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const handlePerformReset = async () => {
    try {
      setLoading(true);
      const res = await counterAction(item.id, { reset: true });
      onUpdate({
        ...item,
        metadata: res.metadata
      });
      setShowResetConfirm(false);
    } catch (err) {
      console.error('Counter reset failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHistory = async () => {
    if (!showHistory) {
      try {
        const hist = await fetchCounterHistory(item.id);
        setHistory(hist);
      } catch (err) {
        console.error('Failed to load history', err);
      }
    }
    setShowHistory(!showHistory);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customDelta);
    if (!isNaN(val) && val !== 0) {
      handleAdjust(val);
      setCustomDelta('');
    }
  };

  const step = meta.step || 1;

  return (
    <div className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-zinc-900/95 border border-zinc-800 hover:border-zinc-700/80 transition-all duration-200 shadow-md shadow-black/30 ring-1 ring-white/5 group">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 truncate">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg">
              <Hash className="w-3.5 h-3.5" />
              <span>Counter</span>
            </span>
            {item.notebook_name && (
              <span className="text-xs font-medium text-zinc-400 truncate max-w-[140px]">
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

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleToggleHistory}
              className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition touch-manipulation"
              title="View History"
            >
              <History className="w-4 h-4" />
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition touch-manipulation"
                title="Edit Counter"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition touch-manipulation"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

        </div>

        <h3 className="font-bold text-zinc-100 text-lg sm:text-xl leading-snug">
          {item.title}
        </h3>
        {item.content && (
          <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{item.content}</p>
        )}
      </div>

      {/* Main Counter Display (Big & Punchy) */}
      <div className="my-6 text-center py-2 bg-zinc-950/50 rounded-2xl border border-zinc-800/80">
        <div className="inline-flex items-baseline gap-2.5">
          <span className="text-6xl sm:text-7xl font-black tracking-tight text-zinc-100 font-mono">
            {meta.count ?? 0}
          </span>
          {meta.unit && (
            <span className="text-lg font-bold text-emerald-400 lowercase">
              {meta.unit}
            </span>
          )}
        </div>
      </div>

      {/* Touch-Friendly Action Buttons */}
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAdjust(-step * 5)}
            className="h-14 sm:h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm border border-zinc-700/60 transition active:scale-95 disabled:opacity-40 touch-manipulation"
          >
            -{step * 5}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAdjust(-step)}
            className="h-14 sm:h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-black text-lg border border-zinc-700/60 flex items-center justify-center transition active:scale-95 disabled:opacity-40 touch-manipulation"
          >
            <Minus className="w-5 h-5 stroke-[3]" />
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAdjust(step)}
            className="h-14 sm:h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg flex items-center justify-center transition shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-40 touch-manipulation"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAdjust(step * 5)}
            className="h-14 sm:h-12 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-sm transition active:scale-95 disabled:opacity-40 touch-manipulation"
          >
            +{step * 5}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
          <form onSubmit={handleApplyCustom} className="flex items-center gap-2 flex-1 max-w-[200px]">
            <input
              type="number"
              placeholder="+/- custom"
              value={customDelta}
              onChange={(e) => setCustomDelta(e.target.value)}
              className="w-full h-11 sm:h-9 px-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 font-medium"
            />
            <button
              type="submit"
              disabled={!customDelta}
              className="h-11 sm:h-9 px-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-lg text-zinc-200 text-xs font-semibold transition shrink-0 touch-manipulation"
            >
              Apply
            </button>
          </form>

          <button
            type="button"
            onClick={handleResetClick}
            className="h-11 sm:h-9 px-3 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition rounded-lg hover:bg-zinc-800 touch-manipulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>


      {/* History Log */}
      {showHistory && (
        <div className="mt-4 pt-3 border-t border-zinc-800 text-xs text-zinc-300">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-zinc-400">Activity History</span>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              Close
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {history.length === 0 ? (
              <p className="text-zinc-500 italic">No adjustments logged yet</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className={`font-mono font-bold ${h.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {h.delta > 0 ? `+${h.delta}` : h.delta} (total: {h.new_value})
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Native Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset Counter?"
        message={`Are you sure you want to reset "${item.title}" back to ${meta.resetValue ?? 0}? This will be recorded in the activity history.`}
        confirmText="Reset Counter"
        confirmVariant="warning"
        icon="reset"
        isLoading={loading}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handlePerformReset}
      />
    </div>
  );
};
