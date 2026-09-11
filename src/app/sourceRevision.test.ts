import { describe, expect, it } from 'vitest';

import { SOURCE_REPOSITORY_URL, sourceRevision } from './sourceRevision';

describe('sourceRevision', () => {
  it('links an injected build SHA to its exact GitHub tree', () => {
    expect(sourceRevision('1de35d3a5d9d2e4c6f7289a0b1c2d3e4f5a6b7c8')).toEqual({
      href: `${SOURCE_REPOSITORY_URL}/tree/1de35d3a5d9d2e4c6f7289a0b1c2d3e4f5a6b7c8`,
      label: 'wstein/regrip@1de35d3',
    });
  });

  it('marks an invalid build revision without implying a branch', () => {
    expect(sourceRevision('not-a-commit')).toEqual({
      href: SOURCE_REPOSITORY_URL,
      label: 'wstein/regrip@unknown',
    });
  });
});
