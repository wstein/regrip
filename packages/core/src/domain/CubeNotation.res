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

// Body face at each world URFDLB position after a Singmaster whole-cube turn.
let faceOrderForTurn = token =>
  switch token {
  | XTurn => "FRDBLU"
  | XPrime => "BRUFLD"
  | XDouble => "DRBULF"
  | YTurn => "UBRDFL"
  | YPrime => "UFLDBR"
  | YDouble => "ULBDRF"
  | ZTurn => "LUFRDB"
  | ZPrime => "RDFLUB"
  | ZDouble => "DLFURB"
  }

let faceAt = (order: string, face: string): string =>
  switch face {
  | "U" => String.substring(order, ~start=0, ~end=1)
  | "R" => String.substring(order, ~start=1, ~end=2)
  | "F" => String.substring(order, ~start=2, ~end=3)
  | "D" => String.substring(order, ~start=3, ~end=4)
  | "L" => String.substring(order, ~start=4, ~end=5)
  | _ => String.substring(order, ~start=5, ~end=6)
  }

let permuteFaceOrder = (order: string, permutation: string): string =>
  permutation->String.split("")->Array.map(face => faceAt(order, face))->Array.join("")
