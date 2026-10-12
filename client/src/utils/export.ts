import { marked } from 'marked';

/**
 * Downloads a single note or markdown content as a .md file.
 */
export function downloadAsMarkdown(title: string, content: string): void {
  const cleanTitle = (title || 'untitled-note')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .trim() || 'note';
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanTitle}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copies rich formatted HTML and plain Markdown to the system clipboard simultaneously.
 * Suitable for pasting into rich text editors (Docs, Gmail, Slack) or text editors.
 */
export async function copyFormattedRichText(content: string): Promise<boolean> {
  const htmlContent = marked.parse(content || '') as string;
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const textBlob = new Blob([content], { type: 'text/plain' });
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': textBlob,
          'text/html': htmlBlob
        })
      ]);
      return true;
    }
  } catch {
    // Fall back to plain text clipboard
  }

  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prints a clean, professionally formatted version of the note via browser print / PDF export,
 * stripping UI bars, buttons, and dark mode backgrounds so output is crisp on paper / PDF.
 */
export function printFormattedNote(title: string, content: string, notebookName?: string): void {
  const htmlBody = marked.parse(content || '') as string;
  const printIframe = document.createElement('iframe');
  printIframe.style.position = 'fixed';
  printIframe.style.right = '0';
  printIframe.style.bottom = '0';
  printIframe.style.width = '0';
  printIframe.style.height = '0';
  printIframe.style.border = '0';
  document.body.appendChild(printIframe);

  const doc = printIframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const printDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title || 'Note'}</title>
        <style>
          @page {
            margin: 20mm;
            size: auto;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #18181b;
            background: #ffffff;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            font-size: 13pt;
          }
          .header {
            border-bottom: 2px solid #e4e4e7;
            padding-bottom: 12px;
            margin-bottom: 24px;
          }
          .title {
            font-size: 22pt;
            font-weight: 700;
            margin: 0 0 6px 0;
            color: #09090b;
          }
          .meta {
            font-size: 9.5pt;
            color: #71717a;
            margin: 0;
          }
          h1, h2, h3, h4, h5, h6 {
            color: #09090b;
            margin-top: 1.4em;
            margin-bottom: 0.4em;
          }
          p { margin: 0.8em 0; }
          ul, ol { padding-left: 24px; }
          li { margin: 0.3em 0; }
          blockquote {
            border-left: 4px solid #d4d4d8;
            margin: 1em 0;
            padding-left: 16px;
            color: #52525b;
            font-style: italic;
          }
          pre {
            background: #f4f4f5;
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            font-family: monospace;
            font-size: 10.5pt;
            border: 1px solid #e4e4e7;
          }
          code {
            font-family: monospace;
            background: #f4f4f5;
            padding: 2px 4px;
            border-radius: 4px;
            font-size: 0.9em;
          }
          pre code { background: none; padding: 0; }
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
          }
          th, td {
            border: 1px solid #d4d4d8;
            padding: 8px 12px;
            text-align: left;
          }
          th { background: #f4f4f5; font-weight: 600; }
          hr {
            border: none;
            border-top: 1px solid #e4e4e7;
            margin: 2em 0;
          }
          input[type="checkbox"] {
            margin-right: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">${title || 'Untitled Note'}</h1>
          <p class="meta">
            ${notebookName ? `Notebook: ${notebookName} • ` : ''}Date: ${printDate}
          </p>
        </div>
        <div class="content">
          ${htmlBody}
        </div>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      printIframe.contentWindow?.focus();
      printIframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(printIframe)) {
          document.body.removeChild(printIframe);
        }
      }, 1000);
    }
  }, 300);
}
