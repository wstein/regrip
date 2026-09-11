// Conversion between the Kociemba facelet string ("URFDLB" order, 9 stickers
// per face) and cubing.js KPatternData for a 3x3x3.

type orbit = {
  pieces: array<int>,
  orientation: array<int>,
  orientationMod?: array<int>,
}

/** cubing.js-compatible KPatternData shape, kept structural for pure-domain use. */
type patternData = {
  @as("CORNERS") corners: orbit,
  @as("EDGES") edges: orbit,
  @as("CENTERS") centers: orbit,
}

/** Cubie coordinates in the Kociemba / smart-cube `URFDLB` convention. */
type kociembaState = {
  @as("CP") cp: array<int>,
  @as("CO") co: array<int>,
  @as("EP") ep: array<int>,
  @as("EO") eo: array<int>,
}

/** Canonical solved 3×3 facelets in Kociemba `URFDLB` order. */
let solvedFacelets: string

/** Whether facelets are exactly the canonical solved 3×3 state. */
let isSolvedFacelets: string => bool

/** Throws if the pattern has non-oriented centers. */
let patternDataToFacelets: patternData => string

/** Validates length / alphabet / sticker counts / piece legality. */
let decodeFacelets: string => result<patternData, string>

/** `decodeFacelets` that throws on invalid input (JS boundary). */
let faceletsToPatternData: string => patternData

/** Decode canonical `URFDLB` facelets into Kociemba / smart-cube coordinates. */
let faceletsToKociembaState: string => result<kociembaState, string>

/** Advance a validated 3×3 state by one standard Singmaster face turn. */
let applyMove: (patternData, string) => option<patternData>
