import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Link from '@tiptap/extension-link';
import TurndownService from 'turndown';
import { Marked } from 'marked';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  Table as TableIcon,
  ImageIcon,
  CodeXml,
  Eye,
  Undo,
  Redo,
  Upload
} from 'lucide-react';
import { uploadFile } from '../../api/index.js';
import { wikilinkMarkedExtension, wikilinkFromEvent } from '../../utils/wikilinks.js';
import { SuggestionPopup, SuggestionItem } from './SuggestionPopup.js';

export function markdownToTipTapHtml(markdown: string): string {
  if (!markdown) return '';
  const markedInstance = new Marked(
    {
      gfm: true,
      breaks: false,
      renderer: {
        list(token) {
        const isTaskList = token.items && token.items.some((i: any) => i.task);
        let body = '';
        for (let j = 0; j < token.items.length; j++) {
          body += this.listitem(token.items[j]);
        }
        if (isTaskList) {
          return `<ul data-type="taskList">\n${body}</ul>\n`;
        }
        const type = token.ordered ? 'ol' : 'ul';
        const startAttr = token.ordered && token.start !== 1 ? ` start="${token.start}"` : '';
        return `<${type}${startAttr}>\n${body}</${type}>\n`;
      },
      listitem(item: any) {
        if (item.task) {
          const isChecked = Boolean(item.checked);
          const body = this.parser.parse(item.tokens, Boolean(item.loose));
          return `<li data-type="taskItem" data-checked="${isChecked}">${body}</li>\n`;
        }
        const body = this.parser.parse(item.tokens, Boolean(item.loose));
        return `<li>${body}</li>\n`;
      }
    }
  },
  { extensions: [wikilinkMarkedExtension] }
  );
  return markedInstance.parse(markdown) as string;
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// Preserve [[wikilinks]] without backslash escaping
const origEscape = turndownService.escape;
turndownService.escape = function (string: string) {
  return origEscape(string).replace(/\\\[\\\[(.*?)\\\]\\\]/g, '[[$1]]');
};

// Configure custom turndown rule for wikilink anchor tags
turndownService.addRule('wikilinks', {
  filter: (node) => {
    return node.nodeName === 'A' && (node.hasAttribute('data-wikilink') || node.classList.contains('wikilink'));
  },
  replacement: (content, node) => {
    const target = (node as HTMLElement).getAttribute('data-wikilink') || content;
    return content && content !== target ? `[[${target}|${content}]]` : `[[${target}]]`;
  }
});

// Configure custom turndown rule for task items
turndownService.addRule('taskListItems', {
  filter: (node) => {
    return node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem';
  },
  replacement: (content, node) => {
    const isChecked = (node as HTMLElement).getAttribute('data-checked') === 'true';
    const prefix = `- [${isChecked ? 'x' : ' '}] `;
    let cleanContent = content.trim();
    cleanContent = cleanContent.replace(/\n+$/, '');
    cleanContent = cleanContent.replace(/\n/gm, '\n    ');
    return prefix + cleanContent + (node.nextSibling ? '\n' : '');
  }
});

interface TipTapEditorProps {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  editable?: boolean;
  availableNotes?: Array<{ id: string; title: string; notebook_name?: string }>;
  availableTags?: string[];
  onAddTag?: (tag: string) => void;
  onNavigateWikilink?: (title: string) => void;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  initialMarkdown,
  onChange,
  placeholder = 'Write freely in markdown or WYSIWYG...',
  editable = true,
  availableNotes = [],
  availableTags = [],
  onAddTag,
  onNavigateWikilink
}) => {
  const [viewMode, setViewMode] = useState<'wysiwyg' | 'markdown'>('wysiwyg');
  const [rawMarkdown, setRawMarkdown] = useState<string>(initialMarkdown || '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Suggestion Autocomplete state
  const [suggestion, setSuggestion] = useState<{
    isOpen: boolean;
    type: 'wikilink' | 'tag';
    query: string;
    selectedIndex: number;
    position: { top: number; left: number } | null;
    replaceRange?: { from: number; to: number };
    textareaRange?: { start: number; end: number };
  }>({
    isOpen: false,
    type: 'wikilink',
    query: '',
    selectedIndex: 0,
    position: null
  });

  const filteredSuggestions: SuggestionItem[] = React.useMemo(() => {
    if (!suggestion.isOpen) return [];
    const q = suggestion.query.toLowerCase().trim();
    if (suggestion.type === 'wikilink') {
      return availableNotes
        .filter((n) => n.title.toLowerCase().includes(q))
        .slice(0, 8)
        .map((n) => ({ id: n.id, label: n.title, sub: n.notebook_name }));
    } else {
      return availableTags
        .filter((t) => t.toLowerCase().includes(q))
        .slice(0, 8)
        .map((t) => ({ id: t, label: `#${t}` }));
    }
  }, [suggestion.isOpen, suggestion.type, suggestion.query, availableNotes, availableTags]);

  const suggestionRef = React.useRef(suggestion);
  suggestionRef.current = suggestion;
  const filteredSuggestionsRef = React.useRef(filteredSuggestions);
  filteredSuggestionsRef.current = filteredSuggestions;

  const handleSelectSuggestion = (item: SuggestionItem) => {
    const currSug = suggestionRef.current;
    if (viewMode === 'wysiwyg' && editor && currSug.replaceRange) {
      if (currSug.type === 'wikilink') {
        editor
          .chain()
          .focus()
          .deleteRange(currSug.replaceRange)
          .insertContent(`[[${item.label}]] `)
          .run();
      } else {
        const cleanTag = item.label.replace(/^#/, '');
        editor
          .chain()
          .focus()
          .deleteRange(currSug.replaceRange)
          .insertContent(`#${cleanTag} `)
          .run();
        onAddTag?.(cleanTag);
      }
    } else if (viewMode === 'markdown' && textareaRef.current && currSug.textareaRange) {
      const ta = textareaRef.current;
      const { start, end } = currSug.textareaRange;
      const val = ta.value;
      let replacement = '';
      if (currSug.type === 'wikilink') {
        replacement = `[[${item.label}]] `;
      } else {
        const cleanTag = item.label.replace(/^#/, '');
        replacement = `#${cleanTag} `;
        onAddTag?.(cleanTag);
      }
      const next = val.slice(0, start) + replacement + val.slice(end);
      setRawMarkdown(next);
      onChange(next);
      const newPos = start + replacement.length;
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(newPos, newPos);
      });
    }
    setSuggestion((prev) => ({ ...prev, isOpen: false }));
  };

  const checkWysiwygSuggestion = (currentEditor: any) => {
    if (!currentEditor) return;
    try {
      const { state, view } = currentEditor;
      const { from } = state.selection;
      const $from = state.selection.$from;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');

      const matchWikilink = /\[\[([^\]\n]*)$/.exec(textBefore);
      const matchTag = /(?:^|\s)#([a-zA-Z0-9_\-\/]*)$/.exec(textBefore);

      if (matchWikilink) {
        const coords = view.coordsAtPos(from);
        setSuggestion({
          isOpen: true,
          type: 'wikilink',
          query: matchWikilink[1],
          selectedIndex: 0,
          position: { top: coords.bottom + 4, left: coords.left },
          replaceRange: { from: from - matchWikilink[0].length, to: from }
        });
      } else if (matchTag) {
        const coords = view.coordsAtPos(from);
        const tagMatchLength = matchTag[1].length + 1;
        setSuggestion({
          isOpen: true,
          type: 'tag',
          query: matchTag[1],
          selectedIndex: 0,
          position: { top: coords.bottom + 4, left: coords.left },
          replaceRange: { from: from - tagMatchLength, to: from }
        });
      } else {
        setSuggestion((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      }
    } catch {
      setSuggestion((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
    }
  };

  const checkTextareaSuggestion = (ta: HTMLTextAreaElement) => {
    try {
      const { selectionStart, value } = ta;
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const lineBefore = value.slice(lineStart, selectionStart);

      const matchWikilink = /\[\[([^\]\n]*)$/.exec(lineBefore);
      const matchTag = /(?:^|\s)#([a-zA-Z0-9_\-\/]*)$/.exec(lineBefore);

      if (matchWikilink || matchTag) {
        const rect = ta.getBoundingClientRect();
        const type = matchWikilink ? 'wikilink' : 'tag';
        const query = matchWikilink ? matchWikilink[1] : matchTag![1];
        const matchLen = matchWikilink ? matchWikilink[0].length : matchTag![1].length + 1;

        setSuggestion({
          isOpen: true,
          type,
          query,
          selectedIndex: 0,
          position: { top: rect.top + 60, left: rect.left + 24 },
          textareaRange: { start: selectionStart - matchLen, end: selectionStart }
        });
      } else {
        setSuggestion((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      }
    } catch {
      setSuggestion((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
    }
  };

  const editorRef = useRef<any>(null);

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Placeholder.configure({
        placeholder
      }),
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Image.configure({
        inline: false,
        allowBase64: true
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: false
      })
    ],
    content: markdownToTipTapHtml(initialMarkdown || ''),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = turndownService.turndown(html);
      setRawMarkdown(markdown);
      onChange(markdown);
      checkWysiwygSuggestion(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      checkWysiwygSuggestion(editor);
    },
    editorProps: {
      handleKeyDown: (view, event) => {
        const sug = suggestionRef.current;
        const list = filteredSuggestionsRef.current;
        if (sug.isOpen && list.length > 0) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSuggestion((prev) => ({
              ...prev,
              selectedIndex: (prev.selectedIndex + 1) % list.length
            }));
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSuggestion((prev) => ({
              ...prev,
              selectedIndex: (prev.selectedIndex - 1 + list.length) % list.length
            }));
            return true;
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            const item = list[sug.selectedIndex];
            if (item) handleSelectSuggestion(item);
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setSuggestion((prev) => ({ ...prev, isOpen: false }));
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items || []);
        const itemFiles = items
          .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
          .map((item) => item.getAsFile())
          .filter((f): f is File => Boolean(f));
        const clipboardFiles = Array.from(event.clipboardData?.files || []).filter((f) =>
          f.type.startsWith('image/')
        );
        const imageFiles = clipboardFiles.length > 0 ? clipboardFiles : itemFiles;
        if (imageFiles.length === 0) return false;

        event.preventDefault();
        (async () => {
          try {
            setIsUploading(true);
            setUploadError(null);
            for (const file of imageFiles) {
              const uploaded = await uploadFile(file);
              if (editorRef.current) {
                editorRef.current.chain().focus().setImage({ src: uploaded.url, alt: uploaded.name }).run();
              } else {
                const node = view.state.schema.nodes.image?.create({ src: uploaded.url, alt: uploaded.name });
                if (node) {
                  view.dispatch(view.state.tr.replaceSelectionWith(node));
                }
              }
            }
          } catch (err) {
            console.error('Failed to upload image', err);
            setUploadError(err instanceof Error ? err.message : 'Failed to upload image. Please try again.');
          } finally {
            setIsUploading(false);
          }
        })();
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files || []).filter((f) =>
          f.type.startsWith('image/')
        );
        if (files.length === 0) return false;

        event.preventDefault();
        const coords = { left: event.clientX, top: event.clientY };
        const dropPos = view.posAtCoords(coords)?.pos;

        (async () => {
          try {
            setIsUploading(true);
            setUploadError(null);
            for (const file of files) {
              const uploaded = await uploadFile(file);
              if (editorRef.current) {
                const chain = editorRef.current.chain().focus();
                if (typeof dropPos === 'number') {
                  chain.setTextSelection(dropPos);
                }
                chain.setImage({ src: uploaded.url, alt: uploaded.name }).run();
              } else {
                const node = view.state.schema.nodes.image?.create({ src: uploaded.url, alt: uploaded.name });
                if (node) {
                  const tr =
                    typeof dropPos === 'number'
                      ? view.state.tr.insert(dropPos, node)
                      : view.state.tr.replaceSelectionWith(node);
                  view.dispatch(tr);
                }
              }
            }
          } catch (err) {
            console.error('Failed to upload image', err);
            setUploadError(err instanceof Error ? err.message : 'Failed to upload image. Please try again.');
          } finally {
            setIsUploading(false);
          }
        })();
        return true;
      }
    }
  });

  editorRef.current = editor;

  // Sync when initialMarkdown changes externally
  useEffect(() => {
    if (editor && initialMarkdown !== rawMarkdown) {
      setRawMarkdown(initialMarkdown);
      const parsedHtml = markdownToTipTapHtml(initialMarkdown || '');
      if (editor.getHTML() !== parsedHtml) {
        editor.commands.setContent(parsedHtml);
      }
    }
  }, [initialMarkdown, editor, rawMarkdown]);

  // Prevent memory leaks
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  // Handle switching between WYSIWYG and Markdown mode
  const handleToggleMode = (mode: 'wysiwyg' | 'markdown') => {
    if (mode === viewMode) return;
    setSuggestion((prev) => ({ ...prev, isOpen: false }));
    if (mode === 'wysiwyg' && editor) {
      // Sync raw markdown to TipTap HTML
      const html = markdownToTipTapHtml(rawMarkdown || '');
      editor.commands.setContent(html);
    } else if (mode === 'markdown' && editor) {
      // Sync TipTap to raw markdown
      const html = editor.getHTML();
      const markdown = turndownService.turndown(html);
      setRawMarkdown(markdown);
    }
    setViewMode(mode);
  };

  const handleRawMarkdownChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextMd = e.target.value;
    setRawMarkdown(nextMd);
    onChange(nextMd);
    checkTextareaSuggestion(e.target);
  };

  // Tab / Shift+Tab indent & unindent (two spaces) for selected lines in raw markdown mode
  const handleRawMarkdownKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const sug = suggestionRef.current;
    const list = filteredSuggestionsRef.current;
    if (sug.isOpen && list.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestion((prev) => ({
          ...prev,
          selectedIndex: (prev.selectedIndex + 1) % list.length
        }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestion((prev) => ({
          ...prev,
          selectedIndex: (prev.selectedIndex - 1 + list.length) % list.length
        }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const item = list[sug.selectedIndex];
        if (item) handleSelectSuggestion(item);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSuggestion((prev) => ({ ...prev, isOpen: false }));
        return;
      }
    }
    if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    const ta = e.currentTarget;
    const { selectionStart, selectionEnd, value } = ta;
    const INDENT = '  ';

    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const lines = value.slice(lineStart, selectionEnd).split('\n');

    let next: string;
    let newStart = selectionStart;
    let newEnd = selectionEnd;

    if (e.shiftKey) {
      let firstRemoved = 0;
      let totalRemoved = 0;
      const out = lines.map((line, i) => {
        const m = line.match(/^( {1,2}|\t)/);
        const removed = m ? m[0].length : 0;
        if (i === 0) firstRemoved = removed;
        totalRemoved += removed;
        return line.slice(removed);
      });
      next = value.slice(0, lineStart) + out.join('\n') + value.slice(selectionEnd);
      newStart = Math.max(lineStart, selectionStart - firstRemoved);
      newEnd = Math.max(newStart, selectionEnd - totalRemoved);
    } else if (selectionStart === selectionEnd) {
      // Caret only: insert indent at the caret
      next = value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd);
      newStart = newEnd = selectionStart + INDENT.length;
    } else {
      const out = lines.map((line) => INDENT + line);
      next = value.slice(0, lineStart) + out.join('\n') + value.slice(selectionEnd);
      newStart = selectionStart + INDENT.length;
      newEnd = selectionEnd + INDENT.length * lines.length;
    }

    setRawMarkdown(next);
    onChange(next);
    requestAnimationFrame(() => ta.setSelectionRange(newStart, newEnd));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    try {
      setIsUploading(true);
      setUploadError(null);
      const uploaded = await uploadFile(file);
      editor.chain().focus().setImage({ src: uploaded.url, alt: uploaded.name }).run();
    } catch (err) {
      console.error('Failed to upload image', err);
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full lg:border border-zinc-800 lg:rounded-xl bg-zinc-900/30 lg:bg-zinc-900/60 overflow-hidden lg:shadow-xl min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-1 px-2 py-1.5 bg-zinc-900 border-b border-zinc-800 text-zinc-300 select-none shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-0.5 shrink-0">
          {viewMode === 'wysiwyg' && editor && (
            <>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 transition touch-manipulation shrink-0 ${editor.isActive('bold') ? 'bg-zinc-800 text-brand-400 font-bold' : ''}`}
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 transition touch-manipulation shrink-0 ${editor.isActive('italic') ? 'bg-zinc-800 text-brand-400 italic' : ''}`}
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-4 bg-zinc-700 mx-1 shrink-0" />

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-1.5 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 transition touch-manipulation shrink-0 ${editor.isActive('heading', { level: 1 }) ? 'bg-zinc-800 text-brand-400' : ''}`}
                title="Heading 1"
              >
                <Heading1 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-1.5 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 transition touch-manipulation shrink-0 ${editor.isActive('heading', { level: 2 }) ? 'bg-zinc-800 text-brand-400' : ''}`}
                title="Heading 2"
              >
                <Heading2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`p-1.5 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 transition touch-manipulation shrink-0 ${editor.isActive('heading', { level: 3 }) ? 'bg-zinc-800 text-brand-400' : ''}`}
                title="Heading 3"
              >
                <Heading3 className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-4 bg-zinc-700 mx-1 shrink-0" />

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 transition touch-manipulation shrink-0 ${editor.isActive('bulletList') ? 'bg-zinc-800 text-brand-400' : ''}`}
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 transition touch-manipulation shrink-0 ${editor.isActive('orderedList') ? 'bg-zinc-800 text-brand-400' : ''}`}
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={`p-1.5 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 transition touch-manipulation shrink-0 ${editor.isActive('taskList') ? 'bg-zinc-800 text-brand-400' : ''}`}
                title="Task Checklist"
              >
                <CheckSquare className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-4 bg-zinc-700 mx-1 shrink-0" />

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={`p-1.5 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 transition touch-manipulation shrink-0 ${editor.isActive('codeBlock') ? 'bg-zinc-800 text-brand-400' : ''}`}
                title="Code Block"
              >
                <Code className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-1.5 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 transition touch-manipulation shrink-0 ${editor.isActive('blockquote') ? 'bg-zinc-800 text-brand-400' : ''}`}
                title="Quote"
              >
                <Quote className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                className="p-1.5 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 transition touch-manipulation shrink-0"
                title="Insert Table"
              >
                <TableIcon className="w-4 h-4" />
              </button>

              <label className="p-1.5 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 transition cursor-pointer touch-manipulation shrink-0" title="Upload Image">
                <Upload className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>

              <div className="w-[1px] h-4 bg-zinc-700 mx-1 shrink-0" />

              <button
                type="button"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="p-1.5 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-30 transition touch-manipulation shrink-0"
                title="Undo"
              >
                <Undo className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="p-1.5 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-30 transition touch-manipulation shrink-0"
                title="Redo"
              >
                <Redo className="w-4 h-4" />
              </button>
            </>
          )}

          {viewMode === 'markdown' && (
            <div className="text-xs text-zinc-400 px-2 py-1 flex items-center gap-1.5 shrink-0">
              <CodeXml className="w-4 h-4 text-brand-400" />
              <span>Editing Raw Markdown</span>
            </div>
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-xs shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => handleToggleMode('wysiwyg')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition touch-manipulation ${
              viewMode === 'wysiwyg'
                ? 'bg-brand-500/20 text-brand-400 font-medium'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">WYSIWYG</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleMode('markdown')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition touch-manipulation ${
              viewMode === 'markdown'
                ? 'bg-brand-500/20 text-brand-400 font-medium'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <CodeXml className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Markdown</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400 shrink-0">
          <span>{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-red-400 hover:text-red-300 ml-2 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Editor Content Area */}
      <div
        className="flex-1 overflow-y-auto p-3 sm:p-5 focus:outline-none min-h-0 relative"
        onClick={(e) => {
          const target = wikilinkFromEvent(e);
          if (target && onNavigateWikilink) {
            e.preventDefault();
            e.stopPropagation();
            onNavigateWikilink(target);
          }
        }}
      >
        {viewMode === 'wysiwyg' ? (
          <EditorContent
            editor={editor}
            className="prose dark:prose-invert max-w-none focus:outline-none min-h-full h-full [&_.is-editor-empty:first-child::before]:text-zinc-500 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:h-0"
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={rawMarkdown}
            onChange={handleRawMarkdownChange}
            onKeyDown={handleRawMarkdownKeyDown}
            placeholder={placeholder}
            className="w-full h-full min-h-full bg-transparent text-zinc-100 font-mono text-sm sm:text-base leading-relaxed resize-none focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
            spellCheck={false}
          />
        )}
      </div>

      <SuggestionPopup
        isOpen={suggestion.isOpen}
        type={suggestion.type}
        items={filteredSuggestions}
        selectedIndex={suggestion.selectedIndex}
        onSelect={handleSelectSuggestion}
        position={suggestion.position}
      />
    </div>
  );
};
