// Shared, wire-compatible vocabulary for cube faces and whole-cube turns.
// The unboxed variants compile to their Singmaster strings, while preserving
// exhaustiveness inside the domain and string unions for TypeScript consumers.

@unboxed
type face =
  | @as("U") U
  | @as("R") R
  | @as("F") F
  | @as("D") D
  | @as("L") L
  | @as("B") B

@unboxed type axis = | @as("x") X | @as("y") Y | @as("z") Z
@unboxed type turn = | @as("") Clockwise | @as("'") CounterClockwise | @as("2") Half

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

let faceFromString = (value: string): option<face> =>
  switch value {
  | "U" => Some(U)
  | "R" => Some(R)
  | "F" => Some(F)
  | "D" => Some(D)
  | "L" => Some(L)
  | "B" => Some(B)
  | _ => None
  }

let faceToString = (value: face): string =>
  switch value {
  | U => "U"
  | R => "R"
  | F => "F"
  | D => "D"
  | L => "L"
  | B => "B"
  }

let token = (axis: axis, turn: turn): regripToken =>
  switch (axis, turn) {
  | (X, Clockwise) => XTurn
  | (X, CounterClockwise) => XPrime
  | (X, Half) => XDouble
  | (Y, Clockwise) => YTurn
  | (Y, CounterClockwise) => YPrime
  | (Y, Half) => YDouble
  | (Z, Clockwise) => ZTurn
  | (Z, CounterClockwise) => ZPrime
  | (Z, Half) => ZDouble
  }

let regripFromString = (value: string): option<regripToken> =>
  switch value {
  | "x" => Some(XTurn)
  | "x'" => Some(XPrime)
  | "x2" => Some(XDouble)
  | "y" => Some(YTurn)
  | "y'" => Some(YPrime)
  | "y2" => Some(YDouble)
  | "z" => Some(ZTurn)
  | "z'" => Some(ZPrime)
  | "z2" => Some(ZDouble)
  | _ => None
  }
