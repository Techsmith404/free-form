import { describe, it, expect } from 'vitest';
import { markdownToTipTapHtml } from './TipTapEditor.js';

describe('TipTap Task List Hard Invariant', () => {
  it('preserves task list attributes data-type="taskList" and data-type="taskItem"', () => {
    const markdown = `- [ ] Clean workstation
- [x] Review pull requests
- [ ] Submit weekly report`;

    const html = markdownToTipTapHtml(markdown);

    // Hard Invariant Check: Must have data-type="taskList"
    expect(html).toContain('data-type="taskList"');
    expect(html).toContain('data-type="taskItem"');

    // Checked state verification
    expect(html).toContain('data-checked="false"');
    expect(html).toContain('data-checked="true"');
  });

  it('never assigns data-type="taskList" to standard bullet or numbered lists', () => {
    const bulletMarkdown = `- Bullet item one
- Bullet item two
- Bullet item three`;

    const bulletHtml = markdownToTipTapHtml(bulletMarkdown);
    expect(bulletHtml).not.toContain('data-type="taskList"');
    expect(bulletHtml).not.toContain('data-type="taskItem"');
    expect(bulletHtml).toContain('<ul>');

    const orderedMarkdown = `1. Step one
2. Step two
3. Step three`;

    const orderedHtml = markdownToTipTapHtml(orderedMarkdown);
    expect(orderedHtml).not.toContain('data-type="taskList"');
    expect(orderedHtml).toContain('<ol>');
  });

  it('correctly handles mixed markdown containing both paragraphs and task lists', () => {
    const mixedMarkdown = `# Meeting Agenda

Here are the items for today:

- [ ] Discuss project roadmap
- [x] Finalize sprint goals

End of notes.`;

    const html = markdownToTipTapHtml(mixedMarkdown);
    expect(html).toContain('<h1>Meeting Agenda</h1>');
    expect(html).toContain('data-type="taskList"');
    expect(html).toContain('Discuss project roadmap');
    expect(html).toContain('data-checked="true"');
  });
});
