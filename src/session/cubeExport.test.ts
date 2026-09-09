import { describe, expect, it } from 'vitest';

import { formatCubeExport, formatOrbit64 } from './cubeExport';

const solved = {
  CP: [0, 1, 2, 3, 4, 5, 6, 7],
  CO: [0, 0, 0, 0, 0, 0, 0, 0],
  EP: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  EO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};
const facelets = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

describe('cube exports', () => {
  it('matches Orbit64 canonical 3×3 compatibility vectors', () => {
    expect(formatOrbit64(solved)).toBe('AAAAAAAAAAAA');
    expect(formatOrbit64({ ...solved, EO: Array.from({ length: 12 }, () => 1) })).toBe(
      'AAAAAAAAAL_o',
    );
    expect(formatOrbit64({ ...solved, CO: [1, 2, 0, 0, 0, 0, 0, 0] })).toBe('AAAASvIVgAAA');
  });

  it('formats compact, spaced, and Singmaster exports', () => {
    const source = { facelets, state: solved };
    expect(formatCubeExport(source, 'compact-facelets')).toBe(facelets);
    expect(formatCubeExport(source, 'spaced-facelets')).toBe(
      'UUUUUUUUU RRRRRRRRR FFFFFFFFF DDDDDDDDD LLLLLLLLL BBBBBBBBB',
    );
    expect(formatCubeExport(source, 'singmaster')).toBe('');
  });

  it('rejects invalid Orbit64 coordinates and missing state exports', () => {
    expect(formatOrbit64({ ...solved, CP: [0, 0, 2, 3, 4, 5, 6, 7] })).toBeUndefined();
    expect(formatCubeExport({ facelets }, 'orbit64')).toBeUndefined();
  });
});
