import { useEffect, useRef, RefObject } from 'react';

export const KB_FOCUS_CLASS = 'ff-kb-focus';

interface UseKeyboardShortcutsOptions {
  /** Disable all shortcuts (e.g. while any modal/drawer is open). */
  enabled: boolean;
  /** Container whose direct children are the navigable items, in order. */
  containerRef: RefObject<HTMLElement>;
  /** Number of navigable items; focus resets when this changes. */
  itemCount: number;
  onOpenIndex: (index: number) => void;
  onNewNote: () => void;
  onNewCounter: () => void;
  onOpenTimers: () => void;
}

/** True when the keyboard event originates from a text-entry control. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable ||
    el.closest?.('[contenteditable="true"]') != null
  );
}

/**
 * Desktop shortcuts:
 *  j / ArrowDown  next item     k / ArrowUp  previous item
 *  Enter          open focused  Esc          clear focus
 *  n note, c counter, t timers, / focus search
 */
export function useKeyboardShortcuts(opts: UseKeyboardShortcutsOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const indexRef = useRef(-1);

  const applyFocus = (index: number) => {
    const container = optsRef.current.containerRef.current;
    if (!container) return;
    Array.from(container.children).forEach((child, i) => {
      child.classList.toggle(KB_FOCUS_CLASS, i === index);
    });
    const el = container.children[index] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  // Reset when the list changes (filter, sort, search, view mode)
  useEffect(() => {
    indexRef.current = -1;
    applyFocus(-1);
  }, [opts.itemCount, opts.enabled]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const o = optsRef.current;
      if (!o.enabled || e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      const count = o.itemCount;
      const move = (delta: number) => {
        if (count === 0) return;
        const next =
          indexRef.current < 0
            ? delta > 0
              ? 0
              : count - 1
            : Math.min(count - 1, Math.max(0, indexRef.current + delta));
        indexRef.current = next;
        applyFocus(next);
      };

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          move(1);
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          move(-1);
          break;
        case 'Enter':
          if (indexRef.current >= 0 && indexRef.current < count) {
            e.preventDefault();
            o.onOpenIndex(indexRef.current);
          }
          break;
        case 'Escape':
          if (indexRef.current >= 0) {
            indexRef.current = -1;
            applyFocus(-1);
          }
          break;
        case 'n':
          e.preventDefault();
          o.onNewNote();
          break;
        case 'c':
          e.preventDefault();
          o.onNewCounter();
          break;
        case 't':
          e.preventDefault();
          o.onOpenTimers();
          break;
        case '/': {
          const search = document.querySelector<HTMLInputElement>('input[placeholder^="Search notes"]');
          if (search) {
            e.preventDefault();
            search.focus();
            search.select();
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
