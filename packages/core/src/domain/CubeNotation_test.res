open Vitest

describe("CubeNotation", () => {
  test("parses only the six Singmaster faces", t => {
    t->expect(CubeNotation.faceFromString("U"))->Expect.toBe(Some(CubeNotation.U))
    t->expect(CubeNotation.faceFromString("Q"))->Expect.toBe(None)
    t->expect(CubeNotation.faceToString(CubeNotation.B))->Expect.toBe("B")
  })

  test("builds and parses exhaustive whole-cube tokens", t => {
    t
    ->expect(CubeNotation.token(CubeNotation.X, CubeNotation.Clockwise))
    ->Expect.toBe(CubeNotation.XTurn)
    t
    ->expect(CubeNotation.token(CubeNotation.Y, CubeNotation.CounterClockwise))
    ->Expect.toBe(CubeNotation.YPrime)
    t
    ->expect(CubeNotation.token(CubeNotation.Z, CubeNotation.Half))
    ->Expect.toBe(CubeNotation.ZDouble)
    t->expect(CubeNotation.regripFromString("y2"))->Expect.toBe(Some(CubeNotation.YDouble))
    t->expect(CubeNotation.regripFromString("q"))->Expect.toBe(None)
  })
})
