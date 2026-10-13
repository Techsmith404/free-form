import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { db, initDatabase } from './db/index.js';
import { runMigrations } from './db/migrator.js';
import { webhookAndTokenRoutes } from './routes/webhooks.js';
import { itemRoutes } from './routes/items.js';
import { parseFrontmatter, isIgnoredVaultPath, keepUsecToIso, convertKeepNote } from './services/importers.js';
import { ownerIdOf, isPersistedUserId, DEFAULT_USER_ID } from './services/owner.js';
import { resolvePat, isPatRequestAllowed } from './services/tokens.js';
import { FailureThrottle } from './services/rateLimit.js';
import { sanitizeSvg, IMAGE_EXTENSIONS } from './services/svg.js';
import { hashToken } from './services/auth.js';

describe('Code Review Audit Verifications', () => {
  describe('Importers Service (importers.ts)', () => {
    it('parses frontmatter with YAML block lists, inline lists, and handles BOM/CRLF', () => {
      const markdown = `\uFEFF---
title: "Deep Work"
tags:
  - focus
  - productivity
created: 2026-03-15T10:00:00.000Z
---
# Deep Work
Content starts here.`;

      const { frontmatter, content } = parseFrontmatter(markdown);
      expect(frontmatter.title).toBe('Deep Work');
      expect(frontmatter.tags).toEqual(['focus', 'productivity']);
      expect(content).toContain('Content starts here.');
    });

    it('correctly ignores dot-folders and macOS junk paths in vaults', () => {
      expect(isIgnoredVaultPath('.obsidian/workspace.json')).toBe(true);
      expect(isIgnoredVaultPath('.trash/deleted.md')).toBe(true);
      expect(isIgnoredVaultPath('__MACOSX/._note.md')).toBe(true);
      expect(isIgnoredVaultPath('.DS_Store')).toBe(true);
      expect(isIgnoredVaultPath('Work/Projects/Alpha.md')).toBe(false);
      expect(isIgnoredVaultPath('Journal 2026.md')).toBe(false);
    });

    it('converts Google Keep microseconds timestamps accurately', () => {
      const usec = 1710500000000000;
      const iso = keepUsecToIso(usec);
      expect(iso).toBe(new Date(1710500000000).toISOString());
      expect(keepUsecToIso(undefined)).toBeDefined();
    });

    it('converts Google Keep notes with checklists, tags, and trashed status', () => {
      const keepNote = {
        title: 'Project Roadmap',
        textContent: 'Main goals for Q2',
        isTrashed: true,
        labels: [{ name: 'Strategy' }, { name: 'FreeForm' }],
        listContent: [
          { text: 'Ship v0.3.0', isChecked: true },
          { text: 'Write release notes', isChecked: false }
        ]
      };

      const converted = convertKeepNote(keepNote);
      expect(converted).not.toBeNull();
      expect(converted!.title).toBe('Project Roadmap');
      expect(converted!.isTrashed).toBe(true);
      expect(converted!.labels).toEqual(['Strategy', 'FreeForm']);
      expect(converted!.content).toContain('- [x] Ship v0.3.0');
      expect(converted!.content).toContain('- [ ] Write release notes');
    });
  });

  describe('Owner Identification & No-Auth FK Safety (owner.ts)', () => {
    it('returns null ownerId for synthetic usr-default user to prevent FK constraint failures', () => {
      const mockNoAuthRequest = {
        user: { id: DEFAULT_USER_ID, username: 'default', role: 'owner' }
      } as any;

      const ownerId = ownerIdOf(mockNoAuthRequest);
      expect(ownerId).toBeNull();
      expect(isPersistedUserId(DEFAULT_USER_ID)).toBe(false);
    });

    it('returns valid string user ID for real persisted users', () => {
      const mockAuthRequest = {
        user: { id: 'usr-real-uuid-1234', username: 'alice', role: 'owner' }
      } as any;

      const ownerId = ownerIdOf(mockAuthRequest);
      expect(ownerId).toBe('usr-real-uuid-1234');
      expect(isPersistedUserId('usr-real-uuid-1234')).toBe(true);
    });
  });

  describe('Personal Access Token Scoping & Permissions (tokens.ts)', () => {
    it('blocks PAT tokens from accessing token management endpoints', () => {
      const res = isPatRequestAllowed('GET', '/api/tokens', ['read', 'write']);
      expect(res.ok).toBe(false);
      expect((res as any).error).toContain('cannot manage other API tokens');

      const resSub = isPatRequestAllowed('DELETE', '/api/tokens/tok-123', ['read', 'write']);
      expect(resSub.ok).toBe(false);
    });

    it('allows read requests with read scope and blocks write requests with read-only scope', () => {
      const readRes = isPatRequestAllowed('GET', '/api/items', ['read']);
      expect(readRes.ok).toBe(true);

      const postRes = isPatRequestAllowed('POST', '/api/items', ['read']);
      expect(postRes.ok).toBe(false);
      expect((postRes as any).error).toContain('read-only');

      const deleteRes = isPatRequestAllowed('DELETE', '/api/items/123', ['read']);
      expect(deleteRes.ok).toBe(false);

      const writeRes = isPatRequestAllowed('POST', '/api/items', ['read', 'write']);
      expect(writeRes.ok).toBe(true);
    });
  });

  describe('Failure Throttling (rateLimit.ts)', () => {
    it('throttles after threshold failures and resets upon success', () => {
      const throttle = new FailureThrottle(3, 10000);
      const key = '127.0.0.1|attacker';

      expect(throttle.retryAfterSeconds(key)).toBe(0);
      throttle.recordFailure(key);
      expect(throttle.retryAfterSeconds(key)).toBe(0);
      throttle.recordFailure(key);
      expect(throttle.retryAfterSeconds(key)).toBe(0);
      throttle.recordFailure(key);
      // Now 3 failures reached
      expect(throttle.retryAfterSeconds(key)).toBeGreaterThan(0);

      throttle.reset(key);
      expect(throttle.retryAfterSeconds(key)).toBe(0);
    });
  });

  describe('SVG Sanitization & MIME Allowlist (svg.ts)', () => {
    it('strips script tags and onload attributes from SVG content', () => {
      const dangerousSvg = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert('XSS')">
        <script>alert(1)</script>
        <circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" />
      </svg>`;

      const cleanSvg = sanitizeSvg(dangerousSvg);
      expect(cleanSvg).not.toContain('<script');
      expect(cleanSvg).not.toContain('onload');
      expect(cleanSvg).toContain('<circle');
    });

    it('validates safe image extension mappings', () => {
      expect(IMAGE_EXTENSIONS['image/png']).toBe('.png');
      expect(IMAGE_EXTENSIONS['image/jpeg']).toBe('.jpg');
      expect(IMAGE_EXTENSIONS['image/svg+xml']).toBe('.svg');
      expect(IMAGE_EXTENSIONS['image/webp']).toBe('.webp');
      expect(IMAGE_EXTENSIONS['text/html']).toBeUndefined();
    });
  });

  describe('Webhooks Security: Secret Omission & IDOR Isolation', () => {
    let app: any;
    const userA = 'usr-audittest-user-a';
    const userB = 'usr-audittest-user-b';

    beforeEach(async () => {
      initDatabase();
      runMigrations(db);

      const now = new Date().toISOString();
      db.prepare('INSERT OR REPLACE INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userA, 'usera', 'hash', 'member', now, now);
      db.prepare('INSERT OR REPLACE INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userB, 'userb', 'hash', 'member', now, now);

      app = fastify({ logger: false });
      await app.register(fastifyCookie);

      app.decorateRequest('user', null);
      let currentUser = userA;
      app.addHook('onRequest', async (req: any) => {
        req.user = { id: req.headers['x-test-user'] || currentUser, username: 'testuser', role: 'member' };
      });

      await app.register(webhookAndTokenRoutes);
      await app.ready();
    });

    afterEach(async () => {
      db.prepare('DELETE FROM webhooks WHERE user_id IN (?, ?)').run(userA, userB);
      db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userA, userB);
      await app.close();
    });

    it('does not expose webhook secrets in GET /api/webhooks', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/webhooks',
        headers: { 'x-test-user': userA },
        payload: {
          name: 'My Automation',
          url: 'https://example.com/webhook',
          events: '*'
        }
      });

      expect(createRes.statusCode).toBe(201);
      const created = JSON.parse(createRes.payload);
      expect(created.secret).toBeDefined();

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/webhooks',
        headers: { 'x-test-user': userA }
      });

      expect(listRes.statusCode).toBe(200);
      const list = JSON.parse(listRes.payload);
      const found = list.find((h: any) => h.id === created.id);
      expect(found).toBeDefined();
      expect(found.secret).toBeUndefined();
    });

    it('prevents User B from deleting or testing User A webhook (IDOR prevention)', async () => {
      // User A creates webhook
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/webhooks',
        headers: { 'x-test-user': userA },
        payload: {
          name: 'User A Webhook',
          url: 'https://example.com/webhook-a',
          events: '*'
        }
      });
      const hook = JSON.parse(createRes.payload);

      // User B tries to delete User A's webhook
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/webhooks/${hook.id}`,
        headers: { 'x-test-user': userB }
      });
      expect(deleteRes.statusCode).toBe(404);

      // User B tries to trigger test ping on User A's webhook
      const testRes = await app.inject({
        method: 'POST',
        url: `/api/webhooks/${hook.id}/test`,
        headers: { 'x-test-user': userB }
      });
      expect(testRes.statusCode).toBe(404);
    });
  });
});
