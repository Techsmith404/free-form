import React, { useState } from 'react';
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
  Plus,
  X,
  ChevronsUpDown,
  ChevronLeft
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
  isExpandedAll?: boolean;
  onToggleExpandAll?: () => void;
  onBack?: () => void;
  backLabel?: string;
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
  onOpenMobileSidebar,
  isExpandedAll,
  onToggleExpandAll,
  onBack,
  backLabel
}) => {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 px-4 sm:px-6 py-3 sm:py-3.5 space-y-3">
      {/* Top Row */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Mobile Back Button OR Drawer Trigger + Notebook Header */}
        <div className="flex items-center gap-3 min-w-0">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="lg:hidden h-10 px-3 flex items-center gap-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 active:scale-95 transition shrink-0 text-xs font-bold"
              title={backLabel || 'Go Back'}
            >
              <ChevronLeft className="w-4 h-4 text-brand-400" />
              <span className="truncate max-w-[100px]">{backLabel || 'Back'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              className="lg:hidden h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white active:scale-95 transition shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="truncate">
            <div className="flex items-center gap-2 truncate">
              {activeNotebook ? (
                <>
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: activeNotebook.color || '#22c55e' }}
                  />
                  <h2 className="text-lg sm:text-xl font-black text-white truncate">
                    {activeNotebook.name}
                  </h2>
                  {activeNotebook.default_template_name && (
                    <span className="hidden md:inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/30 font-semibold shrink-0">
                      <Sparkles className="w-3 h-3" />
                      <span>{activeNotebook.default_template_name}</span>
                    </span>
                  )}
                </>
              ) : (
                <h2 className="text-lg sm:text-xl font-black text-white">All Items</h2>
              )}
            </div>
            {activeNotebook?.description && (
              <p className="text-xs text-zinc-400 truncate mt-0.5 hidden sm:block">
                {activeNotebook.description}
              </p>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop Search */}
          <div className="relative hidden md:block w-64 lg:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search notes, fields, tags..."
              className="w-full h-10 pl-10 pr-4 bg-zinc-900 border border-zinc-750 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-brand-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mobile Search Toggle */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className={`md:hidden h-11 w-11 flex items-center justify-center rounded-xl border transition ${
              mobileSearchOpen || searchQuery
                ? 'bg-brand-500/20 text-brand-400 border-brand-500/40'
                : 'bg-zinc-900 text-zinc-300 border-zinc-750 hover:text-white'
            }`}
            aria-label="Toggle Search"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Desktop Quick Add */}
          {activeNotebook && (
            <button
              type="button"
              onClick={onQuickAdd}
              className="hidden sm:flex items-center gap-1.5 h-10 px-4 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition shadow-md shadow-brand-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{activeNotebook.default_template_name ? 'New Entry' : 'Add Note'}</span>
            </button>
          )}

          {/* Expand All / Collapse All Toggle */}
          {onToggleExpandAll && (
            <button
              type="button"
              onClick={onToggleExpandAll}
              className={`h-11 px-3 flex items-center gap-1.5 rounded-xl border text-xs font-bold transition active:scale-95 ${
                isExpandedAll
                  ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-750 hover:text-white'
              }`}
              title={isExpandedAll ? 'Collapse all card details' : 'Expand all card details'}
            >
              <ChevronsUpDown className="w-4 h-4" />
              <span className="hidden sm:inline">{isExpandedAll ? 'Collapse All' : 'Expand All'}</span>
            </button>
          )}

          {/* Grid / List View Toggle */}
          <div className="flex items-center bg-zinc-900 border border-zinc-750 rounded-xl p-1">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`h-9 w-9 flex items-center justify-center rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-zinc-800 text-brand-400 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={`h-9 w-9 flex items-center justify-center rounded-lg transition ${
                viewMode === 'list'
                  ? 'bg-zinc-800 text-brand-400 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search Bar (Expandable or visible when active) */}
      {(mobileSearchOpen || searchQuery) && (
        <div className="md:hidden relative animate-in fade-in slide-in-from-top-1 duration-150">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            autoFocus={mobileSearchOpen}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notes, fields, tags..."
            className="w-full h-11 pl-10 pr-10 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-brand-500 shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Type Filter Chips (Large, Touch-Friendly) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs sm:text-sm font-semibold">
        <button
          type="button"
          onClick={() => onSelectType('all')}
          className={`h-9 px-4 rounded-xl transition shrink-0 flex items-center justify-center active:scale-95 ${
            selectedType === 'all'
              ? 'bg-zinc-100 text-zinc-950 font-bold shadow-md'
              : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800'
          }`}
        >
          All Items
        </button>

        <button
          type="button"
          onClick={() => onSelectType('note')}
          className={`h-9 px-3.5 rounded-xl transition shrink-0 flex items-center gap-1.5 active:scale-95 ${
            selectedType === 'note'
              ? 'bg-zinc-100 text-zinc-950 font-bold shadow-md'
              : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800'
          }`}
        >
          <FileText className="w-4 h-4 text-brand-400" />
          <span>Notes</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectType('form_entry')}
          className={`h-9 px-3.5 rounded-xl transition shrink-0 flex items-center gap-1.5 active:scale-95 ${
            selectedType === 'form_entry'
              ? 'bg-brand-500 text-white font-bold shadow-md shadow-brand-500/25'
              : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800'
          }`}
        >
          <ClipboardList className="w-4 h-4 text-brand-400" />
          <span>Form Notes</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectType('counter')}
          className={`h-9 px-3.5 rounded-xl transition shrink-0 flex items-center gap-1.5 active:scale-95 ${
            selectedType === 'counter'
              ? 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/25'
              : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800'
          }`}
        >
          <Hash className="w-4 h-4 text-emerald-400" />
          <span>Counters</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectType('bookmark')}
          className={`h-9 px-3.5 rounded-xl transition shrink-0 flex items-center gap-1.5 active:scale-95 ${
            selectedType === 'bookmark'
              ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25'
              : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800'
          }`}
        >
          <Bookmark className="w-4 h-4 text-blue-400" />
          <span>Bookmarks</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectType('poster')}
          className={`h-9 px-3.5 rounded-xl transition shrink-0 flex items-center gap-1.5 active:scale-95 ${
            selectedType === 'poster'
              ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-500/25'
              : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800'
          }`}
        >
          <Images className="w-4 h-4 text-purple-400" />
          <span>Scrapbooks</span>
        </button>
      </div>
    </header>
  );
};
