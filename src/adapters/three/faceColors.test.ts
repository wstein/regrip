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

  it('swaps only green (F) and blue (B) for the Japanese scheme', () => {
    const western = faceColorsFor('western');
    const japanese = faceColorsFor('japanese');
    expect(japanese).toEqual({ ...western, F: western.B, B: western.F });
    expect(japanese.U).toBe(western.U);
    expect(japanese.R).toBe(western.R);
    expect(japanese.D).toBe(western.D);
    expect(japanese.L).toBe(western.L);
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
});
