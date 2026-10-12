import crypto from 'crypto';
import { db } from '../db/index.js';
import { hashToken } from './auth.js';
import { Webhook, WebhookEvent } from '@free-form/shared';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
  user_id?: string | null;
}

/**
 * Dispatches an event to all matching active webhooks asynchronously
 */
export async function dispatchWebhookEvent(
  event: WebhookEvent,
  data: any,
  userId?: string | null
): Promise<void> {
  try {
    const webhooks = (userId
      ? db.prepare('SELECT * FROM webhooks WHERE is_active = 1 AND (user_id = ? OR user_id IS NULL)').all(userId)
      : db.prepare('SELECT * FROM webhooks WHERE is_active = 1').all()) as Webhook[];

    if (!webhooks || webhooks.length === 0) return;

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      user_id: userId || null
    };

    const payloadJson = JSON.stringify(payload);

    for (const hook of webhooks) {
      // Check event match: '*' matches everything, or comma-separated list
      const eventList = hook.events ? hook.events.split(',').map((e) => e.trim()) : ['*'];
      if (!eventList.includes('*') && !eventList.includes(event)) {
        continue;
      }

      // Compute HMAC-SHA256 signature
      const signature = crypto
        .createHmac('sha256', hook.secret)
        .update(payloadJson)
        .digest('hex');

      // Dispatch non-blocking HTTP request
      fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-FreeForm-Event': event,
          'X-FreeForm-Signature': signature,
          'User-Agent': 'FreeForm-Webhook-Engine/1.0'
        },
        body: payloadJson,
        signal: AbortSignal.timeout(5000)
      }).catch((err) => {
        // Silently capture failure or log debug info without crashing
        // In production, background delivery failures shouldn't crash the server
      });
    }
  } catch (err) {
    // Fail silently in event bus
  }
}
