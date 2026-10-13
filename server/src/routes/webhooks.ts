import { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { hashToken, generateToken } from '../services/auth.js';
import { ownerIdOf } from '../services/owner.js';
import { PAT_PREFIX } from '../services/tokens.js';
import { deliverWebhook, normalizeWebhookUrl } from '../services/webhook.js';
import { WebhookEventSchema } from '@free-form/shared';

const VALID_EVENTS = new Set<string>(WebhookEventSchema.options);
const VALID_SCOPES = new Set(['read', 'write']);

/**
 * A row may be managed by its owner. Unowned rows (created while authentication was
 * disabled, or by a legacy install) are managed by the unowned "user" (single-user mode)
 * or by an owner/admin account.
 */
function canManage(rowOwner: string | null, request: FastifyRequest): boolean {
  const me = ownerIdOf(request);
  if (rowOwner === me) return true;
  if (rowOwner === null) {
    const role = (request as any).user?.role;
    return role === 'owner' || role === 'admin';
  }
  return false;
}

/** Parse an `events` input (array or comma list) into a validated, de-duplicated CSV. */
function parseEvents(input: unknown): string | null {
  const list = (Array.isArray(input) ? input : String(input ?? '*').split(','))
    .map((e) => String(e).trim())
    .filter(Boolean);
  if (list.length === 0) return '*';
  if (!list.every((e) => VALID_EVENTS.has(e))) return null;
  return Array.from(new Set(list)).join(',');
}

export async function webhookAndTokenRoutes(fastify: FastifyInstance) {
  // ==========================================
  // PERSONAL ACCESS TOKENS (PATs)
  // ==========================================

  // List PATs (never exposes the raw token or its hash)
  fastify.get('/api/tokens', async (request) => {
    const rows = db.prepare(
      'SELECT id, user_id, name, token_prefix, scopes, created_at, expires_at FROM api_tokens ORDER BY created_at DESC'
    ).all() as Array<{ user_id: string | null } & Record<string, unknown>>;
    return rows.filter((r) => canManage(r.user_id, request));
  });

  // Create a PAT. The raw token is returned exactly once.
  fastify.post('/api/tokens', async (request, reply) => {
    const { name, scopes, expires_in_days } = (request.body as any) || {};

    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || cleanName.length > 80) {
      return reply.code(400).send({ error: 'Token name is required (max 80 characters)' });
    }

    const scopeList = String(scopes ?? 'read,write').split(',').map((s) => s.trim()).filter(Boolean);
    if (scopeList.length === 0 || !scopeList.every((s) => VALID_SCOPES.has(s))) {
      return reply.code(400).send({ error: 'Scopes must be a comma list of: read, write' });
    }

    let expiresAt: string | null = null;
    if (expires_in_days !== undefined && expires_in_days !== null && expires_in_days !== '') {
      const days = Number(expires_in_days);
      if (!Number.isFinite(days) || days <= 0 || days > 3650) {
        return reply.code(400).send({ error: 'expires_in_days must be between 1 and 3650' });
      }
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }

    const id = `pat-${crypto.randomUUID()}`;
    const token = `${PAT_PREFIX}${generateToken(24)}`;
    const tokenPrefix = token.substring(0, 14);
    const now = new Date().toISOString();
    const scopeCsv = scopeList.join(',');

    db.prepare(`
      INSERT INTO api_tokens (id, user_id, name, token_hash, token_prefix, scopes, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, ownerIdOf(request), cleanName, hashToken(token), tokenPrefix, scopeCsv, now, expiresAt);

    return reply.code(201).send({
      id,
      name: cleanName,
      token,
      token_prefix: tokenPrefix,
      scopes: scopeCsv,
      created_at: now,
      expires_at: expiresAt
    });
  });

  // Revoke a PAT
  fastify.delete('/api/tokens/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = db.prepare('SELECT user_id FROM api_tokens WHERE id = ?').get(id) as { user_id: string | null } | undefined;
    if (!row || !canManage(row.user_id, request)) {
      return reply.code(404).send({ error: 'Token not found' });
    }
    db.prepare('DELETE FROM api_tokens WHERE id = ?').run(id);
    return { success: true, id };
  });

  // ==========================================
  // OUTBOUND WEBHOOKS
  // ==========================================

  // List webhooks (secrets are never returned after creation)
  fastify.get('/api/webhooks', async (request) => {
    const rows = db.prepare(
      'SELECT id, user_id, name, url, events, is_active, created_at, updated_at FROM webhooks ORDER BY created_at DESC'
    ).all() as Array<{ user_id: string | null } & Record<string, unknown>>;
    return rows.filter((r) => canManage(r.user_id, request));
  });

  // Create webhook (the signing secret is returned exactly once)
  fastify.post('/api/webhooks', async (request, reply) => {
    const { name, url, secret, events } = (request.body as any) || {};

    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || cleanName.length > 80) {
      return reply.code(400).send({ error: 'Webhook name is required (max 80 characters)' });
    }
    const cleanUrl = normalizeWebhookUrl(url);
    if (!cleanUrl) {
      return reply.code(400).send({ error: 'A valid http(s) URL is required' });
    }
    const cleanEvents = parseEvents(events);
    if (!cleanEvents) {
      return reply.code(400).send({ error: `Unknown event. Valid events: ${Array.from(VALID_EVENTS).join(', ')}` });
    }
    const providedSecret = typeof secret === 'string' ? secret.trim() : '';
    if (providedSecret && providedSecret.length < 8) {
      return reply.code(400).send({ error: 'Secret must be at least 8 characters (or leave blank to auto-generate)' });
    }

    const id = `whk-${crypto.randomUUID()}`;
    const cleanSecret = providedSecret || generateToken(24);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO webhooks (id, user_id, name, url, secret, events, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, ownerIdOf(request), cleanName, cleanUrl, cleanSecret, cleanEvents, now, now);

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

  // Update webhook (set `secret` to rotate it; the new secret is echoed back once)
  fastify.put('/api/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, url, secret, events, is_active } = (request.body as any) || {};

    const existing = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id) as any;
    if (!existing || !canManage(existing.user_id, request)) {
      return reply.code(404).send({ error: 'Webhook not found' });
    }

    let nextName = existing.name;
    if (name !== undefined) {
      nextName = typeof name === 'string' ? name.trim() : '';
      if (!nextName || nextName.length > 80) {
        return reply.code(400).send({ error: 'Webhook name must be 1-80 characters' });
      }
    }

    let nextUrl = existing.url;
    if (url !== undefined) {
      const normalized = normalizeWebhookUrl(url);
      if (!normalized) return reply.code(400).send({ error: 'A valid http(s) URL is required' });
      nextUrl = normalized;
    }

    let nextEvents = existing.events;
    if (events !== undefined) {
      const parsed = parseEvents(events);
      if (!parsed) return reply.code(400).send({ error: 'Unknown event in events list' });
      nextEvents = parsed;
    }

    let nextSecret = existing.secret;
    let rotatedSecret: string | undefined;
    if (secret !== undefined) {
      const s = typeof secret === 'string' ? secret.trim() : '';
      if (s.length < 8) return reply.code(400).send({ error: 'Secret must be at least 8 characters' });
      nextSecret = s;
      rotatedSecret = s;
    }

    const active = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE webhooks
      SET name = ?, url = ?, secret = ?, events = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(nextName, nextUrl, nextSecret, nextEvents, active, now, id);

    return {
      id,
      name: nextName,
      url: nextUrl,
      events: nextEvents,
      is_active: active,
      updated_at: now,
      ...(rotatedSecret ? { secret: rotatedSecret } : {})
    };
  });

  // Delete webhook
  fastify.delete('/api/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = db.prepare('SELECT user_id FROM webhooks WHERE id = ?').get(id) as { user_id: string | null } | undefined;
    if (!row || !canManage(row.user_id, request)) {
      return reply.code(404).send({ error: 'Webhook not found' });
    }
    db.prepare('DELETE FROM webhooks WHERE id = ?').run(id);
    return { success: true, id };
  });

  // Send a signed test ping
  fastify.post('/api/webhooks/:id/test', async (request, reply) => {
    const { id } = request.params as { id: string };
    const hook = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id) as any;
    if (!hook || !canManage(hook.user_id, request)) {
      return reply.code(404).send({ error: 'Webhook not found' });
    }

    const body = JSON.stringify({
      event: 'ping',
      timestamp: new Date().toISOString(),
      data: { message: 'Free Form Webhook Test Ping', webhook_id: id },
      user_id: hook.user_id || null
    });

    try {
      const { ok, status } = await deliverWebhook(hook, 'ping', body);
      return { success: ok, status };
    } catch (err: any) {
      return reply.code(502).send({ error: 'Failed to deliver webhook ping', message: err?.message || 'Network error' });
    }
  });
}
