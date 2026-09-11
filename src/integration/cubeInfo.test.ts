import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';

import * as CubeFacelets from '@wstein/regrip-core/domain/CubeFacelets.res.mjs';
import kociembaFixtures from '../../test/fixtures/kociemba-cubie-level.json';
import ssePatterns from '../../test/fixtures/sse-patterns.json';
import { kpuzzleReady, patternToFacelets } from '../adapters/cubing/utils';

import {
  formatCapabilities,
  formatOfflineStats,
  formatSingmasterCycles,
  formatSupersetEngPermutation,
  parseSupersetEngPermutation,
} from './cubeInfo';

describe('cube information formatters', () => {
  it('summarizes available capabilities and vendor controls', () => {
    expect(
      formatCapabilities({
        gyroscope: true,
        battery: true,
        facelets: true,
        hardware: true,
        reset: true,
        vendorCommands: ['REBOOT', 'TOGGLE_BACKLIGHT'],
      }),
    ).toBe('gyro, battery, facelets, hardware, reset; controls: REBOOT, TOGGLE_BACKLIGHT');
  });

  it('formats GoCube cumulative offline statistics', () => {
    expect(formatOfflineStats({ moves: 1234, timeSeconds: 3661, solves: 42 })).toEqual({
      moves: '1,234',
      duration: '1:01:01',
      solves: '42',
    });
  });

  it('formats a solved Singmaster cycle state as empty cycles', () => {
    expect(
      formatSingmasterCycles({
        CP: [0, 1, 2, 3, 4, 5, 6, 7],
        CO: [0, 0, 0, 0, 0, 0, 0, 0],
        EP: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        EO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      }),
    ).toBe('');
  });

  it('shows compact Kociemba orientations in Singmaster cycles', () => {
    expect(
      formatSingmasterCycles({
        CP: [1, 0, 2, 3, 4, 5, 6, 7],
        CO: [1, 2, 0, 0, 0, 0, 0, 0],
        EP: [0, 1],
        EO: [0, 0],
      }),
    ).toBe('(UFL-,URF+) (unavailable)');
  });

  it('formats CubeTwister Superset ENG permutation cycles', () => {
    expect(
      formatSupersetEngPermutation({
        CP: [4, 1, 2, 0, 7, 5, 6, 3],
        CO: [2, 0, 0, 1, 1, 0, 0, 2],
        EP: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0],
        EO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      }),
    ).toBe('(urf,bru,drb,frd)\n(ur,br,dr,fr)');
  });

  it('uses a prefix for a net corner twist and rejects invalid coordinates', () => {
    expect(
      formatSupersetEngPermutation({
        CP: [0, 1, 2, 3, 4, 5, 6, 7],
        CO: [1, 2, 0, 0, 0, 0, 0, 0],
        EP: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        EO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      }),
    ).toBe('(-urf) (+ufl)');
    expect(
      formatSupersetEngPermutation({
        CP: [0, 0, 2, 3, 4, 5, 6, 7],
        CO: [0, 0, 0, 0, 0, 0, 0, 0],
        EP: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        EO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      }),
    ).toBe('(unavailable)');
  });

  it('round-trips its SSE corner and edge projection to Kociemba coordinates', () => {
    const state = {
      CP: [4, 1, 2, 0, 7, 5, 6, 3],
      CO: [2, 0, 0, 1, 1, 0, 0, 2],
      EP: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0],
      EO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    };
    expect(parseSupersetEngPermutation(formatSupersetEngPermutation(state))).toEqual(state);
    expect(parseSupersetEngPermutation('(++u)')).toBeUndefined();
    expect(parseSupersetEngPermutation('(urf,not-a-location)')).toBeUndefined();
  });

  it.each(kociembaFixtures)(
    'matches Kociemba cubie-level fixture: $name',
    ({ state, display, facelets }) => {
      expect(formatSingmasterCycles(state)).toBe(display);
      if (facelets) {
        const decoded = CubeFacelets.faceletsToKociembaState(facelets);
        expect(decoded.TAG).toBe('Ok');
        if (decoded.TAG === 'Ok') expect(decoded._0).toEqual(state);
      }
    },
  );

  it.each(ssePatterns)(
    'round-trips $name algorithms through facelets into grouped SSE permutation cycles',
    async ({ algorithms, facelets, ssePermutation }) => {
      await kpuzzleReady;
      const kpuzzle = await cube3x3x3.kpuzzle();
      for (const algorithm of algorithms) {
        expect(patternToFacelets(kpuzzle.defaultPattern().applyAlg(new Alg(algorithm)))).toBe(
          facelets,
        );
      }
      const decoded = CubeFacelets.faceletsToKociembaState(facelets);
      expect(decoded.TAG).toBe('Ok');
      if (decoded.TAG === 'Ok') {
        expect(formatSupersetEngPermutation(decoded._0)).toBe(ssePermutation);
        expect(parseSupersetEngPermutation(ssePermutation)).toEqual(decoded._0);
      }
    },
  );
});
