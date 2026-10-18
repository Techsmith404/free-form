import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveAssetUrl,
  fetchWithTimeout,
  uploadFile,
  uploadBase64,
  setAuthToken,
  setServerUrl,
  scrapeUrl
} from './index.js';

describe('resolveAssetUrl', () => {
  afterEach(() => {
    setServerUrl('');
  });

  it('handles null, undefined, and empty string', () => {
    expect(resolveAssetUrl(null)).toBe('');
    expect(resolveAssetUrl(undefined)).toBe('');
    expect(resolveAssetUrl('')).toBe('');
  });

  it('leaves absolute http, https, data, and blob URLs untouched', () => {
    expect(resolveAssetUrl('http://example.com/photo.png')).toBe('http://example.com/photo.png');
    expect(resolveAssetUrl('https://example.com/photo.png')).toBe('https://example.com/photo.png');
    expect(resolveAssetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(resolveAssetUrl('blob:http://localhost:3000/123-456')).toBe('blob:http://localhost:3000/123-456');
  });

  it('resolves relative URLs with server base URL cleanly without duplicate slashes', () => {
    setServerUrl('http://backend.local:3000');
    expect(resolveAssetUrl('/uploads/img.png')).toBe('http://backend.local:3000/uploads/img.png');
    expect(resolveAssetUrl('uploads/img.png')).toBe('http://backend.local:3000/uploads/img.png');

    setServerUrl('http://backend.local:3000/');
    expect(resolveAssetUrl('/uploads/img.png')).toBe('http://backend.local:3000/uploads/img.png');
    expect(resolveAssetUrl('uploads/img.png')).toBe('http://backend.local:3000/uploads/img.png');
  });

  it('returns relative URL untouched if no server URL is set', () => {
    setServerUrl('');
    expect(resolveAssetUrl('/uploads/img.png')).toBe('/uploads/img.png');
  });
});

describe('fetchWithTimeout', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setAuthToken('test-token-123');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setAuthToken(null);
  });

  it('attaches Authorization header and defaults credentials to include', async () => {
    let capturedInput: any;
    let capturedInit: any;
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      capturedInput = input;
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const res = await fetchWithTimeout('/api/test');
    expect(res.ok).toBe(true);
    expect(capturedInit.credentials).toBe('include');
    expect(capturedInit.headers.get('Authorization')).toBe('Bearer test-token-123');
  });
});

describe('uploadFile', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setAuthToken('token-abc');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setAuthToken(null);
    setServerUrl('');
  });

  it('attaches auth headers and credentials include on upload', async () => {
    let capturedInit: any;
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      capturedInit = init;
      return new Response(
        JSON.stringify({ url: '/uploads/uploaded.png', name: 'uploaded.png', size: 1024 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const file = new File(['dummy content'], 'photo.png', { type: 'image/png' });
    const result = await uploadFile(file);

    expect(capturedInit.credentials).toBe('include');
    expect(capturedInit.headers['Authorization']).toBe('Bearer token-abc');
    expect(capturedInit.headers['Content-Type']).toBeUndefined(); // Browser sets multipart boundary
    expect(result.url).toBe('/uploads/uploaded.png');
    expect(result.name).toBe('uploaded.png');
  });

  it('surfaces server error message on HTTP 400 without falling back to base64', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Only images are allowed.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const file = new File(['dummy content'], 'photo.png', { type: 'image/png' });
    await expect(uploadFile(file)).rejects.toThrow('Invalid file type. Only images are allowed.');
  });

  it('surfaces server error message on HTTP 401 without falling back to base64', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const file = new File(['dummy content'], 'photo.png', { type: 'image/png' });
    await expect(uploadFile(file)).rejects.toThrow('Authentication required');
  });

  it('surfaces server error message on HTTP 413 without falling back to base64', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: 'Payload too large: file exceeds 10MB limit' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const file = new File(['dummy content'], 'huge.jpg', { type: 'image/jpeg' });
    await expect(uploadFile(file)).rejects.toThrow('Payload too large: file exceeds 10MB limit');
  });

  it('resolves asset URL against server base URL via resolveAssetUrl', async () => {
    setServerUrl('https://cloud.freeform.app:8443');
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ url: '/uploads/custom-photo.webp', name: 'custom-photo.webp', size: 2048 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const file = new File(['image bytes'], 'custom-photo.webp', { type: 'image/webp' });
    const result = await uploadFile(file);

    expect(result.url).toBe('https://cloud.freeform.app:8443/uploads/custom-photo.webp');
  });

  it('falls back to offline base64 data URL when fetch rejects for valid images', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch (offline)');
    });

    const file = new File(['mock image binary data'], 'offline.png', { type: 'image/png' });
    const result = await uploadFile(file);

    expect(result.url.startsWith('data:image/png;base64,')).toBe(true);
    expect(result.name).toBe('offline.png');
    expect(result.size).toBe(file.size);
  });

  it('rejects non-image files on offline network error', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch (offline)');
    });

    const file = new File(['console.log("bad")'], 'script.js', { type: 'application/javascript' });
    await expect(uploadFile(file)).rejects.toThrow('Invalid file type. Only images are allowed.');
  });
});

describe('uploadBase64', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setAuthToken('token-base64');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setAuthToken(null);
    setServerUrl('');
  });

  it('attaches auth headers and credentials include on upload', async () => {
    let capturedInit: any;
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      capturedInit = init;
      return new Response(
        JSON.stringify({ url: '/uploads/sig.png', name: 'signature.png', size: 500 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await uploadBase64('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==', 'sig.png');
    expect(capturedInit.credentials).toBe('include');
    expect(capturedInit.headers['Authorization']).toBe('Bearer token-base64');
    expect(result.url).toBe('/uploads/sig.png');
  });

  it('surfaces server error message on HTTP 400 without falling back to base64', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: 'Invalid signature payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    });

    await expect(
      uploadBase64('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')
    ).rejects.toThrow('Invalid signature payload');
  });

  it('surfaces server error message on HTTP 401 without falling back to base64', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    });

    await expect(
      uploadBase64('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')
    ).rejects.toThrow('Authentication required');
  });

  it('surfaces server error message on HTTP 413 without falling back to base64', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: 'File is too large (50 MB limit)' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    });

    await expect(
      uploadBase64('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')
    ).rejects.toThrow('File is too large (50 MB limit)');
  });

  it('resolves asset URL against server base URL via resolveAssetUrl', async () => {
    setServerUrl('https://cloud.freeform.app:8443');
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ url: '/uploads/signature-abc.png', name: 'sig.png', size: 300 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await uploadBase64('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==', 'sig.png');
    expect(result.url).toBe('https://cloud.freeform.app:8443/uploads/signature-abc.png');
  });

  it('falls back to offline base64 data URL when fetch rejects', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch (network error)');
    });

    const result = await uploadBase64('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==', 'my-sig.png');
    expect(result.url).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
    expect(result.name).toBe('my-sig.png');
    expect(result.size).toBeGreaterThan(0);
  });

  it('wraps raw base64 as data:image/png;base64,... when fetch rejects', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch (offline)');
    });

    const result = await uploadBase64('iVBORw0KGgoAAAANSUhEUg==');
    expect(result.url).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
    expect(result.name).toBe('signature.png');
  });

  it('rejects non-image data URI when fetch rejects', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch (offline)');
    });

    await expect(
      uploadBase64('data:text/plain;base64,SGVsbG8=')
    ).rejects.toThrow('Invalid file type. Only images are allowed.');
  });
});

describe('scrapeUrl and raw fetch auth consistency', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setAuthToken('token-scrape');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setAuthToken(null);
  });

  it('attaches auth headers and credentials include to raw fetch calls', async () => {
    let capturedInit: any;
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      capturedInit = init;
      return new Response(JSON.stringify({ title: 'Sample' }), { status: 200 });
    });

    await scrapeUrl('https://example.com');
    expect(capturedInit.credentials).toBe('include');
    expect(capturedInit.headers['Authorization']).toBe('Bearer token-scrape');
  });
});
