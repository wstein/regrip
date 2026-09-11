open Vitest

// Kociemba facelet order: U R F D L B, 9 stickers each.
let solved = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"

// Fixture derived from the pre-port TypeScript utils.ts (see scratchpad/fixtures.json),
// which round-trips through cubing.js. Alg: "F R2 U' B' L D2 F' U".
let scrambled = "FBFRULDLFUBUURDBDBFFRLFFLURDBDUDFURLDBRLLURRBLDLRBDUFB"
let scrambledCornerPieces = [0, 3, 5, 4, 7, 6, 1, 2]
let scrambledCornerOri = [1, 2, 1, 0, 0, 0, 0, 2]
let scrambledEdgePieces = [9, 11, 6, 10, 2, 4, 8, 1, 0, 3, 5, 7]
let scrambledEdgeOri = [1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0]

// More fixtures, all generated from the pre-port utils.ts via cubing.js.
// superflip: every edge flipped, nothing else moved.
let superflip = "UBULURUFURURFRBRDRFUFLFRFDFDFDLDRDBDLULBLFLDLBUBRBLBDB"
let superflipEdgeOri = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
// Sune ("R U R' U R U2 R'"): corner twist + cycle, edges untouched in orientation.
let sune = "FUUUUURUBULLRRRRRRUFLFFFFFFDDDDDDDDDUBBLLLLLLFRRBBBBBB"
let suneCornerPieces = [2, 3, 0, 1, 4, 5, 6, 7]
let suneCornerOri = [1, 0, 1, 1, 0, 0, 0, 0]
let suneEdgePieces = [0, 3, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11]
// Slice-square scramble ("F2 B2 U2 D2 L2 R2"): pure edge permutation.
let slices = "UDUDUDUDURLRLRLRLRFBFBFBFBFDUDUDUDUDLRLRLRLRLBFBFBFBFB"
let slicesEdgePieces = [6, 7, 4, 5, 2, 3, 0, 1, 11, 10, 9, 8]

let solvedPatternData: CubeFacelets.patternData = {
  corners: {pieces: [0, 1, 2, 3, 4, 5, 6, 7], orientation: Array.make(~length=8, 0)},
  edges: {
    pieces: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    orientation: Array.make(~length=12, 0),
  },
  centers: {pieces: [0, 1, 2, 3, 4, 5], orientation: Array.make(~length=6, 0)},
}

describe("isSolvedFacelets", () => {
  test("accepts only the canonical solved facelet string", t => {
    t->expect(CubeFacelets.solvedFacelets)->Expect.toBe(solved)
    t->expect(solved->CubeFacelets.isSolvedFacelets)->Expect.toBe(true)
    t
    ->expect("RUUUUUUUUURRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"->CubeFacelets.isSolvedFacelets)
    ->Expect.toBe(false)
  })
})

// Decode helper: project the corner/edge orbits so array equality is easy to assert.
let orbits = f =>
  switch CubeFacelets.decodeFacelets(f) {
  | Ok(pd) =>
    Some((pd.corners.pieces, pd.corners.orientation, pd.edges.pieces, pd.edges.orientation))
  | Error(_) => None
  }

describe("patternDataToFacelets", () => {
  test("solved pattern -> solved facelets", t => {
    t->expect(CubeFacelets.patternDataToFacelets(solvedPatternData))->Expect.toBe(solved)
  })

  test("scrambled pattern -> scrambled facelets", t => {
    let pd: CubeFacelets.patternData = {
      corners: {pieces: scrambledCornerPieces, orientation: scrambledCornerOri},
      edges: {pieces: scrambledEdgePieces, orientation: scrambledEdgeOri},
      centers: {pieces: [0, 1, 2, 3, 4, 5], orientation: Array.make(~length=6, 0)},
    }
    t->expect(CubeFacelets.patternDataToFacelets(pd))->Expect.toBe(scrambled)
  })

  test("rejects non-oriented centers", t => {
    let pd = {
      ...solvedPatternData,
      centers: {pieces: [1, 0, 2, 3, 4, 5], orientation: Array.make(~length=6, 0)},
    }
    t->expect(() => CubeFacelets.patternDataToFacelets(pd))->Expect.toThrow
  })
})

describe("decodeFacelets", () => {
  test("solved facelets -> solved orbits", t => {
    t
    ->expect(orbits(solved))
    ->Expect.toEqual(
      Some((
        [0, 1, 2, 3, 4, 5, 6, 7],
        Array.make(~length=8, 0),
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        Array.make(~length=12, 0),
      )),
    )
  })

  test("scrambled facelets -> matching orbits", t => {
    t
    ->expect(orbits(scrambled))
    ->Expect.toEqual(
      Some((scrambledCornerPieces, scrambledCornerOri, scrambledEdgePieces, scrambledEdgeOri)),
    )
  })

  test("decodes superflip as an all-edges-flipped pattern", t => {
    switch CubeFacelets.decodeFacelets(superflip) {
    | Ok(pd) =>
      t->expect(pd.edges.pieces)->Expect.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
      t->expect(pd.edges.orientation)->Expect.toEqual(superflipEdgeOri)
      t->expect(pd.corners.orientation)->Expect.toEqual(Array.make(~length=8, 0))
    | Error(msg) => t->expect("ok")->Expect.toBe("Error: " ++ msg)
    }
  })

  test("decodes Sune (corner twist + cycle, edges by orientation untouched)", t => {
    switch CubeFacelets.decodeFacelets(sune) {
    | Ok(pd) =>
      t->expect(pd.corners.pieces)->Expect.toEqual(suneCornerPieces)
      t->expect(pd.corners.orientation)->Expect.toEqual(suneCornerOri)
      t->expect(pd.edges.pieces)->Expect.toEqual(suneEdgePieces)
      t->expect(pd.edges.orientation)->Expect.toEqual(Array.make(~length=12, 0))
    | Error(msg) => t->expect("ok")->Expect.toBe("Error: " ++ msg)
    }
  })

  test("decodes a pure edge permutation", t => {
    switch CubeFacelets.decodeFacelets(slices) {
    | Ok(pd) => t->expect(pd.edges.pieces)->Expect.toEqual(slicesEdgePieces)
    | Error(msg) => t->expect("ok")->Expect.toBe("Error: " ++ msg)
    }
  })

  test("forces centers to the identity orbit", t => {
    switch CubeFacelets.decodeFacelets(scrambled) {
    | Ok(pd) => t->expect(pd.centers.pieces)->Expect.toEqual([0, 1, 2, 3, 4, 5])
    | Error(msg) => t->expect("ok")->Expect.toBe("Error: " ++ msg)
    }
  })

  test("round-trips solved, scrambled, superflip, Sune and slices", t => {
    let roundtrip = f =>
      switch CubeFacelets.decodeFacelets(f) {
      | Ok(pd) => CubeFacelets.patternDataToFacelets(pd)
      | Error(msg) => "ERR:" ++ msg
      }
    [solved, scrambled, superflip, sune, slices]->Array.forEach(
      f => t->expect(roundtrip(f))->Expect.toBe(f),
    )
  })

  test("decodes Kociemba coordinates independently from cubing.js orbit order", t => {
    let ganFacelets = "BUBUUUUUDFRLRRRFRRFFRFFFFFRDDUDDDDDDRLLLLLLLLUBUBBBBBB"
    switch CubeFacelets.faceletsToKociembaState(ganFacelets) {
    | Ok(state) => {
        t->expect(state.cp)->Expect.toEqual([4, 1, 3, 2, 0, 5, 6, 7])
        t->expect(state.co)->Expect.toEqual([0, 0, 2, 1, 0, 0, 0, 0])
        t->expect(state.ep)->Expect.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
        t->expect(state.eo)->Expect.toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      }
    | Error(msg) => t->expect("ok")->Expect.toBe("Error: " ++ msg)
    }
  })

  test("rejects a well-formed but geometrically impossible state", t => {
    // solved with the stickers at index 1 and 10 swapped: 9 of each letter,
    // but an edge now reads "UU".
    let bad = "URUUUUUUURURRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"
    t->expect(CubeFacelets.decodeFacelets(bad)->Result.isError)->Expect.toBe(true)
  })

  test("rejects wrong length", t => {
    t->expect(CubeFacelets.decodeFacelets("UUU")->Result.isError)->Expect.toBe(true)
  })

  test("rejects invalid characters", t => {
    let bad = "X" ++ String.slice(solved, ~start=1)
    t->expect(CubeFacelets.decodeFacelets(bad)->Result.isError)->Expect.toBe(true)
  })

  test("rejects wrong sticker counts", t => {
    // 8 U's, 10 R's
    let bad = "RUUUUUUUU" ++ String.slice(solved, ~start=9)
    t->expect(CubeFacelets.decodeFacelets(bad)->Result.isError)->Expect.toBe(true)
  })
})

describe("faceletsToPatternData", () => {
  test("returns the decoded pattern for valid input", t => {
    let pd = CubeFacelets.faceletsToPatternData(scrambled)
    t->expect(pd.corners.pieces)->Expect.toEqual(scrambledCornerPieces)
  })

  test("raises for invalid input", t => {
    t->expect(() => CubeFacelets.faceletsToPatternData("nonsense"))->Expect.toThrow
  })
})

describe("applyMove", () => {
  test("advances a decoded state and composes inverse turns", t => {
    let initial = CubeFacelets.faceletsToPatternData(scrambled)
    let afterL = initial->CubeFacelets.applyMove("L")->Option.getUnsafe
    let restored = afterL->CubeFacelets.applyMove("L'")->Option.getUnsafe
    t->expect(restored->CubeFacelets.patternDataToFacelets)->Expect.toBe(scrambled)
  })

  test("supports quarter, half, and inverse turns", t => {
    let initial = CubeFacelets.faceletsToPatternData(solved)
    let d2 = initial->CubeFacelets.applyMove("D2")->Option.getUnsafe
    t
    ->expect(d2->CubeFacelets.patternDataToFacelets)
    ->Expect.toBe("UUUUUUUUURRRRRRLLLFFFFFFBBBDDDDDDDDDLLLLLLRRRBBBBBBFFF")
  })

  test("does not claim to apply unsupported notation", t =>
    t
    ->expect(solved->CubeFacelets.faceletsToPatternData->CubeFacelets.applyMove("Rw"))
    ->Expect.toBe(None)
  )
})
