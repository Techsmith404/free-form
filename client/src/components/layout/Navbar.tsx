import React, { useState, useEffect, useRef } from 'react';
import { ItemType, Notebook, SortOption, ViewMode, DensityMode } from '../../types/index.js';
import { useRealtime } from '../../context/RealtimeContext.js';
import { hapticTap, hapticMedium } from '../../services/native.js';
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Kanban,
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
  ChevronLeft,
  Clock,
  Bell,
  Settings as SettingsIcon,
  Wifi,
  WifiOff,
  GitMerge,
  AlertTriangle,
  ArrowDownUp,
  Calendar,
  ArrowDownAZ,
  Zap,
  Check,
  Minimize2,
  Maximize2
} from 'lucide-react';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedType: ItemType | 'all';
  onSelectType: (type: ItemType | 'all') => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  density?: DensityMode;
  onDensityChange?: (density: DensityMode) => void;
  activeNotebook: Notebook | null;
  onQuickAdd: () => void;
  onOpenMobileSidebar: () => void;
  isExpandedAll?: boolean;
  onToggleExpandAll?: () => void;
  onBack?: () => void;
  backLabel?: string;
  onOpenSettings?: () => void;
  sortOption?: SortOption;
  onSortOptionChange?: (option: SortOption) => void;
  onOpenCommandPalette?: () => void;
  selectedTag?: string | null;
  onSelectTag?: (tag: string | null) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  selectedType,
  onSelectType,
  viewMode,
  onViewModeChange,
  density = 'cozy',
  onDensityChange,
  activeNotebook,
  onQuickAdd,
  onOpenMobileSidebar,
  isExpandedAll,
  onToggleExpandAll,
  onBack,
  backLabel,
  onOpenSettings,
  sortOption = 'updated',
  onSortOptionChange,
  onOpenCommandPalette,
  selectedTag,
  onSelectTag
}) => {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
    }
    if (sortMenuOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [sortMenuOpen]);
  const {
    timers,
    reminders,
    conflicts,
    setTimersModalOpen,
    setConflictModalOpen,
    isConnected,
    isConnecting,
    reconnectAttempt,
    manualReconnect
  } = useRealtime();

  const ringingTimer = timers.find((t) => t.status === 'ringing');
  const runningTimer = timers.find((t) => t.status === 'running');
  const triggeredReminder = reminders.find((r) => r.status === 'triggered');

  // Live ticker so the countdown in the top bar updates smoothly every second without opening modal
  const [, setNavTick] = useState(0);
  useEffect(() => {
    if (!runningTimer) return;
    const interval = setInterval(() => {
      setNavTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [runningTimer]);

  const formatCountdown = (t: typeof runningTimer) => {
    if (!t) return '';
    let rem = t.remaining_seconds;
    if (t.target_end_time) {
      rem = Math.max(0, Math.round((new Date(t.target_end_time).getTime() - Date.now()) / 1000));
    }
    const mins = Math.floor(rem / 60);
    const secs = rem % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const typeFilters: { label: string; value: ItemType | 'all'; icon?: React.ReactNode; activeClass: string }[] = [
    {
      label: 'All',
      value: 'all',
      activeClass: 'bg-zinc-100 text-zinc-950 font-bold shadow-md'
    },
    {
      label: 'Notes',
      value: 'note',
      icon: <FileText className="w-4 h-4 text-brand-400" />,
      activeClass: 'bg-zinc-100 text-zinc-950 font-bold shadow-md'
    },
    {
      label: 'Forms',
      value: 'form_entry',
      icon: <ClipboardList className="w-4 h-4 text-brand-400" />,
      activeClass: 'bg-brand-500 text-white font-bold shadow-md shadow-brand-500/25'
    },
    {
      label: 'Counters',
      value: 'counter',
      icon: <Hash className="w-4 h-4 text-emerald-400" />,
      activeClass: 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/25'
    },
    {
      label: 'Bookmarks',
      value: 'bookmark',
      icon: <Bookmark className="w-4 h-4 text-blue-400" />,
      activeClass: 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25'
    },
    {
      label: 'Scrapbooks',
      value: 'poster',
      icon: <Images className="w-4 h-4 text-purple-400" />,
      activeClass: 'bg-purple-600 text-white font-bold shadow-md shadow-purple-500/25'
    }
  ];

  const sortOptionsList: { label: string; shortLabel: string; value: SortOption; icon: React.ReactNode; desc: string }[] = [
    {
      label: 'Recently Updated',
      shortLabel: 'Updated',
      value: 'updated',
      icon: <Clock className="w-4 h-4 text-brand-400 shrink-0" />,
      desc: 'Latest edits first'
    },
    {
      label: 'Recently Created',
      shortLabel: 'Created',
      value: 'created',
      icon: <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />,
      desc: 'Newest items first'
    },
    {
      label: 'Title (A → Z)',
      shortLabel: 'A → Z',
      value: 'title',
      icon: <ArrowDownAZ className="w-4 h-4 text-sky-400 shrink-0" />,
      desc: 'Alphabetical order'
    },
    {
      label: 'Priority (Urgent → Low)',
      shortLabel: 'Priority',
      value: 'priority',
      icon: <Zap className="w-4 h-4 text-amber-400 shrink-0" />,
      desc: 'Highest priority first'
    }
  ];

  const currentSortObj = sortOptionsList.find((s) => s.value === sortOption) || sortOptionsList[0];

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 px-3 sm:px-6 pt-[max(env(safe-area-inset-top),0.625rem)] pb-2.5 sm:pb-3.5 space-y-2.5">
      {/* Top Row */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: Mobile Back Button OR Drawer Trigger + Notebook Header */}
        <div className="flex items-center gap-2 min-w-0">
          {onBack ? (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onBack();
              }}
              className="lg:hidden h-11 px-3.5 flex items-center gap-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 active:scale-95 transition shrink-0 text-sm font-bold touch-manipulation"
              title={backLabel || 'Go Back'}
            >
              <ChevronLeft className="w-4 h-4 text-brand-400 shrink-0" />
              <span className="truncate max-w-[90px]">{backLabel || 'Back'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onOpenMobileSidebar();
              }}
              className="lg:hidden h-11 w-11 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white active:scale-95 transition shrink-0 touch-manipulation"
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
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: activeNotebook.color || '#22c55e' }}
                  />
                  <h2 className="text-base sm:text-xl font-black text-white truncate leading-tight">
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
                <h2 className="text-base sm:text-xl font-black text-white">All Items</h2>
              )}
              {selectedTag && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/30 font-semibold shrink-0">
                  <Hash className="w-3 h-3 text-brand-400" />
                  <span>#{selectedTag}</span>
                </span>
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
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Desktop Search & Command Palette */}
          <div className="relative hidden md:flex items-center w-56 lg:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search notes, fields, tags..."
              className="w-full h-10 pl-10 pr-12 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-brand-500 transition"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            ) : onOpenCommandPalette ? (
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  onOpenCommandPalette();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/70 rounded-md transition touch-manipulation"
                title="Command Palette (Cmd+K / Ctrl+K)"
              >
                <span>⌘K</span>
              </button>
            ) : null}
          </div>

          {/* Mobile Command Palette Trigger */}
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onOpenCommandPalette();
              }}
              className="md:hidden h-11 w-11 flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white transition touch-manipulation active:scale-95"
              title="Command Palette (Cmd+K)"
              aria-label="Command Palette"
            >
              <Zap className="w-5 h-5 text-brand-400" />
            </button>
          )}

          {/* Mobile Search Toggle */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className={`md:hidden h-11 w-11 flex items-center justify-center rounded-xl border transition touch-manipulation ${
              mobileSearchOpen || searchQuery
                ? 'bg-brand-500/20 text-brand-400 border-brand-500/40'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white'
            }`}
            aria-label="Toggle Search"
          >
            {mobileSearchOpen && !searchQuery ? (
              <X className="w-5 h-5" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>

          {/* Desktop Quick Add */}
          {activeNotebook && (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onQuickAdd();
              }}
              className="hidden sm:flex items-center gap-1.5 h-10 px-4 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition shadow-md shadow-brand-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{activeNotebook.default_template_name ? 'New Entry' : 'Add Note'}</span>
            </button>
          )}

          {/* Universal Synced Timer / Reminders Trigger */}
          {ringingTimer || triggeredReminder ? (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setTimersModalOpen(true);
              }}
              className="h-10 px-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 animate-pulse shadow-lg shadow-red-500/30 transition active:scale-95 touch-manipulation"
              title="Alarm Ringing! Tap to view/stop"
            >
              <Bell className="w-4 h-4 animate-bounce" />
              <span>ALARM</span>
            </button>
          ) : runningTimer ? (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setTimersModalOpen(true);
              }}
              className="h-10 px-3 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 touch-manipulation"
              title={`Active Timer: ${runningTimer.title}`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <Clock className="w-4 h-4" />
              <span>{formatCountdown(runningTimer)}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setTimersModalOpen(true);
              }}
              className="h-10 px-2.5 sm:px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 touch-manipulation"
              title="Universal Synced Timers & Reminders"
            >
              <Clock className="w-4 h-4 text-brand-400" />
              <span className="hidden md:inline">Timers</span>
            </button>
          )}

          {/* Prominent Realtime Connection Status */}
          {isConnected ? (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                manualReconnect();
              }}
              title="Server Connected (Realtime WebSocket Active). Click to re-sync."
              className="h-10 px-2.5 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 touch-manipulation"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              <span className="hidden lg:inline">Connected</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                manualReconnect();
              }}
              title={
                isConnecting
                  ? `Attempting to reconnect (attempt ${reconnectAttempt})... Click to retry immediately.`
                  : 'Disconnected from server. Click to retry now.'
              }
              className="h-10 px-2.5 sm:px-3 bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 text-red-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 touch-manipulation animate-pulse"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>{isConnecting ? 'Connecting...' : 'Offline (Retry)'}</span>
            </button>
          )}

          {/* Expand All / Collapse All Toggle */}
          {onToggleExpandAll && (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onToggleExpandAll();
              }}
              className={`h-11 px-2.5 sm:px-3 flex items-center gap-1.5 rounded-xl border text-xs font-bold transition active:scale-95 touch-manipulation ${
                isExpandedAll
                  ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white'
              }`}
              title={isExpandedAll ? 'Collapse all card details' : 'Expand all card details'}
            >
              <ChevronsUpDown className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{isExpandedAll ? 'Collapse All' : 'Expand All'}</span>
            </button>
          )}

          {/* Sort Dropdown Menu */}
          {onSortOptionChange && (
            <div className="relative" ref={sortMenuRef}>
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setSortMenuOpen(!sortMenuOpen);
                }}
                className={`h-11 px-2.5 sm:px-3 flex items-center gap-1.5 rounded-xl border text-xs font-bold transition active:scale-95 touch-manipulation ${
                  sortOption !== 'updated'
                    ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white'
                }`}
                title={`Sort Items: ${currentSortObj.label}`}
                aria-label={`Sort Items (current: ${currentSortObj.label})`}
                aria-expanded={sortMenuOpen}
              >
                <ArrowDownUp className="w-4 h-4 shrink-0 text-brand-400" />
                <span className="hidden xl:inline">{currentSortObj.shortLabel}</span>
              </button>

              {sortMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-zinc-800/60">
                  <div className="px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Sort Order
                  </div>
                  <div className="py-1">
                    {sortOptionsList.map((opt) => {
                      const isSelected = opt.value === sortOption;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            hapticTap();
                            onSortOptionChange(opt.value);
                            setSortMenuOpen(false);
                          }}
                          className={`w-full min-h-[44px] px-3.5 py-2 flex items-center justify-between text-left transition hover:bg-zinc-800/80 active:bg-zinc-800 touch-manipulation ${
                            isSelected ? 'bg-brand-500/10 text-white font-semibold' : 'text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {opt.icon}
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">{opt.label}</div>
                              <div className="text-[10px] text-zinc-400 truncate">{opt.desc}</div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-brand-400 shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grid / List / Board View Toggle */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onViewModeChange('grid');
              }}
              className={`h-9 w-9 flex items-center justify-center rounded-lg transition touch-manipulation ${
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
              onClick={() => {
                hapticTap();
                onViewModeChange('list');
              }}
              className={`h-9 w-9 flex items-center justify-center rounded-lg transition touch-manipulation ${
                viewMode === 'list'
                  ? 'bg-zinc-800 text-brand-400 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onViewModeChange('board');
              }}
              className={`h-9 w-9 flex items-center justify-center rounded-lg transition touch-manipulation ${
                viewMode === 'board'
                  ? 'bg-zinc-800 text-brand-400 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Kanban Board View"
            >
              <Kanban className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Density Cycle Button (44px target) */}
          {onDensityChange && (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                const next: DensityMode =
                  density === 'cozy' ? 'compact' : density === 'compact' ? 'comfortable' : 'cozy';
                onDensityChange(next);
              }}
              className="h-11 w-11 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition touch-manipulation"
              title={`Card Density: ${density.charAt(0).toUpperCase() + density.slice(1)} (Click to switch)`}
              aria-label={`Cycle layout density, currently ${density}`}
            >
              {density === 'compact' ? (
                <Minimize2 className="w-4 h-4 text-brand-400" />
              ) : density === 'comfortable' ? (
                <LayoutGrid className="w-4 h-4 text-brand-400" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Settings Trigger */}
          {onOpenSettings && (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onOpenSettings();
              }}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition active:scale-95 touch-manipulation"
              title="Settings & Preferences"
              aria-label="Settings & Preferences"
            >
              <SettingsIcon className="w-4 h-4 text-zinc-400 hover:text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Search Bar (Expandable) */}
      {(mobileSearchOpen || searchQuery) && (
        <div className="md:hidden relative animate-in fade-in slide-in-from-top-1 duration-150">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            autoFocus={mobileSearchOpen}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notes, fields, tags..."
            className="w-full h-12 pl-10 pr-10 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-brand-500 shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { onSearchChange(''); setMobileSearchOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Conflicts Attention Banner */}
      {conflicts.length > 0 && (
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="truncate">
              <strong>{conflicts.length} Sync Conflict{conflicts.length > 1 ? 's' : ''}:</strong> Offline edits detected on multiple devices.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              hapticTap();
              setConflictModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-black text-xs font-bold rounded-lg hover:bg-amber-400 transition-colors shrink-0 shadow-sm"
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>Resolve</span>
          </button>
        </div>
      )}

      {/* Type Filter Chips & Active Tag — touch-friendly scrollable row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar -mx-1 px-1">
        {selectedTag && (
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onSelectTag?.(null);
            }}
            className="h-10 sm:h-9 px-3 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/40 font-semibold text-sm flex items-center gap-1.5 shrink-0 active:scale-95 transition shadow-sm touch-manipulation group"
            title="Active tag filter. Tap to clear."
          >
            <Hash className="w-4 h-4 text-brand-400 shrink-0" />
            <span>#{selectedTag}</span>
            <X className="w-3.5 h-3.5 ml-0.5 text-brand-400/80 group-hover:text-white" />
          </button>
        )}
        {typeFilters.map((filter) => {
          const isActive = selectedType === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => {
                hapticTap();
                onSelectType(filter.value);
              }}
              className={`h-10 sm:h-9 px-3.5 rounded-xl transition shrink-0 flex items-center gap-1.5 active:scale-95 font-semibold text-sm touch-manipulation ${
                isActive
                  ? filter.activeClass
                  : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              {filter.icon}
              <span>{filter.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
