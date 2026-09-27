import React, { useState } from 'react';
import { ConflictRecord } from '../../types';
import { resolveConflict } from '../../api';
import {
  GitMerge,
  Check,
  RotateCcw,
  Copy,
  Edit3,
  X,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Layers,
  FileText
} from 'lucide-react';

interface ConflictResolverModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: ConflictRecord[];
  onResolved: () => void;
}

export const ConflictResolverModal: React.FC<ConflictResolverModalProps> = ({
  isOpen,
  onClose,
  conflicts,
  onResolved
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCustomMerging, setIsCustomMerging] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customContent, setCustomContent] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  if (!isOpen || conflicts.length === 0) return null;

  const currentConflict = conflicts[currentIndex] || conflicts[0];

  const handleStartCustomMerge = () => {
    setCustomTitle(currentConflict.active_title);
    setCustomContent(
      `# ${currentConflict.active_title}\n\n` +
      `<!-- === CURRENT ACTIVE VERSION (${new Date(currentConflict.active_updated_at).toLocaleString()}) === -->\n` +
      `${currentConflict.active_content}\n\n` +
      `<!-- === CONFLICTING VERSION (${new Date(currentConflict.conflict_updated_at).toLocaleString()} - ${currentConflict.device_name || 'Remote'}) === -->\n` +
      `${currentConflict.conflict_content}`
    );
    setIsCustomMerging(true);
  };

  const handleResolve = async (
    action: 'keep_active' | 'use_conflict' | 'keep_both' | 'custom_merge',
    customData?: { title: string; content: string }
  ) => {
    if (isResolving) return;
    setIsResolving(true);
    try {
      await resolveConflict(currentConflict.id, {
        action,
        title: customData?.title,
        content: customData?.content
      });

      setIsCustomMerging(false);
      onResolved();

      if (conflicts.length <= 1) {
        onClose();
      } else {
        setCurrentIndex((prev) => Math.min(prev, conflicts.length - 2));
      }
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    } finally {
      setIsResolving(false);
    }
  };

  const activeLines = (currentConflict.active_content || '').split('\n');
  const conflictLines = (currentConflict.conflict_content || '').split('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--surface-primary)] border border-amber-500/30 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Resolve Note Conflict
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {currentIndex + 1} of {conflicts.length}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Edited on multiple devices offline. The most recent edit is currently active.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Multiple Conflicts Selector Strip */}
        {conflicts.length > 1 && (
          <div className="flex items-center gap-2 px-5 py-2 bg-[var(--surface-secondary)]/50 border-b border-[var(--border-subtle)] overflow-x-auto">
            <span className="text-xs text-[var(--text-tertiary)] font-medium shrink-0">Conflicts:</span>
            {conflicts.map((c, idx) => (
              <button
                key={c.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  setIsCustomMerging(false);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  idx === currentIndex
                    ? 'bg-amber-500 text-black shadow-sm font-semibold'
                    : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                }`}
              >
                {c.active_title || `Note #${idx + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {isCustomMerging ? (
            /* Custom Merge Interactive Editor */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                ✏️ <strong>Custom Merge Mode:</strong> Combine, edit, or clean up the text below. When ready, click "Save & Keep Merged Note" to replace the active note with this merged content.
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Note Title
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Merged Markdown Content
                </label>
                <textarea
                  rows={14}
                  value={customContent}
                  onChange={(e) => setCustomContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>
            </div>
          ) : (
            /* Side-by-Side Comparison */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Active Version Card */}
                <div className="flex flex-col rounded-xl border border-emerald-500/30 bg-emerald-500/[0.03] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-semibold text-emerald-400">
                        Current Active Version
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-400/80 font-mono">
                      {new Date(currentConflict.active_updated_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col space-y-2">
                    <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                      {currentConflict.active_title}
                    </h3>
                    <div className="flex-1 max-h-64 overflow-y-auto p-3 rounded-lg bg-[var(--surface-secondary)]/60 text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words leading-relaxed border border-[var(--border-subtle)]">
                      {currentConflict.active_content || <em className="text-zinc-500">Empty content</em>}
                    </div>
                  </div>
                </div>

                {/* Conflicting Version Card */}
                <div className="flex flex-col rounded-xl border border-amber-500/30 bg-amber-500/[0.03] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span className="text-xs font-semibold text-amber-400">
                        {currentConflict.device_name || 'Remote Device'} (Conflicting Edit)
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-400/80 font-mono">
                      {new Date(currentConflict.conflict_updated_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col space-y-2">
                    <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                      {currentConflict.conflict_title}
                    </h3>
                    <div className="flex-1 max-h-64 overflow-y-auto p-3 rounded-lg bg-[var(--surface-secondary)]/60 text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words leading-relaxed border border-[var(--border-subtle)]">
                      {currentConflict.conflict_content || <em className="text-zinc-500">Empty content</em>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-primary)]">
          {isCustomMerging ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsCustomMerging(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
              >
                Cancel Merge
              </button>
              <button
                type="button"
                disabled={isResolving}
                onClick={() =>
                  handleResolve('custom_merge', {
                    title: customTitle,
                    content: customContent
                  })
                }
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Save & Keep Merged Note
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {/* Option 1: Keep Active */}
              <button
                type="button"
                disabled={isResolving}
                onClick={() => handleResolve('keep_active')}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-all"
                title="Keep the currently active version and dismiss the conflict"
              >
                <Check className="h-4 w-4 shrink-0" />
                <span>Keep Active</span>
              </button>

              {/* Option 2: Restore Conflict Version */}
              <button
                type="button"
                disabled={isResolving}
                onClick={() => handleResolve('use_conflict')}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-sky-600/15 hover:bg-sky-600/25 text-sky-400 border border-sky-500/30 text-xs font-medium transition-all"
                title="Replace the active note with this conflicting version"
              >
                <RotateCcw className="h-4 w-4 shrink-0" />
                <span>Use Conflict Edit</span>
              </button>

              {/* Option 3: Keep Both */}
              <button
                type="button"
                disabled={isResolving}
                onClick={() => handleResolve('keep_both')}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 text-purple-400 border border-purple-500/30 text-xs font-medium transition-all"
                title="Keep active note and save the conflicting version as a separate note"
              >
                <Copy className="h-4 w-4 shrink-0" />
                <span>Keep Both Notes</span>
              </button>

              {/* Option 4: Custom Merge */}
              <button
                type="button"
                disabled={isResolving}
                onClick={handleStartCustomMerge}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500 text-black hover:bg-amber-400 text-xs font-semibold transition-all shadow-md shadow-amber-500/10"
                title="Manually combine and edit both versions in an interactive editor"
              >
                <Edit3 className="h-4 w-4 shrink-0" />
                <span>Custom Merge</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
