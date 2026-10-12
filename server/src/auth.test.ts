import crypto from 'crypto';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { db, initDatabase } from './db/index.js';
import { authRoutes } from './routes/auth.js';
import { itemRoutes } from './routes/items.js';
import { hashToken } from './services/auth.js';
import { addClient, broadcast, getClientCount } from './services/realtime.js';
import { User } from './types/index.js';

describe('Authentication & Multi-User Partitioning', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    initDatabase();
    app = fastify();
    await app.register(fastifyCookie);

    // Auth hook mimicking index.ts
    app.decorateRequest('user', null);
    app.addHook('onRequest', async (request, reply) => {
      const authRequired = process.env.AUTH_REQUIRED === 'true';
      const token = (request.cookies as any)?.ff_session || request.headers.authorization?.replace(/^Bearer\s+/i, '');
      let resolvedUser: User | null = null;

      if (token) {
        const tokenHash = hashToken(token);
        const sessionRow = db.prepare(`
          SELECT s.*, u.id as user_id, u.username, u.email, u.role, u.created_at, u.updated_at
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.token_hash = ? AND s.expires_at > ?
        `).get(tokenHash, new Date().toISOString()) as any;

        if (sessionRow) {
          resolvedUser = {
            id: sessionRow.user_id,
            username: sessionRow.username,
            email: sessionRow.email,
            role: sessionRow.role,
            created_at: sessionRow.created_at,
            updated_at: sessionRow.updated_at
          };
        }
      }

      // Check reverse-proxy forward auth headers if TRUST_FORWARD_AUTH is enabled
      const trustForwardAuth = process.env.TRUST_FORWARD_AUTH === 'true';
      if (trustForwardAuth && !resolvedUser) {
        const forwardUserHeader =
          (request.headers['remote-user'] as string) ||
          (request.headers['x-forwarded-user'] as string) ||
          (request.headers['remote-preferred-username'] as string);

        if (forwardUserHeader && typeof forwardUserHeader === 'string' && forwardUserHeader.trim()) {
          const username = forwardUserHeader.trim();
          const forwardEmail =
            (request.headers['remote-email'] as string) ||
            (request.headers['x-forwarded-email'] as string) ||
            '';

          let userRow = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
          if (!userRow) {
            const userCount = (db.prepare('SELECT count(*) as c FROM users').get() as any)?.c || 0;
            const role = userCount === 0 ? 'owner' : 'member';
            const newUserId = `usr-${crypto.randomBytes(8).toString('hex')}`;
            const now = new Date().toISOString();
            db.prepare(`
              INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(newUserId, username, forwardEmail || null, 'FORWARD_AUTH_NO_PASSWORD', role, now, now);
            userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId) as any;
          }

          if (userRow) {
            resolvedUser = {
              id: userRow.id,
              username: userRow.username,
              email: userRow.email,
              role: userRow.role,
              created_at: userRow.created_at,
              updated_at: userRow.updated_at
            };
          }
        }
      }

      if (!resolvedUser && !authRequired) {
        resolvedUser = {
          id: 'usr-default',
          username: 'default',
          role: 'owner',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      (request as any).user = resolvedUser;

      const pathname = request.url.split('?')[0];
      const isPublic = pathname.startsWith('/api/auth') || pathname === '/api/health';
      if (authRequired && !resolvedUser && !isPublic) {
        return reply.code(401).send({ error: 'Authentication required' });
      }
    });

    await app.register(authRoutes);
    await app.register(itemRoutes);
    await app.ready();
  });

  it('should complete initial owner setup', async () => {
    // Clean any test users and sessions
    db.prepare('DELETE FROM sessions').run();
    db.prepare('DELETE FROM invites').run();
    db.prepare('DELETE FROM users').run();

    const checkStatus = await app.inject({ method: 'GET', url: '/api/auth/status' });
    const statusData = JSON.parse(checkStatus.payload);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: {
        username: 'owner_user',
        password: 'password123',
        email: 'owner@example.com'
      }
    });

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.payload);
    expect(data.token).toBeDefined();
    expect(data.user.role).toBe('owner');
    expect(data.user.username).toBe('owner_user');
  });

  it('should reject registration without a valid invite code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'uninvited_guest',
        password: 'password123',
        invite_code: 'INVALID-CODE'
      }
    });

    expect(res.statusCode).toBe(400);
    const data = JSON.parse(res.payload);
    expect(data.error).toContain('Invalid invite code');
  });

  it('should allow owner to create invite code and register a new user', async () => {
    // Log in as owner
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'owner_user',
        password: 'password123'
      }
    });
    expect(loginRes.statusCode).toBe(200);
    const ownerToken = JSON.parse(loginRes.payload).token;

    // Create invite
    const inviteRes = await app.inject({
      method: 'POST',
      url: '/api/auth/invites',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { role: 'member', max_uses: 1 }
    });
    expect(inviteRes.statusCode).toBe(201);
    const inviteData = JSON.parse(inviteRes.payload);
    expect(inviteData.code).toBeDefined();

    // Register with invite
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'family_member',
        password: 'password123',
        invite_code: inviteData.code
      }
    });
    expect(regRes.statusCode).toBe(201);
    const memberData = JSON.parse(regRes.payload);
    expect(memberData.user.username).toBe('family_member');
    expect(memberData.user.role).toBe('member');
  });

  it('should isolate user items between accounts', async () => {
    // Login as owner
    const ownerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'owner_user', password: 'password123' }
    });
    const ownerToken = JSON.parse(ownerLogin.payload).token;

    // Owner creates an item
    const ownerItemRes = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { title: 'Owner Private Note', type: 'note', content: 'Secret Content' }
    });
    expect(ownerItemRes.statusCode).toBe(201);
    const ownerItem = JSON.parse(ownerItemRes.payload);

    // Login as family_member
    const memberLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'family_member', password: 'password123' }
    });
    const memberToken = JSON.parse(memberLogin.payload).token;

    // Family member lists items -> should NOT see owner's private note
    const memberItemsRes = await app.inject({
      method: 'GET',
      url: '/api/items',
      headers: { authorization: `Bearer ${memberToken}` }
    });
    const memberItems = JSON.parse(memberItemsRes.payload);
    const found = memberItems.find((i: any) => i.id === ownerItem.id);
    expect(found).toBeUndefined();

    // Clean up test user & item data
    db.prepare('DELETE FROM items WHERE id = ?').run(ownerItem.id);
    db.prepare("DELETE FROM users WHERE username IN ('owner_user', 'family_member')").run();
  });

  it('should auto-provision and authenticate users when TRUST_FORWARD_AUTH is enabled', async () => {
    process.env.TRUST_FORWARD_AUTH = 'true';
    process.env.AUTH_REQUIRED = 'true';

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/status',
        headers: {
          'remote-user': 'proxy_alice',
          'remote-email': 'alice@domain.org'
        }
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.authenticated).toBe(true);
      expect(data.user.username).toBe('proxy_alice');
      expect(data.user.email).toBe('alice@domain.org');

      // Verify user was stored in SQLite
      const userInDb = db.prepare('SELECT * FROM users WHERE username = ?').get('proxy_alice') as any;
      expect(userInDb).toBeDefined();
      expect(userInDb.username).toBe('proxy_alice');

      // Subsequent request retains same user id
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/auth/status',
        headers: {
          'remote-user': 'proxy_alice'
        }
      });
      const data2 = JSON.parse(res2.payload);
      expect(data2.user.id).toBe(userInDb.id);

      // Clean up
      db.prepare('DELETE FROM users WHERE username = ?').run('proxy_alice');
    } finally {
      delete process.env.TRUST_FORWARD_AUTH;
      delete process.env.AUTH_REQUIRED;
    }
  });

  it('should partition WebSocket clients and route broadcasts only to targeted user', () => {
    const aliceWs: any = {
      readyState: 1, // WebSocket.OPEN
      send: vi.fn(),
      on: vi.fn(),
    };
    const bobWs: any = {
      readyState: 1,
      send: vi.fn(),
      on: vi.fn(),
    };

    addClient(aliceWs, 'usr-alice');
    addClient(bobWs, 'usr-bob');

    expect(getClientCount('usr-alice')).toBe(1);
    expect(getClientCount('usr-bob')).toBe(1);

    // Broadcast targeted to alice
    broadcast({ type: 'TIMER_UPDATED', payload: { id: 'tim-1' } } as any, 'usr-alice');
    expect(aliceWs.send).toHaveBeenCalled();
    const aliceCalls = aliceWs.send.mock.calls;
    expect(aliceCalls.some((c: any) => typeof c[0] === 'string' && c[0].includes('TIMER_UPDATED'))).toBe(true);

    // bob should not have received alice's targeted event
    const bobCalls = bobWs.send.mock.calls;
    expect(bobCalls.some((c: any) => typeof c[0] === 'string' && c[0].includes('TIMER_UPDATED'))).toBe(false);
  });
});

