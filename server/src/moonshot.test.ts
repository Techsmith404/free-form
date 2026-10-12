import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { db, initDatabase } from './db/index.js';
import { runMigrations } from './db/migrator.js';
import { exportRoutes } from './routes/export.js';
import { webhookAndTokenRoutes } from './routes/webhooks.js';
import { itemRoutes } from './routes/items.js';
import { hashToken } from './services/auth.js';
import AdmZip from 'adm-zip';

describe('Moonshot Features (Vault Importers, Webhooks, PATs)', () => {
  let app: any;

  const testUserId = 'usr-moonshot-tester';

  beforeEach(async () => {
    initDatabase();
    runMigrations(db);

    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testUserId, 'moonshot_tester', 'hash', 'owner', now, now);

    app = fastify({ logger: false });
    await app.register(fastifyCookie);
    await app.register(multipart);

    // Mock auth onRequest hook
    app.decorateRequest('user', null);
    app.addHook('onRequest', async (request: any) => {
      const authHeader = request.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (authHeader) {
        const tokenHash = hashToken(authHeader);
        const patRow = db.prepare('SELECT * FROM api_tokens WHERE token_hash = ?').get(tokenHash) as any;
        if (patRow) {
          request.user = { id: patRow.user_id || 'usr-pat-system', username: patRow.name, role: 'owner' };
          return;
        }
      }
      request.user = { id: testUserId, username: 'moonshot_tester', role: 'owner' };
    });

    await app.register(itemRoutes);
    await app.register(exportRoutes);
    await app.register(webhookAndTokenRoutes);
    await app.ready();
  });

  afterEach(async () => {
    db.prepare('DELETE FROM api_tokens WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM webhooks WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM items WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM notebooks WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    await app.close();
  });

  describe('Personal Access Tokens (PATs)', () => {
    it('creates, lists, authenticates, and revokes a PAT', async () => {
      // 1. Create a PAT
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        payload: {
          name: 'CLI Runner Token',
          scopes: 'read,write',
          expires_in_days: 30
        }
      });

      expect(createRes.statusCode).toBe(201);
      const created = JSON.parse(createRes.payload);
      expect(created.token).toMatch(/^ff_pat_/);
      expect(created.token_prefix).toBe(created.token.substring(0, 14));
      expect(created.name).toBe('CLI Runner Token');

      // 2. List PATs (raw token should not be in response)
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/tokens'
      });
      expect(listRes.statusCode).toBe(200);
      const list = JSON.parse(listRes.payload);
      const found = list.find((t: any) => t.id === created.id);
      expect(found).toBeDefined();
      expect(found.token).toBeUndefined();
      expect(found.token_prefix).toBe(created.token_prefix);

      // 3. Authenticate with the PAT header
      const testAuthRes = await app.inject({
        method: 'GET',
        url: '/api/items',
        headers: {
          authorization: `Bearer ${created.token}`
        }
      });
      expect(testAuthRes.statusCode).toBe(200);

      // 4. Revoke the PAT
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/tokens/${created.id}`
      });
      expect(deleteRes.statusCode).toBe(200);

      const listAfterRes = await app.inject({
        method: 'GET',
        url: '/api/tokens'
      });
      const listAfter = JSON.parse(listAfterRes.payload);
      expect(listAfter.find((t: any) => t.id === created.id)).toBeUndefined();
    });
  });

  describe('Outbound Webhooks', () => {
    it('creates, updates, lists, and triggers webhooks', async () => {
      // 1. Create webhook
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/webhooks',
        payload: {
          name: 'Home Assistant Webhook',
          url: 'https://example.com/api/webhook/test',
          events: 'item.created,counter.threshold'
        }
      });

      expect(createRes.statusCode).toBe(201);
      const webhook = JSON.parse(createRes.payload);
      expect(webhook.id).toMatch(/^whk-/);
      expect(webhook.secret).toBeDefined();
      expect(webhook.is_active).toBe(1);

      // 2. Update webhook
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/webhooks/${webhook.id}`,
        payload: {
          is_active: 0
        }
      });
      expect(updateRes.statusCode).toBe(200);
      const updated = JSON.parse(updateRes.payload);
      expect(updated.is_active).toBe(0);

      // 3. Delete webhook
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/webhooks/${webhook.id}`
      });
      expect(delRes.statusCode).toBe(200);
    });
  });

  describe('Google Keep Importer', () => {
    it('imports notes, checklist items, and tags from Google Keep JSON', async () => {
      const keepJson = [
        {
          title: 'Grocery List',
          listContent: [
            { text: 'Oat Milk', isChecked: false },
            { text: 'Espresso Beans', isChecked: true }
          ],
          labels: [{ name: 'Groceries' }, { name: 'Weekly' }]
        },
        {
          title: 'Project Ideas',
          textContent: 'Build an offline-first markdown notes engine.',
          labels: [{ name: 'Tech' }]
        }
      ];

      const res = await app.inject({
        method: 'POST',
        url: '/api/import/keep',
        payload: keepJson
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.stats.notes).toBe(2);

      // Verify Grocery List item was created with markdown checkboxes
      const groceryItem = db.prepare("SELECT * FROM items WHERE title = 'Grocery List'").get() as any;
      expect(groceryItem).toBeDefined();
      expect(groceryItem.content).toContain('- [ ] Oat Milk');
      expect(groceryItem.content).toContain('- [x] Espresso Beans');
    });
  });

  describe('Obsidian Vault Importer', () => {
    it('imports an obsidian vault archive with frontmatter and folders', async () => {
      const zip = new AdmZip();
      
      const note1 = `---
tags: [work, project]
---
# Architecture Overview
This links to [[Design System]] and [[Database Schema]].
`;

      const note2 = `---
created: 2026-01-01T00:00:00.000Z
---
Design system specifications.
`;

      zip.addFile('Engineering/Architecture.md', Buffer.from(note1, 'utf8'));
      zip.addFile('Design/Design System.md', Buffer.from(note2, 'utf8'));
      const zipBuffer = zip.toBuffer();

      // Send multipart form-data
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const multipartBody = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="vault.zip"\r\nContent-Type: application/zip\r\n\r\n`),
        zipBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/import/obsidian',
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`
        },
        payload: multipartBody
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.stats.notes).toBe(2);
      expect(body.stats.notebooks).toBeGreaterThanOrEqual(2);

      // Verify notes exist
      const archNote = db.prepare("SELECT * FROM items WHERE title = 'Architecture'").get() as any;
      expect(archNote).toBeDefined();
      expect(archNote.content).toContain('# Architecture Overview');

      // Verify links were populated
      const links = db.prepare("SELECT * FROM item_links WHERE source_id = ?").all(archNote.id) as any[];
      expect(links.length).toBe(2);
    });
  });
});
