import { describe, expect, it } from 'vitest';
import { KPattern } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import * as CubeFacelets from '@wstein/regrip-core/domain/CubeFacelets';
import { createPatternReconciler } from './patternReconciler';
import { faceletsToPattern, kpuzzleReady, patternToFacelets } from './utils';

const solvedFacelets = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

describe('Cubing pattern reconciler', () => {
  it('agrees with cubing.js for every standard face-turn token', async () => {
    await kpuzzleReady;
    const initial = CubeFacelets.faceletsToPatternDataExn(solvedFacelets);
    for (const move of [
      'U',
      "U'",
      'U2',
      'R',
      "R'",
      'R2',
      'F',
      "F'",
      'F2',
      'D',
      "D'",
      'D2',
      'L',
      "L'",
      'L2',
      'B',
      "B'",
      'B2',
    ]) {
      const moved = CubeFacelets.applyMove(initial, move);
      expect(moved).toBeDefined();
      expect(CubeFacelets.patternDataToFaceletsExn(moved!)).toBe(
        patternToFacelets(faceletsToPattern(solvedFacelets).applyMove(move)),
      );
    }
  });

  it('keeps ordinary cubing.js moves with untracked centers convertible', async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    await kpuzzleReady;
    for (const initial of [puzzle.defaultPattern(), faceletsToPattern(solvedFacelets)]) {
      for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
        for (const suffix of ['', "'", '2']) {
          const moved = initial.applyMove(face + suffix);
          expect(moved.patternData.CENTERS.orientationMod).toEqual([1, 1, 1, 1, 1, 1]);
          expect(moved.patternData.CENTERS.orientation).toEqual([0, 0, 0, 0, 0, 0]);
          expect(patternToFacelets(moved)).toBe(
            CubeFacelets.patternDataToFaceletsExn(
              CubeFacelets.applyMove(
                CubeFacelets.faceletsToPatternDataExn(solvedFacelets),
                face + suffix,
              )!,
            ),
          );
        }
      }
    }
  });

  it('rejects a known picture-cube center twist produced by a face turn', async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const data = puzzle.defaultPattern().patternData;
    const picture = new KPattern(puzzle, {
      ...data,
      CENTERS: { pieces: [...data.CENTERS.pieces], orientation: [0, 0, 0, 0, 0, 0] },
    });
    const moved = picture.applyMove('R');
    expect(moved.patternData.CENTERS.orientation).toEqual([0, 0, 0, 1, 0, 0]);
    expect(() => patternToFacelets(moved)).toThrow(
      'center twists cannot be represented by color facelets',
    );
  });

  it('does not request a player reset when a facelet snapshot matches applied moves', async () => {
    await kpuzzleReady;
    const reconciler = createPatternReconciler();
    expect(await reconciler.observeSnapshot(solvedFacelets)).toBe(true);

    reconciler.applyMove('R');
    const movedFacelets = patternToFacelets(faceletsToPattern(solvedFacelets).applyMove('R'));
    expect(await reconciler.observeSnapshot(movedFacelets)).toBe(false);
  });

  it('requests reconciliation when a snapshot differs from the tracked permutation', async () => {
    const reconciler = createPatternReconciler();
    await reconciler.observeSnapshot(solvedFacelets);
    reconciler.applyMove('R');
    expect(await reconciler.observeSnapshot(solvedFacelets)).toBe(true);
  });

  it('treats the next snapshot as authoritative after an explicit reset', async () => {
    const reconciler = createPatternReconciler();
    await reconciler.observeSnapshot(solvedFacelets);
    expect(await reconciler.observeSnapshot(solvedFacelets)).toBe(false);

    reconciler.reset();
    expect(await reconciler.observeSnapshot(solvedFacelets)).toBe(true);
  });
});
