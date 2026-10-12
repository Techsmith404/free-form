import React, { useState, useEffect, useRef } from 'react';
import { Item, CounterMetadata, CounterHistoryEntry, DensityMode } from '../../types/index.js';
import { counterAction, fetchCounterHistory } from '../../api/index.js';
import { Plus, Minus, RotateCcw, History, Trash2, Edit2, Hash, EyeOff, Check, Copy } from 'lucide-react';
import { ConfirmModal } from '../modals/ConfirmModal.js';
import { hapticMedium, hapticSuccess, hapticTap } from '../../services/native.js';

interface CounterCardProps {
  item: Item;
  density?: DensityMode;
  isTrashMode?: boolean;
  onUpdate: (updated: Item) => void;
  onDelete: (id: string) => void;
  onEdit?: (item: Item) => void;
  onRestore?: (item: Item) => void;
  onDuplicate?: (item: Item) => void;
  isSelected?: boolean;
  isSelectMode?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const CounterCard: React.FC<CounterCardProps> = ({
  item,
  density = 'cozy',
  isTrashMode = false,
  onUpdate,
  onDelete,
  onEdit,
  onRestore,
  onDuplicate,
  isSelected = false,
  isSelectMode = false,
  onToggleSelect
}) => {
  const isTrash = isTrashMode || Boolean(item.is_archived);
  const meta: CounterMetadata = item.metadata || { count: 0, step: 1 };
  const [displayCount, setDisplayCount] = useState<number>(meta.count ?? 0);
  const [isBouncing, setIsBouncing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<CounterHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [customDelta, setCustomDelta] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const pendingDeltaRef = useRef<number>(0);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync display with upstream item if no pending local adjustments
  useEffect(() => {
    if (pendingDeltaRef.current === 0) {
      setDisplayCount(meta.count ?? 0);
    }
  }, [meta.count]);

  // Flush pending delta when unmounting
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      if (pendingDeltaRef.current !== 0) {
        counterAction(item.id, { delta: pendingDeltaRef.current }).catch(console.error);
      }
      if (bounceTimeoutRef.current) {
        clearTimeout(bounceTimeoutRef.current);
      }
    };
  }, [item.id]);

  const handleAdjust = (delta: number) => {
    if (isTrash) return;
    hapticMedium();

    // 1. Immediate optimistic local update
    setDisplayCount((prev) => prev + delta);
    pendingDeltaRef.current += delta;

    // 2. Immediate tactile spring bounce trigger
    setIsBouncing(false);
    requestAnimationFrame(() => {
      setIsBouncing(true);
    });
    if (bounceTimeoutRef.current) clearTimeout(bounceTimeoutRef.current);
    bounceTimeoutRef.current = setTimeout(() => {
      setIsBouncing(false);
    }, 280);

    // 3. Debounced network sync without blocking UI
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      const deltaToSend = pendingDeltaRef.current;
      pendingDeltaRef.current = 0;
      if (deltaToSend !== 0) {
        try {
          const res = await counterAction(item.id, { delta: deltaToSend });
          onUpdate({
            ...item,
            metadata: res.metadata
          });
          setDisplayCount(res.metadata.count ?? 0);
        } catch (err) {
          console.error('Counter adjustment failed', err);
          // Rollback to item's last confirmed count
          setDisplayCount(meta.count ?? 0);
        }
      }
    }, 350);
  };

  const handleResetClick = () => {
    hapticTap();
    setShowResetConfirm(true);
  };

  const handlePerformReset = async () => {
    hapticTap();
    try {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      pendingDeltaRef.current = 0;
      setLoading(true);
      const res = await counterAction(item.id, { reset: true });
      setDisplayCount(res.metadata.count ?? 0);
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectMode || e.metaKey || e.ctrlKey || e.shiftKey) {
      e.stopPropagation();
      hapticTap();
      onToggleSelect?.(item.id);
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
      ? 'text-base font-bold text-zinc-100 leading-snug'
      : density === 'comfortable'
        ? 'text-base sm:text-lg font-bold text-zinc-100 leading-snug'
        : 'text-lg sm:text-xl font-bold text-zinc-100 leading-snug';

  const countDisplayClass =
    density === 'compact'
      ? 'text-4xl sm:text-5xl'
      : density === 'comfortable'
        ? 'text-5xl sm:text-6xl'
        : 'text-6xl sm:text-7xl';

  const counterBoxMarginClass =
    density === 'compact' ? 'my-2.5 py-1' : density === 'comfortable' ? 'my-4 py-1.5' : 'my-6 py-2';

  const buttonHeightClass =
    density === 'compact' ? 'min-h-[44px] h-11' : density === 'comfortable' ? 'min-h-[44px] h-12' : 'min-h-[44px] h-14 sm:h-12';

  return (
    <div
      role="region"
      aria-label={`Counter: ${item.title}, current count ${displayCount}${meta.unit ? ' ' + meta.unit : ''}`}
      onClick={handleCardClick}
      className={`flex flex-col justify-between ${paddingClass} rounded-2xl bg-zinc-900/95 border transition-all duration-200 shadow-md shadow-black/30 group ${
        isSelected
          ? 'border-brand-500 ring-2 ring-brand-500/40 bg-brand-500/5'
          : 'border-zinc-800 hover:border-zinc-700/80 ring-1 ring-white/5'
      }`}
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
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
                <Check className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg shrink-0">
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
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition touch-manipulation"
              title="View History"
              aria-label={`View history for ${item.title}`}
            >
              <History className="w-4 h-4" />
            </button>
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
              onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition touch-manipulation"
                  title="Edit Counter"
                  aria-label={`Edit ${item.title}`}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )
            )}
            {onDuplicate && !isTrash && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  hapticTap();
                  onDuplicate(item);
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition touch-manipulation"
                title="Duplicate Counter"
                aria-label={`Duplicate ${item.title}`}
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition touch-manipulation"
              title={isTrash ? 'Permanently Delete' : 'Delete'}
              aria-label={isTrash ? `Permanently delete ${item.title}` : `Move ${item.title} to trash`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

        </div>

        <h3 className={titleClass}>
          {item.title}
        </h3>
        {item.content && (
          <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{item.content}</p>
        )}
      </div>

      {/* Main Counter Display (Big & Punchy) */}
      <div className={`${counterBoxMarginClass} text-center bg-zinc-950/50 rounded-2xl border border-zinc-800/80`}>
        <div className="inline-flex items-baseline gap-2.5">
          <span
            className={`${countDisplayClass} font-black tracking-tight text-zinc-100 font-mono inline-block transition-transform ${
              isBouncing ? 'animate-num-bounce' : ''
            }`}
          >
            {displayCount}
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
            disabled={isTrash}
            onClick={() => handleAdjust(-step * 5)}
            aria-label={`Subtract ${step * 5} from ${item.title}`}
            className={`${buttonHeightClass} rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm border border-zinc-700/60 transition active:scale-95 disabled:opacity-40 touch-manipulation flex items-center justify-center`}
          >
            -{step * 5}
          </button>
          <button
            type="button"
            disabled={isTrash}
            onClick={() => handleAdjust(-step)}
            aria-label={`Subtract ${step} from ${item.title}`}
            className={`${buttonHeightClass} rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-black text-lg border border-zinc-700/60 flex items-center justify-center transition active:scale-95 disabled:opacity-40 touch-manipulation`}
          >
            <Minus className="w-5 h-5 stroke-[3]" />
          </button>
          <button
            type="button"
            disabled={isTrash}
            onClick={() => handleAdjust(step)}
            aria-label={`Add ${step} to ${item.title}`}
            className={`${buttonHeightClass} rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg flex items-center justify-center transition shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-40 touch-manipulation`}
          >
            <Plus className="w-5 h-5 stroke-[3]" />
          </button>
          <button
            type="button"
            disabled={isTrash}
            onClick={() => handleAdjust(step * 5)}
            aria-label={`Add ${step * 5} to ${item.title}`}
            className={`${buttonHeightClass} rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-sm transition active:scale-95 disabled:opacity-40 touch-manipulation flex items-center justify-center`}
          >
            +{step * 5}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
          <form onSubmit={handleApplyCustom} className="flex items-center gap-2 flex-1 max-w-[200px]">
            <input
              type="number"
              placeholder="+/- custom"
              aria-label="Custom adjustment amount"
              value={customDelta}
              disabled={isTrash}
              onChange={(e) => setCustomDelta(e.target.value)}
              className="w-full min-h-[44px] h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 font-medium disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={!customDelta || isTrash}
              aria-label={`Apply custom adjustment to ${item.title}`}
              className="min-h-[44px] min-w-[44px] px-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-lg text-zinc-200 text-xs font-semibold transition shrink-0 touch-manipulation flex items-center justify-center"
            >
              Apply
            </button>
          </form>

          <button
            type="button"
            disabled={isTrash}
            onClick={handleResetClick}
            aria-label={`Reset ${item.title}`}
            className="min-h-[44px] min-w-[44px] px-3 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition rounded-lg hover:bg-zinc-800 disabled:opacity-30 touch-manipulation"
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
