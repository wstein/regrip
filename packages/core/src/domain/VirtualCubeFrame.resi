// Pure virtual regrip frame. It owns logical/physical URFDLB composition;
// session adapters may use it to reframe moves, facelets, or view gizmos.

@genType
type vector = {x: int, y: int, z: int}
/** The logical R/U/F axes' unit vectors and body-face letters, for driving a
 * 3D orientation indicator. */
@genType
type orientation = {
  right: vector,
  up: vector,
  front: vector,
  rightFace: string,
  upFace: string,
  frontFace: string,
}
/** The current body→logical URFDLB face mapping. */
@genType
type t

/** The identity frame: logical and body faces coincide. */
@genType
let make: unit => t
/** Back to the identity frame. */
@genType
let reset: t => t
/** Compose one more x/y/z whole-cube regrip onto the frame. */
@genType
let applyRegrip: (t, CubeNotation.regripToken) => t
/** Rewrite a body-frame move token's face letter into the logical frame. */
@genType
let translate: (t, string) => string
/** The logical frame's current axes, for a view gizmo. */
@genType
let orientation: t => orientation
/** The logical face letter a given body face currently maps to. */
@genType
let solverFaceForBody: (t, string) => string
/** Re-express a body-local x/y/z regrip token in the current solver frame. */
@genType
let solverToken: (t, CubeNotation.regripToken) => CubeNotation.regripToken
/** Re-express a body Kociemba URFDLB facelet string in this logical frame. */
@genType
let reframeFacelets: (t, string) => string
