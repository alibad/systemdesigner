import { describe, expect, it } from 'vitest';
import {
  deleteContentBlock,
  duplicateContentBlock,
  insertContentBlock,
  moveContentBlock,
  parseEditableContentBlocks,
  replaceContentBlock,
} from './content-block-editor';

const SOURCE = `---
registryId: example
---

{% section-card tone="intro" %}
## What is an example?

Introductory copy.
{% /section-card %}

{% callout variant="info" %}
Remember this.
{% /callout %}
`;

describe('structured Markdoc block editing', () => {
  it('discovers top-level blocks without exposing frontmatter as a movable block', () => {
    const parsed = parseEditableContentBlocks(SOURCE);
    expect(parsed.prefix).toContain('registryId: example');
    expect(parsed.blocks).toHaveLength(2);
    expect(parsed.blocks.map((block) => block.kind)).toEqual(['section-card', 'callout']);
    expect(parsed.blocks[0].startLine).toBe(5);
  });

  it('replaces one block while preserving the rest of the document', () => {
    const next = replaceContentBlock(SOURCE, 1, '{% callout variant="warn" %}\nChanged.\n{% /callout %}');
    expect(next).toContain('What is an example?');
    expect(next).toContain('variant="warn"');
    expect(parseEditableContentBlocks(next).blocks).toHaveLength(2);
  });

  it('moves, duplicates, deletes, and inserts complete top-level blocks', () => {
    const moved = moveContentBlock(SOURCE, 1, -1);
    expect(moved.indexOf('{% callout')).toBeLessThan(moved.indexOf('{% section-card'));

    const duplicated = duplicateContentBlock(SOURCE, 0);
    expect(parseEditableContentBlocks(duplicated).blocks).toHaveLength(3);

    const deleted = deleteContentBlock(SOURCE, 1);
    expect(parseEditableContentBlocks(deleted).blocks).toHaveLength(1);

    const inserted = insertContentBlock(
      SOURCE,
      0,
      '{% section-card %}\n## Inserted block\n\nNew copy.\n{% /section-card %}',
    );
    expect(parseEditableContentBlocks(inserted).blocks).toHaveLength(3);
    expect(inserted.indexOf('Inserted block')).toBeLessThan(inserted.indexOf('{% callout'));
  });
});
