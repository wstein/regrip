import { describe, expect, it } from 'vitest';

import { createPatternReconciler } from './patternReconciler';
import { faceletsToPattern, kpuzzleReady, patternToFacelets } from './utils';

const solvedFacelets = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

describe('Cubing pattern reconciler', () => {
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
});
