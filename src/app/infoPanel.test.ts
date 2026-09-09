import { describe, expect, it } from 'vitest';

import { countDetectedMoves } from './infoPanel';

describe('countDetectedMoves', () => {
  it('counts editable whitespace-delimited move and virtual-regrip tokens', () => {
    expect(countDetectedMoves("  R  U'\ny  x2  ")).toBe(4);
    expect(countDetectedMoves('   ')).toBe(0);
  });
});
