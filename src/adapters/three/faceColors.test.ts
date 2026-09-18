import { describe, expect, it } from 'vitest';

import { faceColorsFor, homeFrameColorsFor } from './faceColors';

describe('faceColorsFor', () => {
  it('keeps the Western scheme as the existing six-color mapping', () => {
    expect(faceColorsFor('western')).toEqual({
      U: 0xffffff,
      R: 0xff3131,
      F: 0x78ed3e,
      D: 0xfff34a,
      L: 0xff8a2a,
      B: 0x3568ff,
    });
  });

  it('swaps only blue (B) and yellow (D) for the Japanese scheme', () => {
    const western = faceColorsFor('western');
    const japanese = faceColorsFor('japanese');
    expect(japanese).toEqual({ ...western, B: western.D, D: western.B });
    expect(japanese.U).toBe(western.U);
    expect(japanese.R).toBe(western.R);
    expect(japanese.F).toBe(western.F);
    expect(japanese.L).toBe(western.L);
  });

  it('uses custom face colors when provided for the custom scheme', () => {
    const western = faceColorsFor('western');
    const custom = { U: 0x111111, D: 0x222222 };
    const resolved = faceColorsFor('custom', custom);
    expect(resolved.U).toBe(0x111111);
    expect(resolved.D).toBe(0x222222);
    expect(resolved.F).toBe(western.F);
    expect(resolved.B).toBe(western.B);
    expect(resolved.R).toBe(western.R);
    expect(resolved.L).toBe(western.L);
  });
});

describe('homeFrameColorsFor', () => {
  it('derives the gizmo home colors from the matching scheme table', () => {
    const western = faceColorsFor('western');
    const japanese = faceColorsFor('japanese');
    expect(homeFrameColorsFor('western')).toEqual({
      x: western.R,
      y: western.U,
      z: western.F,
    });
    expect(homeFrameColorsFor('japanese')).toEqual({
      x: japanese.R,
      y: japanese.U,
      z: japanese.F,
    });
  });

  it('derives gizmo home colors for custom schemes', () => {
    const custom = { R: 0xaa0000, U: 0x00aa00, F: 0x0000aa };
    expect(homeFrameColorsFor('custom', custom)).toEqual({
      x: 0xaa0000,
      y: 0x00aa00,
      z: 0x0000aa,
    });
  });
});
