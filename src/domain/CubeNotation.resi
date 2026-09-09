/** Singmaster face labels, compiled as literal strings. */
@unboxed
type face =
  | @as("U") U
  | @as("R") R
  | @as("F") F
  | @as("D") D
  | @as("L") L
  | @as("B") B

/** Whole-cube rotation axes, compiled as lowercase literal strings. */
@unboxed type axis = | @as("x") X | @as("y") Y | @as("z") Z
/** A clockwise, counter-clockwise, or half turn suffix. */
@unboxed type turn = | @as("") Clockwise | @as("'") CounterClockwise | @as("2") Half

/** Complete whole-cube rotation tokens. */
@unboxed
type regripToken =
  | @as("x") XTurn
  | @as("x'") XPrime
  | @as("x2") XDouble
  | @as("y") YTurn
  | @as("y'") YPrime
  | @as("y2") YDouble
  | @as("z") ZTurn
  | @as("z'") ZPrime
  | @as("z2") ZDouble

let faceFromString: string => option<face>
let faceToString: face => string
let token: (axis, turn) => regripToken
let regripFromString: string => option<regripToken>
