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

import { Plus, FileText, Hash, Bookmark, Images, ClipboardList, Sparkles } from 'lucide-react';

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileFabMenuOpen, setMobileFabMenuOpen] = useState(false);

  // Modal States
  const [noteModal, setNoteModal] = useState<{ open: boolean; item?: Item | null }>({ open: false });
  const [notebookModal, setNotebookModal] = useState<{ open: boolean; notebook?: Notebook | null }>({ open: false });
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
  }, [items, activeNotebookId, activeFilter, selectedType, searchQuery]);

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
        onNewNotebook={() => setNotebookModal({ open: true, notebook: null })}
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

      {/* Mobile Floating Action Button (FAB) */}
      <div className="fixed bottom-6 right-5 z-40 lg:hidden flex flex-col items-end gap-2.5">
        {mobileFabMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setMobileFabMenuOpen(false)}
          />
        )}

        {mobileFabMenuOpen && (
          <div className="relative z-40 flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <button
              type="button"
              onClick={() => {
                setMobileFabMenuOpen(false);
                setNoteModal({ open: true, item: null });
              }}
              className="flex items-center gap-2.5 h-12 px-4 rounded-full bg-zinc-900 border border-zinc-700 text-white font-bold text-xs shadow-2xl active:scale-95 transition"
            >
              <span>Markdown Note</span>
              <FileText className="w-4 h-4 text-brand-400" />
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
                className="flex items-center gap-2.5 h-12 px-4 rounded-full bg-brand-500 text-white font-bold text-xs shadow-2xl shadow-brand-500/30 active:scale-95 transition"
              >
                <span>Fill Form Note</span>
                <ClipboardList className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileFabMenuOpen(false);
                setCounterModal({ open: true, item: null });
              }}
              className="flex items-center gap-2.5 h-12 px-4 rounded-full bg-zinc-900 border border-zinc-700 text-white font-bold text-xs shadow-2xl active:scale-95 transition"
            >
              <span>Counter</span>
              <Hash className="w-4 h-4 text-emerald-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileFabMenuOpen(false);
                setBookmarkModal({ open: true, item: null });
              }}
              className="flex items-center gap-2.5 h-12 px-4 rounded-full bg-zinc-900 border border-zinc-700 text-white font-bold text-xs shadow-2xl active:scale-95 transition"
            >
              <span>Bookmark</span>
              <Bookmark className="w-4 h-4 text-blue-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileFabMenuOpen(false);
                setPosterModal({ open: true, item: null });
              }}
              className="flex items-center gap-2.5 h-12 px-4 rounded-full bg-zinc-900 border border-zinc-700 text-white font-bold text-xs shadow-2xl active:scale-95 transition"
            >
              <span>Scrapbook</span>
              <Images className="w-4 h-4 text-purple-400" />
            </button>
          </div>
        )}

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
          className="relative z-40 h-14 w-14 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center shadow-2xl shadow-brand-500/40 active:scale-90 transition transform"
          aria-label="New Item"
        >
          <Plus className={`w-7 h-7 stroke-[3] transition-transform duration-200 ${mobileFabMenuOpen ? 'rotate-45' : ''}`} />
        </button>
      </div>

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
          templates={templates}
          onClose={() => setNotebookModal({ open: false, notebook: null })}
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
