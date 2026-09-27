import React, { useState, useEffect } from 'react';
import { FormTemplate, Notebook, Item } from '../../types/index.js';
import { createItem, updateItem, previewTemplateMarkdown, uploadFile } from '../../api/index.js';
import { SignaturePad } from './SignaturePad.js';
import { DynamicTableField } from './DynamicTableField.js';
import {
  X,
  Star,
  FileText,
  Eye,
  Save,
  CheckCircle2,
  Folder,
  Calendar,
  Clock,
  Upload,
  AlertCircle
} from 'lucide-react';
import { marked } from 'marked';

interface FormRunnerModalProps {
  template: FormTemplate;
  notebooks: Notebook[];
  defaultNotebookId?: string | null;
  existingItem?: Item | null;
  onClose: () => void;
  onSaved: (item: Item) => void;
}

export const FormRunnerModal: React.FC<FormRunnerModalProps> = ({
  template,
  notebooks,
  defaultNotebookId,
  existingItem,
  onClose,
  onSaved
}) => {
  const initialValues = existingItem?.metadata?.values || {};
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [title, setTitle] = useState<string>(
    existingItem?.title || `${template.name} - ${new Date().toLocaleDateString()}`
  );
  const [notebookId, setNotebookId] = useState<string | null>(
    existingItem?.notebook_id ?? defaultNotebookId ?? template.default_notebook_id ?? null
  );

  const [isProcessed, setIsProcessed] = useState<boolean>(Boolean(existingItem?.metadata?.is_processed));
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  const [markdownPreview, setMarkdownPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize defaults from template schema
  useEffect(() => {
    if (!existingItem) {
      const defaults: Record<string, any> = {};
      const now = new Date();
      // Format local YYYY-MM-DD
      const localDate = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
      ].join('-');
      // Format local HH:MM
      const localTime = [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0')
      ].join(':');

      template.fields_schema.forEach((field) => {
        if (field.defaultValue !== undefined) {
          defaults[field.id] = field.defaultValue;
        } else if (field.type === 'date') {
          defaults[field.id] = localDate;
        } else if (field.type === 'time') {
          defaults[field.id] = localTime;
        } else if (field.type === 'table') {
          const rowCount = field.defaultRows && field.defaultRows > 0 ? field.defaultRows : 0;
          defaults[field.id] = Array.from({ length: rowCount }, () => {
            const row: Record<string, any> = {};
            (field.columns || []).forEach((col) => {
              row[col.id] = col.type === 'checkbox' ? false : '';
            });
            return row;
          });
        } else if (field.type === 'checkbox') {
          defaults[field.id] = false;
        }
      });
      setValues((prev) => ({ ...defaults, ...prev }));
    }
  }, [template, existingItem]);

  const handleFieldChange = (fieldId: string, val: any) => {
    setValues((prev) => ({
      ...prev,
      [fieldId]: val
    }));
  };

  const handleSwitchToPreview = async () => {
    try {
      const md = await previewTemplateMarkdown(template.id, values);
      setMarkdownPreview(md);
      setActiveTab('preview');
    } catch (err) {
      console.error('Failed to preview markdown', err);
      setActiveTab('preview');
    }
  };

  const handleFileUpload = async (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadFile(file);
      handleFieldChange(fieldId, uploaded.url);
    } catch (err) {
      alert('Failed to upload file');
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Please provide a title for this note entry');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        title: title.trim(),
        notebook_id: notebookId || null,
        type: 'form_entry' as const,
        metadata: {
          template_id: template.id,
          template_name: template.name,
          values,
          is_processed: isProcessed,
          processed_at: isProcessed
            ? (existingItem?.metadata?.processed_at || new Date().toISOString())
            : null
        }
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
      setError(err.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 sm:p-6 overflow-hidden">
      <div className="bg-zinc-900 border-t sm:border border-zinc-800 sm:rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col h-[97dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-md shrink-0">
                Form Entry
              </span>
              <span className="text-xs text-zinc-400 truncate">{template.name}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-100 mt-0.5">
              {existingItem ? 'Edit Entry' : 'New Entry'}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`h-8 px-2.5 rounded-md transition font-medium flex items-center gap-1 touch-manipulation ${
                  activeTab === 'form'
                    ? 'bg-zinc-800 text-brand-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Form</span>
              </button>
              <button
                type="button"
                onClick={handleSwitchToPreview}
                className={`h-8 px-2.5 rounded-md transition font-medium flex items-center gap-1 touch-manipulation ${
                  activeTab === 'preview'
                    ? 'bg-zinc-800 text-brand-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Preview</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition touch-manipulation"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Note Metadata Configuration */}
        <div className="px-4 sm:px-6 py-3 bg-zinc-950/40 border-b border-zinc-800/60 grid grid-cols-1 sm:grid-cols-2 gap-2.5 shrink-0">
          <div>
            <label className="block text-xs text-zinc-400 font-medium mb-1.5">Entry Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title for this form note..."
              className="w-full h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-brand-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 font-medium mb-1.5 flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-brand-400" />
              <span>Save to Notebook</span>
            </label>
            <select
              value={notebookId || ''}
              onChange={(e) => setNotebookId(e.target.value || null)}
              className="w-full h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-brand-500 text-sm"
            >
              <option value="">Uncategorized (No Notebook)</option>
              {notebooks.map((nb) => (
                <option key={nb.id} value={nb.id}>
                  {nb.name}
                </option>
              ))}
            </select>
          </div>

          {template.enable_processed_tracking !== false && (
            <div className="col-span-1 sm:col-span-2 pt-1">
              <label className="flex items-center justify-between p-2.5 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer transition touch-manipulation select-none">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isProcessed}
                    onChange={(e) => setIsProcessed(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 bg-zinc-950 border-zinc-700"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <CheckCircle2 className={`w-3.5 h-3.5 ${isProcessed ? 'text-emerald-400' : 'text-zinc-500'}`} />
                      Mark as Processed / Seen
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Dims entry and defaults to compact view in your list
                    </span>
                  </div>
                </div>
                {isProcessed && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md shrink-0">
                    Processed
                  </span>
                )}
              </label>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {activeTab === 'form' ? (
            <div className="space-y-5">
              {template.fields_schema.map((field) => {
                const val = values[field.id];

                if (field.type === 'header') {
                  return (
                    <div key={field.id} className="pt-3 pb-1 border-b border-zinc-800">
                      <h3 className="text-base font-bold text-zinc-100">{field.label}</h3>
                      {field.description && (
                        <p className="text-xs text-zinc-400 mt-0.5">{field.description}</p>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={field.id} className="space-y-1.5">
                    {field.type !== 'checkbox' && (
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-medium text-zinc-300">
                          {field.label}
                          {field.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        {field.description && (
                          <span className="text-zinc-500 text-[11px]">{field.description}</span>
                        )}
                      </div>
                    )}

                    {field.type === 'text' && (
                      <input
                        type="text"
                        value={val || ''}
                        placeholder={field.placeholder || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-brand-500"
                      />
                    )}

                    {field.type === 'textarea' && (
                      <textarea
                        rows={3}
                        value={val || ''}
                        placeholder={field.placeholder || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-brand-500 resize-y"
                      />
                    )}

                    {field.type === 'number' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={val ?? ''}
                          min={field.min}
                          max={field.max}
                          step={field.step || 1}
                          placeholder={field.placeholder || '0'}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-brand-500"
                        />
                        {field.unit && (
                          <span className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold">
                            {field.unit}
                          </span>
                        )}
                      </div>
                    )}

                    {field.type === 'select' && (
                      <select
                        value={val || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-brand-500"
                      >
                        <option value="">-- Select option --</option>
                        {(field.options || []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {field.type === 'checkbox' && (
                      <label className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-xl cursor-pointer hover:border-zinc-700 transition">
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                          className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-brand-500 focus:ring-brand-500 focus:ring-offset-zinc-950"
                        />
                        <div>
                          <span className="text-sm font-medium text-zinc-200">
                            {field.label}
                          </span>
                          {field.description && (
                            <p className="text-xs text-zinc-500 mt-0.5">{field.description}</p>
                          )}
                        </div>
                      </label>
                    )}

                    {field.type === 'rating' && (
                      <div className="flex items-center gap-1.5 p-2 bg-zinc-950 border border-zinc-800 rounded-xl">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleFieldChange(field.id, star)}
                            className="p-1 text-zinc-600 hover:text-amber-400 transition"
                          >
                            <Star
                              className={`w-6 h-6 ${
                                (Number(val) || 0) >= star
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-zinc-600'
                              }`}
                            />
                          </button>
                        ))}
                        <span className="ml-2 text-xs font-semibold text-zinc-400">
                          {val ? `${val} / 5` : 'Not rated'}
                        </span>
                      </div>
                    )}

                    {field.type === 'date' && (
                      <div className="relative">
                        <input
                          type="date"
                          value={val || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    )}

                    {field.type === 'time' && (
                      <div className="relative">
                        <input
                          type="time"
                          value={val || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    )}

                    {field.type === 'table' && (
                      <DynamicTableField
                        label={field.label}
                        columns={field.columns}
                        rows={val || []}
                        onChange={(rows) => handleFieldChange(field.id, rows)}
                        description={field.description}
                      />
                    )}

                    {field.type === 'signature' && (
                      <SignaturePad
                        label={field.label}
                        value={val}
                        onChange={(url) => handleFieldChange(field.id, url)}
                      />
                    )}

                    {field.type === 'image' && (
                      <div className="space-y-2">
                        {val && (
                          <div className="relative w-40 h-28 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                            <img src={val} alt="Attached" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl cursor-pointer text-xs font-medium transition">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{val ? 'Replace Image' : 'Upload Image'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(field.id, e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="prose prose-invert max-w-none text-sm p-4 bg-zinc-950 rounded-xl border border-zinc-800">
              <div
                dangerouslySetInnerHTML={{
                  __html: marked.parse(markdownPreview || '*Generating preview...*') as string
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition touch-manipulation"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 h-11 px-5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-brand-500/20 touch-manipulation"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Form Note'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
