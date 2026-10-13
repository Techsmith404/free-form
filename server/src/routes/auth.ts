import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { hashPassword, verifyPassword, generateToken, hashToken, generateInviteCode } from '../services/auth.js';
import { FailureThrottle } from '../services/rateLimit.js';
import { User, UserWithPassword, Invite, Session, AuthStatusResponse, UserRole } from '../types/index.js';

const DUMMY_HASH = 'scrypt:' + '00'.repeat(16) + ':' + '00'.repeat(64);
const loginThrottle = new FailureThrottle(8, 15 * 60 * 1000); // 8 failures per 15m

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/auth/status - Public endpoint to check auth requirements
  fastify.get('/api/auth/status', async (request, reply): Promise<AuthStatusResponse> => {
    const accountsEnabled = process.env.ACCOUNTS_ENABLED === 'true';
    const authRequired = process.env.AUTH_REQUIRED === 'true' || accountsEnabled;

    const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
    const needsSetup = (accountsEnabled || authRequired) && userCount === 0;

    const currentUser = (request as any).user as User | undefined;

    return {
      accounts_enabled: accountsEnabled,
      auth_required: authRequired,
      needs_setup: needsSetup,
      authenticated: Boolean(currentUser),
      user: currentUser || null
    };
  });

  // POST /api/auth/setup - Initial owner account creation
  fastify.post('/api/auth/setup', async (request, reply) => {
    const { username, password, email } = (request.body as any) || {};
    const cleanUsername = username?.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      return reply.code(400).send({ error: 'Username must be at least 3 characters long' });
    }
    if (!password || password.length < 6) {
      return reply.code(400).send({ error: 'Password must be at least 6 characters long' });
    }

    const userId = `usr-${crypto.randomUUID()}`;
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    const created = db.transaction(() => {
      const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
      if (userCount > 0) {
        return false;
      }

      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'owner', ?, ?)
      `).run(userId, cleanUsername, email?.trim() || null, passwordHash, now, now);

      // Assign any legacy unassigned records to the new owner
      const tables = ['notebooks', 'items', 'templates', 'timers', 'reminders', 'tags'];
      for (const table of tables) {
        try {
          db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`).run(userId);
        } catch {}
      }
      return true;
    })();

    if (!created) {
      return reply.code(400).send({ error: 'Initial setup has already been completed' });
    }

    // Create session
    const token = generateToken();
    const tokenHash = hashToken(token);
    const sessionId = `ses-${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    db.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, user_agent, ip_address, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      userId,
      tokenHash,
      request.headers['user-agent'] || null,
      request.ip || null,
      expiresAt,
      now
    );

    reply.setCookie('ff_session', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60
    });

    return reply.code(201).send({
      token,
      user: {
        id: userId,
        username: cleanUsername,
        email: email?.trim() || undefined,
        role: 'owner',
        created_at: now,
        updated_at: now
      }
    });
  });

  // POST /api/auth/login
  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password, remember_me } = (request.body as any) || {};
    const cleanUsername = username?.trim().toLowerCase();
    if (!cleanUsername || !password) {
      return reply.code(400).send({ error: 'Username and password are required' });
    }

    const throttleKey = `${request.ip || 'unknown'}|${cleanUsername}`;
    const retryAfter = loginThrottle.retryAfterSeconds(throttleKey);
    if (retryAfter > 0) {
      reply.header('Retry-After', retryAfter.toString());
      return reply.code(429).send({
        error: `Too many failed login attempts. Please try again in ${retryAfter} seconds.`
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get(cleanUsername) as UserWithPassword | undefined;
    if (!user) {
      // Dummy check to prevent timing analysis
      await verifyPassword(password, DUMMY_HASH);
      loginThrottle.recordFailure(throttleKey);
      return reply.code(401).send({ error: 'Invalid username or password' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      loginThrottle.recordFailure(throttleKey);
      return reply.code(401).send({ error: 'Invalid username or password' });
    }

    loginThrottle.reset(throttleKey);

    const token = generateToken();
    const tokenHash = hashToken(token);
    const sessionId = `ses-${crypto.randomUUID()}`;
    const days = remember_me ? 90 : 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, user_agent, ip_address, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      user.id,
      tokenHash,
      request.headers['user-agent'] || null,
      request.ip || null,
      expiresAt,
      now
    );

    reply.setCookie('ff_session', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: days * 24 * 60 * 60
    });

    const safeUser: User = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    return { token, user: safeUser };
  });

  // POST /api/auth/register - Register using invite code
  fastify.post('/api/auth/register', async (request, reply) => {
    const { username, password, email, invite_code } = (request.body as any) || {};
    const cleanCode = invite_code?.trim().toUpperCase();
    if (!cleanCode) {
      return reply.code(400).send({ error: 'An invite code is required to register' });
    }

    const cleanUsername = username?.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      return reply.code(400).send({ error: 'Username must be at least 3 characters long' });
    }
    if (!password || password.length < 6) {
      return reply.code(400).send({ error: 'Password must be at least 6 characters long' });
    }

    // Quick pre-checks before password hashing
    const quickInvite = db.prepare('SELECT * FROM invites WHERE code = ?').get(cleanCode) as Invite | undefined;
    if (!quickInvite) {
      return reply.code(400).send({ error: 'Invalid invite code' });
    }
    if (quickInvite.expires_at && new Date(quickInvite.expires_at) < new Date()) {
      return reply.code(400).send({ error: 'This invite code has expired' });
    }
    if (quickInvite.max_uses > 0 && quickInvite.uses_count >= quickInvite.max_uses) {
      return reply.code(400).send({ error: 'This invite code has reached its maximum uses' });
    }
    const quickExisting = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(cleanUsername);
    if (quickExisting) {
      return reply.code(409).send({ error: 'Username is already taken' });
    }

    const userId = `usr-${crypto.randomUUID()}`;
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    let inviteRole: UserRole = 'member';
    try {
      db.transaction(() => {
        const invite = db.prepare('SELECT * FROM invites WHERE code = ?').get(cleanCode) as Invite | undefined;
        if (!invite) throw new Error('INVALID_INVITE');
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) throw new Error('EXPIRED_INVITE');
        if (invite.max_uses > 0 && invite.uses_count >= invite.max_uses) throw new Error('MAX_USES_REACHED');

        const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(cleanUsername);
        if (existing) throw new Error('USERNAME_TAKEN');

        inviteRole = invite.role || 'member';
        db.prepare(`
          INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, cleanUsername, email?.trim() || null, passwordHash, inviteRole, now, now);

        db.prepare(`
          UPDATE invites SET uses_count = uses_count + 1 WHERE code = ?
        `).run(cleanCode);
      })();
    } catch (err: any) {
      if (err.message === 'INVALID_INVITE') return reply.code(400).send({ error: 'Invalid invite code' });
      if (err.message === 'EXPIRED_INVITE') return reply.code(400).send({ error: 'This invite code has expired' });
      if (err.message === 'MAX_USES_REACHED') return reply.code(400).send({ error: 'This invite code has reached its maximum uses' });
      if (err.message === 'USERNAME_TAKEN') return reply.code(409).send({ error: 'Username is already taken' });
      throw err;
    }

    // Auto login after registration
    const token = generateToken();
    const tokenHash = hashToken(token);
    const sessionId = `ses-${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, user_agent, ip_address, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      userId,
      tokenHash,
      request.headers['user-agent'] || null,
      request.ip || null,
      expiresAt,
      now
    );

    reply.setCookie('ff_session', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60
    });

    const safeUser: User = {
      id: userId,
      username: cleanUsername,
      email: email?.trim() || undefined,
      role: inviteRole,
      created_at: now,
      updated_at: now
    };

    return reply.code(201).send({ token, user: safeUser });
  });

  // POST /api/auth/logout
  fastify.post('/api/auth/logout', async (request, reply) => {
    const rawToken = (request.cookies as any)?.ff_session || (request.headers.authorization?.replace(/^Bearer\s+/i, ''));
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    }
    reply.clearCookie('ff_session', { path: '/' });
    return { success: true };
  });

  // GET /api/auth/me
  fastify.get('/api/auth/me', async (request, reply) => {
    const user = (request as any).user as User | undefined;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    return user;
  });

  // --- Invite Management (Owner / Admin only) ---

  // GET /api/auth/invites
  fastify.get('/api/auth/invites', async (request, reply) => {
    const user = (request as any).user as User | undefined;
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
      return reply.code(403).send({ error: 'Only administrators can manage invite codes' });
    }

    const invites = db.prepare(`
      SELECT i.*, u.username as creator_name
      FROM invites i
      LEFT JOIN users u ON i.created_by = u.id
      ORDER BY i.created_at DESC
    `).all();

    return invites;
  });

  // POST /api/auth/invites
  fastify.post('/api/auth/invites', async (request, reply) => {
    const user = (request as any).user as User | undefined;
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
      return reply.code(403).send({ error: 'Only administrators can create invite codes' });
    }

    const { role = 'member', max_uses = 1, expires_in_days } = (request.body as any) || {};

    if (role !== 'member' && role !== 'admin') {
      return reply.code(400).send({ error: 'Invalid role. Only "member" and "admin" are permitted.' });
    }
    if (role === 'admin' && user.role !== 'owner') {
      return reply.code(403).send({ error: 'Only the server owner can create administrator invite codes' });
    }

    const parsedMaxUses = Number(max_uses);
    if (!Number.isInteger(parsedMaxUses) || parsedMaxUses < 0) {
      return reply.code(400).send({ error: 'max_uses must be a non-negative integer (0 for unlimited)' });
    }

    let parsedExpiresInDays: number | null = null;
    if (expires_in_days !== undefined && expires_in_days !== null && expires_in_days !== '') {
      parsedExpiresInDays = Number(expires_in_days);
      if (!Number.isFinite(parsedExpiresInDays) || parsedExpiresInDays <= 0) {
        return reply.code(400).send({ error: 'expires_in_days must be a positive number' });
      }
    }

    const code = generateInviteCode();
    const now = new Date().toISOString();
    const expiresAt = parsedExpiresInDays ? new Date(Date.now() + parsedExpiresInDays * 24 * 60 * 60 * 1000).toISOString() : null;

    db.prepare(`
      INSERT INTO invites (code, created_by, role, max_uses, uses_count, expires_at, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(code, user.id, role, parsedMaxUses, expiresAt, now);

    return reply.code(201).send({
      code,
      created_by: user.id,
      role,
      max_uses: parsedMaxUses,
      uses_count: 0,
      expires_at: expiresAt,
      created_at: now
    });
  });

  // DELETE /api/auth/invites/:code
  fastify.delete('/api/auth/invites/:code', async (request, reply) => {
    const user = (request as any).user as User | undefined;
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
      return reply.code(403).send({ error: 'Only administrators can revoke invite codes' });
    }

    const { code } = request.params as { code: string };
    const res = db.prepare('DELETE FROM invites WHERE code = ?').run(code.toUpperCase());
    if (res.changes === 0) {
      return reply.code(404).send({ error: 'Invite code not found' });
    }
    return { success: true, code: code.toUpperCase() };
  });

  // GET /api/auth/users (Owner / Admin only)
  fastify.get('/api/auth/users', async (request, reply) => {
    const user = (request as any).user as User | undefined;
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
      return reply.code(403).send({ error: 'Only administrators can view user list' });
    }

    const users = db.prepare(`
      SELECT id, username, email, role, created_at, updated_at
      FROM users
      ORDER BY created_at ASC
    `).all();

    return users;
  });
};

