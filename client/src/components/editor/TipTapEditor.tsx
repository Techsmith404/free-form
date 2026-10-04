import React, { useState, useEffect } from 'react';
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

export function markdownToTipTapHtml(markdown: string): string {
  if (!markdown) return '';
  const markedInstance = new Marked({
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
  });
  return markedInstance.parse(markdown) as string;
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
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
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  initialMarkdown,
  onChange,
  placeholder = 'Write freely in markdown or WYSIWYG...',
  editable = true
}) => {
  const [viewMode, setViewMode] = useState<'wysiwyg' | 'markdown'>('wysiwyg');
  const [rawMarkdown, setRawMarkdown] = useState<string>(initialMarkdown || '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    }
  });

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
      setUploadError('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full sm:border border-zinc-800 sm:rounded-xl bg-zinc-900/30 sm:bg-zinc-900/60 overflow-hidden sm:shadow-xl min-h-0">
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
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 focus:outline-none min-h-0">
        {viewMode === 'wysiwyg' ? (
          <EditorContent
            editor={editor}
            className="prose prose-invert max-w-none focus:outline-none min-h-full h-full [&_.is-editor-empty:first-child::before]:text-zinc-500 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:h-0"
          />
        ) : (
          <textarea
            value={rawMarkdown}
            onChange={handleRawMarkdownChange}
            placeholder={placeholder}
            className="w-full h-full min-h-full bg-transparent text-zinc-100 font-mono text-sm sm:text-base leading-relaxed resize-none focus:outline-none placeholder:text-zinc-600"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
};
