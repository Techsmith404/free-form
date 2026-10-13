/**
 * Ownership helpers.
 *
 * When authentication is disabled (single-user mode) the global auth hook attaches a
 * synthetic `usr-default` user to every request so that scoped reads keep working.
 * That user has no row in the `users` table, so it must NEVER be written into a
 * `user_id` foreign-key column (doing so fails with SQLITE_CONSTRAINT_FOREIGNKEY).
 */

export const DEFAULT_USER_ID = 'usr-default';
export const PAT_SYSTEM_USER_ID = 'usr-pat-system';

const SYNTHETIC_USER_IDS = new Set([DEFAULT_USER_ID, PAT_SYSTEM_USER_ID]);

/** True when the id belongs to a real row in `users` (i.e. safe to use as a foreign key). */
export function isPersistedUserId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id.length > 0 && !SYNTHETIC_USER_IDS.has(id);
}

/** The id to persist in `user_id` columns for this request (null for unowned / single-user data). */
export function ownerIdOf(request: unknown): string | null {
  const id = (request as { user?: { id?: string } } | null | undefined)?.user?.id;
  return isPersistedUserId(id) ? id : null;
}
