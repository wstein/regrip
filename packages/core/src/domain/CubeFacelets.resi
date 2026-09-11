// Conversion between the Kociemba facelet string ("URFDLB" order, 9 stickers
// per face) and cubing.js KPatternData for a 3x3x3.

type orbit = {
  pieces: array<int>,
  orientation: array<int>,
  orientationMod?: array<int>,
}

type patternData = {
  @as("CORNERS") corners: orbit,
  @as("EDGES") edges: orbit,
  @as("CENTERS") centers: orbit,
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

/** Advance a validated 3×3 state by one standard Singmaster face turn. */
let applyMove: (patternData, string) => option<patternData>
