import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { db, initDatabase } from './db/index.js';
import { exportRoutes } from './routes/export.js';
import AdmZip from 'adm-zip';

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
});
