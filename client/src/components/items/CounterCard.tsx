import React, { useState } from 'react';
import { Item, CounterMetadata, CounterHistoryEntry } from '../../types/index.js';
import { counterAction, fetchCounterHistory } from '../../api/index.js';
import { Plus, Minus, RotateCcw, History, Star, Pin, Trash2, Edit2 } from 'lucide-react';

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

  const handleReset = async () => {
    if (!confirm(`Reset counter "${item.title}"?`)) return;
    try {
      setLoading(true);
      const res = await counterAction(item.id, { reset: true });
      onUpdate({
        ...item,
        metadata: res.metadata
      });
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
    <div className="relative flex flex-col justify-between p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition shadow-lg group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
              Counter
            </span>
            {item.notebook_name && (
              <span className="text-xs text-zinc-400">
                in {item.notebook_name}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-zinc-100 mt-1 line-clamp-1">
            {item.title}
          </h3>
          {item.content && (
            <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{item.content}</p>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
          <button
            type="button"
            onClick={handleToggleHistory}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            title="View History"
          >
            <History className="w-4 h-4" />
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
              title="Edit Counter"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition"
            title="Delete / Archive"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Counter Display */}
      <div className="my-6 text-center">
        <div className="inline-flex items-baseline gap-2">
          <span className="text-5xl font-black tracking-tight text-white font-mono">
            {meta.count ?? 0}
          </span>
          {meta.unit && (
            <span className="text-base font-medium text-zinc-400 lowercase">
              {meta.unit}
            </span>
          )}
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAdjust(-step * 5)}
            className="py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 font-semibold text-xs transition active:scale-95 disabled:opacity-40"
          >
            -5
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAdjust(-step)}
            className="py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 font-bold text-sm flex items-center justify-center transition active:scale-95 disabled:opacity-40"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAdjust(step)}
            className="py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm flex items-center justify-center transition shadow-lg shadow-brand-500/20 active:scale-95 disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAdjust(step * 5)}
            className="py-2 rounded-xl bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 font-semibold text-xs transition active:scale-95 disabled:opacity-40"
          >
            +5
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80 text-xs">
          <form onSubmit={handleApplyCustom} className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="+/- custom"
              value={customDelta}
              onChange={(e) => setCustomDelta(e.target.value)}
              className="w-20 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              disabled={!customDelta}
              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-lg text-zinc-300 font-medium transition"
            >
              Add
            </button>
          </form>

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition py-1 px-2 rounded-lg hover:bg-zinc-800/50"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* History Log Modal / Slide Down */}
      {showHistory && (
        <div className="mt-4 pt-3 border-t border-zinc-800 text-xs text-zinc-300">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-zinc-400">Recent Activity</span>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              Close
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {history.length === 0 ? (
              <p className="text-zinc-500 italic">No adjustments recorded yet</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="flex items-center justify-between py-1 px-2 rounded bg-zinc-950/60 border border-zinc-800/40">
                  <span className={`font-mono font-medium ${h.delta >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                    {h.delta > 0 ? `+${h.delta}` : h.delta} (now {h.new_value})
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
