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

let solvedPatternData: CubeFacelets.patternData = {
  corners: {pieces: [0, 1, 2, 3, 4, 5, 6, 7], orientation: Array.make(~length=8, 0)},
  edges: {
    pieces: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    orientation: Array.make(~length=12, 0),
  },
  centers: {pieces: [0, 1, 2, 3, 4, 5], orientation: Array.make(~length=6, 0)},
}

// Decode helper: project the corner/edge orbits so array equality is easy to assert.
let orbits = f =>
  switch CubeFacelets.decodeFacelets(f) {
  | Ok(pd) => Some((pd.corners.pieces, pd.corners.orientation, pd.edges.pieces, pd.edges.orientation))
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
    let pd = {...solvedPatternData, centers: {pieces: [1, 0, 2, 3, 4, 5], orientation: Array.make(~length=6, 0)}}
    t->expect(() => CubeFacelets.patternDataToFacelets(pd))->Expect.toThrow
  })
})

describe("decodeFacelets", () => {
  test("solved facelets -> solved orbits", t => {
    t->expect(orbits(solved))->Expect.toEqual(
      Some((
        [0, 1, 2, 3, 4, 5, 6, 7],
        Array.make(~length=8, 0),
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        Array.make(~length=12, 0),
      )),
    )
  })

  test("scrambled facelets -> matching orbits", t => {
    t->expect(orbits(scrambled))->Expect.toEqual(
      Some((scrambledCornerPieces, scrambledCornerOri, scrambledEdgePieces, scrambledEdgeOri)),
    )
  })

  test("round-trips solved and scrambled", t => {
    let roundtrip = f =>
      switch CubeFacelets.decodeFacelets(f) {
      | Ok(pd) => CubeFacelets.patternDataToFacelets(pd)
      | Error(msg) => "ERR:" ++ msg
      }
    t->expect(roundtrip(solved))->Expect.toBe(solved)
    t->expect(roundtrip(scrambled))->Expect.toBe(scrambled)
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
