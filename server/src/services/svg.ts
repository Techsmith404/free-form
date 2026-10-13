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
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg'
};
