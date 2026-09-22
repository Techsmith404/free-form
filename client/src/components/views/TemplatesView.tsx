import React from 'react';
import { FormTemplate } from '../../types/index.js';
import {
  Sparkles,
  Plus,
  Play,
  Edit2,
  Trash2,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';

interface TemplatesViewProps {
  templates: FormTemplate[];
  onNewTemplate: () => void;
  onEditTemplate: (template: FormTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onRunTemplate: (template: FormTemplate) => void;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  templates,
  onNewTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onRunTemplate
}) => {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-md">
              Free Form Engine
            </span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">Form Templates</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Design reusable structured forms with ratings, tables, and signature blocks to fill out into your notebooks.
          </p>
        </div>

        <button
          type="button"
          onClick={onNewTemplate}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs rounded-xl transition shadow-lg shadow-brand-500/20 active:scale-98"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Design New Template</span>
        </button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="flex flex-col justify-between p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition shadow-lg space-y-4"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tpl.color || '#3b82f6' }}
                  />
                  <h3 className="font-bold text-zinc-100 text-base">{tpl.name}</h3>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEditTemplate(tpl)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                    title="Edit Schema"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate(tpl.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition"
                    title="Delete Template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {tpl.description && (
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  {tpl.description}
                </p>
              )}

              {/* Fields preview */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(tpl.fields_schema || []).map((f) => (
                  <span
                    key={f.id}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800/80 text-zinc-300 font-mono"
                  >
                    {f.label} ({f.type})
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">
                {tpl.usage_count || 0} entries created
              </span>

              <button
                type="button"
                onClick={() => onRunTemplate(tpl)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/15 hover:bg-brand-500/25 text-brand-400 border border-brand-500/30 rounded-xl text-xs font-semibold transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Fill Out Entry</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
