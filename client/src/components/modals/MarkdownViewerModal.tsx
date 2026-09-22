import React from 'react';
import { Item } from '../../types/index.js';
import { marked } from 'marked';
import { X, Copy, Check, Edit2, FileText } from 'lucide-react';

interface MarkdownViewerModalProps {
  item: Item;
  onClose: () => void;
  onEdit?: (item: Item) => void;
}

export const MarkdownViewerModal: React.FC<MarkdownViewerModalProps> = ({
  item,
  onClose,
  onEdit
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(item.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const html = marked.parse(item.content || '*No content*') as string;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-400" />
            <div>
              <h2 className="text-lg font-bold text-zinc-100">{item.title}</h2>
              {item.notebook_name && (
                <p className="text-xs text-zinc-400">in {item.notebook_name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition"
              title="Copy Raw Markdown"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-brand-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Markdown'}</span>
            </button>

            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-medium transition"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950/40">
          <div
            className="prose prose-invert max-w-none text-zinc-200 leading-relaxed font-sans"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
};
