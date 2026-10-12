/**
 * Pure wikilink parsing (no DB access, safe to import from migrations).
 * Supports `[[Title]]`, `[[Title|alias]]`, `[[Title#heading]]`.
 */

export function normalizeLinkTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Extract unique normalized target titles from markdown, ignoring code. */
export function extractWikilinks(content: string | null | undefined): string[] {
  if (!content) return [];
  const withoutCode = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const found = new Set<string>();
  const re = /\[\[([^\[\]\n]+?)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutCode)) !== null) {
    const target = normalizeLinkTitle(m[1].split('|')[0].split('#')[0]);
    if (target) found.add(target);
  }
  return Array.from(found);
}
