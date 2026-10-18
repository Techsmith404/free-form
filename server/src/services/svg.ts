import path from 'path';

/**
 * Best-effort SVG sanitiser. Defence in depth only: uploaded files are also served with a
 * sandboxed CSP + `nosniff` (see server/src/index.ts), which is the primary protection.
 */
export function sanitizeSvg(input: string): string {
  return (
    input
      // Dangerous elements with a closing tag (content included)
      .replace(/<\s*(script|foreignObject|iframe|object|embed)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      // Any remaining opening / self-closing instances
      .replace(/<\s*(script|foreignObject|iframe|object|embed|link|meta)\b[^>]*>/gi, '')
      // Inline event handlers: on*="..." / on*='...' / on*=bare
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      // javascript: / data:text/html URLs in href / xlink:href / src
      .replace(/\s+(?:xlink:)?(?:href|src)\s*=\s*(?:"\s*(?:javascript|data:text\/html)[^"]*"|'\s*(?:javascript|data:text\/html)[^']*')/gi, '')
  );
}

/** Allowed upload MIME types mapped to the ONLY extension we will store them under. */
export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/pjpeg': '.jpg',
  'image/png': '.png',
  'image/x-png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/bmp': '.bmp',
  'image/x-ms-bmp': '.bmp',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico'
};

/** Safe file extensions mapped to standard normalized extensions */
export const SAFE_IMAGE_EXTENSIONS: Record<string, string> = {
  '.jpg': '.jpg',
  '.jpeg': '.jpg',
  '.png': '.png',
  '.gif': '.gif',
  '.webp': '.webp',
  '.svg': '.svg',
  '.avif': '.avif',
  '.heic': '.heic',
  '.heif': '.heif',
  '.bmp': '.bmp',
  '.ico': '.ico'
};

/**
 * Resolves a safe file extension from MIME type and optional filename fallback.
 */
export function resolveImageExtension(mimetype?: string | null, filename?: string | null): string | null {
  const normalizedMime = (mimetype || '').toLowerCase().split(';')[0].trim();
  if (normalizedMime && Object.prototype.hasOwnProperty.call(IMAGE_EXTENSIONS, normalizedMime)) {
    return IMAGE_EXTENSIONS[normalizedMime];
  }
  if (!normalizedMime || normalizedMime === 'application/octet-stream') {
    const ext = path.extname(filename || '').toLowerCase();
    return SAFE_IMAGE_EXTENSIONS[ext] ?? null;
  }
  return null;
}
