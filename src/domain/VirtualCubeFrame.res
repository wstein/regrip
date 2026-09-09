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
let stickerPositions = [0, 1, 2, 3, 4, 5, 6, 7, 8]

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

type faceGeometry = {normal: vector, right: vector, down: vector}

// Kociemba URFDLB facelet grids, viewed from outside each face.
let geometry = (face: string): faceGeometry =>
  switch face {
  | "U" => {normal: {x: 0, y: 1, z: 0}, right: {x: 1, y: 0, z: 0}, down: {x: 0, y: 0, z: 1}}
  | "R" => {normal: {x: 1, y: 0, z: 0}, right: {x: 0, y: 0, z: -1}, down: {x: 0, y: -1, z: 0}}
  | "F" => {normal: {x: 0, y: 0, z: 1}, right: {x: 1, y: 0, z: 0}, down: {x: 0, y: -1, z: 0}}
  | "D" => {normal: {x: 0, y: -1, z: 0}, right: {x: 1, y: 0, z: 0}, down: {x: 0, y: 0, z: -1}}
  | "L" => {normal: {x: -1, y: 0, z: 0}, right: {x: 0, y: 0, z: 1}, down: {x: 0, y: -1, z: 0}}
  | _ => {normal: {x: 0, y: 0, z: -1}, right: {x: -1, y: 0, z: 0}, down: {x: 0, y: -1, z: 0}}
  }

let dot = (left: vector, right: vector): int =>
  left.x * right.x + left.y * right.y + left.z * right.z

let faceForNormal = (direction: vector): string =>
  switch positions->Array.find(index => {
    let face = charAt(faceOrder, index)
    dot(geometry(face).normal, direction) == 1
  }) {
  | Some(index) => charAt(faceOrder, index)
  | None => ""
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

/** Re-express physical Kociemba facelets in this logical regrip frame. */
let reframeFacelets = (frame: t, facelets: string): string =>
  if String.length(facelets) != 54 {
    facelets
  } else {
    let frameOrientation = orientation(frame)
    let physicalX = geometry(frameOrientation.rightFace).normal
    let physicalY = geometry(frameOrientation.upFace).normal
    let physicalZ = geometry(frameOrientation.frontFace).normal
    let rotate = (direction: vector): vector => {
      x: direction.x * physicalX.x + direction.y * physicalY.x + direction.z * physicalZ.x,
      y: direction.x * physicalX.y + direction.y * physicalY.y + direction.z * physicalZ.y,
      z: direction.x * physicalX.z + direction.y * physicalY.z + direction.z * physicalZ.z,
    }

    positions
    ->Array.map(logicalIndex => {
      let logical = geometry(charAt(faceOrder, logicalIndex))
      let physicalFace = faceForNormal(rotate(logical.normal))
      let physical = geometry(physicalFace)
      let rotatedRight = rotate(logical.right)
      let rotatedDown = rotate(logical.down)
      stickerPositions
      ->Array.map(stickerIndex => {
        let row = stickerIndex / 3 - 1
        let column = stickerIndex % 3 - 1
        let physicalRow =
          column * dot(rotatedRight, physical.down) + row * dot(rotatedDown, physical.down) + 1
        let physicalColumn =
          column * dot(rotatedRight, physical.right) + row * dot(rotatedDown, physical.right) + 1
        let rawIndex = faceIndex(physicalFace) * 9 + physicalRow * 3 + physicalColumn
        logicalFaceForPhysical(frame, charAt(facelets, rawIndex))
      })
      ->Array.join("")
    })
    ->Array.join("")
  }
