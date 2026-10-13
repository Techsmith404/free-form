import crypto from 'crypto';
import { db } from '../db/index.js';
import { WebhookEvent } from '@free-form/shared';
import { isPersistedUserId } from './owner.js';

export interface WebhookPayload {
  event: WebhookEvent | 'ping';
  timestamp: string;
  data: unknown;
  user_id?: string | null;
}

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string;
}

const DELIVERY_TIMEOUT_MS = 5000;
/** Delay before retry #1 and #2 (so at most 3 attempts per event). */
const RETRY_DELAYS_MS = [1000, 5000];

/** Hex HMAC-SHA256 of the raw JSON body, sent as `X-FreeForm-Signature`. */
export function signPayload(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/** Does a webhook's comma-separated `events` filter match this event? */
export function matchesEvent(filter: string | null | undefined, event: string): boolean {
  const list = (filter || '*').split(',').map((e) => e.trim()).filter(Boolean);
  return list.includes('*') || list.includes(event);
}

/** Validate a user-supplied webhook URL (http/https only). Returns the normalised URL or null. */
export function normalizeWebhookUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function deliverWebhook(hook: Pick<WebhookRow, 'url' | 'secret'>, event: string, body: string): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(hook.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-FreeForm-Event': event,
      'X-FreeForm-Signature': signPayload(hook.secret, body),
      'User-Agent': 'FreeForm-Webhook-Engine/1.0'
    },
    body,
    // Never follow redirects: a signed payload must only ever go to the configured URL.
    redirect: 'manual',
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS)
  });
  return { ok: res.ok, status: res.status };
}

async function deliverWithRetry(hook: WebhookRow, event: string, body: string): Promise<void> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const { ok, status } = await deliverWebhook(hook, event, body);
      // 2xx = delivered. 4xx (except 408/429) is a permanent client error: don't hammer the endpoint.
      if (ok || (status >= 400 && status < 500 && status !== 408 && status !== 429)) return;
    } catch {
      // network error / timeout: fall through to retry
    }
    if (attempt < RETRY_DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  console.warn(`[webhook] delivery failed after retries: ${hook.name} (${event})`);
}

/**
 * Fire-and-forget dispatch of an event to every matching active webhook.
 * Hooks owned by `userId` plus unowned (global) hooks receive the event; hooks owned by
 * other users never do. Never throws.
 */
export function dispatchWebhookEvent(event: WebhookEvent, data: unknown, userId?: string | null): void {
  try {
    const owner = isPersistedUserId(userId) ? userId : null;
    const hooks = (owner
      ? db.prepare('SELECT id, name, url, secret, events FROM webhooks WHERE is_active = 1 AND (user_id = ? OR user_id IS NULL)').all(owner)
      : db.prepare('SELECT id, name, url, secret, events FROM webhooks WHERE is_active = 1 AND user_id IS NULL').all()) as WebhookRow[];

    const targets = hooks.filter((h) => matchesEvent(h.events, event));
    if (targets.length === 0) return;

    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data,
      user_id: owner
    } satisfies WebhookPayload);

    for (const hook of targets) {
      void deliverWithRetry(hook, event, body);
    }
  } catch {
    // The event bus must never break the request that triggered it.
  }
}
