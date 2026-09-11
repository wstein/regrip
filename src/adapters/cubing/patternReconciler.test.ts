import { describe, expect, it } from 'vitest';

import * as CubeFacelets from '@wstein/regrip-core/domain/CubeFacelets.res.mjs';
import { createPatternReconciler } from './patternReconciler';
import { faceletsToPattern, kpuzzleReady, patternToFacelets } from './utils';

const solvedFacelets = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

describe('Cubing pattern reconciler', () => {
  it('agrees with cubing.js for every standard face-turn token', async () => {
    await kpuzzleReady;
    const initial = CubeFacelets.faceletsToPatternData(solvedFacelets);
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
      expect(CubeFacelets.patternDataToFacelets(moved!)).toBe(
        patternToFacelets(faceletsToPattern(solvedFacelets).applyMove(move)),
      );
    }
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
