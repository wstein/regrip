import { describe, expect, it } from 'vitest';

import { SOURCE_REPOSITORY_URL, sourceRevision } from './sourceRevision';

describe('sourceRevision', () => {
  it('links an injected build SHA to its exact GitHub tree', () => {
    expect(sourceRevision('1de35d3a5d9d2e4c6f7289a0b1c2d3e4f5a6b7c8')).toEqual({
      href: `${SOURCE_REPOSITORY_URL}/tree/1de35d3a5d9d2e4c6f7289a0b1c2d3e4f5a6b7c8`,
      label: 'GitHub@1de35d3',
    });
  });

  it('prefers a released core tag over the matching build SHA', () => {
    expect(sourceRevision('1de35d3a5d9d2e4c6f7289a0b1c2d3e4f5a6b7c8', 'core-v0.3.0')).toEqual({
      href: `${SOURCE_REPOSITORY_URL}/releases/tag/core-v0.3.0`,
      label: 'GitHub@core-v0.3.0',
    });
  });

  it('falls back to the build SHA for a non-release tag', () => {
    expect(sourceRevision('1de35d3a5d9d2e4c6f7289a0b1c2d3e4f5a6b7c8', 'preview')).toEqual({
      href: `${SOURCE_REPOSITORY_URL}/tree/1de35d3a5d9d2e4c6f7289a0b1c2d3e4f5a6b7c8`,
      label: 'GitHub@1de35d3',
    });
  });

  it('marks an invalid build revision without implying a branch', () => {
    expect(sourceRevision('not-a-commit')).toEqual({
      href: SOURCE_REPOSITORY_URL,
      label: 'GitHub@unknown',
    });
  });
});
