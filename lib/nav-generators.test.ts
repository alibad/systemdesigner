import { describe, expect, it } from 'vitest';
import { generateReferenceNavConfig } from './nav-generators';

describe('generated reference navigation', () => {
  it('merges category aliases into unique groups and links', () => {
    const groups = generateReferenceNavConfig();
    const titles = groups.map((group) => group.title);
    const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));

    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
