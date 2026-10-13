import { db } from '../db/index.js';
import { hashToken } from './auth.js';
import { PAT_SYSTEM_USER_ID } from './owner.js';
import { User } from '../types/index.js';

export const PAT_PREFIX = 'ff_pat_';

export interface ResolvedPat {
  user: User;
  scopes: string[];
}

interface PatRow {
  id: string;
  name: string;
  scopes: string | null;
  created_at: string;
  user_id: string | null;
  username: string | null;
  email: string | null;
  role: string | null;
  u_created_at: string | null;
  u_updated_at: string | null;
}

/**
 * Resolve a Personal Access Token (`ff_pat_...`) to its owning user.
 * Returns null for unknown / expired tokens. Tokens without an owner (created while
 * authentication was disabled) map to a synthetic system user.
 */
export function resolvePat(rawToken: string | undefined | null): ResolvedPat | null {
  if (!rawToken || !rawToken.startsWith(PAT_PREFIX)) return null;

  const row = db.prepare(`
    SELECT p.id, p.name, p.scopes, p.created_at, p.user_id,
           u.username, u.email, u.role,
           u.created_at AS u_created_at, u.updated_at AS u_updated_at
    FROM api_tokens p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.token_hash = ? AND (p.expires_at IS NULL OR p.expires_at > ?)
  `).get(hashToken(rawToken), new Date().toISOString()) as PatRow | undefined;

  if (!row) return null;

  const scopes = (row.scopes || 'read,write').split(',').map((s) => s.trim()).filter(Boolean);

  if (row.user_id && row.username) {
    return {
      scopes,
      user: {
        id: row.user_id,
        username: row.username,
        email: row.email ?? undefined,
        role: (row.role as User['role']) || 'member',
        created_at: row.u_created_at || row.created_at,
        updated_at: row.u_updated_at || row.created_at
      }
    };
  }

  return {
    scopes,
    user: {
      id: PAT_SYSTEM_USER_ID,
      username: row.name || 'api-token',
      role: 'owner',
      created_at: row.created_at,
      updated_at: row.created_at
    }
  };
}

/**
 * Decide whether a PAT-authenticated request is allowed.
 * - Tokens can never manage tokens (prevents a leaked token minting more tokens).
 * - Mutating methods require the `write` scope.
 */
export function isPatRequestAllowed(method: string, pathname: string, scopes: string[]): { ok: true } | { ok: false; error: string } {
  if (pathname === '/api/tokens' || pathname.startsWith('/api/tokens/')) {
    return { ok: false, error: 'API tokens cannot manage other API tokens' };
  }
  const isRead = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  if (!isRead && !scopes.includes('write')) {
    return { ok: false, error: 'This token is read-only' };
  }
  return { ok: true };
}
