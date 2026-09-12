import { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import * as CubeFacelets from '@wstein/regrip-core/domain/CubeFacelets';

let KPUZZLE_333: KPuzzle;

// cubing.js types its orbit map more broadly than the concrete 3×3 runtime
// shape. The packed-core regression test verifies these exact uppercase keys.
const asCorePatternData = (patternData: KPattern['patternData']): CubeFacelets.patternData =>
  patternData as unknown as CubeFacelets.patternData;

const asCubingPatternData = (patternData: CubeFacelets.patternData): KPattern['patternData'] =>
  patternData as unknown as KPattern['patternData'];

/**
 * Resolves once the 3x3x3 KPuzzle required by `faceletsToPattern` has loaded.
 * Await this before the first `faceletsToPattern` call.
 */
const kpuzzleReady: Promise<void> = cube3x3x3.kpuzzle().then((v) => {
  KPUZZLE_333 = v;
});

/**
 * Convert cubing.js KPattern object to the facelets string in the Kociemba notation
 * @param pattern Source KPattern object
 * @returns String representing cube facelets in the Kociemba notation
 */
function patternToFacelets(pattern: KPattern): string {
  return CubeFacelets.patternDataToFacelets(asCorePatternData(pattern.patternData));
}

/**
 * Convert facelets string in the Kociemba notation to the cubing.js KPattern object
 * @param facelets Source string with facelets in the Kociemba notation
 * @returns KPattern object representing cube state
 * @throws if `facelets` is not a valid 3x3x3 state, or if called before `kpuzzleReady` resolves
 */
function faceletsToPattern(facelets: string): KPattern {
  return new KPattern(
    KPUZZLE_333,
    asCubingPatternData(CubeFacelets.faceletsToPatternData(facelets)),
  );
}

export { patternToFacelets, faceletsToPattern, kpuzzleReady };
