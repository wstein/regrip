// Hand-written types for the compiled ReScript module src/CubeFacelets.res.
// Keep in sync with that file's signatures.

export type Orbit = {
  pieces: number[];
  orientation: number[];
  orientationMod?: number[];
};

export type PatternData = {
  CORNERS: Orbit;
  EDGES: Orbit;
  CENTERS: Orbit;
};

export type DecodeFaceletsResult =
  | { TAG: 'Ok'; _0: PatternData }
  | { TAG: 'Error'; _0: string };

/** Canonical solved 3×3 facelets in Kociemba `URFDLB` order. */
export const solvedFacelets: string;

/** Whether facelets are exactly the canonical solved 3×3 state. */
export function isSolvedFacelets(facelets: string): boolean;

/** Throws if the pattern has non-oriented centers. */
export function patternDataToFacelets(pd: Record<string, Orbit>): string;

/** Validates length, stickers, and cubie legality without throwing. */
export function decodeFacelets(facelets: string): DecodeFaceletsResult;

/** Throws if `facelets` is not a valid 3x3x3 Kociemba state. */
export function faceletsToPatternData(facelets: string): PatternData;

/** Advance a validated 3×3 state by one standard Singmaster face turn. */
export function applyMove(pattern: PatternData, move: string): PatternData | undefined;
