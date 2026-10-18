import fs from 'fs';
import path from 'path';
import puppeteer, { Browser } from 'puppeteer-core';
import { Marked, TokenizerAndRendererExtension } from 'marked';
import * as cheerio from 'cheerio';
import { UPLOADS_DIR } from '../db/index.js';

export interface PdfNoteSection {
  id?: string;
  title?: string;
  html?: string;
  content?: string;
  markdown?: string;
  type?: string;
  metadata?: any;
  tags?: Array<{ name: string } | string>;
  created_at?: string;
  updated_at?: string;
}

export interface PdfDocumentOptions {
  title?: string;
  notebookName?: string;
  notes: PdfNoteSection[];
}

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

export function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseWikilink(inner: string): { title: string; label: string } {
  const [targetPart, alias] = inner.split('|');
  const title = targetPart.split('#')[0].trim();
  return { title, label: (alias ?? targetPart).trim() };
}

const wikilinkMarkedExtension: TokenizerAndRendererExtension = {
  name: 'wikilink',
  level: 'inline',
  start(src: string) {
    const i = src.indexOf('[[');
    return i < 0 ? undefined : i;
  },
  tokenizer(src: string) {
    const m = /^\[\[([^\[\]\n]+?)\]\]/.exec(src);
    if (!m) return undefined;
    const { title, label } = parseWikilink(m[1]);
    if (!title) return undefined;
    return { type: 'wikilink', raw: m[0], title, label } as any;
  },
  renderer(token: any) {
    return `<a href="#" class="wikilink" data-wikilink="${escapeHtml(token.title)}">${escapeHtml(token.label)}</a>`;
  }
};

/**
 * Converts Markdown content to TipTap-compatible HTML, preserving
 * `ul[data-type="taskList"]` and `li[data-type="taskItem"][data-checked]` attributes.
 */
export function markdownToTipTapHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return '';
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
            const body = (this.parser.parse as any)(item.tokens, Boolean(item.loose));
            return `<li data-type="taskItem" data-checked="${isChecked}"><label><input type="checkbox" ${isChecked ? 'checked="checked"' : ''} disabled="disabled" /><span></span></label><div>${body}</div></li>\n`;
          }
          const body = (this.parser.parse as any)(item.tokens, Boolean(item.loose));
          return `<li>${body}</li>\n`;
        }
      }
    },
    { extensions: [wikilinkMarkedExtension] }
  );
  return markedInstance.parse(markdown) as string;
}

/**
 * Normalizes and sanitizes HTML (whether from TipTap editor, Marked, or raw string):
 * - Strips unsafe elements (<script>, <iframe>, <object>, <embed>) and inline event handlers
 * - Ensures GFM task lists or TipTap task lists both carry `data-type="taskList"` and `data-type="taskItem"`
 * - Resolves `/uploads/...` image URLs to inline `data:` URIs when local files exist
 */
export function normalizeAndSanitizeTipTapHtml(rawHtml: string): string {
  if (!rawHtml || !rawHtml.trim()) return '';

  const $ = cheerio.load(rawHtml, null, false);

  // Strip dangerous tags
  $('script, iframe, object, embed, form, meta, link').remove();

  // Strip inline event handlers and javascript: URLs
  $('*').each((_, el) => {
    const attribs = (el as any).attribs || {};
    for (const attrName of Object.keys(attribs)) {
      if (attrName.toLowerCase().startsWith('on')) {
        $(el).removeAttr(attrName);
      } else if (
        (attrName.toLowerCase() === 'href' || attrName.toLowerCase() === 'src') &&
        /^\s*javascript:/i.test(attribs[attrName])
      ) {
        $(el).removeAttr(attrName);
      }
    }
  });

  // Normalize plain GFM checkbox lists into TipTap `data-type="taskList"` structure if needed
  $('li').each((_, liEl) => {
    const $li = $(liEl);
    const directCheckbox = $li.find('> input[type="checkbox"], > p > input[type="checkbox"]').first();
    if ($li.attr('data-type') === 'taskItem') {
      const isChecked = $li.attr('data-checked') === 'true';
      const $parentUl = $li.parent('ul');
      if ($parentUl.length && !$parentUl.attr('data-type')) {
        $parentUl.attr('data-type', 'taskList');
      }
      // If TipTap exported `<li data-type="taskItem" data-checked="true"><p>...</p></li>` without `<label><input>`,
      // inject the checkbox label so it renders identically to TipTap's DOM
      if ($li.children('label').length === 0 && directCheckbox.length === 0) {
        const innerHtml = $li.html() || '';
        $li.html(
          `<label><input type="checkbox" ${isChecked ? 'checked="checked"' : ''} disabled="disabled" /><span></span></label><div>${innerHtml}</div>`
        );
      } else {
        $li.find('input[type="checkbox"]').each((__, cb) => {
          if (isChecked) {
            $(cb).attr('checked', 'checked');
          } else {
            $(cb).removeAttr('checked');
          }
          $(cb).attr('disabled', 'disabled');
        });
      }
    } else if (directCheckbox.length > 0) {
      const isChecked = directCheckbox.attr('checked') !== undefined;
      $li.attr('data-type', 'taskItem');
      $li.attr('data-checked', isChecked ? 'true' : 'false');
      const $parentUl = $li.parent('ul');
      if ($parentUl.length && !$parentUl.attr('data-type')) {
        $parentUl.attr('data-type', 'taskList');
      }
      directCheckbox.remove();
      const innerHtml = $li.html() || '';
      $li.html(
        `<label><input type="checkbox" ${isChecked ? 'checked="checked"' : ''} disabled="disabled" /><span></span></label><div>${innerHtml}</div>`
      );
    }
  });

  // Resolve local /uploads/... images to base64 data URIs so headless browser renders them without network dependency
  $('img').each((_, imgEl) => {
    const $img = $(imgEl);
    const src = $img.attr('src');
    if (!src) return;

    const uploadMatch = /^(?:https?:\/\/[^/]+)?\/uploads\/([^/?#]+)$/i.exec(src.trim());
    if (uploadMatch) {
      const filename = path.basename(uploadMatch[1]);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile() && stat.size <= 25 * 1024 * 1024) {
            const ext = path.extname(filename).toLowerCase();
            const mime = IMAGE_MIME_BY_EXT[ext] || 'image/png';
            const buf = fs.readFileSync(filePath);
            $img.attr('src', `data:${mime};base64,${buf.toString('base64')}`);
          }
        } catch {
          // Ignore file read errors and leave src as-is
        }
      }
    }
  });

  return $.html();
}

/**
 * Formats a note section into HTML body content based on its item type and available fields.
 */
export function renderNoteSectionHtml(note: PdfNoteSection): string {
  // If pre-rendered HTML is supplied, normalize & sanitize it directly
  if (typeof note.html === 'string' && note.html.trim()) {
    return normalizeAndSanitizeTipTapHtml(note.html);
  }

  const rawText = typeof note.content === 'string' ? note.content : typeof note.markdown === 'string' ? note.markdown : '';
  const meta = typeof note.metadata === 'string' ? (() => {
    try { return JSON.parse(note.metadata); } catch { return {}; }
  })() : (note.metadata || {});

  let combinedMarkdown = rawText;

  if (note.type === 'counter') {
    const countVal = meta.count ?? meta.value ?? 0;
    const unitVal = meta.unit ? ` ${meta.unit}` : '';
    combinedMarkdown = `**Current Count:** ${countVal}${unitVal}\n\n${rawText}`;
  } else if (note.type === 'bookmark' && meta.url) {
    const desc = meta.ogDescription ? `\n\n> ${meta.ogDescription}` : '';
    combinedMarkdown = `**Link:** [${meta.url}](${meta.url})${desc}\n\n${rawText}`;
  } else if (note.type === 'poster' && Array.isArray(meta.images) && meta.images.length > 0) {
    const imgsMd = meta.images
      .map((img: any) => `![${img.caption || img.name || 'Image'}](${img.url})`)
      .join('\n\n');
    combinedMarkdown = `${imgsMd}\n\n${rawText}`;
  }

  // Detect if rawText looks like pre-rendered HTML (starts with a block HTML tag and has no markdown)
  const trimmed = combinedMarkdown.trim();
  const looksLikeHtml =
    /^<(p|h[1-6]|ul|ol|div|table|blockquote|pre|section|article)\b/i.test(trimmed) &&
    !trimmed.includes('\n# ') &&
    !trimmed.includes('\n- [');

  const html = looksLikeHtml ? trimmed : markdownToTipTapHtml(combinedMarkdown);
  return normalizeAndSanitizeTipTapHtml(html);
}

/**
 * Print-friendly TipTap stylesheet for server-side PDF rendering.
 */
export const TIPTAP_PRINT_STYLESHEET = `
  @page {
    size: A4;
    margin: 18mm 16mm 18mm 16mm;
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  html, body {
    margin: 0;
    padding: 0;
    background-color: #ffffff;
    color: #18181b;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    font-size: 11pt;
    line-height: 1.6;
  }

  .pdf-notebook-header {
    border-bottom: 2px solid #18181b;
    padding-bottom: 12px;
    margin-bottom: 24px;
  }

  .pdf-notebook-title {
    font-size: 22pt;
    font-weight: 800;
    color: #09090b;
    margin: 0 0 6px 0;
    letter-spacing: -0.02em;
  }

  .pdf-notebook-meta {
    font-size: 9.5pt;
    color: #52525b;
    margin: 0;
  }

  .pdf-note-section {
    margin-bottom: 28px;
    padding-bottom: 20px;
    border-bottom: 1px solid #e4e4e7;
    page-break-inside: auto;
  }

  .pdf-note-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .pdf-note-header {
    margin-bottom: 12px;
    page-break-after: avoid;
    break-after: avoid;
  }

  .pdf-note-title {
    font-size: 16pt;
    font-weight: 700;
    color: #09090b;
    margin: 0 0 4px 0;
    line-height: 1.3;
  }

  .pdf-note-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }

  .pdf-note-tag {
    font-size: 8.5pt;
    font-weight: 600;
    color: #15803d;
    background-color: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 4px;
    padding: 1px 6px;
  }

  /* TipTap / ProseMirror Content Styles */
  .ProseMirror, .tiptap-content {
    outline: none;
    color: #18181b;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .ProseMirror h1, .tiptap-content h1 {
    font-size: 16pt;
    font-weight: 800;
    color: #09090b;
    margin: 1.1em 0 0.45em 0;
    line-height: 1.25;
    page-break-after: avoid;
    break-after: avoid;
  }

  .ProseMirror h2, .tiptap-content h2 {
    font-size: 13.5pt;
    font-weight: 700;
    color: #18181b;
    margin: 1em 0 0.4em 0;
    line-height: 1.3;
    page-break-after: avoid;
    break-after: avoid;
  }

  .ProseMirror h3, .tiptap-content h3 {
    font-size: 11.5pt;
    font-weight: 600;
    color: #18181b;
    margin: 0.85em 0 0.35em 0;
    line-height: 1.35;
    page-break-after: avoid;
    break-after: avoid;
  }

  .ProseMirror h4, .ProseMirror h5, .ProseMirror h6,
  .tiptap-content h4, .tiptap-content h5, .tiptap-content h6 {
    font-size: 10.5pt;
    font-weight: 600;
    color: #27272a;
    margin: 0.75em 0 0.3em 0;
    page-break-after: avoid;
    break-after: avoid;
  }

  .ProseMirror p, .tiptap-content p {
    margin: 0 0 0.65rem 0;
    line-height: 1.6;
    color: #18181b;
  }

  .ProseMirror strong, .ProseMirror b,
  .tiptap-content strong, .tiptap-content b {
    font-weight: 700;
    color: #09090b;
  }

  .ProseMirror em, .ProseMirror i,
  .tiptap-content em, .tiptap-content i {
    font-style: italic;
  }

  /* Bullet & Ordered Lists */
  .ProseMirror ul:not([data-type="taskList"]),
  .tiptap-content ul:not([data-type="taskList"]) {
    list-style-type: disc !important;
    padding-left: 1.5rem !important;
    margin: 0.4rem 0 0.75rem 0;
  }

  .ProseMirror ol,
  .tiptap-content ol {
    list-style-type: decimal !important;
    padding-left: 1.5rem !important;
    margin: 0.4rem 0 0.75rem 0;
  }

  .ProseMirror ul:not([data-type="taskList"]) li,
  .ProseMirror ol li,
  .tiptap-content ul:not([data-type="taskList"]) li,
  .tiptap-content ol li {
    margin-bottom: 0.25rem;
    display: list-item;
    color: #18181b;
  }

  .ProseMirror ul:not([data-type="taskList"]) li > p,
  .ProseMirror ol li > p,
  .tiptap-content ul:not([data-type="taskList"]) li > p,
  .tiptap-content ol li > p {
    margin-bottom: 0;
    display: inline;
  }

  /* TipTap Task Lists (Hard Invariant: data-type="taskList") */
  .ProseMirror ul[data-type="taskList"],
  .tiptap-content ul[data-type="taskList"] {
    list-style: none !important;
    padding-left: 0.25rem !important;
    margin: 0.5rem 0 0.85rem 0;
  }

  .ProseMirror ul[data-type="taskList"] li,
  .tiptap-content ul[data-type="taskList"] li {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    margin-bottom: 0.35rem;
    list-style: none !important;
  }

  .ProseMirror ul[data-type="taskList"] li > label,
  .tiptap-content ul[data-type="taskList"] li > label {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    margin-top: 0.2rem;
    user-select: none;
  }

  .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"],
  .tiptap-content ul[data-type="taskList"] li > label input[type="checkbox"],
  .tiptap-content input[type="checkbox"] {
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: #16a34a;
  }

  .ProseMirror ul[data-type="taskList"] li > div,
  .tiptap-content ul[data-type="taskList"] li > div {
    flex: 1 1 auto;
    min-width: 0;
  }

  .ProseMirror ul[data-type="taskList"] li > div > p,
  .tiptap-content ul[data-type="taskList"] li > div > p {
    margin: 0;
  }

  .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div,
  .tiptap-content ul[data-type="taskList"] li[data-checked="true"] > div {
    color: #71717a;
    text-decoration: line-through;
  }

  /* Code & Preformatted Blocks */
  .ProseMirror code:not(pre code),
  .tiptap-content code:not(pre code) {
    background-color: #f4f4f5;
    border: 1px solid #e4e4e7;
    padding: 0.1rem 0.35rem;
    border-radius: 0.25rem;
    font-size: 0.88em;
    color: #15803d;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }

  .ProseMirror pre,
  .tiptap-content pre {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 9.5pt;
    line-height: 1.5;
    margin: 0.75rem 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: #0f172a;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .ProseMirror pre code,
  .tiptap-content pre code {
    background: transparent;
    border: none;
    padding: 0;
    color: inherit;
    font-size: inherit;
  }

  /* Blockquotes */
  .ProseMirror blockquote,
  .tiptap-content blockquote {
    border-left: 3px solid #22c55e;
    background-color: #f8fafc;
    padding: 0.5rem 0.85rem;
    margin: 0.75rem 0;
    color: #3f3f46;
    font-style: italic;
    border-radius: 0 0.375rem 0.375rem 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .ProseMirror blockquote p:last-child,
  .tiptap-content blockquote p:last-child {
    margin-bottom: 0;
  }

  /* Tables */
  .ProseMirror table,
  .tiptap-content table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.85rem 0;
    font-size: 10pt;
    page-break-inside: auto;
  }

  .ProseMirror tr,
  .tiptap-content tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .ProseMirror th,
  .ProseMirror td,
  .tiptap-content th,
  .tiptap-content td {
    border: 1px solid #cbd5e1;
    padding: 0.45rem 0.65rem;
    text-align: left;
    vertical-align: top;
  }

  .ProseMirror th,
  .tiptap-content th {
    background-color: #f1f5f9;
    font-weight: 700;
    color: #0f172a;
  }

  /* Images */
  .ProseMirror img,
  .tiptap-content img {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
    margin: 0.65rem 0;
    border: 1px solid #e2e8f0;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Horizontal Rule */
  .ProseMirror hr,
  .tiptap-content hr {
    border: none;
    border-top: 1px solid #d4d4d8;
    margin: 1.25rem 0;
  }

  /* Links & Wikilinks */
  .ProseMirror a,
  .tiptap-content a {
    color: #16a34a;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .ProseMirror a.wikilink,
  .tiptap-content a.wikilink {
    color: #15803d;
    background-color: #f0fdf4;
    padding: 0 4px;
    border-radius: 3px;
    font-weight: 500;
    text-decoration: underline;
  }
`;

/**
 * Builds the full standalone HTML document to be rendered by Puppeteer.
 */
export function buildPdfHtmlDocument(options: PdfDocumentOptions): string {
  const notebookTitle = (options.notebookName || options.title || '').trim();
  const exportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const sectionsHtml = options.notes
    .map((note, idx) => {
      const noteTitle = note.title?.trim();
      const bodyHtml = renderNoteSectionHtml(note);

      // Avoid duplicate top heading if the note body already begins with an identical <h1>
      let showNoteHeader = Boolean(noteTitle);
      if (noteTitle) {
        const $ = cheerio.load(bodyHtml, null, false);
        const firstEl = $.root().children().first();
        if (firstEl.is('h1') && firstEl.text().trim().toLowerCase() === noteTitle.toLowerCase()) {
          showNoteHeader = false;
        }
      }

      const tagList = (note.tags || [])
        .map((t) => (typeof t === 'string' ? t : t?.name))
        .filter(Boolean) as string[];

      const tagsHtml =
        tagList.length > 0
          ? `<div class="pdf-note-tags">${tagList.map((t) => `<span class="pdf-note-tag">#${escapeHtml(t)}</span>`).join('')}</div>`
          : '';

      const headerBlock =
        showNoteHeader || tagsHtml
          ? `<div class="pdf-note-header">
              ${showNoteHeader ? `<h2 class="pdf-note-title">${escapeHtml(noteTitle!)}</h2>` : ''}
              ${tagsHtml}
            </div>`
          : '';

      return `<section class="pdf-note-section" data-note-index="${idx}"${note.id ? ` data-note-id="${escapeHtml(note.id)}"` : ''}>
        ${headerBlock}
        <div class="ProseMirror tiptap-content">
          ${bodyHtml}
        </div>
      </section>`;
    })
    .join('\n');

  const docTitle = notebookTitle || (options.notes.length === 1 && options.notes[0].title) || 'Notebook Export';

  const notebookHeaderHtml = notebookTitle
    ? `<header class="pdf-notebook-header">
        <h1 class="pdf-notebook-title">${escapeHtml(notebookTitle)}</h1>
        <p class="pdf-notebook-meta">${options.notes.length} ${options.notes.length === 1 ? 'note' : 'notes'} • Exported ${escapeHtml(exportDate)}</p>
      </header>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docTitle)}</title>
  <style>${TIPTAP_PRINT_STYLESHEET}</style>
</head>
<body>
  ${notebookHeaderHtml}
  <main class="pdf-notes-container">
    ${sectionsHtml}
  </main>
</body>
</html>`;
}

/**
 * Resolves the local Chromium / Chrome executable path on the system.
 */
export function resolveBrowserExecutablePath(): string {
  const envPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    process.env.CHROMIUM_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/opt/chromium.org/thorium/thorium',
    '/usr/bin/thorium-browser',
    '/usr/bin/brave-browser-stable',
    '/usr/bin/brave-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'No Chromium/Chrome executable found. Set PUPPETEER_EXECUTABLE_PATH or install chromium.'
  );
}

let sharedBrowser: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser;
  }

  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  browserLaunchPromise = (async () => {
    const executablePath = resolveBrowserExecutablePath();
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote'
      ]
    });

    browser.on('disconnected', () => {
      if (sharedBrowser === browser) {
        sharedBrowser = null;
      }
    });

    sharedBrowser = browser;
    return browser;
  })();

  try {
    return await browserLaunchPromise;
  } finally {
    browserLaunchPromise = null;
  }
}

/**
 * Cleanly closes the shared Puppeteer browser instance (called on server shutdown).
 */
export async function closePdfBrowser(): Promise<void> {
  if (sharedBrowser) {
    const b = sharedBrowser;
    sharedBrowser = null;
    try {
      await b.close();
    } catch {
      // Ignore errors on shutdown
    }
  }
}

/**
 * Generates a PDF Buffer from the given notebook/notes options using headless Chromium via Puppeteer.
 */
export async function generatePdfBuffer(options: PdfDocumentOptions): Promise<Buffer> {
  const htmlDocument = buildPdfHtmlDocument(options);
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Block external/local network fetches from inside the page to prevent SSRF while allowing data: URIs
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url === 'about:blank') {
        req.continue().catch(() => {});
      } else {
        req.abort().catch(() => {});
      }
    });

    await page.setContent(htmlDocument, {
      waitUntil: 'load',
      timeout: 15000
    });

    const pdfUint8Array = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '18mm',
        right: '16mm',
        bottom: '18mm',
        left: '16mm'
      }
    });

    return Buffer.from(pdfUint8Array);
  } finally {
    await page.close().catch(() => {});
  }
}
