import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { db, initDatabase, UPLOADS_DIR } from './db/index.js';
import { exportRoutes } from './routes/export.js';
import {
  buildPdfHtmlDocument,
  markdownToTipTapHtml,
  normalizeAndSanitizeTipTapHtml,
  renderNoteSectionHtml,
  closePdfBrowser
} from './services/pdf.js';
import { isPatRequestAllowed } from './services/tokens.js';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';

function extractTextFromPdfBuffer(pdfBuffer: Buffer): string {
  const tmpPdf = path.join(UPLOADS_DIR, `tmp-verify-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(tmpPdf, pdfBuffer);
  try {
    return execFileSync('pdftotext', [tmpPdf, '-'], { encoding: 'utf8' });
  } finally {
    try {
      fs.unlinkSync(tmpPdf);
    } catch {}
  }
}

describe('Export and Import Routes', () => {
  let app: FastifyInstance;
  const testUserId = 'usr-import-test';

  beforeAll(async () => {
    initDatabase();

    // Create test user in DB
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testUserId, 'import_tester', 'hash', 'owner', now, now);

    app = fastify();
    await app.register(multipart);

    // Mock authenticated user
    app.decorateRequest('user', null);
    app.addHook('onRequest', async (request) => {
      (request as any).user = {
        id: testUserId,
        username: 'import_tester',
        role: 'owner'
      };
    });

    await app.register(exportRoutes);
    await app.ready();
  });

  afterAll(async () => {
    // Cleanup test data
    db.prepare('DELETE FROM items WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM notebooks WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM templates WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM tags WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    await closePdfBrowser();
    await app.close();
  });

  it('should import backup from JSON payload and assign user_id', async () => {
    const payload = {
      notebooks: [
        {
          id: 'nb-test-import-1',
          name: 'Imported Notebook',
          description: 'Testing import',
          color: '#3b82f6',
          icon: 'book'
        }
      ],
      templates: [
        {
          id: 'tpl-test-import-1',
          name: 'Imported Template',
          fields_schema: [{ id: 'f1', label: 'Field 1', type: 'text' }]
        }
      ],
      items: [
        {
          id: 'item-test-import-1',
          notebook_id: 'nb-test-import-1',
          title: 'Imported Note 1',
          type: 'note',
          content: 'Hello World',
          metadata: {}
        }
      ],
      tags: [
        {
          id: 'tag-test-import-1',
          name: 'test-import-tag',
          color: '#ef4444'
        }
      ],
      itemTags: [
        {
          item_id: 'item-test-import-1',
          tag_id: 'tag-test-import-1'
        }
      ]
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/import',
      headers: {
        'content-type': 'application/json'
      },
      payload
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.stats.notebooks).toBe(1);
    expect(body.stats.items).toBe(1);
    expect(body.stats.templates).toBe(1);
    expect(body.stats.tags).toBe(1);
    expect(body.imported_for_user).toBe(testUserId);

    // Verify in database that user_id was assigned correctly
    const dbItem = db.prepare('SELECT * FROM items WHERE id = ?').get('item-test-import-1') as any;
    expect(dbItem).toBeDefined();
    expect(dbItem.user_id).toBe(testUserId);
    expect(dbItem.title).toBe('Imported Note 1');

    const dbNb = db.prepare('SELECT * FROM notebooks WHERE id = ?').get('nb-test-import-1') as any;
    expect(dbNb).toBeDefined();
    expect(dbNb.user_id).toBe(testUserId);

    const dbTpl = db.prepare('SELECT * FROM templates WHERE id = ?').get('tpl-test-import-1') as any;
    expect(dbTpl).toBeDefined();
    expect(dbTpl.user_id).toBe(testUserId);
  });

  it('should export data as ZIP containing free-form-backup.json', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/export'
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');

    const zip = new AdmZip(res.rawPayload);
    const backupEntry = zip.getEntry('free-form-backup.json');
    expect(backupEntry).toBeDefined();

    const jsonText = zip.readAsText(backupEntry!);
    const parsed = JSON.parse(jsonText);
    expect(parsed.items).toBeDefined();
    expect(parsed.notebooks).toBeDefined();
    expect(parsed.items.some((i: any) => i.id === 'item-test-import-1')).toBe(true);
  });

  it('should import from ZIP archive even if it contains duplicate markdown entry names', async () => {
    const archiverModule = (await import('archiver')).default;
    const archive = archiverModule('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (c: Buffer) => chunks.push(c));

    const backupContent = {
      notebooks: [],
      templates: [],
      items: [
        {
          id: 'item-dup-zip-test',
          title: 'Dup Archive Note',
          type: 'note',
          content: 'Imported despite duplicate zip entries',
          metadata: {}
        }
      ],
      tags: [],
      itemTags: []
    };

    archive.append(JSON.stringify(backupContent), { name: 'free-form-backup.json' });
    // Append duplicate filenames like in the user's issue
    archive.append('content 1', { name: 'Folder/Duplicate Title-item-1.md' });
    archive.append('content 2', { name: 'Folder/Duplicate Title-item-1.md' });
    await archive.finalize();

    const zipBuffer = Buffer.concat(chunks);

    // Build multipart body
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="backup.zip"\r\nContent-Type: application/zip\r\n\r\n`),
      zipBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/import',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload: multipartBody
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.stats.items).toBe(1);

    const savedItem = db.prepare('SELECT * FROM items WHERE id = ?').get('item-dup-zip-test') as any;
    expect(savedItem).toBeDefined();
    expect(savedItem.user_id).toBe(testUserId);
  });

  it('should import notebooks where child notebook appears before parent notebook', async () => {
    const payload = {
      notebooks: [
        {
          id: 'nb-child-1',
          name: 'Child Notebook',
          parent_id: 'nb-parent-1'
        },
        {
          id: 'nb-parent-1',
          name: 'Parent Notebook',
          parent_id: null
        }
      ],
      items: [
        {
          id: 'item-in-child-nb',
          notebook_id: 'nb-child-1',
          title: 'Note in Child',
          type: 'note'
        }
      ]
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/import',
      headers: { 'content-type': 'application/json' },
      payload
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.stats.notebooks).toBe(2);

    const childNb = db.prepare('SELECT * FROM notebooks WHERE id = ?').get('nb-child-1') as any;
    expect(childNb).toBeDefined();
    expect(childNb.parent_id).toBe('nb-parent-1');

    const parentNb = db.prepare('SELECT * FROM notebooks WHERE id = ?').get('nb-parent-1') as any;
    expect(parentNb).toBeDefined();
  });

  it('should export and import timers, reminders, settings, counter_history, and upload files', async () => {
    // 1. Setup entities to export
    const timerId = `tm-exp-${Date.now()}`;
    const reminderId = `rem-exp-${Date.now()}`;
    const counterItemId = `item-cnt-${Date.now()}`;
    const counterHistoryId = `ch-exp-${Date.now()}`;
    const testUploadName = `test-export-${Date.now()}.txt`;
    const testUploadPath = path.join(UPLOADS_DIR, testUploadName);
    const now = new Date().toISOString();

    fs.writeFileSync(testUploadPath, 'Sample upload attachment content');

    db.prepare(`
      INSERT INTO items (id, user_id, title, type, metadata, created_at, updated_at)
      VALUES (?, ?, 'Exported Counter Item', 'counter', '{"count": 5}', ?, ?)
    `).run(counterItemId, testUserId, now, now);

    db.prepare(`
      INSERT INTO counter_history (id, item_id, delta, new_value, note, created_at)
      VALUES (?, ?, 5, 5, 'Initial count', ?)
    `).run(counterHistoryId, counterItemId, now);

    db.prepare(`
      INSERT INTO timers (id, user_id, title, duration_seconds, remaining_seconds, status, created_at, updated_at)
      VALUES (?, ?, 'Exported Timer', 300, 300, 'idle', ?, ?)
    `).run(timerId, testUserId, now, now);

    db.prepare(`
      INSERT INTO reminders (id, user_id, title, notes, due_date, status, priority, created_at, updated_at)
      VALUES (?, ?, 'Exported Reminder', 'Reminder notes', ?, 'pending', 'high', ?, ?)
    `).run(reminderId, testUserId, now, now, now);

    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES ('custom_test_key', 'test_setting_value', ?)
    `).run(now);

    // 2. Export to ZIP
    const exportRes = await app.inject({
      method: 'GET',
      url: '/api/export'
    });
    expect(exportRes.statusCode).toBe(200);

    const exportZip = new AdmZip(exportRes.rawPayload);
    const backupEntry = exportZip.getEntry('free-form-backup.json');
    expect(backupEntry).toBeDefined();

    const backupJson = JSON.parse(exportZip.readAsText(backupEntry!));
    expect(Array.isArray(backupJson.timers)).toBe(true);
    expect(backupJson.timers.some((t: any) => t.id === timerId)).toBe(true);

    expect(Array.isArray(backupJson.reminders)).toBe(true);
    expect(backupJson.reminders.some((r: any) => r.id === reminderId)).toBe(true);

    expect(Array.isArray(backupJson.settings)).toBe(true);
    expect(backupJson.settings.some((s: any) => s.key === 'custom_test_key')).toBe(true);

    expect(Array.isArray(backupJson.counter_history)).toBe(true);
    expect(backupJson.counter_history.some((c: any) => c.id === counterHistoryId)).toBe(true);

    const uploadEntry = exportZip.getEntry(`uploads/${testUploadName}`);
    expect(uploadEntry).toBeDefined();
    expect(exportZip.readAsText(uploadEntry!)).toBe('Sample upload attachment content');

    // Clean up created file in UPLOADS_DIR
    try { fs.unlinkSync(testUploadPath); } catch {}

    // 3. Import from a custom ZIP containing all new items & upload file
    const archiverModule = (await import('archiver')).default;
    const archive = archiverModule('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (c: Buffer) => chunks.push(c));

    const importTimerId = `tm-imp-${Date.now()}`;
    const importReminderId = `rem-imp-${Date.now()}`;
    const importCounterItemId = `item-cnt-imp-${Date.now()}`;
    const importCounterHistoryId = `ch-imp-${Date.now()}`;
    const importedUploadName = `imported-attachment-${Date.now()}.txt`;

    const newBackupData = {
      notebooks: [],
      templates: [],
      items: [
        {
          id: importCounterItemId,
          title: 'Imported Counter',
          type: 'counter',
          metadata: { count: 42 }
        }
      ],
      tags: [],
      itemTags: [],
      timers: [
        {
          id: importTimerId,
          title: 'Imported Pomodoro',
          duration_seconds: 1500,
          remaining_seconds: 1500,
          status: 'idle'
        }
      ],
      reminders: [
        {
          id: importReminderId,
          title: 'Imported Task Reminder',
          notes: 'Do not forget',
          due_date: now,
          status: 'pending',
          priority: 'urgent'
        }
      ],
      settings: [
        {
          key: 'imported_setting_key',
          value: 'active'
        }
      ],
      counter_history: [
        {
          id: importCounterHistoryId,
          item_id: importCounterItemId,
          delta: 42,
          new_value: 42,
          note: 'Imported count'
        }
      ]
    };

    archive.append(JSON.stringify(newBackupData), { name: 'free-form-backup.json' });
    archive.append('Restored attachment payload', { name: `uploads/${importedUploadName}` });
    await archive.finalize();

    const zipBuffer = Buffer.concat(chunks);
    const boundary = '----WebKitFormBoundaryFullBackupTest';
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="full-backup.zip"\r\nContent-Type: application/zip\r\n\r\n`),
      zipBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const importRes = await app.inject({
      method: 'POST',
      url: '/api/import',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload: multipartBody
    });

    expect(importRes.statusCode).toBe(200);
    const importResult = JSON.parse(importRes.payload);
    expect(importResult.success).toBe(true);
    expect(importResult.stats.timers).toBe(1);
    expect(importResult.stats.reminders).toBe(1);
    expect(importResult.stats.counter_history).toBe(1);
    expect(importResult.stats.settings).toBe(1);

    // Verify imported data in SQLite
    const savedTimer = db.prepare('SELECT * FROM timers WHERE id = ?').get(importTimerId) as any;
    expect(savedTimer).toBeDefined();
    expect(savedTimer.title).toBe('Imported Pomodoro');
    expect(savedTimer.user_id).toBe(testUserId);

    const savedReminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(importReminderId) as any;
    expect(savedReminder).toBeDefined();
    expect(savedReminder.priority).toBe('urgent');
    expect(savedReminder.user_id).toBe(testUserId);

    const savedHistory = db.prepare('SELECT * FROM counter_history WHERE id = ?').get(importCounterHistoryId) as any;
    expect(savedHistory).toBeDefined();
    expect(savedHistory.new_value).toBe(42);

    const savedSetting = db.prepare('SELECT * FROM settings WHERE key = ?').get('imported_setting_key') as any;
    expect(savedSetting).toBeDefined();
    expect(savedSetting.value).toBe('active');

    // Verify upload file was written to disk
    const importedFilePath = path.join(UPLOADS_DIR, importedUploadName);
    expect(fs.existsSync(importedFilePath)).toBe(true);
    expect(fs.readFileSync(importedFilePath, 'utf8')).toBe('Restored attachment payload');

    // Cleanup
    try { fs.unlinkSync(importedFilePath); } catch {}
  });

  it('should stream a markdown ZIP for selected note IDs via POST /api/export/batch', async () => {
    const noteId1 = 'item-exp-batch-1';
    const noteId2 = 'item-exp-batch-2';
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO items (id, user_id, title, content, type, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'note', 0, ?, ?), (?, ?, ?, ?, 'note', 0, ?, ?)
    `).run(
      noteId1, testUserId, 'Batch Note Alpha', '# Alpha Content\n- Task 1', now, now,
      noteId2, testUserId, 'Batch Note Beta', '# Beta Content\n- Task 2', now, now
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/export/batch',
      payload: { ids: [noteId1, noteId2] }
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toContain('free-form-selected-notes');

    const zip = new AdmZip(res.rawPayload);
    const entries = zip.getEntries();
    expect(entries.length).toBe(2);

    const alphaEntry = entries.find((e) => e.entryName.includes('Batch Note Alpha'));
    expect(alphaEntry).toBeDefined();
    const alphaContent = alphaEntry!.getData().toString('utf8');
    expect(alphaContent).toContain('# Alpha Content');
    expect(alphaContent).toContain('title: "Batch Note Alpha"');

    // Clean up
    db.prepare('DELETE FROM items WHERE id IN (?, ?)').run(noteId1, noteId2);
  });

  it('should build print-friendly TipTap HTML preserving data-type="taskList" and taskItem attributes', () => {
    const md = `# Sprint Checklist\n\n- [x] Ship PDF API\n- [ ] Write unit tests\n\n| Feature | Status |\n| --- | --- |\n| Puppeteer | Ready |\n\n\`\`\`ts\nconst ok = true;\n\`\`\``;
    const tipTapHtml = markdownToTipTapHtml(md);
    expect(tipTapHtml).toContain('data-type="taskList"');
    expect(tipTapHtml).toContain('data-type="taskItem"');
    expect(tipTapHtml).toContain('data-checked="true"');
    expect(tipTapHtml).toContain('data-checked="false"');

    const fullDoc = buildPdfHtmlDocument({
      notebookName: 'Engineering Notebook',
      notes: [
        {
          id: 'note-1',
          title: 'Sprint Checklist',
          content: md,
          tags: ['backend', 'pdf']
        },
        {
          id: 'note-2',
          title: 'Second Note',
          html: '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Already HTML</p></li></ul><script>alert(1)</script>'
        }
      ]
    });

    expect(fullDoc).toContain('Engineering Notebook');
    expect(fullDoc).toContain('data-type="taskList"');
    expect(fullDoc).toContain('data-note-index="0"');
    expect(fullDoc).toContain('data-note-index="1"');
    expect(fullDoc).toContain('#backend');
    expect(fullDoc).not.toContain('<script>');
  });

  it('should return 400 when POST /api/export/pdf is called with empty payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/export/pdf',
      payload: { notes: [] }
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('At least one note or HTML payload is required');
  });

  it('should generate and return a valid PDF attachment via POST /api/export/pdf with ordered HTML notes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/export/pdf',
      payload: {
        notebookName: 'Architecture Plan',
        notes: [
          {
            id: 'pdf-note-1',
            title: 'First Ordered Note',
            html: '<h1>First Ordered Note</h1><p>Intro paragraph.</p><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked></label><div><p>Completed task</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Pending task</p></div></li></ul>'
          },
          {
            id: 'pdf-note-2',
            title: 'Second Ordered Note',
            content: '## Table & Code\n\n| Col A | Col B |\n| --- | --- |\n| Val 1 | Val 2 |\n\n```js\nconsole.log("hello pdf");\n```'
          }
        ]
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment; filename="Architecture Plan.pdf"');
    expect(res.rawPayload.length).toBeGreaterThan(1000);
    expect(res.rawPayload.subarray(0, 5).toString('utf8')).toBe('%PDF-');

    const extractedText = extractTextFromPdfBuffer(res.rawPayload);
    expect(extractedText).toContain('Architecture Plan');
    expect(extractedText).toContain('First Ordered Note');
    expect(extractedText).toContain('Completed task');
    expect(extractedText).toContain('Pending task');
    expect(extractedText).toContain('Second Ordered Note');
    expect(extractedText).toContain('Col A');
    expect(extractedText).toContain('Val 2');
    expect(extractedText).toContain('console.log("hello pdf");');
    expect(extractedText.indexOf('First Ordered Note')).toBeLessThan(
      extractedText.indexOf('Second Ordered Note')
    );
  }, 30000);

  it('should generate a PDF from ordered database note IDs via POST /api/export/pdf preserving exact note sequence', async () => {
    const noteIdA = 'item-pdf-db-a';
    const noteIdB = 'item-pdf-db-b';
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO items (id, user_id, title, content, type, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'note', 0, ?, ?), (?, ?, ?, ?, 'note', 0, ?, ?)
    `).run(
      noteIdA, testUserId, 'Note Alpha', '- [x] Alpha item', now, now,
      noteIdB, testUserId, 'Note Beta', '- [ ] Beta item', now, now
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/export/pdf',
      payload: {
        notebookName: 'DB Ordered Export',
        ids: [noteIdB, noteIdA]
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment; filename="DB Ordered Export.pdf"');
    expect(res.rawPayload.subarray(0, 5).toString('utf8')).toBe('%PDF-');

    const extractedText = extractTextFromPdfBuffer(res.rawPayload);
    expect(extractedText).toContain('DB Ordered Export');
    expect(extractedText).toContain('Note Beta');
    expect(extractedText).toContain('Beta item');
    expect(extractedText).toContain('Note Alpha');
    expect(extractedText).toContain('Alpha item');
    // Verify Note Beta appears BEFORE Note Alpha in the rendered PDF
    expect(extractedText.indexOf('Note Beta')).toBeLessThan(extractedText.indexOf('Note Alpha'));

    db.prepare('DELETE FROM items WHERE id IN (?, ?)').run(noteIdA, noteIdB);
  }, 30000);

  it('should preserve nested TipTap taskList/taskItem states, tables, wikilinks, and inline local upload images', () => {
    // 1. Nested TipTap task list where parent is unchecked and child is checked
    const nestedTipTapHtml = `
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false">
          <p>Parent Unchecked</p>
          <ul data-type="taskList">
            <li data-type="taskItem" data-checked="true"><p>Child Checked</p></li>
          </ul>
        </li>
      </ul>
    `;
    const normalizedNested = normalizeAndSanitizeTipTapHtml(nestedTipTapHtml);
    expect(normalizedNested).toContain('data-type="taskList"');
    expect(normalizedNested).toContain('<li data-type="taskItem" data-checked="false"><label><input type="checkbox" disabled="disabled"><span></span></label><div>');
    expect(normalizedNested).toContain('<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked" disabled="disabled"><span></span></label><div><p>Child Checked</p></div></li>');

    // 2. Local /uploads/... image resolved to inline base64 data URI
    const samplePngName = `pdf-inline-test-${Date.now()}.png`;
    const samplePngPath = path.join(UPLOADS_DIR, samplePngName);
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    fs.writeFileSync(samplePngPath, tinyPng);

    try {
      const htmlWithImg = renderNoteSectionHtml({
        title: 'Rich Note',
        content: `See [[Architecture Spec|Arch Doc]]\n\n![Diagram](/uploads/${samplePngName})\n\n| Metric | Target |\n| --- | --- |\n| Latency | <100ms |`
      });
      expect(htmlWithImg).toContain('class="wikilink"');
      expect(htmlWithImg).toContain('data-wikilink="Architecture Spec"');
      expect(htmlWithImg).toContain('>Arch Doc</a>');
      expect(htmlWithImg).toContain('src="data:image/png;base64,');
      expect(htmlWithImg).toContain('<table>');
      expect(htmlWithImg).toContain('<th>Metric</th>');
      expect(htmlWithImg).toContain('<td>&lt;100ms</td>');
    } finally {
      try {
        fs.unlinkSync(samplePngPath);
      } catch {}
    }
  });

  it('should export an entire notebook by notebookId excluding archived notes and enforcing multi-tenant isolation', async () => {
    const nbId = 'nb-pdf-full-test';
    const otherUserId = 'usr-other-tenant';
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES (?, 'other_tenant', 'hash', 'member', ?, ?)
    `).run(otherUserId, now, now);

    db.prepare(`
      INSERT OR REPLACE INTO notebooks (id, user_id, name, color, icon, created_at, updated_at)
      VALUES (?, ?, 'Full Sprint Notebook', '#22c55e', 'book', ?, ?)
    `).run(nbId, testUserId, now, now);

    db.prepare(`
      INSERT OR REPLACE INTO items (id, user_id, notebook_id, title, content, type, is_pinned, is_archived, created_at, updated_at)
      VALUES
        ('nb-item-unpinned', ?, ?, 'Unpinned Second', 'Standard note body', 'note', 0, 0, ?, ?),
        ('nb-item-pinned', ?, ?, 'Pinned First', '| Col1 | Col2 |\n| --- | --- |\n| A1 | B1 |', 'note', 1, 0, ?, ?),
        ('nb-item-archived', ?, ?, 'Archived Secret', 'Should not be in PDF', 'note', 0, 1, ?, ?),
        ('nb-item-other-user', ?, ?, 'Other Tenant Private Note', 'Forbidden content', 'note', 0, 0, ?, ?)
    `).run(
      testUserId, nbId, now, now,
      testUserId, nbId, now, now,
      testUserId, nbId, now, now,
      otherUserId, nbId, now, now
    );

    try {
      // 1. Export by notebookId
      const res = await app.inject({
        method: 'POST',
        url: '/api/export/pdf',
        payload: { notebookId: nbId }
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-disposition']).toContain('attachment; filename="Full Sprint Notebook.pdf"');
      const pdfText = extractTextFromPdfBuffer(res.rawPayload);
      expect(pdfText).toContain('Full Sprint Notebook');
      expect(pdfText).toContain('Pinned First');
      expect(pdfText).toContain('Unpinned Second');
      expect(pdfText).not.toContain('Archived Secret');
      expect(pdfText).not.toContain('Other Tenant Private Note');
      expect(pdfText.indexOf('Pinned First')).toBeLessThan(pdfText.indexOf('Unpinned Second'));

      // 2. Attempting to export another user's private note via notes: [{ id }] or ids: [...] returns 400
      const idorRes1 = await app.inject({
        method: 'POST',
        url: '/api/export/pdf',
        payload: { notes: [{ id: 'nb-item-other-user' }] }
      });
      expect(idorRes1.statusCode).toBe(400);

      const idorRes2 = await app.inject({
        method: 'POST',
        url: '/api/export/pdf',
        payload: { ids: ['nb-item-other-user'] }
      });
      expect(idorRes2.statusCode).toBe(400);

      // 3. Read-only PAT is allowed to call POST /api/export/pdf
      expect(isPatRequestAllowed('POST', '/api/export/pdf', ['read']).ok).toBe(true);
    } finally {
      db.prepare("DELETE FROM items WHERE id IN ('nb-item-unpinned', 'nb-item-pinned', 'nb-item-archived', 'nb-item-other-user')").run();
      db.prepare('DELETE FROM notebooks WHERE id = ?').run(nbId);
      db.prepare('DELETE FROM users WHERE id = ?').run(otherUserId);
    }
  }, 30000);
});

