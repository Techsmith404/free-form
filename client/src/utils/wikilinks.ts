import type { TokenizerAndRendererExtension } from 'marked';

/** Mirrors server/src/services/wikilinks.ts so client and server resolve titles identically. */
export function normalizeLinkTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Split `Title|alias` / `Title#heading` into the target title and the visible label. */
export function parseWikilink(inner: string): { title: string; label: string } {
  const [targetPart, alias] = inner.split('|');
  const title = targetPart.split('#')[0].trim();
  return { title, label: (alias ?? targetPart).trim() };
}

/** marked inline extension rendering `[[Title]]` as a clickable `<a data-wikilink>` element. */
export const wikilinkMarkedExtension: TokenizerAndRendererExtension = {
  name: 'wikilink',
  level: 'inline',
  start(src: string) {
    const i = src.indexOf('[[');
    return i < 0 ? undefined : i;
  },
  tokenizer(src: string) {
    const m = /^\[\[([^\[\]\n]+?)\]\]/.exec(src);
    if (!m) return undefined;
    const { title, label } = parseWikilink(m[1]);
    if (!title) return undefined;
    return { type: 'wikilink', raw: m[0], title, label } as any;
  },
  renderer(token: any) {
    return `<a href="#" class="wikilink" data-wikilink="${escapeHtml(token.title)}">${escapeHtml(token.label)}</a>`;
  }
};

/** Find the wikilink element a click landed on, if any. */
export function wikilinkFromEvent(e: { target: EventTarget | null }): string | null {
  const el = (e.target as HTMLElement | null)?.closest?.('a[data-wikilink]') as HTMLElement | null;
  return el ? el.getAttribute('data-wikilink') : null;
}
