@genType
type vector = {x: int, y: int, z: int}
@genType
type orientation = {
  right: vector,
  up: vector,
  front: vector,
  rightFace: string,
  upFace: string,
  frontFace: string,
}
@genType
type t

@genType
let make: unit => t
@genType
let reset: t => t
@genType
let applyRegrip: (t, CubeNotation.regripToken) => t
@genType
let translate: (t, string) => string
@genType
let orientation: t => orientation
@genType
let solverFaceForBody: (t, string) => string
/** Re-express a body-local x/y/z regrip token in the current solver frame. */
@genType
let solverToken: (t, CubeNotation.regripToken) => CubeNotation.regripToken
/** Re-express a body Kociemba URFDLB facelet string in this logical frame. */
@genType
let reframeFacelets: (t, string) => string
