// Conversion between the Kociemba facelet string ("URFDLB" order, 9 stickers
// per face) and cubing.js KPatternData for a 3x3x3.

@genType
type orbit = {
  pieces: array<int>,
  orientation: array<int>,
  orientationMod?: array<int>,
}

/** cubing.js-compatible KPatternData shape, kept structural for pure-domain use. */
@genType
type patternData = {
  @as("CORNERS") corners: orbit,
  @as("EDGES") edges: orbit,
  @as("CENTERS") centers: orbit,
}

/** Cubie coordinates in the Kociemba / smart-cube `URFDLB` convention. */
@genType
type kociembaState = {
  @as("CP") cp: array<int>,
  @as("CO") co: array<int>,
  @as("EP") ep: array<int>,
  @as("EO") eo: array<int>,
}

/** Canonical solved 3×3 facelets in Kociemba `URFDLB` order. */
@genType
let solvedFacelets: string

/** Whether facelets are exactly the canonical solved 3×3 state. */
@genType
let isSolvedFacelets: string => bool

/** Encode validated pattern data, returning `Error` for malformed or impossible orbit data. */
@genType
let patternDataToFacelets: patternData => result<string, string>

/** `patternDataToFacelets` that throws on invalid input (JS boundary). */
@genType
let patternDataToFaceletsExn: patternData => string

/** Validates syntax, canonical centers, cubie uniqueness, orientation sums, and parity. */
@genType
let decodeFacelets: string => result<patternData, string>

/** Alias of `decodeFacelets` for the inverse conversion API. */
@genType
let faceletsToPatternData: string => result<patternData, string>

/** `faceletsToPatternData` that throws on invalid input (JS boundary). */
@genType
let faceletsToPatternDataExn: string => patternData

/** Decode canonical `URFDLB` facelets into Kociemba / smart-cube coordinates. */
@genType
let faceletsToKociembaState: string => result<kociembaState, string>

/** Advance a validated 3×3 state by one standard Singmaster face turn. */
@genType
let applyMove: (patternData, string) => option<patternData>
