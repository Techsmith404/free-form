import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Item, Notebook, Tag, FormTemplate } from '../../types/index.js';
import {
  Search,
  Command,
  FileDown,
  FileText,
  Folder,
  Tag as TagIcon,
  Plus,
  Clock,
  Settings,
  Sparkles,
  ArrowRight,
  Hash,
  Bookmark,
  Images,
  ClipboardList,
  RotateCw,
  SunMoon,
  CornerDownLeft,
  X
} from 'lucide-react';
import { hapticTap, hapticMedium } from '../../services/native.js';

interface PaletteResult {
  id: string;
  title: string;
  subtitle?: string;
  category: 'action' | 'notebook' | 'item' | 'tag' | 'template';
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  onSelect: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  notebooks: Notebook[];
  tags: Tag[];
  templates: FormTemplate[];
  onSelectItem: (item: Item) => void;
  onSelectNotebook: (notebookId: string | null) => void;
  onSelectTag?: (tagName: string) => void;
  onNewNote: () => void;
  onNewCounter: () => void;
  onNewBookmark: () => void;
  onNewPoster: () => void;
  onOpenTemplateRunner: (template: FormTemplate) => void;
  onNewNotebook: () => void;
  onOpenTimers: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onManualSync?: () => void;
  onExportPdf?: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  items,
  notebooks,
  tags,
  templates,
  onSelectItem,
  onSelectNotebook,
  onSelectTag,
  onNewNote,
  onNewCounter,
  onNewBookmark,
  onNewPoster,
  onOpenTemplateRunner,
  onNewNotebook,
  onOpenTimers,
  onOpenSettings,
  onToggleTheme,
  onManualSync,
  onExportPdf
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset query and focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Global actions list
  const actions: PaletteResult[] = useMemo(() => [
    {
      id: 'act-new-note',
      title: 'New Note',
      subtitle: 'Create a rich markdown note',
      category: 'action',
      icon: <FileText className="w-4 h-4 text-brand-400" />,
      badge: 'Action',
      onSelect: () => {
        onClose();
        onNewNote();
      }
    },
    {
      id: 'act-new-counter',
      title: 'New Counter',
      subtitle: 'Create a tally tracker or counter card',
      category: 'action',
      icon: <Hash className="w-4 h-4 text-emerald-400" />,
      badge: 'Action',
      onSelect: () => {
        onClose();
        onNewCounter();
      }
    },
    {
      id: 'act-new-bookmark',
      title: 'New Bookmark',
      subtitle: 'Save and scrape web links',
      category: 'action',
      icon: <Bookmark className="w-4 h-4 text-sky-400" />,
      badge: 'Action',
      onSelect: () => {
        onClose();
        onNewBookmark();
      }
    },
    {
      id: 'act-new-poster',
      title: 'New Scrapbook',
      subtitle: 'Create an image board with captions',
      category: 'action',
      icon: <Images className="w-4 h-4 text-purple-400" />,
      badge: 'Action',
      onSelect: () => {
        onClose();
        onNewPoster();
      }
    },
    {
      id: 'act-new-notebook',
      title: 'New Notebook',
      subtitle: 'Create a new organized folder',
      category: 'action',
      icon: <Folder className="w-4 h-4 text-amber-400" />,
      badge: 'Action',
      onSelect: () => {
        onClose();
        onNewNotebook();
      }
    },
    {
      id: 'act-timers',
      title: 'Universal Timers & Reminders',
      subtitle: 'Manage active stopwatches, alarms, and due reminders',
      category: 'action',
      icon: <Clock className="w-4 h-4 text-rose-400" />,
      badge: 'Action',
      onSelect: () => {
        onClose();
        onOpenTimers();
      }
    },
    {
      id: 'act-toggle-theme',
      title: 'Toggle Color Theme',
      subtitle: 'Switch between dark and light workstation palette',
      category: 'action',
      icon: <SunMoon className="w-4 h-4 text-yellow-400" />,
      badge: 'Action',
      onSelect: () => {
        onClose();
        onToggleTheme();
      }
    },
    {
      id: 'act-settings',
      title: 'Settings & Preferences',
      subtitle: 'Configure backup, priorities, and sync settings',
      category: 'action',
      icon: <Settings className="w-4 h-4 text-zinc-400" />,
      badge: 'Action',
      onSelect: () => {
        onClose();
        onOpenSettings();
      }
    },
    ...(onExportPdf ? [{
      id: 'act-export-pdf',
      title: 'Export Notebook to PDF',
      subtitle: 'Select, reorder, and export notes into a PDF document',
      category: 'action' as const,
      icon: <FileDown className="w-4 h-4 text-brand-400" />,
      badge: 'Action',
      onSelect: () => {
        onClose();
        onExportPdf();
      }
    }] : []),
    ...(onManualSync ? [{
      id: 'act-sync',
      title: 'Sync Now',
      subtitle: 'Trigger immediate bi-directional server sync',
      category: 'action' as const,
      icon: <RotateCw className="w-4 h-4 text-blue-400" />,
      badge: 'Action',
      onSelect: () => {
        onClose();
        onManualSync();
      }
    }] : [])
  ], [onClose, onNewNote, onNewCounter, onNewBookmark, onNewPoster, onNewNotebook, onOpenTimers, onToggleTheme, onOpenSettings, onManualSync, onExportPdf]);

  // Compute filtered results
  const results: PaletteResult[] = useMemo(() => {
    const trimmed = query.trim();

    // Mode 1: Action Runner ('>')
    if (trimmed.startsWith('>')) {
      const q = trimmed.slice(1).trim().toLowerCase();
      return actions.filter(
        (a) => !q || a.title.toLowerCase().includes(q) || a.subtitle?.toLowerCase().includes(q)
      );
    }

    // Mode 2: Notebook Jump ('@')
    if (trimmed.startsWith('@')) {
      const q = trimmed.slice(1).trim().toLowerCase();
      const nbs: PaletteResult[] = [
        {
          id: 'nb-all',
          title: 'All Notes & Items',
          subtitle: 'Clear notebook filter and show all workspace items',
          category: 'notebook',
          icon: <Folder className="w-4 h-4 text-brand-400" />,
          badge: 'Notebook',
          onSelect: () => {
            onClose();
            onSelectNotebook(null);
          }
        },
        ...notebooks
          .filter((nb) => !q || nb.name.toLowerCase().includes(q) || (nb.description && nb.description.toLowerCase().includes(q)))
          .map((nb) => ({
            id: `nb-${nb.id}`,
            title: nb.name,
            subtitle: nb.description || `${nb.item_count ?? 0} items`,
            category: 'notebook' as const,
            icon: <Folder className="w-4 h-4" style={{ color: nb.color || '#22c55e' }} />,
            badge: 'Notebook',
            onSelect: () => {
              onClose();
              onSelectNotebook(nb.id);
            }
          }))
      ];
      return nbs;
    }

    // Mode 3: Tag Filter ('#')
    if (trimmed.startsWith('#')) {
      const q = trimmed.slice(1).trim().toLowerCase();
      return tags
        .filter((t) => !q || t.name.toLowerCase().includes(q))
        .map((t) => ({
          id: `tag-${t.id || t.name}`,
          title: `#${t.name}`,
          subtitle: 'Filter feed by this tag',
          category: 'tag' as const,
          icon: <TagIcon className="w-4 h-4" style={{ color: t.color || '#6b7280' }} />,
          badge: 'Tag',
          onSelect: () => {
            onClose();
            if (onSelectTag) {
              onSelectTag(t.name);
            }
          }
        }));
    }

    // Mode 4: Universal Spotlight Search
    const q = trimmed.toLowerCase();
    const matches: PaletteResult[] = [];

    // Matching actions (limit 3)
    if (q) {
      const matchedActions = actions
        .filter((a) => a.title.toLowerCase().includes(q) || a.subtitle?.toLowerCase().includes(q))
        .slice(0, 3);
      matches.push(...matchedActions);
    }

    // Matching notebooks (limit 3)
    const matchedNbs = notebooks
      .filter((nb) => !q || nb.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((nb) => ({
        id: `nb-${nb.id}`,
        title: nb.name,
        subtitle: `Notebook • ${nb.item_count ?? 0} items`,
        category: 'notebook' as const,
        icon: <Folder className="w-4 h-4" style={{ color: nb.color || '#22c55e' }} />,
        badge: 'Notebook',
        onSelect: () => {
          onClose();
          onSelectNotebook(nb.id);
        }
      }));
    matches.push(...matchedNbs);

    // Matching templates (limit 3)
    const matchedTpls = templates
      .filter((tpl) => !q || tpl.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((tpl) => ({
        id: `tpl-${tpl.id}`,
        title: tpl.name,
        subtitle: tpl.description || 'Fill new operational form log',
        category: 'template' as const,
        icon: <ClipboardList className="w-4 h-4" style={{ color: tpl.color || '#3b82f6' }} />,
        badge: 'Form',
        onSelect: () => {
          onClose();
          onOpenTemplateRunner(tpl);
        }
      }));
    matches.push(...matchedTpls);

    // Matching items (active/unarchived first, limit 12)
    const matchedItems = items
      .filter((item) => {
        if (item.is_archived) return false;
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          (item.content && item.content.toLowerCase().includes(q))
        );
      })
      .slice(0, 12)
      .map((item) => {
        let iconNode = <FileText className="w-4 h-4 text-brand-400" />;
        let typeBadge = 'Note';
        if (item.type === 'counter') {
          iconNode = <Hash className="w-4 h-4 text-emerald-400" />;
          typeBadge = 'Counter';
        } else if (item.type === 'bookmark') {
          iconNode = <Bookmark className="w-4 h-4 text-sky-400" />;
          typeBadge = 'Bookmark';
        } else if (item.type === 'poster') {
          iconNode = <Images className="w-4 h-4 text-purple-400" />;
          typeBadge = 'Scrapbook';
        } else if (item.type === 'form_entry') {
          iconNode = <ClipboardList className="w-4 h-4 text-blue-400" />;
          typeBadge = 'Form Log';
        }

        return {
          id: `item-${item.id}`,
          title: item.title,
          subtitle: item.notebook_name ? `${item.notebook_name} • ${typeBadge}` : typeBadge,
          category: 'item' as const,
          icon: iconNode,
          badge: typeBadge,
          onSelect: () => {
            onClose();
            onSelectItem(item);
          }
        };
      });
    matches.push(...matchedItems);

    return matches;
  }, [query, actions, notebooks, tags, templates, items, onClose, onSelectNotebook, onSelectTag, onOpenTemplateRunner, onSelectItem]);

  // Reset selectedIndex when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  // Ensure active element is scrolled into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        hapticMedium();
        results[selectedIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 pt-[max(env(safe-area-inset-top),3.5rem)] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Top Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800 bg-zinc-950/60 shrink-0">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search... ('>' for actions, '@' for notebooks, '#' for tags)"
            className="flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-500 text-sm sm:text-base outline-none border-0"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="text-zinc-400 hover:text-zinc-200 p-1"
              aria-label="Clear query"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-mono bg-zinc-800 text-zinc-400 rounded border border-zinc-700/60">
              Esc
            </kbd>
          )}
        </div>

        {/* Quick Filter Pill Buttons */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-zinc-800/80 bg-zinc-950/30 text-xs shrink-0 overflow-x-auto">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mr-1 shrink-0">
            Modes:
          </span>
          <button
            type="button"
            onClick={() => {
              setQuery('>');
              inputRef.current?.focus();
            }}
            className={`px-2 py-1 rounded-lg border font-mono text-[11px] transition shrink-0 ${
              query.startsWith('>')
                ? 'bg-brand-500/20 text-brand-300 border-brand-500/40 font-bold'
                : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-zinc-200'
            }`}
          >
            &gt; Actions
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('@');
              inputRef.current?.focus();
            }}
            className={`px-2 py-1 rounded-lg border font-mono text-[11px] transition shrink-0 ${
              query.startsWith('@')
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-zinc-200'
            }`}
          >
            @ Notebooks
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('#');
              inputRef.current?.focus();
            }}
            className={`px-2 py-1 rounded-lg border font-mono text-[11px] transition shrink-0 ${
              query.startsWith('#')
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
                : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-zinc-200'
            }`}
          >
            # Tags
          </button>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-zinc-800/40"
        >
          {results.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              <p className="font-medium">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-zinc-600 mt-1">
                Try searching for a note title, content word, or prefix with &gt;, @, or #
              </p>
            </div>
          ) : (
            results.map((res, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => {
                    hapticTap();
                    res.onSelect();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl flex items-center justify-between text-left transition touch-manipulation ${
                    isSelected
                      ? 'bg-brand-500/15 border border-brand-500/35 text-white'
                      : 'text-zinc-300 hover:bg-zinc-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="shrink-0 p-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60">
                      {res.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate flex items-center gap-2">
                        <span>{res.title}</span>
                      </div>
                      {res.subtitle && (
                        <div className="text-xs text-zinc-400 truncate mt-0.5">
                          {res.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {res.badge && (
                      <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-zinc-800 text-zinc-400 border border-zinc-700/60 rounded-md">
                        {res.badge}
                      </span>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-4 h-4 text-brand-400 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 bg-zinc-950/80 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 shrink-0">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 font-mono">↑</kbd>{' '}
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 font-mono">↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 font-mono">↵</kbd> Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 font-mono">Esc</kbd> Close
            </span>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1 text-zinc-500">
            <Command className="w-3.5 h-3.5 text-brand-400" />
            <span>Omni Palette</span>
          </div>
        </div>
      </div>
    </div>
  );
};
