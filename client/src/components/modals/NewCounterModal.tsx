import React, { useState } from 'react';
import { Notebook, Item, CounterMetadata } from '../../types/index.js';
import { createItem, updateItem } from '../../api/index.js';
import { X, Hash, Save } from 'lucide-react';

interface NewCounterModalProps {
  existingItem?: Item | null;
  notebooks: Notebook[];
  defaultNotebookId?: string | null;
  onClose: () => void;
  onSaved: (item: Item) => void;
}

export const NewCounterModal: React.FC<NewCounterModalProps> = ({
  existingItem,
  notebooks,
  defaultNotebookId,
  onClose,
  onSaved
}) => {
  const existingMeta: CounterMetadata = existingItem?.metadata || { count: 0, step: 1 };
  const [title, setTitle] = useState(existingItem?.title || '');
  const [description, setDescription] = useState(existingItem?.content || '');
  const [count, setCount] = useState<number>(existingMeta.count ?? 0);
  const [step, setStep] = useState<number>(existingMeta.step ?? 1);
  const [unit, setUnit] = useState<string>(existingMeta.unit || '');
  const [min, setMin] = useState<string>(existingMeta.min !== undefined && existingMeta.min !== null ? String(existingMeta.min) : '');
  const [max, setMax] = useState<string>(existingMeta.max !== undefined && existingMeta.max !== null ? String(existingMeta.max) : '');
  const [resetValue, setResetValue] = useState<number>(existingMeta.resetValue ?? 0);
  const [notebookId, setNotebookId] = useState<string | null>(
    existingItem?.notebook_id ?? defaultNotebookId ?? null
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Counter name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const metadata: CounterMetadata = {
        count: Number(count) || 0,
        step: Number(step) || 1,
        unit: unit.trim(),
        min: min !== '' ? Number(min) : null,
        max: max !== '' ? Number(max) : null,
        resetValue: Number(resetValue) || 0
      };

      const payload = {
        title: title.trim(),
        content: description.trim(),
        notebook_id: notebookId || null,
        type: 'counter' as const,
        metadata
      };

      let saved: Item;
      if (existingItem) {
        saved = await updateItem(existingItem.id, payload);
      } else {
        saved = await createItem(payload);
      }

      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save counter');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-zinc-100">
              {existingItem ? 'Edit Counter' : 'Create New Counter'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Counter Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cups of Coffee, Daily Pushups, Tasks Closed..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Initial Count</label>
              <input
                type="number"
                value={count}
                onChange={(e) => setCount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Step Size (+/-)</label>
              <input
                type="number"
                value={step}
                onChange={(e) => setStep(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Unit Label (Optional)</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="cups, reps, pages..."
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Reset Value</label>
              <input
                type="number"
                value={resetValue}
                onChange={(e) => setResetValue(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Min Value (Optional)</label>
              <input
                type="number"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="No min"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Max Value (Optional)</label>
              <input
                type="number"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="No max"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notebook</label>
            <select
              value={notebookId || ''}
              onChange={(e) => setNotebookId(e.target.value || null)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-brand-500 text-sm"
            >
              <option value="">Uncategorized (No Notebook)</option>
              {notebooks.map((nb) => (
                <option key={nb.id} value={nb.id}>
                  {nb.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Description / Notes</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this counter tracks..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold transition shadow-lg shadow-emerald-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Counter'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
