import React, { useState } from 'react';
import {
  FormTemplate,
  FormFieldDefinition,
  FormFieldType,
  FormFieldTableColumn,
  Notebook
} from '../../types/index.js';
import { createTemplate, updateTemplate } from '../../api/index.js';
import {
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Save,
  FileSpreadsheet,
  PenTool,
  CheckSquare,
  Hash,
  Type,
  Calendar,
  Clock,
  Star,
  ListFilter,
  Heading
} from 'lucide-react';

interface TemplateBuilderModalProps {
  existingTemplate?: FormTemplate | null;
  notebooks: Notebook[];
  onClose: () => void;
  onSaved: (template: FormTemplate) => void;
}

export const TemplateBuilderModal: React.FC<TemplateBuilderModalProps> = ({
  existingTemplate,
  notebooks,
  onClose,
  onSaved
}) => {
  const [name, setName] = useState(existingTemplate?.name || '');
  const [description, setDescription] = useState(existingTemplate?.description || '');
  const [color, setColor] = useState(existingTemplate?.color || '#3b82f6');
  const [icon, setIcon] = useState(existingTemplate?.icon || 'file-text');
  const [defaultNotebookId, setDefaultNotebookId] = useState<string | null>(
    existingTemplate?.default_notebook_id || null
  );

  const [fields, setFields] = useState<FormFieldDefinition[]>(
    existingTemplate?.fields_schema || [
      { id: 'f_title', label: 'Item Name', type: 'text', required: true },
      { id: 'f_notes', label: 'Details & Notes', type: 'textarea' }
    ]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddField = (type: FormFieldType) => {
    const newId = `f_${Date.now()}`;
    const newField: FormFieldDefinition = {
      id: newId,
      label: type === 'header' ? 'Section Title' : `New ${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      type,
      required: false
    };

    if (type === 'select') {
      newField.options = ['Option A', 'Option B', 'Option C'];
    } else if (type === 'number') {
      newField.unit = '';
      newField.step = 1;
    } else if (type === 'rating') {
      newField.min = 1;
      newField.max = 5;
    } else if (type === 'table') {
      newField.columns = [
        { id: 'col_1', name: 'Item', type: 'text' },
        { id: 'col_2', name: 'Status', type: 'checkbox' }
      ];
      newField.defaultRows = 3;
    } else if (type === 'time') {
      newField.label = 'Time';
    } else if (type === 'date') {
      newField.label = 'Date';
    }

    setFields([...fields, newField]);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, idx) => idx !== index));
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= fields.length) return;

    const updated = [...fields];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setFields(updated);
  };

  const handleUpdateField = (index: number, updates: Partial<FormFieldDefinition>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...updates };
    setFields(updated);
  };

  // Add column to table field
  const handleAddTableColumn = (fieldIndex: number) => {
    const field = fields[fieldIndex];
    const columns = field.columns || [];
    const newCol: FormFieldTableColumn = {
      id: `c_${Date.now()}`,
      name: `Column ${columns.length + 1}`,
      type: 'text'
    };
    handleUpdateField(fieldIndex, { columns: [...columns, newCol] });
  };

  const handleRemoveTableColumn = (fieldIndex: number, colIndex: number) => {
    const field = fields[fieldIndex];
    const columns = (field.columns || []).filter((_, idx) => idx !== colIndex);
    handleUpdateField(fieldIndex, { columns });
  };

  const handleUpdateTableColumn = (
    fieldIndex: number,
    colIndex: number,
    updates: Partial<FormFieldTableColumn>
  ) => {
    const field = fields[fieldIndex];
    const columns = [...(field.columns || [])];
    columns[colIndex] = { ...columns[colIndex], ...updates };
    handleUpdateField(fieldIndex, { columns });
  };

  // Apply Presets
  const applyPreset = (presetKey: string) => {
    if (presetKey === 'daily-standup') {
      setName('Daily Standup & Goals');
      setDescription('Quick daily progress check with accomplishments and blockers');
      setColor('#22c55e');
      setFields([
        { id: 'f_yesterday', label: 'What did you accomplish yesterday?', type: 'textarea', required: true },
        { id: 'f_today', label: 'What will you focus on today?', type: 'textarea', required: true },
        { id: 'f_blockers', label: 'Any blockers or impediments?', type: 'textarea' },
        { id: 'f_energy', label: 'Energy / Focus Rating', type: 'rating', min: 1, max: 5 }
      ]);
    } else if (presetKey === 'work-order') {
      setName('Work Order & Sign-off');
      setDescription('Structured client job sheet with parts table and signature');
      setColor('#f59e0b');
      setFields([
        { id: 'f_client', label: 'Client / Account Name', type: 'text', required: true },
        { id: 'f_date', label: 'Service Date', type: 'date', required: true },
        { id: 'f_status', label: 'Job Status', type: 'select', options: ['In Progress', 'Awaiting Parts', 'Completed', 'Approved'] },
        {
          id: 'f_parts',
          label: 'Parts & Labor Breakdown',
          type: 'table',
          columns: [
            { id: 'item', name: 'Item Description', type: 'text' },
            { id: 'qty', name: 'Qty', type: 'number' },
            { id: 'cost', name: 'Price', type: 'number' },
            { id: 'installed', name: 'Installed', type: 'checkbox' }
          ]
        },
        { id: 'f_signature', label: 'Client Signature', type: 'signature' }
      ]);
    } else if (presetKey === 'car-log') {
      setName('Vehicle Maintenance');
      setDescription('Track services, fluid changes, and repair costs');
      setColor('#8b5cf6');
      setFields([
        { id: 'f_vehicle', label: 'Vehicle', type: 'text', placeholder: 'e.g. 2020 Subaru Outback', required: true },
        { id: 'f_mileage', label: 'Odometer Mileage', type: 'number', unit: 'mi', required: true },
        { id: 'f_type', label: 'Service Category', type: 'select', options: ['Oil & Filter', 'Brakes', 'Tires', 'Battery', 'Inspection', 'Custom'] },
        { id: 'f_cost', label: 'Total Cost', type: 'number', unit: '$' },
        { id: 'f_notes', label: 'Shop / Invoice Notes', type: 'textarea' }
      ]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    if (fields.length === 0) {
      setError('Please add at least one field to this template');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: name.trim(),
        description: description.trim(),
        color,
        icon,
        default_notebook_id: defaultNotebookId || null,
        fields_schema: fields
      };

      let saved: FormTemplate;
      if (existingTemplate) {
        saved = await updateTemplate(existingTemplate.id, payload);
      } else {
        saved = await createTemplate(payload);
      }

      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div>
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-md">
              Template Designer
            </span>
            <h2 className="text-xl font-bold text-zinc-100 mt-1">
              {existingTemplate ? 'Edit Form Template' : 'Design New Form Template'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Presets dropdown */}
            <select
              onChange={(e) => {
                if (e.target.value) applyPreset(e.target.value);
              }}
              defaultValue=""
              className="text-xs bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-500"
            >
              <option value="" disabled>
                Load Preset...
              </option>
              <option value="daily-standup">Daily Standup</option>
              <option value="work-order">Work Order & Sign-off</option>
              <option value="car-log">Vehicle Maintenance</option>
            </select>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Template Settings */}
        <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-950/40 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="md:col-span-2 space-y-2">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Daily Progress Log, Client Intake, Equipment Check..."
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Description / Subtitle</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief explanation of when to use this template..."
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Default Notebook Binding</label>
              <select
                value={defaultNotebookId || ''}
                onChange={(e) => setDefaultNotebookId(e.target.value || null)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-brand-500"
              >
                <option value="">Any Notebook (Not Bound)</option>
                {notebooks.map((nb) => (
                  <option key={nb.id} value={nb.id}>
                    {nb.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Theme Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer"
                />
                <span className="font-mono text-zinc-400">{color}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Fields Builder Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">
              Template Fields ({fields.length})
            </h3>
            <span className="text-xs text-zinc-500">
              Drag or use arrows to organize your form layout
            </span>
          </div>

          {/* Field Cards */}
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id || index}
                className="p-4 bg-zinc-950/70 border border-zinc-800 rounded-xl space-y-3 transition hover:border-zinc-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-5 h-5 rounded-md bg-zinc-800 text-zinc-400 flex items-center justify-center text-[10px] font-mono">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => handleUpdateField(index, { label: e.target.value })}
                      placeholder="Field Label..."
                      className="flex-1 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 font-medium focus:outline-none focus:border-brand-500"
                    />
                    <span className="text-xs font-mono uppercase px-2 py-1 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-md">
                      {field.type}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveField(index, 'up')}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-200 disabled:opacity-20 transition"
                      title="Move Up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === fields.length - 1}
                      onClick={() => handleMoveField(index, 'down')}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-200 disabled:opacity-20 transition"
                      title="Move Down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveField(index)}
                      className="p-1 rounded text-zinc-500 hover:text-red-400 transition"
                      title="Delete Field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Field-specific Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-zinc-900">
                  <div>
                    <label className="text-zinc-500 block mb-0.5">Placeholder or Hint</label>
                    <input
                      type="text"
                      value={field.placeholder || ''}
                      onChange={(e) => handleUpdateField(index, { placeholder: e.target.value })}
                      placeholder="Optional hint..."
                      className="w-full px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 text-xs focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer mt-3 text-zinc-300">
                      <input
                        type="checkbox"
                        checked={Boolean(field.required)}
                        onChange={(e) => handleUpdateField(index, { required: e.target.checked })}
                        className="rounded border-zinc-700 bg-zinc-900 text-brand-500 focus:ring-brand-500"
                      />
                      <span>Required field</span>
                    </label>
                  </div>
                </div>

                {/* Dropdown Options */}
                {field.type === 'select' && (
                  <div className="text-xs pt-1 space-y-1">
                    <label className="text-zinc-400 block font-medium">Dropdown Options (comma-separated)</label>
                    <input
                      type="text"
                      value={(field.options || []).join(', ')}
                      onChange={(e) =>
                        handleUpdateField(index, {
                          options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        })
                      }
                      placeholder="Option 1, Option 2, Option 3..."
                      className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 text-xs focus:outline-none focus:border-brand-500"
                    />
                  </div>
                )}

                {/* Number Units / Step */}
                {field.type === 'number' && (
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div>
                      <label className="text-zinc-500 block mb-0.5">Unit (e.g. $, kg, mi)</label>
                      <input
                        type="text"
                        value={field.unit || ''}
                        onChange={(e) => handleUpdateField(index, { unit: e.target.value })}
                        placeholder="$"
                        className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-500 block mb-0.5">Step</label>
                      <input
                        type="number"
                        value={field.step ?? 1}
                        onChange={(e) => handleUpdateField(index, { step: parseFloat(e.target.value) || 1 })}
                        className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-500 block mb-0.5">Min / Max</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          placeholder="Min"
                          value={field.min ?? ''}
                          onChange={(e) => handleUpdateField(index, { min: e.target.value ? parseFloat(e.target.value) : undefined })}
                          className="w-1/2 px-1.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 text-xs"
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          value={field.max ?? ''}
                          onChange={(e) => handleUpdateField(index, { max: e.target.value ? parseFloat(e.target.value) : undefined })}
                          className="w-1/2 px-1.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Table Columns Designer */}
                {field.type === 'table' && (
                  <div className="text-xs pt-2 space-y-2 bg-zinc-900/60 p-3 rounded-xl border border-zinc-850">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-300">Table Columns</span>
                      <button
                        type="button"
                        onClick={() => handleAddTableColumn(index)}
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-brand-400 rounded transition font-medium"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Column</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {(field.columns || []).map((col, cIdx) => (
                        <div key={col.id || cIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={col.name}
                            onChange={(e) => handleUpdateTableColumn(index, cIdx, { name: e.target.value })}
                            placeholder="Column Name..."
                            className="flex-1 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-200"
                          />
                          <select
                            value={col.type}
                            onChange={(e) => handleUpdateTableColumn(index, cIdx, { type: e.target.value as any })}
                            className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300"
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="checkbox">Checkbox</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveTableColumn(index, cIdx)}
                            className="p-1 text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2.5 pt-2.5 mt-2 border-t border-zinc-800">
                      <label className="text-zinc-300 font-semibold text-xs">Default Number of Rows:</label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={field.defaultRows ?? ''}
                        placeholder="e.g. 3"
                        onChange={(e) => handleUpdateField(index, { defaultRows: parseInt(e.target.value) || 0 })}
                        className="w-20 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-100 font-mono"
                      />
                      <span className="text-[11px] text-zinc-400">Rows pre-filled on new entry</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Add Field Bar */}
          <div className="p-4 bg-zinc-950/40 border border-zinc-800/80 rounded-xl space-y-2">
            <span className="text-xs font-semibold text-zinc-400 block">Add New Field to Form:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleAddField('text')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition"
              >
                <Type className="w-3.5 h-3.5 text-blue-400" />
                <span>Text</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddField('textarea')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition"
              >
                <Type className="w-3.5 h-3.5 text-blue-400" />
                <span>Text Area</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddField('number')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition"
              >
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                <span>Number</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddField('select')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition"
              >
                <ListFilter className="w-3.5 h-3.5 text-amber-400" />
                <span>Dropdown</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddField('checkbox')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition"
              >
                <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                <span>Checkbox</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddField('rating')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition"
              >
                <Star className="w-3.5 h-3.5 text-yellow-400" />
                <span>Rating</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddField('table')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
                <span>Dynamic Table</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddField('signature')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition"
              >
                <PenTool className="w-3.5 h-3.5 text-brand-400" />
                <span>Signature Pad</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddField('date')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition"
              >
                <Calendar className="w-3.5 h-3.5 text-pink-400" />
                <span>Date</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddField('time')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition"
              >
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Time</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddField('header')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition"
              >
                <Heading className="w-3.5 h-3.5 text-zinc-400" />
                <span>Header / Section</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-brand-500/20"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Template'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
