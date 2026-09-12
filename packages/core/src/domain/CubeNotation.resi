/** Singmaster face labels, compiled as literal strings. */
@genType @unboxed
type face =
  | @as("U") U
  | @as("R") R
  | @as("F") F
  | @as("D") D
  | @as("L") L
  | @as("B") B

/** Whole-cube rotation axes, compiled as lowercase literal strings. */
@genType @unboxed type axis = | @as("x") X | @as("y") Y | @as("z") Z
/** A clockwise, counter-clockwise, or half turn suffix. */
@genType @unboxed type turn = | @as("") Clockwise | @as("'") CounterClockwise | @as("2") Half

/** Complete whole-cube rotation tokens. */
@genType @unboxed
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

@genType
let faceFromString: string => option<face>
@genType
let faceToString: face => string
@genType
let token: (axis, turn) => regripToken
@genType
let regripFromString: string => option<regripToken>
