import React, { useEffect, useRef } from 'react';
import { FileText, Hash } from 'lucide-react';

export interface SuggestionItem {
  id: string;
  label: string;
  sub?: string;
}

interface SuggestionPopupProps {
  isOpen: boolean;
  type: 'wikilink' | 'tag';
  items: SuggestionItem[];
  selectedIndex: number;
  onSelect: (item: SuggestionItem) => void;
  position: { top: number; left: number } | null;
}

export const SuggestionPopup: React.FC<SuggestionPopupProps> = ({
  isOpen,
  type,
  items,
  selectedIndex,
  onSelect,
  position
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen || !position || items.length === 0) return null;

  return (
    <div
      style={{
        top: `${position.top}px`,
        left: `${Math.max(12, Math.min(position.left, window.innerWidth - 300))}px`
      }}
      className="fixed z-[100] w-72 max-w-[calc(100vw-24px)] max-h-60 overflow-y-auto bg-zinc-900 border border-zinc-700/90 rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between border-b border-zinc-800 mb-1">
        <span>{type === 'wikilink' ? 'Link Note' : 'Insert Tag'}</span>
        <span className="text-[10px] text-zinc-500 font-normal">↑↓ to navigate, Enter to select</span>
      </div>

      <div ref={listRef} className="flex flex-col gap-0.5 overflow-y-auto">
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => {
                // Prevent blurring the active input/editor
                e.preventDefault();
                onSelect(item);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors touch-manipulation ${
                isSelected
                  ? 'bg-brand-500/20 text-brand-300 font-medium'
                  : 'text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {type === 'wikilink' ? (
                  <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-brand-400' : 'text-zinc-400'}`} />
                ) : (
                  <Hash className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-brand-400' : 'text-zinc-400'}`} />
                )}
                <span className="truncate">{item.label}</span>
              </div>
              {item.sub && (
                <span className="text-[10px] text-zinc-400 shrink-0 ml-2 truncate max-w-[90px]">
                  {item.sub}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
