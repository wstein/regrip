// Pure virtual regrip frame. It owns logical/physical URFDLB composition;
// session adapters may use it to reframe moves, facelets, or view gizmos.

type vector = {x: int, y: int, z: int}
type orientation = {
  right: vector,
  up: vector,
  front: vector,
  rightFace: string,
  upFace: string,
  frontFace: string,
}

type t = {mutable logicalToPhysical: string}

let faceOrder = "URFDLB"
let positions = [0, 1, 2, 3, 4, 5]

let charAt = (value: string, index: int): string =>
  String.substring(value, ~start=index, ~end=index + 1)

let faceIndex = (face: string): int =>
  switch face {
  | "U" => 0
  | "R" => 1
  | "F" => 2
  | "D" => 3
  | "L" => 4
  | "B" => 5
  | _ => -1
  }

let normal = (face: string): vector =>
  switch face {
  | "U" => {x: 0, y: 1, z: 0}
  | "R" => {x: 1, y: 0, z: 0}
  | "F" => {x: 0, y: 0, z: 1}
  | "D" => {x: 0, y: -1, z: 0}
  | "L" => {x: -1, y: 0, z: 0}
  | _ => {x: 0, y: 0, z: -1}
  }

let make = (): t => {logicalToPhysical: faceOrder}
let reset = (frame: t): unit => frame.logicalToPhysical = faceOrder

let applyRegrip = (frame: t, notationToken: string): unit => {
  let step = RegripDetector.faceOrderForNotation(notationToken)
  frame.logicalToPhysical =
    positions
    ->Array.map(index => {
      let physicalAtLogical = charAt(frame.logicalToPhysical, index)
      charAt(step, faceIndex(physicalAtLogical))
    })
    ->Array.join("")
}

let translate = (frame: t, move: string): string => {
  if String.length(move) == 0 {
    move
  } else {
    let physicalFace = charAt(move, 0)
    let logicalIndex =
      positions->Array.find(index => charAt(frame.logicalToPhysical, index) == physicalFace)
    switch logicalIndex {
    | Some(index) =>
      `${charAt(faceOrder, index)}${String.substring(move, ~start=1, ~end=String.length(move))}`
    | None => move
    }
  }
}

let orientation = (frame: t): orientation => {
  let rightFace = charAt(frame.logicalToPhysical, 1)
  let upFace = charAt(frame.logicalToPhysical, 0)
  let frontFace = charAt(frame.logicalToPhysical, 2)
  {
    right: normal(rightFace),
    up: normal(upFace),
    front: normal(frontFace),
    rightFace,
    upFace,
    frontFace,
  }
}

let logicalFaceForPhysical = (frame: t, physicalFace: string): string => {
  switch positions->Array.find(index => charAt(frame.logicalToPhysical, index) == physicalFace) {
  | Some(index) => charAt(faceOrder, index)
  | None => physicalFace
  }
}
