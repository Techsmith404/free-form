import { describe, it, expect } from 'vitest';
import {
  analyzeNoteContent,
  toggleChecklistItemByLine,
  toggleChecklistItemByIndex,
  renderInteractiveMarkdownHtml
} from './markdownList.js';

describe('markdownList utility', () => {
  it('correctly identifies a pure checklist as majority checklist', () => {
    const text = `- [ ] Buy milk
- [x] Buy bread
- [ ] Buy eggs`;

    const res = analyzeNoteContent(text, 'Groceries');
    expect(res.isMajorityList).toBe(true);
    expect(res.isChecklist).toBe(true);
    expect(res.isStandardList).toBe(false);
    expect(res.checklistCount).toBe(3);
    expect(res.checkedCount).toBe(1);
    expect(res.summaryText).toContain('1/3 done');
    expect(res.summaryText).toContain('Buy milk, Buy bread, Buy eggs');
  });

  it('correctly identifies a header + checklist as majority checklist', () => {
    const text = `# Weekend Chores
- [ ] Clean garage
- [x] Mow lawn`;

    const res = analyzeNoteContent(text, 'Weekend Chores');
    expect(res.isMajorityList).toBe(true);
    expect(res.isChecklist).toBe(true);
    expect(res.checklistCount).toBe(2);
    expect(res.checkedCount).toBe(1);
  });

  it('correctly identifies a bullet list as standard list', () => {
    const text = `- Item A
- Item B
- Item C`;

    const res = analyzeNoteContent(text);
    expect(res.isMajorityList).toBe(true);
    expect(res.isChecklist).toBe(false);
    expect(res.isStandardList).toBe(true);
    expect(res.bulletCount).toBe(3);
    expect(res.summaryText).toContain('3 items');
  });

  it('correctly identifies an ordered numbered list as standard list', () => {
    const text = `1. Step one
2. Step two
3. Step three`;

    const res = analyzeNoteContent(text);
    expect(res.isMajorityList).toBe(true);
    expect(res.isChecklist).toBe(false);
    expect(res.isStandardList).toBe(true);
    expect(res.bulletCount).toBe(3);
    expect(res.summaryText).toContain('3 items');
  });

  it('does not classify long prose with a single checkbox as majority list', () => {
    const text = `This is a long meeting summary with a detailed discussion about the roadmap.
We reviewed all quarterly targets and discussed key hiring needs.
Several team members gave presentations on current features.
Finally we aligned on our next steps.

- [ ] Follow up with team lead`;

    const res = analyzeNoteContent(text);
    expect(res.isMajorityList).toBe(false);
    expect(res.isChecklist).toBe(false);
    expect(res.hasChecklist).toBe(true);
    expect(res.checklistCount).toBe(1);
    expect(res.checkedCount).toBe(0);
  });

  it('toggles checklist items by line index', () => {
    const original = `# Tasks
- [ ] First task
- [x] Second task`;

    // Line 1 is "- [ ] First task"
    const toggled1 = toggleChecklistItemByLine(original, 1);
    expect(toggled1).toContain('- [x] First task');

    // Line 2 is "- [x] Second task"
    const toggled2 = toggleChecklistItemByLine(toggled1, 2);
    expect(toggled2).toContain('- [ ] Second task');
  });

  it('toggles checklist items by checkbox index', () => {
    const original = `# Tasks
- [ ] Task 0
  - [x] Subtask 1
- [X] Task 2`;

    // Toggle 0 (Task 0 unchecked -> checked)
    const toggled0 = toggleChecklistItemByIndex(original, 0);
    expect(toggled0).toContain('- [x] Task 0');

    // Toggle 1 (Subtask 1 checked -> unchecked)
    const toggled1 = toggleChecklistItemByIndex(original, 1);
    expect(toggled1).toContain('- [ ] Subtask 1');

    // Toggle 2 (Task 2 [X] -> unchecked)
    const toggled2 = toggleChecklistItemByIndex(original, 2);
    expect(toggled2).toContain('- [ ] Task 2');
  });

  it('renders interactive markdown with data-checklist-index', () => {
    const text = `- [ ] Task 1
- [x] Task 2`;

    const html = renderInteractiveMarkdownHtml(text);
    expect(html).toContain('data-checklist-index="0"');
    expect(html).toContain('data-checklist-index="1"');
    expect(html).toContain('checked');
    expect(html).not.toContain('disabled=""');
  });
});
