import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderItemToHtml } from './export.js';
import { exportPdf } from '../api/index.js';
import { Item } from '../types/index.js';
import { PdfExportRequestSchema } from '@free-form/shared';

describe('PDF Export Utilities & Client API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('renderItemToHtml', () => {
    it('renders basic markdown note content to formatted HTML', () => {
      const item: Item = {
        id: 'test-item-1',
        title: 'Project Roadmap',
        type: 'note',
        content: '## Heading 2\n\nThis is a **bold** paragraph with [link](https://example.com).',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_favorite: 0,
        is_pinned: 0,
        is_archived: 0,
        hide_from_all: 0
      };

      const html = renderItemToHtml(item);
      expect(html).toContain('<h2>Heading 2</h2>');
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<a href="https://example.com">link</a>');
    });

    it('renders task lists within note content preserving TipTap data-type="taskList" and data-type="taskItem" invariants', () => {
      const item: Item = {
        id: 'test-item-2',
        title: 'Checklist',
        type: 'note',
        content: '- [x] Completed task\n- [ ] Pending task',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_favorite: 0,
        is_pinned: 0,
        is_archived: 0,
        hide_from_all: 0
      };

      const html = renderItemToHtml(item);
      expect(html).toContain('data-type="taskList"');
      expect(html).toContain('data-type="taskItem"');
      expect(html).toContain('data-checked="true"');
      expect(html).toContain('data-checked="false"');
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('Completed task');
      expect(html).toContain('Pending task');
    });

    it('renders markdown tables and [[wikilinks]] accurately for PDF export', () => {
      const item: Item = {
        id: 'test-item-table-wiki',
        title: 'Specs & Links',
        type: 'note',
        content: 'Reference [[System Design|Architecture Doc]]\n\n| Service | Port |\n| --- | --- |\n| Fastify | 3000 |',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_favorite: 0,
        is_pinned: 0,
        is_archived: 0,
        hide_from_all: 0
      };

      const html = renderItemToHtml(item);
      expect(html).toContain('class="wikilink"');
      expect(html).toContain('data-wikilink="System Design"');
      expect(html).toContain('>Architecture Doc</a>');
      expect(html).toContain('<table>');
      expect(html).toContain('<th>Service</th>');
      expect(html).toContain('<td>Fastify</td>');
      expect(html).toContain('<td>3000</td>');
    });

    it('renders counter items with formatted count and unit metadata', () => {
      const item: Item = {
        id: 'test-item-counter',
        title: 'Inventory Count',
        type: 'counter',
        content: 'Additional tally notes.',
        metadata: { count: 42, unit: 'boxes' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_favorite: 0,
        is_pinned: 0,
        is_archived: 0,
        hide_from_all: 0
      };

      const html = renderItemToHtml(item);
      expect(html).toContain('Current Count:</strong> 42 boxes');
      expect(html).toContain('Additional tally notes.');
    });

    it('renders bookmark items with formatted URL and preview blockquote', () => {
      const item: Item = {
        id: 'test-item-bookmark',
        title: 'Documentation',
        type: 'bookmark',
        content: 'Key reference for team.',
        metadata: {
          url: 'https://docs.freeform.io',
          ogDescription: 'Official FreeForm Documentation and API specs.'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_favorite: 0,
        is_pinned: 0,
        is_archived: 0,
        hide_from_all: 0
      };

      const html = renderItemToHtml(item);
      expect(html).toContain('<a href="https://docs.freeform.io">https://docs.freeform.io</a>');
      expect(html).toContain('Official FreeForm Documentation and API specs.');
      expect(html).toContain('Key reference for team.');
    });

    it('renders poster items with image markdown tags', () => {
      const item: Item = {
        id: 'test-item-poster',
        title: 'Visual Assets',
        type: 'poster',
        content: 'Mockups for the release.',
        metadata: {
          images: [
            { url: 'https://example.com/asset1.png', caption: 'Architecture Diagram' }
          ]
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_favorite: 0,
        is_pinned: 0,
        is_archived: 0,
        hide_from_all: 0
      };

      const html = renderItemToHtml(item);
      expect(html).toContain('<img src="https://example.com/asset1.png" alt="Architecture Diagram"');
      expect(html).toContain('Mockups for the release.');
    });
  });

  describe('exportPdf client API', () => {
    it('validates request payload matching PdfExportRequestSchema', () => {
      const payload = {
        notebookName: 'Test Notebook',
        notes: [
          {
            id: 'n1',
            title: 'Note 1',
            html: '<p>Content 1</p>',
            content: 'Content 1'
          },
          {
            id: 'n2',
            title: 'Note 2',
            html: '<p>Content 2</p>',
            content: 'Content 2'
          }
        ],
        ids: ['n1', 'n2']
      };

      const parsed = PdfExportRequestSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
    });

    it('POSTs ordered notes and triggers a browser download from blob', async () => {
      const dummyBlob = new Blob(['%PDF-1.4 dummy content'], { type: 'application/pdf' });
      const fakeUrl = 'blob:http://localhost:3000/mock-uuid-pdf';

      // Mock window and document on globalThis
      let clickedHref = '';
      let clickedDownload = '';
      const dummyAnchor: any = {
        href: '',
        download: '',
        click: vi.fn(function (this: any) {
          clickedHref = this.href;
          clickedDownload = this.download;
        })
      };

      const dummyDoc: any = {
        createElement: vi.fn((tag: string) => {
          if (tag.toLowerCase() === 'a') return dummyAnchor;
          return {};
        }),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn()
        }
      };

      const createObjectURLMock = vi.fn().mockReturnValue(fakeUrl);
      const revokeObjectURLMock = vi.fn();

      const dummyWin: any = {
        URL: {
          createObjectURL: createObjectURLMock,
          revokeObjectURL: revokeObjectURLMock
        }
      };

      (globalThis as any).window = dummyWin;
      (globalThis as any).document = dummyDoc;

      // Mock fetch
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="Exported-Notes.pdf"'
        }),
        blob: async () => dummyBlob
      });
      globalThis.fetch = fetchMock;

      await exportPdf({
        notebookName: 'Exported Notes',
        notes: [
          { id: '1', title: 'Note 1', html: '<p>First</p>' },
          { id: '2', title: 'Note 2', html: '<p>Second</p>' }
        ]
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [fetchUrl, fetchOpts] = fetchMock.mock.calls[0];
      expect(fetchUrl).toContain('/export/pdf');
      expect(fetchOpts.method).toBe('POST');
      expect(JSON.parse(fetchOpts.body)).toMatchObject({
        notebookName: 'Exported Notes',
        notes: [
          { id: '1', title: 'Note 1', html: '<p>First</p>' },
          { id: '2', title: 'Note 2', html: '<p>Second</p>' }
        ]
      });

      expect(createObjectURLMock).toHaveBeenCalledWith(dummyBlob);
      expect(clickedDownload).toBe('Exported-Notes.pdf');
      expect(revokeObjectURLMock).toHaveBeenCalledWith(fakeUrl);
      expect(dummyDoc.body.appendChild).toHaveBeenCalledWith(dummyAnchor);
      expect(dummyDoc.body.removeChild).toHaveBeenCalledWith(dummyAnchor);
    });

    it('throws when the server returns an error during PDF export', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Chromium headless error' })
      });

      await expect(
        exportPdf({
          notebookName: 'Error Notebook',
          notes: []
        })
      ).rejects.toThrow('Chromium headless error');
    });
  });
});
