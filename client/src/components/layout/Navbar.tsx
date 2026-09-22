import React from 'react';
import { ItemType, Notebook } from '../../types/index.js';
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Menu,
  FileText,
  Hash,
  Bookmark,
  Images,
  ClipboardList,
  Sparkles,
  Plus
} from 'lucide-react';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedType: ItemType | 'all';
  onSelectType: (type: ItemType | 'all') => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  activeNotebook: Notebook | null;
  onQuickAdd: () => void;
  onOpenMobileSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  selectedType,
  onSelectType,
  viewMode,
  onViewModeChange,
  activeNotebook,
  onQuickAdd,
  onOpenMobileSidebar
}) => {
  return (
    <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 py-3 space-y-3">
      {/* Top Row: Mobile Menu + Active Notebook Header + Search + View Mode */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              {activeNotebook ? (
                <>
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: activeNotebook.color || '#22c55e' }}
                  />
                  <h2 className="text-lg font-bold text-zinc-100">{activeNotebook.name}</h2>
                  {activeNotebook.default_template_name && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-medium">
                      <Sparkles className="w-3 h-3" />
                      <span>Auto-Form: {activeNotebook.default_template_name}</span>
                    </span>
                  )}
                </>
              ) : (
                <h2 className="text-lg font-bold text-zinc-100">All Items</h2>
              )}
            </div>
            {activeNotebook?.description && (
              <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">
                {activeNotebook.description}
              </p>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative w-44 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search notes, tags..."
              className="w-full pl-9 pr-3 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-brand-500 transition"
            />
          </div>

          {/* Quick Notebook Add Button */}
          {activeNotebook && (
            <button
              type="button"
              onClick={onQuickAdd}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/15 hover:bg-brand-500/25 text-brand-400 border border-brand-500/30 rounded-xl text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{activeNotebook.default_template_name ? 'New Entry' : 'Add Note'}</span>
            </button>
          )}

          {/* Grid / List View Toggle */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Type Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
        <button
          type="button"
          onClick={() => onSelectType('all')}
          className={`px-3 py-1 rounded-lg transition shrink-0 font-medium ${
            selectedType === 'all'
              ? 'bg-zinc-800 text-white font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          All Types
        </button>

        <button
          type="button"
          onClick={() => onSelectType('note')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition shrink-0 font-medium ${
            selectedType === 'note'
              ? 'bg-zinc-800 text-brand-400 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Notes</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectType('form_entry')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition shrink-0 font-medium ${
            selectedType === 'form_entry'
              ? 'bg-brand-500/20 text-brand-400 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Form Notes</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectType('counter')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition shrink-0 font-medium ${
            selectedType === 'counter'
              ? 'bg-emerald-500/20 text-emerald-400 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Hash className="w-3.5 h-3.5" />
          <span>Counters</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectType('bookmark')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition shrink-0 font-medium ${
            selectedType === 'bookmark'
              ? 'bg-blue-500/20 text-blue-400 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Bookmarks</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectType('poster')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition shrink-0 font-medium ${
            selectedType === 'poster'
              ? 'bg-purple-500/20 text-purple-400 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Images className="w-3.5 h-3.5" />
          <span>Scrapbooks</span>
        </button>
      </div>
    </header>
  );
};
