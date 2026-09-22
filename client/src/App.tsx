import React, { useState, useEffect, useMemo } from 'react';
import {
  Notebook,
  Item,
  FormTemplate,
  Tag,
  ItemType
} from './types/index.js';
import {
  fetchNotebooks,
  fetchItems,
  fetchTemplates,
  fetchTags,
  deleteNotebook,
  deleteItem,
  updateItem,
  deleteTemplate
} from './api/index.js';
import { Sidebar } from './components/layout/Sidebar.js';
import { Navbar } from './components/layout/Navbar.js';
import { TemplatesView } from './components/views/TemplatesView.js';
import { NoteCard } from './components/items/NoteCard.js';
import { FormEntryCard } from './components/items/FormEntryCard.js';
import { CounterCard } from './components/items/CounterCard.js';
import { BookmarkCard } from './components/items/BookmarkCard.js';
import { PosterCard } from './components/items/PosterCard.js';

// Modals
import { NoteEditorModal } from './components/modals/NoteEditorModal.js';
import { NewNotebookModal } from './components/modals/NewNotebookModal.js';
import { NewBookmarkModal } from './components/modals/NewBookmarkModal.js';
import { NewCounterModal } from './components/modals/NewCounterModal.js';
import { NewPosterModal } from './components/modals/NewPosterModal.js';
import { FormRunnerModal } from './components/forms/FormRunnerModal.js';
import { TemplateBuilderModal } from './components/forms/TemplateBuilderModal.js';
import { MarkdownViewerModal } from './components/modals/MarkdownViewerModal.js';

import { Plus, FileText, Hash, Bookmark, Images, ClipboardList, Sparkles, Folder, Star, ChevronRight, ChevronLeft, EyeOff, Layers } from 'lucide-react';

export const App: React.FC = () => {
  // Data State
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Navigation State
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'templates' | 'trash'>('all');
  const [selectedType, setSelectedType] = useState<ItemType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [expandAllCards, setExpandAllCards] = useState<boolean>(false);
  const [showHiddenItems, setShowHiddenItems] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileFabMenuOpen, setMobileFabMenuOpen] = useState(false);

  // Modal States
  const [noteModal, setNoteModal] = useState<{ open: boolean; item?: Item | null }>({ open: false });
  const [notebookModal, setNotebookModal] = useState<{ open: boolean; notebook?: Notebook | null; defaultParentId?: string | null }>({ open: false });
  const [bookmarkModal, setBookmarkModal] = useState<{ open: boolean; item?: Item | null }>({ open: false });
  const [counterModal, setCounterModal] = useState<{ open: boolean; item?: Item | null }>({ open: false });
  const [posterModal, setPosterModal] = useState<{ open: boolean; item?: Item | null }>({ open: false });
  const [formRunnerModal, setFormRunnerModal] = useState<{ open: boolean; template?: FormTemplate | null; existingItem?: Item | null }>({ open: false });
  const [templateBuilderModal, setTemplateBuilderModal] = useState<{ open: boolean; template?: FormTemplate | null }>({ open: false });
  const [markdownViewerModal, setMarkdownViewerModal] = useState<{ open: boolean; item?: Item | null }>({ open: false });

  // Initial Data Load
  const loadData = async () => {
    try {
      setLoading(true);
      const [nbs, itms, tpls, tgs] = await Promise.all([
        fetchNotebooks(),
        fetchItems({ is_archived: activeFilter === 'trash' }),
        fetchTemplates(),
        fetchTags()
      ]);
      setNotebooks(nbs);
      setItems(itms);
      setTemplates(tpls);
      setTags(tgs);
    } catch (err) {
      console.error('Error loading data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeFilter]);

  // Active Notebook Object
  const activeNotebook = useMemo(() => {
    return notebooks.find((n) => n.id === activeNotebookId) || null;
  }, [notebooks, activeNotebookId]);

  // Parent Notebook (for breadcrumbs and navigation)
  const parentNotebook = useMemo(() => {
    if (!activeNotebook?.parent_id) return null;
    return notebooks.find((n) => n.id === activeNotebook.parent_id) || null;
  }, [notebooks, activeNotebook]);

  // Sub-Notebooks belonging to current active notebook
  const subNotebooks = useMemo(() => {
    if (!activeNotebook) return [];
    return notebooks.filter((n) => n.parent_id === activeNotebook.id);
  }, [notebooks, activeNotebook]);

  // Count of items excluded from All Items feed
  const hiddenItemsCount = useMemo(() => {
    return items.filter((item) => {
      if (item.hide_from_all === 1) return true;
      const nb = notebooks.find((n) => n.id === item.notebook_id);
      return nb?.hide_from_all === 1;
    }).length;
  }, [items, notebooks]);

  // If viewing a notebook linked to a form template, expand all cards by default
  useEffect(() => {
    setExpandAllCards(Boolean(activeNotebook?.default_template_id));
  }, [activeNotebookId, activeNotebook?.default_template_id]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Notebook filter
      if (activeNotebookId && item.notebook_id !== activeNotebookId) {
        return false;
      }
      // 1b. Hide from All Items filter
      if (!activeNotebookId && activeFilter === 'all' && !showHiddenItems && !searchQuery.trim()) {
        if (item.hide_from_all === 1) return false;
        const parentNb = notebooks.find((n) => n.id === item.notebook_id);
        if (parentNb?.hide_from_all === 1) return false;
      }
      // 2. Favorites filter
      if (activeFilter === 'favorites' && !item.is_favorite) {
        return false;
      }
      // 3. Type filter
      if (selectedType !== 'all' && item.type !== selectedType) {
        return false;
      }
      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesContent = item.content.toLowerCase().includes(q);
        if (!matchesTitle && !matchesContent) return false;
      }
      return true;
    });
  }, [items, activeNotebookId, activeFilter, selectedType, searchQuery, showHiddenItems, notebooks]);

  // Handlers for Items
  const handleItemSaved = (saved: Item) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
    // refresh notebooks count
    fetchNotebooks().then(setNotebooks);
  };

  const handleDeleteItem = async (id: string) => {
    const isTrash = activeFilter === 'trash';
    const msg = isTrash ? 'Permanently delete this item?' : 'Move item to trash?';
    if (!confirm(msg)) return;

    try {
      await deleteItem(id, isTrash);
      setItems((prev) => prev.filter((i) => i.id !== id));
      fetchNotebooks().then(setNotebooks);
    } catch (err) {
      console.error('Failed to delete item', err);
    }
  };

  const handleToggleFavorite = async (item: Item) => {
    try {
      const nextFav = item.is_favorite ? 0 : 1;
      const updated = await updateItem(item.id, { is_favorite: nextFav });
      handleItemSaved(updated);
    } catch (err) {
      console.error('Failed to toggle favorite', err);
    }
  };

  const handleTogglePin = async (item: Item) => {
    try {
      const nextPin = item.is_pinned ? 0 : 1;
      const updated = await updateItem(item.id, { is_pinned: nextPin });
      handleItemSaved(updated);
    } catch (err) {
      console.error('Failed to toggle pin', err);
    }
  };

  // Notebook Handlers
  const handleNotebookSaved = (nb: Notebook) => {
    setNotebooks((prev) => {
      const idx = prev.findIndex((n) => n.id === nb.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = nb;
        return copy;
      }
      return [...prev, nb];
    });
  };

  const handleDeleteNotebook = async (id: string) => {
    if (!confirm('Delete this notebook? Notes will be moved to Uncategorized.')) return;
    try {
      await deleteNotebook(id);
      setNotebooks((prev) => prev.filter((n) => n.id !== id));
      if (activeNotebookId === id) setActiveNotebookId(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete notebook', err);
    }
  };

  // Quick Add Action from Navbar or Notebook
  const handleQuickAdd = () => {
    if (activeNotebook?.default_template_id) {
      const tpl = templates.find((t) => t.id === activeNotebook.default_template_id);
      if (tpl) {
        setFormRunnerModal({ open: true, template: tpl });
        return;
      }
    }
    setNoteModal({ open: true, item: null });
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans selection:bg-brand-500 selection:text-white">
      {/* Sidebar */}
      <Sidebar
        notebooks={notebooks}
        templates={templates}
        tags={tags}
        activeNotebookId={activeNotebookId}
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        onSelectNotebook={setActiveNotebookId}
        onNewNotebook={(parentId) => setNotebookModal({ open: true, notebook: null, defaultParentId: parentId || null })}
        onEditNotebook={(nb) => setNotebookModal({ open: true, notebook: nb })}
        onDeleteNotebook={handleDeleteNotebook}
        onNewNote={() => setNoteModal({ open: true, item: null })}
        onNewCounter={() => setCounterModal({ open: true, item: null })}
        onNewBookmark={() => setBookmarkModal({ open: true, item: null })}
        onNewPoster={() => setPosterModal({ open: true, item: null })}
        onOpenTemplateRunner={(tpl) => setFormRunnerModal({ open: true, template: tpl })}
        onNewTemplate={() => setTemplateBuilderModal({ open: true, template: null })}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Navbar */}
        <Navbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedType={selectedType}
          onSelectType={setSelectedType}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          activeNotebook={activeNotebook}
          isExpandedAll={expandAllCards}
          onToggleExpandAll={() => setExpandAllCards((prev) => !prev)}
          onQuickAdd={handleQuickAdd}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onBack={
            activeNotebook
              ? () => setActiveNotebookId(activeNotebook.parent_id || null)
              : undefined
          }
          backLabel={parentNotebook ? parentNotebook.name : 'All Notes'}
        />

        {/* Views */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 sm:pb-8">
          {activeFilter === 'templates' ? (
            <TemplatesView
              templates={templates}
              onNewTemplate={() => setTemplateBuilderModal({ open: true, template: null })}
              onEditTemplate={(tpl) => setTemplateBuilderModal({ open: true, template: tpl })}
              onDeleteTemplate={async (id) => {
                if (confirm('Delete this template?')) {
                  await deleteTemplate(id);
                  setTemplates((prev) => prev.filter((t) => t.id !== id));
                }
              }}
              onRunTemplate={(tpl) => setFormRunnerModal({ open: true, template: tpl })}
            />
          ) : (
            <div>
              {/* Breadcrumbs & Sub-Notebooks Header */}
              {activeNotebook && (
                <div className="mb-4">
                  {/* Breadcrumb Path */}
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-2.5 overflow-x-auto no-scrollbar py-0.5">
                    <button
                      type="button"
                      onClick={() => setActiveNotebookId(null)}
                      className="hover:text-white transition flex items-center gap-1 shrink-0 font-medium"
                    >
                      <Folder className="w-3.5 h-3.5 text-zinc-500" />
                      <span>All Items</span>
                    </button>
                    {parentNotebook && (
                      <>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                        <button
                          type="button"
                          onClick={() => setActiveNotebookId(parentNotebook.id)}
                          className="hover:text-white transition truncate max-w-[130px] shrink-0 font-medium"
                        >
                          {parentNotebook.name}
                        </button>
                      </>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                    <span className="text-zinc-200 font-bold truncate max-w-[160px] shrink-0">
                      {activeNotebook.name}
                    </span>
                  </div>

                  {/* Sub-Notebooks Cards */}
                  {subNotebooks.length > 0 && (
                    <div className="mb-4 p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                          <Folder className="w-3.5 h-3.5 text-brand-400" />
                          <span>Sub-Notebooks ({subNotebooks.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setNotebookModal({ open: true, notebook: null, defaultParentId: activeNotebook.id })
                          }
                          className="flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Sub-Notebook</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {subNotebooks.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setActiveNotebookId(sub.id)}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 text-left transition shadow-sm active:scale-98 group"
                          >
                            <div className="flex items-center gap-2 truncate min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: sub.color || '#22c55e' }}
                              />
                              <span className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate">
                                {sub.name}
                              </span>
                            </div>
                            {sub.item_count !== undefined && (
                              <span className="text-[11px] text-zinc-400 font-mono ml-1.5">
                                {sub.item_count}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hidden Items Indicator / Toggle in All Items view */}
              {!activeNotebookId && activeFilter === 'all' && hiddenItemsCount > 0 && (
                <div className="flex items-center justify-between mb-4 px-1">
                  <button
                    type="button"
                    onClick={() => setShowHiddenItems(!showHiddenItems)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition shadow-sm"
                  >
                    <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {showHiddenItems
                        ? `Showing ${hiddenItemsCount} hidden items (click to hide)`
                        : `${hiddenItemsCount} hidden item${hiddenItemsCount > 1 ? 's' : ''} excluded from feed (click to reveal)`}
                    </span>
                  </button>
                </div>
              )}

              {/* Empty State */}
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto my-12 border-2 border-dashed border-zinc-800/80 rounded-3xl bg-zinc-900/30">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4 shadow-xl">
                    <Sparkles className="w-7 h-7 text-brand-400" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-100">No items found</h3>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    Start filling this notebook with markdown notes, quick counters, bookmarks, or structured form entries.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => setNoteModal({ open: true, item: null })}
                      className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition"
                    >
                      <FileText className="w-3.5 h-3.5 text-brand-400" />
                      <span>Note</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCounterModal({ open: true, item: null })}
                      className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition"
                    >
                      <Hash className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Counter</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookmarkModal({ open: true, item: null })}
                      className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition"
                    >
                      <Bookmark className="w-3.5 h-3.5 text-blue-400" />
                      <span>Bookmark</span>
                    </button>
                    {templates.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormRunnerModal({ open: true, template: templates[0] })}
                        className="flex items-center gap-1.5 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-brand-500/20"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        <span>Fill Form</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
                      : 'flex flex-col space-y-3'
                  }
                >
                  {filteredItems.map((item) => {
                    switch (item.type) {
                      case 'counter':
                        return (
                          <CounterCard
                            key={item.id}
                            item={item}
                            onUpdate={handleItemSaved}
                            onDelete={handleDeleteItem}
                            onEdit={(it) => setCounterModal({ open: true, item: it })}
                          />
                        );
                      case 'bookmark':
                        return (
                          <BookmarkCard
                            key={item.id}
                            item={item}
                            onUpdate={handleItemSaved}
                            onDelete={handleDeleteItem}
                            onEdit={(it) => setBookmarkModal({ open: true, item: it })}
                          />
                        );
                      case 'poster':
                        return (
                          <PosterCard
                            key={item.id}
                            item={item}
                            onUpdate={handleItemSaved}
                            onDelete={handleDeleteItem}
                            onEdit={(it) => setPosterModal({ open: true, item: it })}
                          />
                        );
                      case 'form_entry':
                        return (
                          <FormEntryCard
                            key={item.id}
                            item={item}
                            template={templates.find((t) => t.id === item.metadata?.template_id)}
                            isExpanded={expandAllCards}
                            onOpenForm={(it) => {
                              const tpl = templates.find((t) => t.id === it.metadata?.template_id);
                              if (tpl) {
                                setFormRunnerModal({ open: true, template: tpl, existingItem: it });
                              }
                            }}
                            onOpenMarkdown={(it) => setMarkdownViewerModal({ open: true, item: it })}
                            onToggleFavorite={handleToggleFavorite}
                            onTogglePin={handleTogglePin}
                            onDelete={handleDeleteItem}
                          />
                        );
                      case 'note':
                      default:
                        return (
                          <NoteCard
                            key={item.id}
                            item={item}
                            onOpen={(it) => setNoteModal({ open: true, item: it })}
                            onToggleFavorite={handleToggleFavorite}
                            onTogglePin={handleTogglePin}
                            onDelete={handleDeleteItem}
                          />
                        );
                    }
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Native Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-3 py-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] lg:hidden flex items-center justify-around shadow-2xl">
        {/* Tab 1: All Items */}
        <button
          type="button"
          onClick={() => {
            setActiveNotebookId(null);
            setActiveFilter('all');
          }}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            activeFilter === 'all' && activeNotebookId === null
              ? 'text-brand-400 font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-medium">All Notes</span>
        </button>

        {/* Tab 2: Notebooks */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            activeNotebookId !== null
              ? 'text-brand-400 font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Folder className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-medium">Notebooks</span>
        </button>

        {/* Tab 3: Center Elevated Add (+) Button */}
        <div className="relative -top-3">
          <button
            type="button"
            onClick={() => {
              if (activeNotebook?.default_template_id) {
                const tpl = templates.find((t) => t.id === activeNotebook.default_template_id);
                if (tpl) {
                  setFormRunnerModal({ open: true, template: tpl });
                  return;
                }
              }
              setMobileFabMenuOpen(!mobileFabMenuOpen);
            }}
            className="h-12 w-12 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/40 active:scale-95 transition transform ring-4 ring-zinc-950"
            aria-label="New Item"
          >
            <Plus
              className={`w-6 h-6 stroke-[2.5] transition-transform duration-200 ${
                mobileFabMenuOpen ? 'rotate-45' : ''
              }`}
            />
          </button>
        </div>

        {/* Tab 4: Form Templates */}
        <button
          type="button"
          onClick={() => {
            setActiveNotebookId(null);
            setActiveFilter('templates');
          }}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            activeFilter === 'templates'
              ? 'text-brand-400 font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ClipboardList className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-medium">Templates</span>
        </button>

        {/* Tab 5: Favorites */}
        <button
          type="button"
          onClick={() => {
            setActiveNotebookId(null);
            setActiveFilter('favorites');
          }}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            activeFilter === 'favorites'
              ? 'text-amber-400 font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Star className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-medium">Favorites</span>
        </button>
      </nav>

      {/* Mobile Quick Add Bottom Sheet Menu */}
      {mobileFabMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden flex flex-col justify-end p-4 animate-in fade-in duration-150"
          onClick={() => setMobileFabMenuOpen(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 shadow-2xl space-y-2 mb-16 animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 flex items-center justify-between">
              <span>Create New</span>
              <button
                type="button"
                onClick={() => setMobileFabMenuOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1"
              >
                ✕
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileFabMenuOpen(false);
                setNoteModal({ open: true, item: null });
              }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 text-left transition active:scale-98"
            >
              <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-100">Markdown Note</div>
                <div className="text-[11px] text-zinc-400">Rich WYSIWYG & markdown notes</div>
              </div>
            </button>

            {templates.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMobileFabMenuOpen(false);
                  const boundTpl = templates.find((t) => t.id === activeNotebook?.default_template_id);
                  setFormRunnerModal({
                    open: true,
                    template: boundTpl || templates[0]
                  });
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 text-left transition active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-100">Fill Form Note</div>
                  <div className="text-[11px] text-zinc-400">Standardized form entries and logs</div>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileFabMenuOpen(false);
                setCounterModal({ open: true, item: null });
              }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 text-left transition active:scale-98"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-100">Interactive Counter</div>
                <div className="text-[11px] text-zinc-400">Track counts, tallies, and habits</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileFabMenuOpen(false);
                setBookmarkModal({ open: true, item: null });
              }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 text-left transition active:scale-98"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Bookmark className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-100">Web Bookmark</div>
                <div className="text-[11px] text-zinc-400">Save links with auto metadata preview</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileFabMenuOpen(false);
                setPosterModal({ open: true, item: null });
              }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 text-left transition active:scale-98"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Images className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-100">Scrapbook Poster</div>
                <div className="text-[11px] text-zinc-400">Curate photos and visual collections</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileFabMenuOpen(false);
                setNotebookModal({ open: true, notebook: null, defaultParentId: activeNotebookId });
              }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 text-left transition active:scale-98"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-100">
                  {activeNotebook ? 'New Sub-Notebook' : 'New Notebook'}
                </div>
                <div className="text-[11px] text-zinc-400">
                  {activeNotebook ? `Nest inside ${activeNotebook.name}` : 'Organize into categories'}
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {noteModal.open && (
        <NoteEditorModal
          existingNote={noteModal.item}
          notebooks={notebooks}
          defaultNotebookId={activeNotebookId}
          onClose={() => setNoteModal({ open: false, item: null })}
          onSaved={handleItemSaved}
        />
      )}

      {notebookModal.open && (
        <NewNotebookModal
          existingNotebook={notebookModal.notebook}
          notebooks={notebooks}
          defaultParentId={notebookModal.defaultParentId}
          templates={templates}
          onClose={() => setNotebookModal({ open: false, notebook: null, defaultParentId: null })}
          onSaved={handleNotebookSaved}
        />
      )}

      {bookmarkModal.open && (
        <NewBookmarkModal
          existingItem={bookmarkModal.item}
          notebooks={notebooks}
          defaultNotebookId={activeNotebookId}
          onClose={() => setBookmarkModal({ open: false, item: null })}
          onSaved={handleItemSaved}
        />
      )}

      {counterModal.open && (
        <NewCounterModal
          existingItem={counterModal.item}
          notebooks={notebooks}
          defaultNotebookId={activeNotebookId}
          onClose={() => setCounterModal({ open: false, item: null })}
          onSaved={handleItemSaved}
        />
      )}

      {posterModal.open && (
        <NewPosterModal
          existingItem={posterModal.item}
          notebooks={notebooks}
          defaultNotebookId={activeNotebookId}
          onClose={() => setPosterModal({ open: false, item: null })}
          onSaved={handleItemSaved}
        />
      )}

      {formRunnerModal.open && formRunnerModal.template && (
        <FormRunnerModal
          template={formRunnerModal.template}
          notebooks={notebooks}
          defaultNotebookId={activeNotebookId}
          existingItem={formRunnerModal.existingItem}
          onClose={() => setFormRunnerModal({ open: false, template: null, existingItem: null })}
          onSaved={handleItemSaved}
        />
      )}

      {templateBuilderModal.open && (
        <TemplateBuilderModal
          existingTemplate={templateBuilderModal.template}
          notebooks={notebooks}
          onClose={() => setTemplateBuilderModal({ open: false, template: null })}
          onSaved={(tpl) => {
            setTemplates((prev) => {
              const idx = prev.findIndex((t) => t.id === tpl.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = tpl;
                return copy;
              }
              return [...prev, tpl];
            });
          }}
        />
      )}

      {markdownViewerModal.open && markdownViewerModal.item && (
        <MarkdownViewerModal
          item={markdownViewerModal.item}
          onClose={() => setMarkdownViewerModal({ open: false, item: null })}
          onEdit={(it) => {
            setMarkdownViewerModal({ open: false, item: null });
            if (it.type === 'form_entry') {
              const tpl = templates.find((t) => t.id === it.metadata?.template_id);
              if (tpl) {
                setFormRunnerModal({ open: true, template: tpl, existingItem: it });
              }
            } else {
              setNoteModal({ open: true, item: it });
            }
          }}
        />
      )}
    </div>
  );
};
