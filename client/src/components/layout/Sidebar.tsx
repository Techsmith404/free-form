import React, { useState } from 'react';
import { Notebook, FormTemplate, Tag } from '../../types/index.js';
import { getExportUrl } from '../../api/index.js';
import {
  Folder,
  Plus,
  Star,
  FileText,
  Hash,
  Bookmark,
  Images,
  ClipboardList,
  Trash2,
  Download,
  Edit2,
  Sparkles,
  Layers,
  X,
  ChevronRight,
  ChevronDown,
  EyeOff
} from 'lucide-react';

interface SidebarProps {
  notebooks: Notebook[];
  templates: FormTemplate[];
  tags: Tag[];
  activeNotebookId: string | null;
  activeFilter: 'all' | 'favorites' | 'templates' | 'trash';
  onSelectFilter: (filter: 'all' | 'favorites' | 'templates' | 'trash') => void;
  onSelectNotebook: (id: string | null) => void;
  onNewNotebook: (parentId?: string | null) => void;
  onEditNotebook: (notebook: Notebook) => void;
  onDeleteNotebook: (id: string) => void;
  onNewNote: () => void;
  onNewCounter: () => void;
  onNewBookmark: () => void;
  onNewPoster: () => void;
  onOpenTemplateRunner: (template: FormTemplate) => void;
  onNewTemplate: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  notebooks,
  templates,
  activeNotebookId,
  activeFilter,
  onSelectFilter,
  onSelectNotebook,
  onNewNotebook,
  onEditNotebook,
  onDeleteNotebook,
  onNewNote,
  onNewCounter,
  onNewBookmark,
  onNewPoster,
  onOpenTemplateRunner,
  isOpenMobile,
  onCloseMobile
}) => {
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [expandedNotebooks, setExpandedNotebooks] = useState<Record<string, boolean>>({});

  const handleSelectNav = (action: () => void) => {
    action();
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-80 sm:w-84 max-w-[85vw] bg-zinc-950 border-r border-zinc-800 flex flex-col transition-transform duration-300 shadow-2xl lg:static lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-brand-500/25 shrink-0">
              <Layers className="w-6 h-6 text-zinc-950 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-black text-lg tracking-tight text-white flex items-center gap-1.5">
                <span>Free Form</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/30">
                  v0.1
                </span>
              </h1>
              <p className="text-xs text-zinc-400 font-medium">Notes & Form Engine</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Quick Action Button */}
        <div className="p-4 border-b border-zinc-800 relative">
          <button
            type="button"
            onClick={() => setShowNewMenu(!showNewMenu)}
            className="w-full h-12 flex items-center justify-center gap-2 px-4 bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-brand-500/25 active:scale-98"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>New Note or Form</span>
          </button>

          {/* Quick Create Dropdown */}
          {showNewMenu && (
            <div
              className="absolute top-18 left-4 right-4 z-50 bg-zinc-900 border border-zinc-700 rounded-2xl p-2 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150"
              onClick={() => setShowNewMenu(false)}
            >
              <button
                type="button"
                onClick={() => handleSelectNav(onNewNote)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-zinc-200 hover:bg-zinc-800 transition"
              >
                <FileText className="w-4 h-4 text-brand-400" />
                <span>Markdown Note</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectNav(onNewCounter)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-zinc-200 hover:bg-zinc-800 transition"
              >
                <Hash className="w-4 h-4 text-emerald-400" />
                <span>Interactive Counter</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectNav(onNewBookmark)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-zinc-200 hover:bg-zinc-800 transition"
              >
                <Bookmark className="w-4 h-4 text-blue-400" />
                <span>Web Bookmark</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectNav(onNewPoster)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-zinc-200 hover:bg-zinc-800 transition"
              >
                <Images className="w-4 h-4 text-purple-400" />
                <span>Scrapbook Poster</span>
              </button>

              {templates.length > 0 && (
                <>
                  <div className="h-[1px] bg-zinc-800 my-1.5" />
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Form Templates
                  </div>
                  {templates.slice(0, 3).map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectNav(() => onOpenTemplateRunner(tpl))}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition truncate"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{tpl.name}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
          {/* Main Views */}
          <div className="space-y-1 font-semibold text-sm">
            <button
              type="button"
              onClick={() =>
                handleSelectNav(() => {
                  onSelectFilter('all');
                  onSelectNotebook(null);
                })
              }
              className={`w-full h-11 flex items-center gap-3 px-3.5 rounded-xl transition ${
                activeFilter === 'all' && activeNotebookId === null
                  ? 'bg-zinc-800 text-white font-bold shadow-sm'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <FileText className="w-5 h-5 text-zinc-400" />
              <span>All Items</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleSelectNav(() => {
                  onSelectFilter('favorites');
                  onSelectNotebook(null);
                })
              }
              className={`w-full h-11 flex items-center gap-3 px-3.5 rounded-xl transition ${
                activeFilter === 'favorites'
                  ? 'bg-zinc-800 text-amber-400 font-bold shadow-sm'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Star className="w-5 h-5 text-amber-400" />
              <span>Favorites</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleSelectNav(() => {
                  onSelectFilter('templates');
                  onSelectNotebook(null);
                })
              }
              className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl transition ${
                activeFilter === 'templates'
                  ? 'bg-zinc-800 text-brand-400 font-bold shadow-sm'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <ClipboardList className="w-5 h-5 text-brand-400" />
                <span>Form Templates</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
                {templates.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleSelectNav(() => {
                  onSelectFilter('trash');
                  onSelectNotebook(null);
                })
              }
              className={`w-full h-11 flex items-center gap-3 px-3.5 rounded-xl transition ${
                activeFilter === 'trash'
                  ? 'bg-zinc-800 text-red-400 font-bold shadow-sm'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Trash2 className="w-5 h-5 text-zinc-400" />
              <span>Trash</span>
            </button>
          </div>

          {/* Notebooks Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3 text-xs font-bold uppercase tracking-wider text-zinc-400">
              <span>Notebooks</span>
              <button
                type="button"
                onClick={() => onNewNotebook(null)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition"
                title="Create Top-Level Notebook"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="space-y-1 text-sm font-medium">
              {notebooks.length === 0 ? (
                <div className="px-3 py-2 text-zinc-500 italic text-xs">No notebooks yet</div>
              ) : (
                (() => {
                  const rootNotebooks = notebooks.filter(
                    (nb) => !nb.parent_id || !notebooks.some((parent) => parent.id === nb.parent_id)
                  );

                  const renderNotebookNode = (nb: Notebook, depth = 0): React.ReactNode => {
                    const isActive = activeNotebookId === nb.id;
                    const children = notebooks.filter((child) => child.parent_id === nb.id);
                    const hasChildren = children.length > 0;
                    const isExpanded = expandedNotebooks[nb.id] ?? true;

                    return (
                      <div key={nb.id} className="space-y-0.5">
                        <div
                          className={`group flex items-center justify-between h-10 rounded-xl transition cursor-pointer pr-2 ${
                            isActive
                              ? 'bg-zinc-800 text-white font-bold shadow-sm'
                              : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
                          }`}
                          style={{ paddingLeft: `${depth * 14 + 10}px` }}
                          onClick={() =>
                            handleSelectNav(() => {
                              onSelectNotebook(nb.id);
                              onSelectFilter('all');
                            })
                          }
                        >
                          <div className="flex items-center gap-2 truncate min-w-0">
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedNotebooks((prev) => ({
                                    ...prev,
                                    [nb.id]: !isExpanded
                                  }));
                                }}
                                className="p-0.5 rounded text-zinc-400 hover:text-zinc-200"
                                title={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                                )}
                              </button>
                            ) : (
                              <span className="w-3.5 shrink-0" />
                            )}

                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: nb.color || '#22c55e' }}
                            />
                            <span className="truncate text-xs font-semibold">{nb.name}</span>

                            {nb.default_template_id && (
                              <span title="Bound to template">
                                <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                              </span>
                            )}

                            {Boolean(nb.hide_from_all) && (
                              <span title="Hidden from All Items feed">
                                <EyeOff className="w-3 h-3 text-amber-400/80 shrink-0" />
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {nb.item_count !== undefined && (
                              <span className="text-[11px] text-zinc-400 font-mono group-hover:hidden px-1">
                                {nb.item_count}
                              </span>
                            )}
                            <div
                              className="hidden group-hover:flex items-center gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => onNewNotebook(nb.id)}
                                className="p-1 rounded text-zinc-400 hover:text-brand-400 hover:bg-zinc-700 transition"
                                title="Add Sub-Notebook"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditNotebook(nb)}
                                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
                                title="Edit Notebook"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteNotebook(nb.id)}
                                className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition"
                                title="Delete Notebook"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Children (Sub-notebooks) */}
                        {hasChildren && isExpanded && (
                          <div className="space-y-0.5 border-l border-zinc-800/60 ml-3.5 pl-0.5">
                            {children.map((child) => renderNotebookNode(child, depth + 1))}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return rootNotebooks.map((nb) => renderNotebookNode(nb, 0));
                })()
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950">
          <a
            href={getExportUrl()}
            download
            className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs font-bold border border-zinc-800 transition shadow-sm"
          >
            <Download className="w-4 h-4 text-zinc-400" />
            <span>Export Backup (ZIP)</span>
          </a>
        </div>
      </aside>
    </>
  );
};
