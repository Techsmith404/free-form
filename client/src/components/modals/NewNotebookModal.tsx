import React, { useState } from 'react';
import { Notebook, FormTemplate } from '../../types/index.js';
import { createNotebook, updateNotebook } from '../../api/index.js';
import { X, Folder, Save, Sparkles } from 'lucide-react';

interface NewNotebookModalProps {
  existingNotebook?: Notebook | null;
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
  templates,
  onClose,
  onSaved
}) => {
  const [name, setName] = useState(existingNotebook?.name || '');
  const [description, setDescription] = useState(existingNotebook?.description || '');
  const [color, setColor] = useState(existingNotebook?.color || '#22c55e');
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(
    existingNotebook?.default_template_id || null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
