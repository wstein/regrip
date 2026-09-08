open Vitest

describe("Cube333", () => {
  test("recognizes canonical solved facelets", t => {
    t->expect(Cube333.solvedFacelets->Cube333.fromFacelets->Cube333.isSolved)->Expect.toBe(true)
  })

  test("does not treat a swapped sticker state as solved", t => {
    let unsolved = "RUUUUUUUUURRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"
    t->expect(unsolved->Cube333.fromFacelets->Cube333.isSolved)->Expect.toBe(false)
  })
})
