// Conversion between the Kociemba facelet string ("URFDLB" order, 9 stickers per
// face) and cubing.js KPatternData for a 3x3x3. Ported from the original
// src/utils.ts; the async KPuzzle handling stays in the TypeScript shim.

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

let reidEdgeOrder = ["UF", "UR", "UB", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BR", "BL"]
let reidCornerOrder = ["UFR", "URB", "UBL", "ULF", "DRF", "DFL", "DLB", "DBR"]
let reidCenterOrder = ["U", "L", "F", "R", "B", "D"]

// For each of the 54 facelets: (orbit, permutation index, orientation index).
// orbit 0 = edges, 1 = corners, 2 = centers.
let reidToFaceletsMap = [
  (1, 2, 0),
  (0, 2, 0),
  (1, 1, 0),
  (0, 3, 0),
  (2, 0, 0),
  (0, 1, 0),
  (1, 3, 0),
  (0, 0, 0),
  (1, 0, 0),
  (1, 0, 2),
  (0, 1, 1),
  (1, 1, 1),
  (0, 8, 1),
  (2, 3, 0),
  (0, 10, 1),
  (1, 4, 1),
  (0, 5, 1),
  (1, 7, 2),
  (1, 3, 2),
  (0, 0, 1),
  (1, 0, 1),
  (0, 9, 0),
  (2, 2, 0),
  (0, 8, 0),
  (1, 5, 1),
  (0, 4, 1),
  (1, 4, 2),
  (1, 5, 0),
  (0, 4, 0),
  (1, 4, 0),
  (0, 7, 0),
  (2, 5, 0),
  (0, 5, 0),
  (1, 6, 0),
  (0, 6, 0),
  (1, 7, 0),
  (1, 2, 2),
  (0, 3, 1),
  (1, 3, 1),
  (0, 11, 1),
  (2, 1, 0),
  (0, 9, 1),
  (1, 6, 1),
  (0, 7, 1),
  (1, 5, 2),
  (1, 1, 2),
  (0, 2, 1),
  (1, 2, 1),
  (0, 10, 0),
  (2, 4, 0),
  (0, 11, 0),
  (1, 7, 1),
  (0, 6, 1),
  (1, 6, 2),
]

// Facelet indices (0..47, centers excluded) that make up each corner / edge cubie.
let cornerMapping = [
  [0, 21, 15],
  [5, 13, 47],
  [7, 45, 39],
  [2, 37, 23],
  [29, 10, 16],
  [31, 18, 32],
  [26, 34, 40],
  [24, 42, 8],
]
let edgeMapping = [
  [1, 22],
  [3, 14],
  [6, 46],
  [4, 38],
  [30, 17],
  [27, 9],
  [25, 41],
  [28, 33],
  [19, 12],
  [20, 35],
  [44, 11],
  [43, 36],
]

let faceOrder = "URFDLB"

let rotateLeft = (s, i) => String.slice(s, ~start=i) ++ String.slice(s, ~start=0, ~end=i)

// Piece name (in any rotation) -> (piece index, orientation).
let pieceMap = {
  let m = Dict.make()
  reidEdgeOrder->Array.forEachWithIndex((edge, idx) =>
    for i in 0 to 1 {
      m->Dict.set(rotateLeft(edge, i), (idx, i))
    }
  )
  reidCornerOrder->Array.forEachWithIndex((corner, idx) =>
    for i in 0 to 2 {
      m->Dict.set(rotateLeft(corner, i), (idx, i))
    }
  )
  m
}

let centersOriented = (pd: patternData) => pd.centers.pieces->Array.everyWithIndex((p, i) => p == i)

// (edges, corners, centers) as Reid piece-name arrays.
let toReid333Struct = (pd: patternData): result<
  (array<string>, array<string>, array<string>),
  string,
> =>
  if !centersOriented(pd) {
    Error("non-oriented puzzles are not supported")
  } else {
    let edges = Array.fromInitializer(~length=12, i =>
      rotateLeft(
        reidEdgeOrder->Array.getUnsafe(pd.edges.pieces->Array.getUnsafe(i)),
        pd.edges.orientation->Array.getUnsafe(i),
      )
    )
    let corners = Array.fromInitializer(~length=8, i =>
      rotateLeft(
        reidCornerOrder->Array.getUnsafe(pd.corners.pieces->Array.getUnsafe(i)),
        pd.corners.orientation->Array.getUnsafe(i),
      )
    )
    Ok((edges, corners, reidCenterOrder))
  }

let patternDataToFacelets = (pd: patternData): string =>
  switch toReid333Struct(pd) {
  | Error(msg) => JsError.throwWithMessage(msg)
  | Ok((edges, corners, centers)) =>
    reidToFaceletsMap
    ->Array.map(((orbit, perm, ori)) => {
      let arr = switch orbit {
      | 0 => edges
      | 1 => corners
      | _ => centers
      }
      String.getUnsafe(arr->Array.getUnsafe(perm), ori)
    })
    ->Array.join("")
  }

// 48 sticker letters (centers dropped), in the order utils.ts produced them:
// each 9-char face reversed, then positions 0..8 except the middle.
let toStickers = (facelets: string): array<string> => {
  let stickers = []
  for f in 0 to 5 {
    let face = String.substring(facelets, ~start=f * 9, ~end=f * 9 + 9)
    face
    ->String.split("")
    ->Array.toReversed
    ->Array.forEachWithIndex((s, i) =>
      if i != 4 {
        stickers->Array.push(s)
      }
    )
  }
  stickers
}

let decodeOrbit = (mapping: array<array<int>>, stickers: array<string>): result<
  (array<int>, array<int>),
  string,
> => {
  let pieces = []
  let orientation = []
  let error = ref(None)
  mapping->Array.forEach(indices => {
    let key = indices->Array.map(i => stickers->Array.getUnsafe(i))->Array.join("")
    switch pieceMap->Dict.get(key) {
    | Some((p, o)) => {
        pieces->Array.push(p)
        orientation->Array.push(o)
      }
    | None => error := Some(`unknown cubie "${key}"`)
    }
  })
  switch error.contents {
  | Some(msg) => Error(msg)
  | None => Ok((pieces, orientation))
  }
}

let decodeFacelets = (facelets: string): result<patternData, string> => {
  let chars = facelets->String.split("")
  let count = c => chars->Array.filter(x => x == c)->Array.length
  if String.length(facelets) != 54 {
    Error(`facelets must be 54 characters, got ${Int.toString(String.length(facelets))}`)
  } else if !(chars->Array.every(c => String.includes(faceOrder, c))) {
    Error(`facelets contains characters outside "${faceOrder}"`)
  } else if !(faceOrder->String.split("")->Array.every(c => count(c) == 9)) {
    Error("facelets must contain exactly 9 of each face letter")
  } else {
    let stickers = toStickers(facelets)
    switch (decodeOrbit(cornerMapping, stickers), decodeOrbit(edgeMapping, stickers)) {
    | (Ok((cornerPieces, cornerOri)), Ok((edgePieces, edgeOri))) =>
      Ok({
        corners: {pieces: cornerPieces, orientation: cornerOri},
        edges: {pieces: edgePieces, orientation: edgeOri},
        centers: {
          pieces: [0, 1, 2, 3, 4, 5],
          orientation: Array.make(~length=6, 0),
          orientationMod: Array.make(~length=6, 1),
        },
      })
    | (Error(msg), _) | (_, Error(msg)) => Error(msg)
    }
  }
}

let faceletsToPatternData = (facelets: string): patternData =>
  switch decodeFacelets(facelets) {
  | Ok(pd) => pd
  | Error(msg) => JsError.throwWithMessage(msg)
  }

type turnOrbit = {pieces: array<int>, orientation: array<int>}
type turn = {corners: turnOrbit, edges: turnOrbit}

let u: turn = {
  corners: {pieces: [1, 2, 3, 0, 4, 5, 6, 7], orientation: [0, 0, 0, 0, 0, 0, 0, 0]},
  edges: {pieces: [1, 2, 3, 0, 4, 5, 6, 7, 8, 9, 10, 11], orientation: Array.make(~length=12, 0)},
}
let r: turn = {
  corners: {pieces: [4, 0, 2, 3, 7, 5, 6, 1], orientation: [2, 1, 0, 0, 1, 0, 0, 2]},
  edges: {pieces: [0, 8, 2, 3, 4, 10, 6, 7, 5, 9, 1, 11], orientation: Array.make(~length=12, 0)},
}
let f: turn = {
  corners: {pieces: [3, 1, 2, 5, 0, 4, 6, 7], orientation: [1, 0, 0, 2, 2, 1, 0, 0]},
  edges: {
    pieces: [9, 1, 2, 3, 8, 5, 6, 7, 0, 4, 10, 11],
    orientation: [1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0],
  },
}
let d: turn = {
  corners: {pieces: [0, 1, 2, 3, 5, 6, 7, 4], orientation: Array.make(~length=8, 0)},
  edges: {pieces: [0, 1, 2, 3, 7, 4, 5, 6, 8, 9, 10, 11], orientation: Array.make(~length=12, 0)},
}
let l: turn = {
  corners: {pieces: [0, 1, 6, 2, 4, 3, 5, 7], orientation: [0, 0, 2, 1, 0, 2, 1, 0]},
  edges: {pieces: [0, 1, 2, 11, 4, 5, 6, 9, 8, 3, 10, 7], orientation: Array.make(~length=12, 0)},
}
let b: turn = {
  corners: {pieces: [0, 7, 1, 3, 4, 5, 2, 6], orientation: [0, 2, 1, 0, 0, 0, 2, 1]},
  edges: {
    pieces: [0, 1, 10, 3, 4, 5, 11, 7, 8, 9, 6, 2],
    orientation: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
  },
}

let parseMove = (move: string): option<(turn, int)> =>
  switch move {
  | "U" => Some((u, 1))
  | "U2" => Some((u, 2))
  | "U'" => Some((u, 3))
  | "R" => Some((r, 1))
  | "R2" => Some((r, 2))
  | "R'" => Some((r, 3))
  | "F" => Some((f, 1))
  | "F2" => Some((f, 2))
  | "F'" => Some((f, 3))
  | "D" => Some((d, 1))
  | "D2" => Some((d, 2))
  | "D'" => Some((d, 3))
  | "L" => Some((l, 1))
  | "L2" => Some((l, 2))
  | "L'" => Some((l, 3))
  | "B" => Some((b, 1))
  | "B2" => Some((b, 2))
  | "B'" => Some((b, 3))
  | _ => None
  }

let applyOrbit = (orbit: orbit, turn: turnOrbit, modulo: int): orbit => {
  pieces: Array.fromInitializer(~length=orbit.pieces->Array.length, index =>
    orbit.pieces->Array.getUnsafe(turn.pieces->Array.getUnsafe(index))
  ),
  orientation: Array.fromInitializer(~length=orbit.orientation->Array.length, index => {
    let source = turn.pieces->Array.getUnsafe(index)
    (orbit.orientation->Array.getUnsafe(source) + turn.orientation->Array.getUnsafe(index)) % modulo
  }),
  orientationMod: ?orbit.orientationMod,
}

let applyTurn = (pattern: patternData, turn: turn): patternData => {
  corners: applyOrbit(pattern.corners, turn.corners, 3),
  edges: applyOrbit(pattern.edges, turn.edges, 2),
  centers: pattern.centers,
}

/** Advance a validated 3×3 state by one standard Singmaster face turn. */
let applyMove = (pattern: patternData, move: string): option<patternData> =>
  switch parseMove(move) {
  | None => None
  | Some((turn, turns)) => {
      let next = ref(pattern)
      for _ in 1 to turns {
        next := applyTurn(next.contents, turn)
      }
      Some(next.contents)
    }
  }
