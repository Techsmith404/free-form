import React, { useState } from 'react';
import { Notebook, FormTemplate } from '../../types/index.js';
import { createNotebook, updateNotebook } from '../../api/index.js';
import { X, Folder, Save, Sparkles, EyeOff } from 'lucide-react';

interface NewNotebookModalProps {
  existingNotebook?: Notebook | null;
  notebooks: Notebook[];
  defaultParentId?: string | null;
  templates: FormTemplate[];
  onClose: () => void;
  onSaved: (notebook: Notebook) => void;
}

const PRESET_COLORS = [
  '#22c55e', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#64748b'  // Slate
];

export const NewNotebookModal: React.FC<NewNotebookModalProps> = ({
  existingNotebook,
  notebooks,
  defaultParentId,
  templates,
  onClose,
  onSaved
}) => {
  const [name, setName] = useState(existingNotebook?.name || '');
  const [description, setDescription] = useState(existingNotebook?.description || '');
  const [color, setColor] = useState(existingNotebook?.color || '#22c55e');
  const [parentId, setParentId] = useState<string | null>(
    existingNotebook?.parent_id ?? defaultParentId ?? null
  );
  const [hideFromAll, setHideFromAll] = useState<boolean>(
    Boolean(existingNotebook?.hide_from_all)
  );
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(
    existingNotebook?.default_template_id || null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent circular nesting: cannot select self or descendants
  const isDescendant = (candidateId: string, targetId: string): boolean => {
    if (candidateId === targetId) return true;
    let current = notebooks.find((n) => n.id === candidateId);
    while (current && current.parent_id) {
      if (current.parent_id === targetId) return true;
      current = notebooks.find((n) => n.id === current?.parent_id);
    }
    return false;
  };

  const availableParents = notebooks.filter((n) => {
    if (!existingNotebook) return true;
    return !isDescendant(n.id, existingNotebook.id);
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Notebook name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: name.trim(),
        description: description.trim(),
        color,
        parent_id: parentId || null,
        hide_from_all: hideFromAll ? 1 : 0,
        default_template_id: defaultTemplateId || null
      };

      let saved: Notebook;
      if (existingNotebook) {
        saved = await updateNotebook(existingNotebook.id, payload);
      } else {
        saved = await createNotebook(payload);
      }

      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save notebook');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-brand-400" />
            <h2 className="text-lg font-bold text-zinc-100">
              {existingNotebook ? 'Edit Notebook' : 'Create New Notebook'}
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
            <label className="block text-zinc-300 font-medium mb-1">Notebook Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Work, Journal, Home Renovation, Recipes..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description or purpose..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">Color Accent</label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full transition transform hover:scale-110 ${
                    color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Parent Notebook for Nesting */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Parent Notebook (Optional Nesting)</label>
            <select
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-brand-500"
            >
              <option value="">None (Top-Level Notebook)</option>
              {availableParents.map((nb) => (
                <option key={nb.id} value={nb.id}>
                  📁 {nb.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-zinc-500 mt-1">
              Nest this notebook inside another notebook to organize into hierarchies.
            </p>
          </div>

          {/* Template Binding */}
          <div className="pt-2 border-t border-zinc-800">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <label className="text-zinc-300 font-medium">Default Form Template Binding</label>
            </div>
            <p className="text-[11px] text-zinc-500 mb-2">
              If selected, tapping &quot;+&quot; inside this notebook will automatically launch this form template!
            </p>
            <select
              value={defaultTemplateId || ''}
              onChange={(e) => setDefaultTemplateId(e.target.value || null)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-brand-500"
            >
              <option value="">None (Standard Notes Notebook)</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>

          {/* Hide from All Items Toggle */}
          <div className="pt-2 border-t border-zinc-800">
            <label className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition">
              <input
                type="checkbox"
                checked={hideFromAll}
                onChange={(e) => setHideFromAll(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-brand-500 bg-zinc-900 border-zinc-700 focus:ring-0 focus:ring-offset-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-200 text-xs">
                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Hide from All Items</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                  Notes inside this notebook won&apos;t clutter your main feed. They will only appear when opening this notebook directly.
                </p>
              </div>
            </label>
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
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl font-semibold transition shadow-lg shadow-brand-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Notebook'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
