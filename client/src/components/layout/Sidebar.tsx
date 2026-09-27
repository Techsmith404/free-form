import React, { useState } from 'react';
import { Notebook, FormTemplate, Tag } from '../../types/index.js';
import { getExportUrl } from '../../api/index.js';
import { useRealtime } from '../../context/RealtimeContext.js';
import { hapticTap, hapticMedium } from '../../services/native.js';
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
  EyeOff,
  Clock,
  Bell,
  Settings as SettingsIcon,
  GitMerge
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
  onOpenSettings?: () => void;
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
  onCloseMobile,
  onOpenSettings
}) => {
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [expandedNotebooks, setExpandedNotebooks] = useState<Record<string, boolean>>({});
  const { timers, reminders, conflicts, setTimersModalOpen, setConflictModalOpen } = useRealtime();

  const activeTimersCount = timers.filter((t) => t.status === 'running' || t.status === 'ringing').length;
  const pendingRemindersCount = reminders.filter((r) => r.status === 'pending' || r.status === 'triggered').length;

  const handleSelectNav = (action: () => void) => {
    hapticTap();
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
        className={`fixed top-0 bottom-0 left-0 z-50 w-80 sm:w-84 max-w-[88vw] bg-zinc-950 border-r border-zinc-800 flex flex-col transition-transform duration-300 shadow-2xl lg:static lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 sm:p-5 pt-[max(env(safe-area-inset-top),1rem)] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.svg?v=2"
              alt="Free Form Logo"
              className="w-10 h-10 rounded-2xl shadow-lg shadow-cyan-950/40 shrink-0 object-cover"
            />
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

          {/* Close button — large touch target */}
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onCloseMobile();
            }}
            className="lg:hidden h-11 w-11 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition touch-manipulation"
            aria-label="Close Navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Quick Action Button */}
        <div className="p-4 border-b border-zinc-800 relative">
          <button
            type="button"
            onClick={() => setShowNewMenu(!showNewMenu)}
            className="w-full h-13 py-3.5 flex items-center justify-center gap-2 px-4 bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-brand-500/25 active:scale-[0.98] touch-manipulation"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>New Note or Form</span>
          </button>

          {/* Quick Create Dropdown */}
          {showNewMenu && (
            <div
              className="absolute top-[5.5rem] left-4 right-4 z-50 bg-zinc-900 border border-zinc-700 rounded-2xl p-2 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150"
              onClick={() => setShowNewMenu(false)}
            >
              <button
                type="button"
                onClick={() => handleSelectNav(onNewNote)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-zinc-200 hover:bg-zinc-800 transition touch-manipulation min-h-[48px]"
              >
                <FileText className="w-4 h-4 text-brand-400 shrink-0" />
                <span>Markdown Note</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectNav(onNewCounter)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-zinc-200 hover:bg-zinc-800 transition touch-manipulation min-h-[48px]"
              >
                <Hash className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Interactive Counter</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectNav(onNewBookmark)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-zinc-200 hover:bg-zinc-800 transition touch-manipulation min-h-[48px]"
              >
                <Bookmark className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Web Bookmark</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectNav(onNewPoster)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-zinc-200 hover:bg-zinc-800 transition touch-manipulation min-h-[48px]"
              >
                <Images className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Scrapbook Poster</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectNav(() => setTimersModalOpen(true))}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-zinc-200 hover:bg-zinc-800 transition touch-manipulation min-h-[48px]"
              >
                <Clock className="w-4 h-4 text-brand-400 shrink-0" />
                <span>Timer or Reminder</span>
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
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition truncate touch-manipulation min-h-[44px]"
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
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
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
              className={`w-full h-12 flex items-center gap-3 px-3.5 rounded-xl transition touch-manipulation ${
                activeFilter === 'all' && activeNotebookId === null
                  ? 'bg-zinc-800 text-white font-bold shadow-sm'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <FileText className="w-5 h-5 text-zinc-400 shrink-0" />
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
              className={`w-full h-12 flex items-center gap-3 px-3.5 rounded-xl transition touch-manipulation ${
                activeFilter === 'favorites'
                  ? 'bg-zinc-800 text-amber-400 font-bold shadow-sm'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Star className="w-5 h-5 text-amber-400 shrink-0" />
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
              className={`w-full h-12 flex items-center justify-between px-3.5 rounded-xl transition touch-manipulation ${
                activeFilter === 'templates'
                  ? 'bg-zinc-800 text-brand-400 font-bold shadow-sm'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <ClipboardList className="w-5 h-5 text-brand-400 shrink-0" />
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
                  setTimersModalOpen(true);
                })
              }
              className="w-full h-12 flex items-center justify-between px-3.5 rounded-xl transition touch-manipulation text-zinc-300 hover:text-white hover:bg-zinc-900"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-brand-400 shrink-0" />
                <span>Timers & Reminders</span>
              </div>
              {(activeTimersCount > 0 || pendingRemindersCount > 0) && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                  {activeTimersCount + pendingRemindersCount}
                </span>
              )}
            </button>

            {conflicts.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  handleSelectNav(() => {
                    setConflictModalOpen(true);
                  })
                }
                className="w-full h-12 flex items-center justify-between px-3.5 rounded-xl transition touch-manipulation bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20"
              >
                <div className="flex items-center gap-3">
                  <GitMerge className="w-5 h-5 text-amber-400 shrink-0" />
                  <span className="font-bold">Sync Conflicts</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500 text-black font-mono font-bold">
                  {conflicts.length}
                </span>
              </button>
            )}


            <button
              type="button"
              onClick={() =>
                handleSelectNav(() => {
                  onSelectFilter('trash');
                  onSelectNotebook(null);
                })
              }
              className={`w-full h-12 flex items-center gap-3 px-3.5 rounded-xl transition touch-manipulation ${
                activeFilter === 'trash'
                  ? 'bg-zinc-800 text-red-400 font-bold shadow-sm'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Trash2 className="w-5 h-5 text-zinc-400 shrink-0" />
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
                className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition touch-manipulation"
                title="Create Top-Level Notebook"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="space-y-0.5 text-sm font-medium">
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
                          className={`group flex items-center justify-between h-12 rounded-xl transition cursor-pointer pr-1 ${
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
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 touch-manipulation shrink-0"
                                title={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </button>
                            ) : (
                              <span className="w-[1.625rem] shrink-0" />
                            )}

                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: nb.color || '#22c55e' }}
                            />
                            <span className="truncate text-xs font-semibold">{nb.name}</span>

                            {nb.default_template_id && (
                              <span title="Bound to template" className="shrink-0">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                              </span>
                            )}

                            {Boolean(nb.hide_from_all) && (
                              <span title="Hidden from All Items feed" className="shrink-0">
                                <EyeOff className="w-3 h-3 text-amber-400/80" />
                              </span>
                            )}
                          </div>

                          {/* Actions — always visible on touch, hover on desktop */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            {nb.item_count !== undefined && (
                              <span className="text-[11px] text-zinc-400 font-mono group-hover:hidden px-1.5">
                                {nb.item_count}
                              </span>
                            )}
                            {/* On mobile: always show action buttons via touch-friendly reveal */}
                            <div
                              className="hidden group-hover:flex items-center gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => onNewNotebook(nb.id)}
                                className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-brand-400 hover:bg-zinc-700 transition touch-manipulation"
                                title="Add Sub-Notebook"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditNotebook(nb)}
                                className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition touch-manipulation"
                                title="Edit Notebook"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteNotebook(nb.id)}
                                className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition touch-manipulation"
                                title="Delete Notebook"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
        <div className="p-4 pb-[max(env(safe-area-inset-bottom),1rem)] border-t border-zinc-800 bg-zinc-950 space-y-2">
          {onOpenSettings && (
            <button
              type="button"
              onClick={() => handleSelectNav(onOpenSettings)}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs font-bold border border-zinc-800 transition shadow-sm touch-manipulation"
            >
              <SettingsIcon className="w-4 h-4 text-zinc-400" />
              <span>Settings & Preferences</span>
            </button>
          )}
          <a
            href={getExportUrl()}
            download
            className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs font-bold border border-zinc-800 transition shadow-sm touch-manipulation"
          >
            <Download className="w-4 h-4 text-zinc-400" />
            <span>Export Backup (ZIP)</span>
          </a>
        </div>
      </aside>
    </>
  );
};
