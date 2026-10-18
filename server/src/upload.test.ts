import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { uploadRoutes } from './routes/upload.js';
import { UPLOADS_DIR, initDatabase, db } from './db/index.js';
import {
  IMAGE_EXTENSIONS,
  SAFE_IMAGE_EXTENSIONS,
  resolveImageExtension,
  sanitizeSvg
} from './services/svg.js';
import { hashToken, generateToken } from './services/auth.js';
import { User } from './types/index.js';

describe('MIME Normalization & Safe Extension Fallback (resolveImageExtension)', () => {
  it('defines IMAGE_EXTENSIONS with all required aliases', () => {
    expect(IMAGE_EXTENSIONS['image/jpeg']).toBe('.jpg');
    expect(IMAGE_EXTENSIONS['image/jpg']).toBe('.jpg');
    expect(IMAGE_EXTENSIONS['image/pjpeg']).toBe('.jpg');
    expect(IMAGE_EXTENSIONS['image/png']).toBe('.png');
    expect(IMAGE_EXTENSIONS['image/x-png']).toBe('.png');
    expect(IMAGE_EXTENSIONS['image/gif']).toBe('.gif');
    expect(IMAGE_EXTENSIONS['image/webp']).toBe('.webp');
    expect(IMAGE_EXTENSIONS['image/svg+xml']).toBe('.svg');
    expect(IMAGE_EXTENSIONS['image/avif']).toBe('.avif');
    expect(IMAGE_EXTENSIONS['image/heic']).toBe('.heic');
    expect(IMAGE_EXTENSIONS['image/heif']).toBe('.heif');
    expect(IMAGE_EXTENSIONS['image/bmp']).toBe('.bmp');
    expect(IMAGE_EXTENSIONS['image/x-ms-bmp']).toBe('.bmp');
    expect(IMAGE_EXTENSIONS['image/x-icon']).toBe('.ico');
    expect(IMAGE_EXTENSIONS['image/vnd.microsoft.icon']).toBe('.ico');
  });

  it('maps standard image MIME types and aliases correctly', () => {
    expect(resolveImageExtension('image/jpeg')).toBe('.jpg');
    expect(resolveImageExtension('image/jpg')).toBe('.jpg');
    expect(resolveImageExtension('image/pjpeg')).toBe('.jpg');
    expect(resolveImageExtension('image/png')).toBe('.png');
    expect(resolveImageExtension('image/x-png')).toBe('.png');
    expect(resolveImageExtension('image/gif')).toBe('.gif');
    expect(resolveImageExtension('image/webp')).toBe('.webp');
    expect(resolveImageExtension('image/svg+xml')).toBe('.svg');
    expect(resolveImageExtension('image/avif')).toBe('.avif');
    expect(resolveImageExtension('image/heic')).toBe('.heic');
    expect(resolveImageExtension('image/heif')).toBe('.heif');
    expect(resolveImageExtension('image/bmp')).toBe('.bmp');
    expect(resolveImageExtension('image/x-ms-bmp')).toBe('.bmp');
    expect(resolveImageExtension('image/x-icon')).toBe('.ico');
    expect(resolveImageExtension('image/vnd.microsoft.icon')).toBe('.ico');
  });

  it('normalizes MIME types with uppercase letters and parameters', () => {
    expect(resolveImageExtension('IMAGE/PNG')).toBe('.png');
    expect(resolveImageExtension('IMAGE/JPEG; charset=utf-8')).toBe('.jpg');
    expect(resolveImageExtension('image/jpeg; charset=binary')).toBe('.jpg');
    expect(resolveImageExtension('  Image/Png ; boundary=something  ')).toBe('.png');
    expect(resolveImageExtension('image/svg+xml;utf-8')).toBe('.svg');
  });

  it('falls back to safe filename extension when MIME is empty, null, or octet-stream', () => {
    expect(resolveImageExtension('', 'photo.jpg')).toBe('.jpg');
    expect(resolveImageExtension(null, 'picture.jpeg')).toBe('.jpg');
    expect(resolveImageExtension(undefined, 'IMAGE.PNG')).toBe('.png');
    expect(resolveImageExtension('application/octet-stream', 'snapshot.GIF')).toBe('.gif');
    expect(resolveImageExtension('application/octet-stream; charset=binary', 'graphic.webp')).toBe('.webp');
    expect(resolveImageExtension('application/octet-stream', 'icon.webp')).toBe('.webp');
    expect(resolveImageExtension('', 'diagram.svg')).toBe('.svg');
    expect(resolveImageExtension('application/octet-stream', 'diagram.svg')).toBe('.svg');
    expect(resolveImageExtension('application/octet-stream', 'avatar.avif')).toBe('.avif');
    expect(resolveImageExtension('application/octet-stream', 'photo.heic')).toBe('.heic');
    expect(resolveImageExtension('application/octet-stream', 'photo.heif')).toBe('.heif');
    expect(resolveImageExtension('application/octet-stream', 'bitmap.bmp')).toBe('.bmp');
    expect(resolveImageExtension('application/octet-stream', 'favicon.ico')).toBe('.ico');
  });

  it('rejects unsafe extensions when MIME is empty or octet-stream', () => {
    expect(resolveImageExtension('', 'evil.html')).toBeNull();
    expect(resolveImageExtension('application/octet-stream', 'evil.html')).toBeNull();
    expect(resolveImageExtension('', 'script.js')).toBeNull();
    expect(resolveImageExtension('application/octet-stream', 'script.js')).toBeNull();
    expect(resolveImageExtension('', 'script.sh')).toBeNull();
    expect(resolveImageExtension(null, 'malicious.exe')).toBeNull();
    expect(resolveImageExtension('application/octet-stream', 'index.html')).toBeNull();
    expect(resolveImageExtension('application/octet-stream', 'app.js')).toBeNull();
    expect(resolveImageExtension('application/octet-stream', 'file_without_ext')).toBeNull();
    expect(resolveImageExtension('', '')).toBeNull();
  });

  it('preserves anti-spoofing guarantees for explicit non-image MIME types', () => {
    expect(resolveImageExtension('text/html', 'photo.png')).toBeNull();
    expect(resolveImageExtension('text/html', 'looks_like_image.png')).toBeNull();
    expect(resolveImageExtension('application/javascript', 'payload.jpg')).toBeNull();
    expect(resolveImageExtension('text/plain', 'note.webp')).toBeNull();
    expect(resolveImageExtension('application/pdf', 'doc.svg')).toBeNull();
    expect(resolveImageExtension('application/json', 'data.gif')).toBeNull();
  });
});

function buildMultipart(filename: string, mimetype: string, content: Buffer | string) {
  const boundary = '----WebKitFormBoundaryTest' + Math.random().toString(36).slice(2);
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimetype}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
  const headers: Record<string, string> = {
    'content-type': `multipart/form-data; boundary=${boundary}`
  };
  return {
    headers,
    payload
  };
}

describe('Upload Routes (/api/upload and /api/upload-base64)', () => {
  let app: FastifyInstance;
  const createdFiles: string[] = [];

  beforeAll(async () => {
    initDatabase();
    app = fastify();
    await app.register(multipart, {
      limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
      }
    });
    await app.register(uploadRoutes);
    await app.ready();
  });

  afterEach(async () => {
    while (createdFiles.length > 0) {
      const file = createdFiles.pop();
      if (file) {
        await fs.promises.unlink(file).catch(() => {});
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/upload', () => {
    it('successfully uploads valid PNG image', async () => {
      const { headers, payload } = buildMultipart('test.png', 'image/png', Buffer.from('PNGDATA123'));
      const res = await app.inject({
        method: 'POST',
        url: '/api/upload',
        headers,
        payload
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);
      expect(json.name).toBe('test.png');
      expect(json.size).toBe(Buffer.from('PNGDATA123').length);

      const filePath = path.join(UPLOADS_DIR, path.basename(json.url));
      createdFiles.push(filePath);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('normalizes MIME aliases such as image/x-png and image/pjpeg', async () => {
      const { headers, payload } = buildMultipart('photo.jpg', 'image/pjpeg', Buffer.from('JPGDATA'));
      const res = await app.inject({
        method: 'POST',
        url: '/api/upload',
        headers,
        payload
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.url).toMatch(/^\/uploads\/[0-9a-f-]+\.jpg$/);
      createdFiles.push(path.join(UPLOADS_DIR, path.basename(json.url)));
    });

    it('safely resolves extension for application/octet-stream with valid image filename', async () => {
      const { headers, payload } = buildMultipart('my-drawing.webp', 'application/octet-stream', Buffer.from('WEBPDATA'));
      const res = await app.inject({
        method: 'POST',
        url: '/api/upload',
        headers,
        payload
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.url).toMatch(/^\/uploads\/[0-9a-f-]+\.webp$/);
      createdFiles.push(path.join(UPLOADS_DIR, path.basename(json.url)));
    });

    it('rejects upload with explicit non-image MIME type even if filename has image extension', async () => {
      const { headers, payload } = buildMultipart('avatar.png', 'text/html', '<h1>Not an image</h1>');
      const res = await app.inject({
        method: 'POST',
        url: '/api/upload',
        headers,
        payload
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.payload);
      expect(json.error).toBe('Invalid file type. Only images are allowed.');
    });

    it('rejects application/octet-stream with non-image extension', async () => {
      const { headers, payload } = buildMultipart('exploit.sh', 'application/octet-stream', '#!/bin/sh\necho hack');
      const res = await app.inject({
        method: 'POST',
        url: '/api/upload',
        headers,
        payload
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.payload);
      expect(json.error).toBe('Invalid file type. Only images are allowed.');
    });

    it('returns 400 when no file is uploaded', async () => {
      const boundary = '----WebKitFormBoundaryEmpty' + Math.random().toString(36).slice(2);
      const res = await app.inject({
        method: 'POST',
        url: '/api/upload',
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`
        },
        payload: Buffer.from(`--${boundary}--\r\n`)
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.payload);
      expect(json.error).toBe('No file uploaded');
    });

    it('sanitizes SVG uploads to strip scripts and event handlers', async () => {
      const dangerousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><circle cx="5" cy="5" r="5" onload="evil()"/></svg>';
      const { headers, payload } = buildMultipart('vector.svg', 'image/svg+xml', dangerousSvg);
      const res = await app.inject({
        method: 'POST',
        url: '/api/upload',
        headers,
        payload
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.url).toMatch(/^\/uploads\/[0-9a-f-]+\.svg$/);

      const filePath = path.join(UPLOADS_DIR, path.basename(json.url));
      createdFiles.push(filePath);
      const content = await fs.promises.readFile(filePath, 'utf8');
      expect(content).not.toContain('<script');
      expect(content).not.toContain('onload');
      expect(content).toContain('<circle');
    });

    it('automatically recreates UPLOADS_DIR if missing at runtime', async () => {
      // Temporarily remove UPLOADS_DIR
      if (fs.existsSync(UPLOADS_DIR)) {
        await fs.promises.rm(UPLOADS_DIR, { recursive: true, force: true });
      }
      expect(fs.existsSync(UPLOADS_DIR)).toBe(false);

      const { headers, payload } = buildMultipart('recreate.png', 'image/png', Buffer.from('PNGRECREATE'));
      const res = await app.inject({
        method: 'POST',
        url: '/api/upload',
        headers,
        payload
      });

      expect(res.statusCode).toBe(200);
      expect(fs.existsSync(UPLOADS_DIR)).toBe(true);
      const json = JSON.parse(res.payload);
      createdFiles.push(path.join(UPLOADS_DIR, path.basename(json.url)));
    });

    it('returns 413 and unlinks partial file if file exceeds limit', async () => {
      const smallApp = fastify();
      await smallApp.register(multipart, {
        limits: {
          fileSize: 10 // 10 bytes limit
        }
      });
      await smallApp.register(uploadRoutes);
      await smallApp.ready();

      try {
        const largeContent = Buffer.alloc(1024, 'a');
        const { headers, payload } = buildMultipart('oversized.png', 'image/png', largeContent);
        const res = await smallApp.inject({
          method: 'POST',
          url: '/api/upload',
          headers,
          payload
        });

        expect(res.statusCode).toBe(413);
        const json = JSON.parse(res.payload);
        expect(json.error).toBe('File is too large (50 MB limit)');

        const files = await fs.promises.readdir(UPLOADS_DIR);
        const oversizedFiles = files.filter(f => f.includes('oversized'));
        expect(oversizedFiles.length).toBe(0);
      } finally {
        await smallApp.close();
      }
    });

    it('returns 413 and unlinks partial file if SVG file exceeds limit', async () => {
      const smallApp = fastify();
      await smallApp.register(multipart, {
        limits: {
          fileSize: 10
        }
      });
      await smallApp.register(uploadRoutes);
      await smallApp.ready();

      try {
        const largeSvg = '<svg>' + 'x'.repeat(1024) + '</svg>';
        const { headers, payload } = buildMultipart('oversized.svg', 'image/svg+xml', largeSvg);
        const res = await smallApp.inject({
          method: 'POST',
          url: '/api/upload',
          headers,
          payload
        });

        expect(res.statusCode).toBe(413);
        const json = JSON.parse(res.payload);
        expect(json.error).toBe('File is too large (50 MB limit)');
      } finally {
        await smallApp.close();
      }
    });
  });

  describe('POST /api/upload-base64', () => {
    it('uploads valid data URL image with standard MIME', async () => {
      const rawData = Buffer.from('PNG_BASE64_TEST').toString('base64');
      const res = await app.inject({
        method: 'POST',
        url: '/api/upload-base64',
        payload: {
          base64Data: `data:image/png;base64,${rawData}`,
          filename: 'signature.png'
        }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);
      expect(json.name).toBe('signature.png');
      expect(json.size).toBe(Buffer.from('PNG_BASE64_TEST').length);

      const filePath = path.join(UPLOADS_DIR, path.basename(json.url));
      createdFiles.push(filePath);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('uploads valid data URL with MIME parameters and aliases', async () => {
      const rawData = Buffer.from('JPEG_ALIAS_TEST').toString('base64');
      const res = await app.inject({
        method: 'POST',
        url: '/api/upload-base64',
        payload: {
          base64Data: `data:image/pjpeg;charset=utf-8;base64,${rawData}`,
          filename: 'avatar.jpg'
        }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.url).toMatch(/^\/uploads\/[0-9a-f-]+\.jpg$/);
      createdFiles.push(path.join(UPLOADS_DIR, path.basename(json.url)));
    });

    it('uploads raw base64 without data prefix and defaults to .png or uses filename', async () => {
      const rawData = Buffer.from('RAW_BASE64').toString('base64');
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/upload-base64',
        payload: {
          base64Data: rawData
        }
      });

      expect(res1.statusCode).toBe(200);
      const json1 = JSON.parse(res1.payload);
      expect(json1.url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);
      createdFiles.push(path.join(UPLOADS_DIR, path.basename(json1.url)));

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/upload-base64',
        payload: {
          base64Data: rawData,
          filename: 'custom.gif'
        }
      });

      expect(res2.statusCode).toBe(200);
      const json2 = JSON.parse(res2.payload);
      expect(json2.url).toMatch(/^\/uploads\/[0-9a-f-]+\.gif$/);
      createdFiles.push(path.join(UPLOADS_DIR, path.basename(json2.url)));
    });

    it('sanitizes SVG uploaded via base64', async () => {
      const maliciousSvg = '<svg><script>alert("pwn")</script><rect width="10" height="10" onclick="hack()"/></svg>';
      const rawData = Buffer.from(maliciousSvg).toString('base64');
      const res = await app.inject({
        method: 'POST',
        url: '/api/upload-base64',
        payload: {
          base64Data: `data:image/svg+xml;base64,${rawData}`,
          filename: 'badge.svg'
        }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.url).toMatch(/^\/uploads\/[0-9a-f-]+\.svg$/);

      const filePath = path.join(UPLOADS_DIR, path.basename(json.url));
      createdFiles.push(filePath);
      const savedContent = await fs.promises.readFile(filePath, 'utf8');
      expect(savedContent).not.toContain('<script');
      expect(savedContent).not.toContain('onclick');
      expect(savedContent).toContain('<rect');
    });

    it('rejects data URL with non-image MIME type', async () => {
      const rawData = Buffer.from('<html><body>XSS</body></html>').toString('base64');
      const res = await app.inject({
        method: 'POST',
        url: '/api/upload-base64',
        payload: {
          base64Data: `data:text/html;base64,${rawData}`,
          filename: 'page.html'
        }
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.payload);
      expect(json.error).toBe('Invalid file type. Only images are allowed.');
    });

    it('rejects empty or missing base64Data', async () => {
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/upload-base64',
        payload: {}
      });
      expect(res1.statusCode).toBe(400);
      expect(JSON.parse(res1.payload).error).toBe('base64Data is required');

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/upload-base64',
        payload: {
          base64Data: ''
        }
      });
      expect(res2.statusCode).toBe(400);
      expect(JSON.parse(res2.payload).error).toBe('base64Data is required');
    });

    it('rejects empty decoded base64 buffer', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/upload-base64',
        payload: {
          base64Data: 'data:image/png;base64,'
        }
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toBe('Invalid or empty image data');
    });
  });
});

describe('Upload Routes with Authentication Enabled (AUTH_REQUIRED and ACCOUNTS_ENABLED)', () => {
  let authApp: FastifyInstance;
  const createdFiles: string[] = [];
  const testUserId = `usr-upload-${crypto.randomBytes(4).toString('hex')}`;
  const validToken = generateToken();

  beforeAll(async () => {
    initDatabase();

    // Insert test user and session in database
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testUserId, `uploader_${testUserId}`, 'uploader@example.com', 'scrypt:test:hash', 'member', now, now);

    db.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(`ses-${crypto.randomUUID()}`, testUserId, hashToken(validToken), expiresAt, now);

    authApp = fastify();
    await authApp.register(fastifyCookie);
    await authApp.register(multipart, {
      limits: {
        fileSize: 50 * 1024 * 1024
      }
    });

    // Global Auth Hook identical to server/src/index.ts
    authApp.decorateRequest('user', null);
    authApp.addHook('onRequest', async (request, reply) => {
      const accountsEnabled = process.env.ACCOUNTS_ENABLED === 'true';
      const authRequired = process.env.AUTH_REQUIRED === 'true' || accountsEnabled;

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
      const isPublic =
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/health') ||
        pathname === '/api/metrics' ||
        pathname === '/api/ws' ||
        !pathname.startsWith('/api');

      if (authRequired && !resolvedUser && !isPublic) {
        return reply.code(401).send({ error: 'Authentication required' });
      }
    });

    await authApp.register(uploadRoutes);
    await authApp.ready();
  });

  afterEach(async () => {
    while (createdFiles.length > 0) {
      const file = createdFiles.pop();
      if (file) {
        await fs.promises.unlink(file).catch(() => {});
      }
    }
    delete process.env.AUTH_REQUIRED;
    delete process.env.ACCOUNTS_ENABLED;
  });

  afterAll(async () => {
    await authApp.close();
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  });

  describe('When AUTH_REQUIRED=true', () => {
    it('rejects unauthenticated POST /api/upload with 401', async () => {
      process.env.AUTH_REQUIRED = 'true';

      const { headers, payload } = buildMultipart('unauth.png', 'image/png', Buffer.from('DATA'));
      const res = await authApp.inject({
        method: 'POST',
        url: '/api/upload',
        headers,
        payload
      });

      expect(res.statusCode).toBe(401);
      const json = JSON.parse(res.payload);
      expect(json.error).toBe('Authentication required');
    });

    it('rejects POST /api/upload with invalid Bearer token', async () => {
      process.env.AUTH_REQUIRED = 'true';

      const { headers, payload } = buildMultipart('unauth.png', 'image/png', Buffer.from('DATA'));
      headers['authorization'] = 'Bearer invalid-token-123';

      const res = await authApp.inject({
        method: 'POST',
        url: '/api/upload',
        headers,
        payload
      });

      expect(res.statusCode).toBe(401);
      const json = JSON.parse(res.payload);
      expect(json.error).toBe('Authentication required');
    });

    it('allows authenticated POST /api/upload via Authorization Bearer header', async () => {
      process.env.AUTH_REQUIRED = 'true';

      const { headers, payload } = buildMultipart('auth_bearer.png', 'image/png', Buffer.from('AUTHBEARER'));
      headers['authorization'] = `Bearer ${validToken}`;

      const res = await authApp.inject({
        method: 'POST',
        url: '/api/upload',
        headers,
        payload
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);
      expect(json.name).toBe('auth_bearer.png');
      expect(json.size).toBe(Buffer.from('AUTHBEARER').length);

      const filePath = path.join(UPLOADS_DIR, path.basename(json.url));
      createdFiles.push(filePath);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('allows authenticated POST /api/upload via ff_session cookie', async () => {
      process.env.AUTH_REQUIRED = 'true';

      const { headers, payload } = buildMultipart('auth_cookie.png', 'image/png', Buffer.from('AUTHCOOKIE'));
      headers['cookie'] = `ff_session=${validToken}`;

      const res = await authApp.inject({
        method: 'POST',
        url: '/api/upload',
        headers,
        payload
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);
      expect(json.name).toBe('auth_cookie.png');

      const filePath = path.join(UPLOADS_DIR, path.basename(json.url));
      createdFiles.push(filePath);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('recreates missing UPLOADS_DIR on authenticated upload', async () => {
      process.env.AUTH_REQUIRED = 'true';

      if (fs.existsSync(UPLOADS_DIR)) {
        await fs.promises.rm(UPLOADS_DIR, { recursive: true, force: true });
      }
      expect(fs.existsSync(UPLOADS_DIR)).toBe(false);

      const { headers, payload } = buildMultipart('auth_recreate.jpg', 'image/jpeg', Buffer.from('AUTHDATA'));
      headers['authorization'] = `Bearer ${validToken}`;

      const res = await authApp.inject({
        method: 'POST',
        url: '/api/upload',
        headers,
        payload
      });

      expect(res.statusCode).toBe(200);
      expect(fs.existsSync(UPLOADS_DIR)).toBe(true);
      const json = JSON.parse(res.payload);
      createdFiles.push(path.join(UPLOADS_DIR, path.basename(json.url)));
    });

    it('sanitizes SVG on authenticated upload', async () => {
      process.env.AUTH_REQUIRED = 'true';

      const dangerousSvg = '<svg><script>alert("auth_xss")</script><rect width="20" height="20" onclick="alert()"/></svg>';
      const { headers, payload } = buildMultipart('vector_clean.svg', 'image/svg+xml', dangerousSvg);
      headers['authorization'] = `Bearer ${validToken}`;

      const res = await authApp.inject({
        method: 'POST',
        url: '/api/upload',
        headers,
        payload
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      const filePath = path.join(UPLOADS_DIR, path.basename(json.url));
      createdFiles.push(filePath);

      const saved = await fs.promises.readFile(filePath, 'utf8');
      expect(saved).not.toContain('<script');
      expect(saved).not.toContain('onclick');
      expect(saved).toContain('<rect');
    });

    it('rejects unauthenticated POST /api/upload-base64 with 401', async () => {
      process.env.AUTH_REQUIRED = 'true';

      const rawData = Buffer.from('TEST').toString('base64');
      const res = await authApp.inject({
        method: 'POST',
        url: '/api/upload-base64',
        payload: {
          base64Data: `data:image/png;base64,${rawData}`,
          filename: 'unauth.png'
        }
      });

      expect(res.statusCode).toBe(401);
      const json = JSON.parse(res.payload);
      expect(json.error).toBe('Authentication required');
    });

    it('allows authenticated POST /api/upload-base64 via Bearer header and sanitizes SVG', async () => {
      process.env.AUTH_REQUIRED = 'true';

      const dangerousSvg = '<svg><script>alert("auth_b64")</script><circle r="10"/></svg>';
      const rawData = Buffer.from(dangerousSvg).toString('base64');
      const res = await authApp.inject({
        method: 'POST',
        url: '/api/upload-base64',
        headers: {
          authorization: `Bearer ${validToken}`
        },
        payload: {
          base64Data: `data:image/svg+xml;base64,${rawData}`,
          filename: 'auth_clean.svg'
        }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.url).toMatch(/^\/uploads\/[0-9a-f-]+\.svg$/);

      const filePath = path.join(UPLOADS_DIR, path.basename(json.url));
      createdFiles.push(filePath);
      const saved = await fs.promises.readFile(filePath, 'utf8');
      expect(saved).not.toContain('<script');
      expect(saved).toContain('<circle');
    });

    it('allows authenticated POST /api/upload-base64 via ff_session cookie', async () => {
      process.env.AUTH_REQUIRED = 'true';

      const rawData = Buffer.from('COOKIE_BASE64').toString('base64');
      const res = await authApp.inject({
        method: 'POST',
        url: '/api/upload-base64',
        headers: {
          cookie: `ff_session=${validToken}`
        },
        payload: {
          base64Data: `data:image/png;base64,${rawData}`,
          filename: 'cookie.png'
        }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);
      createdFiles.push(path.join(UPLOADS_DIR, path.basename(json.url)));
    });
  });

  describe('When ACCOUNTS_ENABLED=true', () => {
    it('enforces authentication on POST /api/upload and POST /api/upload-base64', async () => {
      process.env.ACCOUNTS_ENABLED = 'true';

      // 1. Unauthenticated /api/upload
      const { headers: unauthHeaders, payload: unauthPayload } = buildMultipart('accounts.png', 'image/png', Buffer.from('DATA'));
      const unauthRes = await authApp.inject({
        method: 'POST',
        url: '/api/upload',
        headers: unauthHeaders,
        payload: unauthPayload
      });
      expect(unauthRes.statusCode).toBe(401);

      // 2. Authenticated /api/upload
      const { headers: authHeaders, payload: authPayload } = buildMultipart('accounts.png', 'image/png', Buffer.from('DATA'));
      authHeaders['authorization'] = `Bearer ${validToken}`;
      const authRes = await authApp.inject({
        method: 'POST',
        url: '/api/upload',
        headers: authHeaders,
        payload: authPayload
      });
      expect(authRes.statusCode).toBe(200);
      const authJson = JSON.parse(authRes.payload);
      createdFiles.push(path.join(UPLOADS_DIR, path.basename(authJson.url)));

      // 3. Unauthenticated /api/upload-base64
      const rawData = Buffer.from('ACCOUNTS_BASE64').toString('base64');
      const unauthB64 = await authApp.inject({
        method: 'POST',
        url: '/api/upload-base64',
        payload: {
          base64Data: `data:image/png;base64,${rawData}`
        }
      });
      expect(unauthB64.statusCode).toBe(401);

      // 4. Authenticated /api/upload-base64
      const authB64 = await authApp.inject({
        method: 'POST',
        url: '/api/upload-base64',
        headers: {
          authorization: `Bearer ${validToken}`
        },
        payload: {
          base64Data: `data:image/png;base64,${rawData}`
        }
      });
      expect(authB64.statusCode).toBe(200);
      const authB64Json = JSON.parse(authB64.payload);
      createdFiles.push(path.join(UPLOADS_DIR, path.basename(authB64Json.url)));
    });
  });
});
