import type { KPattern } from 'cubing/kpuzzle';

import { faceletsToPattern, kpuzzleReady } from './utils';

/**
 * Tracks the body-frame permutation that TwistyPlayer should be showing.
 *
 * This is deliberately an adapter: cubing.js supplies the tested 3×3
 * permutation tables. The domain `PlayerSync` reducer decides only when an
 * authoritative snapshot should be applied or released.
 */
export function createPatternReconciler() {
  let expected: KPattern | undefined;
  let movesBeforeFirstSnapshot: string[] = [];
  const pendingSnapshots: { expectedAtCapture: KPattern | undefined; movesAfter: string[] }[] = [];

  return {
    applyMove(move: string): void {
      if (!expected) {
        movesBeforeFirstSnapshot.push(move);
        return;
      }
      expected = expected.applyMove(move);
      for (const snapshot of pendingSnapshots) snapshot.movesAfter.push(move);
    },
    async observeSnapshot(facelets: string): Promise<boolean> {
      // Capture the expected permutation before awaiting kpuzzle loading. BLE
      // moves may arrive during that await; they belong after this snapshot,
      // not in the comparison against it.
      const snapshot = { expectedAtCapture: expected, movesAfter: [] as string[] };
      pendingSnapshots.push(snapshot);
      await kpuzzleReady;
      const actual = faceletsToPattern(facelets);
      const matchesExpected = snapshot.expectedAtCapture?.isIdentical(actual) ?? false;
      expected = actual;
      for (const move of movesBeforeFirstSnapshot) expected = expected.applyMove(move);
      movesBeforeFirstSnapshot = [];
      for (const move of snapshot.movesAfter) expected = expected.applyMove(move);
      pendingSnapshots.splice(pendingSnapshots.indexOf(snapshot), 1);
      return !matchesExpected;
    },
    reset(): void {
      expected = undefined;
      movesBeforeFirstSnapshot = [];
      pendingSnapshots.length = 0;
    },
  };
}
