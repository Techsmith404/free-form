import { Marked, marked } from 'marked';

export const CHECKLIST_ITEM_REGEX = /^(\s*)([-*+]|\d+\.)\s+\[([ xX])\]\s*(.*)$/;
export const BULLET_ITEM_REGEX = /^(\s*)([-*+]|\d+\.)\s+(?!\[[ xX]\])(.*)$/;
export const HEADER_REGEX = /^(\s*)(#{1,6})\s+(.*)$/;
export const BLOCKQUOTE_REGEX = /^(\s*)>\s*(.*)$/;

export interface ChecklistItemData {
  type: 'checklist';
  lineIndex: number;
  checkboxIndex: number;
  indent: number;
  checked: boolean;
  text: string;
}

export interface BulletItemData {
  type: 'bullet';
  lineIndex: number;
  indent: number;
  marker: string;
  isOrdered: boolean;
  text: string;
}

export interface HeadingItemData {
  type: 'heading';
  lineIndex: number;
  level: number;
  text: string;
}

export interface BlockquoteItemData {
  type: 'blockquote';
  lineIndex: number;
  text: string;
}

export interface TextItemData {
  type: 'text';
  lineIndex: number;
  text: string;
}

export type ParsedNoteLine =
  | ChecklistItemData
  | BulletItemData
  | HeadingItemData
  | BlockquoteItemData
  | TextItemData;

export interface ListAnalysisResult {
  isMajorityList: boolean;
  isChecklist: boolean;
  isStandardList: boolean;
  hasChecklist: boolean;
  checklistCount: number;
  checkedCount: number;
  bulletCount: number;
  totalListCount: number;
  parsedLines: ParsedNoteLine[];
  preamble?: string;
  summaryText: string;
}

/**
 * Analyze note markdown content to determine if it is predominantly a checklist or list.
 */
export function analyzeNoteContent(content: string, itemTitle?: string): ListAnalysisResult {
  const result: ListAnalysisResult = {
    isMajorityList: false,
    isChecklist: false,
    isStandardList: false,
    hasChecklist: false,
    checklistCount: 0,
    checkedCount: 0,
    bulletCount: 0,
    totalListCount: 0,
    parsedLines: [],
    preamble: undefined,
    summaryText: ''
  };

  if (!content || !content.trim()) {
    result.summaryText = 'Empty note';
    return result;
  }

  const lines = content.split('\n');
  const parsedLines: ParsedNoteLine[] = [];
  let checkboxCounter = 0;
  let nonBlankCount = 0;
  let headingCount = 0;
  let textParagraphCount = 0;
  let firstPreambleCandidate: string | undefined = undefined;
  let inCodeBlock = false;
  let hasCodeBlock = false;
  let hasTable = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      continue;
    }
    nonBlankCount++;

    // Check for fenced code block delimiters (``` or ~~~)
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inCodeBlock = !inCodeBlock;
      hasCodeBlock = true;
      textParagraphCount++;
      parsedLines.push({
        type: 'text',
        lineIndex: i,
        text: trimmed
      });
      continue;
    }

    // Inside a fenced code block, lines are verbatim code text, not markdown lists or headers
    if (inCodeBlock) {
      textParagraphCount++;
      parsedLines.push({
        type: 'text',
        lineIndex: i,
        text: rawLine
      });
      continue;
    }

    // Check for markdown table rows
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      hasTable = true;
      textParagraphCount++;
      parsedLines.push({
        type: 'text',
        lineIndex: i,
        text: trimmed
      });
      continue;
    }

    const checkMatch = rawLine.match(CHECKLIST_ITEM_REGEX);
    if (checkMatch) {
      const indent = checkMatch[1].length;
      const checked = checkMatch[3].toLowerCase() === 'x';
      const text = checkMatch[4].trim();
      const currentCheckboxIdx = checkboxCounter++;

      parsedLines.push({
        type: 'checklist',
        lineIndex: i,
        checkboxIndex: currentCheckboxIdx,
        indent,
        checked,
        text
      });

      result.checklistCount++;
      if (checked) result.checkedCount++;
      continue;
    }

    const bulletMatch = rawLine.match(BULLET_ITEM_REGEX);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const marker = bulletMatch[2];
      const isOrdered = /^\d+\./.test(marker);
      const text = bulletMatch[3].trim();

      parsedLines.push({
        type: 'bullet',
        lineIndex: i,
        indent,
        marker,
        isOrdered,
        text
      });

      result.bulletCount++;
      continue;
    }

    const headerMatch = rawLine.match(HEADER_REGEX);
    if (headerMatch) {
      headingCount++;
      const level = headerMatch[2].length;
      const text = headerMatch[3].trim();
      parsedLines.push({
        type: 'heading',
        lineIndex: i,
        level,
        text
      });
      continue;
    }

    const blockquoteMatch = rawLine.match(BLOCKQUOTE_REGEX);
    if (blockquoteMatch) {
      textParagraphCount++;
      const text = blockquoteMatch[2].trim();
      parsedLines.push({
        type: 'blockquote',
        lineIndex: i,
        text
      });
      continue;
    }

    // Regular text line
    textParagraphCount++;
    if (!firstPreambleCandidate && nonBlankCount === 1) {
      firstPreambleCandidate = trimmed;
    }
    parsedLines.push({
      type: 'text',
      lineIndex: i,
      text: trimmed
    });
  }

  result.hasChecklist = result.checklistCount > 0;
  result.totalListCount = result.checklistCount + result.bulletCount;
  result.parsedLines = parsedLines;

  // Determine if this note qualifies as a special majority list card:
  // Notes containing code blocks or tables are rich document notes and should render as NoteCards.
  // Otherwise, a note qualifies if list items constitute >= 55% of the content lines.
  const contentLinesExcludingLeadingHeader = nonBlankCount - (headingCount > 0 ? 1 : 0);
  const listRatio = contentLinesExcludingLeadingHeader > 0
    ? result.totalListCount / contentLinesExcludingLeadingHeader
    : (result.totalListCount > 0 ? 1 : 0);

  result.isMajorityList =
    !hasCodeBlock &&
    !hasTable &&
    result.totalListCount > 0 &&
    (listRatio >= 0.55 || (result.totalListCount >= 3 && textParagraphCount === 0));

  if (result.isMajorityList) {
    if (result.checklistCount > 0 && result.checklistCount >= result.bulletCount) {
      result.isChecklist = true;
    } else if (result.bulletCount > 0) {
      result.isStandardList = true;
    }
  }

  // Attach preamble if there is a short lead-in
  if (firstPreambleCandidate && (result.isChecklist || result.isStandardList)) {
    result.preamble = firstPreambleCandidate;
  }

  // Build summary text for compact subtitles
  if (result.isChecklist) {
    const listPreview = parsedLines
      .filter((l): l is ChecklistItemData => l.type === 'checklist')
      .slice(0, 3)
      .map((l) => l.text)
      .join(', ');
    result.summaryText = `${result.checkedCount}/${result.checklistCount} done${listPreview ? ` • ${listPreview}` : ''}`;
  } else if (result.isStandardList) {
    const listPreview = parsedLines
      .filter((l): l is BulletItemData => l.type === 'bullet')
      .slice(0, 3)
      .map((l) => l.text)
      .join(', ');
    result.summaryText = `${result.bulletCount} item${result.bulletCount === 1 ? '' : 's'}${listPreview ? ` • ${listPreview}` : ''}`;
  } else {
    const raw = (content || '').replace(/[#*_`~>-]/g, '').trim();
    result.summaryText = raw.slice(0, 80) || 'Empty note';
  }

  return result;
}

/**
 * Toggles a checklist item at a specific line index in markdown text.
 */
export function toggleChecklistItemByLine(content: string, lineIndex: number): string {
  const lines = content.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return content;

  const targetLine = lines[lineIndex];
  if (!CHECKLIST_ITEM_REGEX.test(targetLine)) return content;

  lines[lineIndex] = targetLine.replace(/\[([ xX])\]/, (match, checkState) => {
    return checkState.trim() ? '[ ]' : '[x]';
  });

  return lines.join('\n');
}

/**
 * Toggles the N-th checklist item in markdown text (0-indexed across entire note).
 */
export function toggleChecklistItemByIndex(content: string, checkboxIndex: number): string {
  const lines = content.split('\n');
  let currentChecklistIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    if (CHECKLIST_ITEM_REGEX.test(lines[i])) {
      if (currentChecklistIndex === checkboxIndex) {
        lines[i] = lines[i].replace(/\[([ xX])\]/, (match, checkState) => {
          return checkState.trim() ? '[ ]' : '[x]';
        });
        return lines.join('\n');
      }
      currentChecklistIndex++;
    }
  }

  return content;
}

/**
 * Renders markdown to HTML with interactive checkboxes tagged with data-checklist-index.
 * Neutralizes raw HTML tags (<script>, <iframe>) while preserving markdown elements and symbols.
 */
export function renderInteractiveMarkdownHtml(content: string): string {
  if (!content || !content.trim()) return '';

  let checkboxIdx = 0;
  const markedInstance = new Marked({
    renderer: {
      checkbox({ checked }) {
        const currentIdx = checkboxIdx++;
        return `<input type="checkbox" data-checklist-index="${currentIdx}" class="task-checkbox cursor-pointer mr-2 accent-indigo-500 rounded hover:ring-2 hover:ring-indigo-400/50 transition-all touch-manipulation" ${checked ? 'checked' : ''} />`;
      },
      html(token) {
        return (token.text || token.raw || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
    }
  });

  return markedInstance.parse(content) as string;
}

const inlineMarkedInstance = new Marked({
  renderer: {
    html(token) {
      return (token.text || token.raw || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }
});

/**
 * Renders inline markdown formatting (bold, italic, code, strikethrough).
 * Neutralizes raw HTML tags (<script>) without double-escaping entities or symbols like ->.
 */
export function renderInlineMarkdownHtml(text: string): string {
  if (!text || !text.trim()) return '';
  return inlineMarkedInstance.parseInline(text) as string;
}
