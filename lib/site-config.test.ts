import { describe, expect, it } from 'vitest';

import { githubEditUrl } from './site-config';

describe('githubEditUrl', () => {
  it('targets the canonical content entry body', () => {
    expect(githubEditUrl('/fundamentals/scalability-basics/')).toContain(
      '/content/entries/fundamentals/scalability-basics/index.mdoc'
    );
  });
});
