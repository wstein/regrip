type vector = {x: int, y: int, z: int}
type orientation = {
  right: vector,
  up: vector,
  front: vector,
  rightFace: string,
  upFace: string,
  frontFace: string,
}
type t

let make: unit => t
let reset: t => unit
let applyRegrip: (t, CubeNotation.regripToken) => unit
let translate: (t, string) => string
let orientation: t => orientation
let solverFaceForBody: (t, string) => string
/** Re-express a body-local x/y/z regrip token in the current solver frame. */
let solverToken: (t, CubeNotation.regripToken) => CubeNotation.regripToken
/** Re-express a body Kociemba URFDLB facelet string in this logical frame. */
let reframeFacelets: (t, string) => string
