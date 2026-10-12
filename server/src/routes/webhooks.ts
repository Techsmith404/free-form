import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { hashToken, generateToken } from '../services/auth.js';
import { ApiToken, Webhook } from '@free-form/shared';

export async function webhookAndTokenRoutes(fastify: FastifyInstance) {
  // ==========================================
  // PERSONAL ACCESS TOKENS (PATs)
  // ==========================================

  // List user's PATs (never exposes raw token or token_hash)
  fastify.get('/api/tokens', async (request) => {
    const userId = (request as any).user?.id;
    const tokens = (userId
      ? db.prepare('SELECT id, user_id, name, token_prefix, scopes, created_at, expires_at FROM api_tokens WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC').all(userId)
      : db.prepare('SELECT id, user_id, name, token_prefix, scopes, created_at, expires_at FROM api_tokens ORDER BY created_at DESC').all()) as ApiToken[];

    return tokens;
  });

  // Create a new PAT (only returns the raw token ONCE upon creation)
  fastify.post('/api/tokens', async (request, reply) => {
    const userId = (request as any).user?.id || null;
    const { name, scopes, expires_in_days } = (request.body as any) || {};

    const cleanName = (name || '').trim();
    if (!cleanName) {
      return reply.code(400).send({ error: 'Token name is required' });
    }

    const id = `pat-${crypto.randomUUID()}`;
    const rawSecret = generateToken(24);
    const token = `ff_pat_${rawSecret}`;
    const tokenPrefix = token.substring(0, 14); // e.g. ff_pat_a1b2c3d4
    const tokenHash = hashToken(token);
    const now = new Date().toISOString();

    let expiresAt: string | null = null;
    if (expires_in_days && Number(expires_in_days) > 0) {
      expiresAt = new Date(Date.now() + Number(expires_in_days) * 24 * 60 * 60 * 1000).toISOString();
    }

    db.prepare(`
      INSERT INTO api_tokens (id, user_id, name, token_hash, token_prefix, scopes, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, cleanName, tokenHash, tokenPrefix, scopes || 'read,write', now, expiresAt);

    return reply.code(201).send({
      id,
      name: cleanName,
      token, // Raw token shown only this once
      token_prefix: tokenPrefix,
      scopes: scopes || 'read,write',
      created_at: now,
      expires_at: expiresAt
    });
  });

  // Revoke / delete a PAT
  fastify.delete('/api/tokens/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.id;

    const res = userId
      ? db.prepare('DELETE FROM api_tokens WHERE id = ? AND (user_id = ? OR user_id IS NULL)').run(id, userId)
      : db.prepare('DELETE FROM api_tokens WHERE id = ?').run(id);

    if (res.changes === 0) {
      return reply.code(404).send({ error: 'Token not found' });
    }

    return { success: true, id };
  });

  // ==========================================
  // OUTBOUND WEBHOOKS
  // ==========================================

  // List webhooks
  fastify.get('/api/webhooks', async (request) => {
    const userId = (request as any).user?.id;
    const hooks = (userId
      ? db.prepare('SELECT id, user_id, name, url, events, is_active, created_at, updated_at FROM webhooks WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC').all(userId)
      : db.prepare('SELECT id, user_id, name, url, events, is_active, created_at, updated_at FROM webhooks ORDER BY created_at DESC').all()) as Webhook[];

    return hooks;
  });

  // Create webhook
  fastify.post('/api/webhooks', async (request, reply) => {
    const userId = (request as any).user?.id || null;
    const { name, url, secret, events } = (request.body as any) || {};

    const cleanName = (name || '').trim();
    const cleanUrl = (url || '').trim();
    if (!cleanName) {
      return reply.code(400).send({ error: 'Webhook name is required' });
    }
    if (!cleanUrl || (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://'))) {
      return reply.code(400).send({ error: 'Valid HTTP/HTTPS URL is required' });
    }

    const id = `whk-${crypto.randomUUID()}`;
    const cleanSecret = (secret || '').trim() || generateToken(16);
    const cleanEvents = Array.isArray(events) ? events.join(',') : (events || '*');
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO webhooks (id, user_id, name, url, secret, events, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, userId, cleanName, cleanUrl, cleanSecret, cleanEvents, now, now);

    return reply.code(201).send({
      id,
      name: cleanName,
      url: cleanUrl,
      secret: cleanSecret,
      events: cleanEvents,
      is_active: 1,
      created_at: now,
      updated_at: now
    });
  });

  // Update webhook
  fastify.put('/api/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.id;
    const { name, url, secret, events, is_active } = (request.body as any) || {};

    const existing = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id) as any;
    if (!existing) {
      return reply.code(404).send({ error: 'Webhook not found' });
    }

    const cleanName = name !== undefined ? String(name).trim() : existing.name;
    const cleanUrl = url !== undefined ? String(url).trim() : existing.url;
    const cleanSecret = secret !== undefined ? String(secret).trim() : existing.secret;
    const cleanEvents = events !== undefined ? (Array.isArray(events) ? events.join(',') : String(events)) : existing.events;
    const active = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE webhooks
      SET name = ?, url = ?, secret = ?, events = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(cleanName, cleanUrl, cleanSecret, cleanEvents, active, now, id);

    return {
      id,
      name: cleanName,
      url: cleanUrl,
      secret: cleanSecret,
      events: cleanEvents,
      is_active: active,
      updated_at: now
    };
  });

  // Delete webhook
  fastify.delete('/api/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.id;

    const res = userId
      ? db.prepare('DELETE FROM webhooks WHERE id = ? AND (user_id = ? OR user_id IS NULL)').run(id, userId)
      : db.prepare('DELETE FROM webhooks WHERE id = ?').run(id);

    if (res.changes === 0) {
      return reply.code(404).send({ error: 'Webhook not found' });
    }

    return { success: true, id };
  });

  // Test webhook ping
  fastify.post('/api/webhooks/:id/test', async (request, reply) => {
    const { id } = request.params as { id: string };
    const hook = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id) as any;
    if (!hook) {
      return reply.code(404).send({ error: 'Webhook not found' });
    }

    const testPayload = JSON.stringify({
      event: 'ping',
      timestamp: new Date().toISOString(),
      data: { message: 'Free Form Webhook Test Ping', webhook_id: id },
      user_id: hook.user_id || null
    });

    const signature = crypto
      .createHmac('sha256', hook.secret)
      .update(testPayload)
      .digest('hex');

    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-FreeForm-Event': 'ping',
          'X-FreeForm-Signature': signature,
          'User-Agent': 'FreeForm-Webhook-Engine/1.0'
        },
        body: testPayload,
        signal: AbortSignal.timeout(5000)
      });

      return {
        success: res.ok,
        status: res.status,
        statusText: res.statusText
      };
    } catch (err: any) {
      return reply.code(502).send({
        error: 'Failed to deliver webhook ping',
        message: err.message
      });
    }
  });
}
