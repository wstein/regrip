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

/** Throws if the pattern has non-oriented centers. */
export function patternDataToFacelets(pd: Record<string, Orbit>): string;

/** Validates length, stickers, and cubie legality without throwing. */
export function decodeFacelets(facelets: string): DecodeFaceletsResult;

/** Throws if `facelets` is not a valid 3x3x3 Kociemba state. */
export function faceletsToPatternData(facelets: string): PatternData;
