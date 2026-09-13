import { describe, expect, it } from 'vitest';

import { structuralEqual } from './structuralEqual.js';

describe('structuralEqual', () => {
  it('ignores record key insertion order', () => {
    expect(
      structuralEqual(
        { id: 'gan', nested: { enabled: true, values: [1, 2] } },
        { nested: { values: [1, 2], enabled: true }, id: 'gan' },
      ),
    ).toBe(true);
  });

  it('detects nested value and array-order changes', () => {
    expect(structuralEqual({ nested: { value: 1 } }, { nested: { value: 2 } })).toBe(false);
    expect(structuralEqual({ values: [1, 2] }, { values: [2, 1] })).toBe(false);
  });
});
