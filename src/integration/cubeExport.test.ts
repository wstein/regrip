import { describe, expect, it } from 'vitest';

import * as CubeFacelets from '@wstein/regrip-core/domain/CubeFacelets.res.mjs';
import { formatCubeExport, formatCubieCoordinates, formatOrbit64 } from './cubeExport';

const solved = {
  CP: [0, 1, 2, 3, 4, 5, 6, 7],
  CO: [0, 0, 0, 0, 0, 0, 0, 0],
  EP: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  EO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};
const facelets = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
const ponsAsinorum = 'UDUDUDUDURLRLRLRLRFBFBFBFBFDUDUDUDUDLRLRLRLRLBFBFBFBFB';

function cubieState(facelets: string) {
  const decoded = CubeFacelets.decodeFacelets(facelets);
  if (decoded.TAG !== 'Ok') throw new Error(decoded._0);
  return {
    CP: decoded._0.CORNERS.pieces,
    CO: decoded._0.CORNERS.orientation,
    EP: decoded._0.EDGES.pieces,
    EO: decoded._0.EDGES.orientation,
  };
}

describe('cube exports', () => {
  it('matches Orbit64 canonical 3×3 compatibility vectors', () => {
    expect(formatOrbit64(solved)).toBe('AAAAAAAAAAAA');
    expect(formatOrbit64({ ...solved, EO: Array.from({ length: 12 }, () => 1) })).toBe(
      'AAAAAAAAAL_o',
    );
    expect(formatOrbit64({ ...solved, CO: [1, 2, 0, 0, 0, 0, 0, 0] })).toBe('AAACTNvNgAAA');
    expect(
      formatOrbit64({
        ...solved,
        CP: [1, 2, 3, 0, 4, 5, 6, 7],
        EP: [1, 2, 3, 0, 4, 5, 6, 7, 8, 9, 10, 11],
      }),
    ).toBe('FRot3QyvoAAA');
  });

  it('matches Orbit64 Pons Asinorum from its canonical URFDLB facelets', () => {
    expect(formatOrbit64(cubieState(ponsAsinorum))).toBe('AAAABeBQZgAA');
  });

  it('formats compact, spaced, and Singmaster exports', () => {
    const source = { facelets, state: solved };
    expect(formatCubeExport(source, 'compact-facelets')).toBe(facelets);
    expect(formatCubeExport(source, 'spaced-facelets')).toBe(
      'UUUUUUUUU RRRRRRRRR FFFFFFFFF DDDDDDDDD LLLLLLLLL BBBBBBBBB',
    );
    expect(formatCubeExport(source, 'singmaster')).toBe('');
    expect(formatCubeExport(source, 'cubie-coordinates')).toBe(
      'CP: 0,1,2,3,4,5,6,7\nCO: 0,0,0,0,0,0,0,0\nEP: 0,1,2,3,4,5,6,7,8,9,10,11\nEO: 0,0,0,0,0,0,0,0,0,0,0,0',
    );
  });

  it('formats each cubie coordinate array on its own copy-ready line', () => {
    expect(formatCubieCoordinates({ ...solved, CP: [1, 0, 2, 3, 4, 5, 6, 7] })).toBe(
      'CP: 1,0,2,3,4,5,6,7\nCO: 0,0,0,0,0,0,0,0\nEP: 0,1,2,3,4,5,6,7,8,9,10,11\nEO: 0,0,0,0,0,0,0,0,0,0,0,0',
    );
  });

  it('rejects invalid Orbit64 coordinates and missing state exports', () => {
    expect(formatOrbit64({ ...solved, CP: [0, 0, 2, 3, 4, 5, 6, 7] })).toBeUndefined();
    expect(formatCubeExport({ facelets }, 'orbit64')).toBeUndefined();
  });
});
