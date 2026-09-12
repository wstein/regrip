open Vitest

describe("CubeNotation", () => {
  test("parses only the six Singmaster faces", t => {
    [
      (CubeNotation.U, "U"),
      (CubeNotation.R, "R"),
      (CubeNotation.F, "F"),
      (CubeNotation.D, "D"),
      (CubeNotation.L, "L"),
      (CubeNotation.B, "B"),
    ]->Array.forEach(
      ((face, text)) => {
        t->expect(CubeNotation.faceFromString(text))->Expect.toBe(Some(face))
        t->expect(CubeNotation.faceToString(face))->Expect.toBe(text)
      },
    )
    t->expect(CubeNotation.faceFromString("Q"))->Expect.toBe(None)
  })

  test("builds and parses exhaustive whole-cube tokens", t => {
    [
      (CubeNotation.X, CubeNotation.Clockwise, CubeNotation.XTurn, "x"),
      (CubeNotation.X, CubeNotation.CounterClockwise, CubeNotation.XPrime, "x'"),
      (CubeNotation.X, CubeNotation.Half, CubeNotation.XDouble, "x2"),
      (CubeNotation.Y, CubeNotation.Clockwise, CubeNotation.YTurn, "y"),
      (CubeNotation.Y, CubeNotation.CounterClockwise, CubeNotation.YPrime, "y'"),
      (CubeNotation.Y, CubeNotation.Half, CubeNotation.YDouble, "y2"),
      (CubeNotation.Z, CubeNotation.Clockwise, CubeNotation.ZTurn, "z"),
      (CubeNotation.Z, CubeNotation.CounterClockwise, CubeNotation.ZPrime, "z'"),
      (CubeNotation.Z, CubeNotation.Half, CubeNotation.ZDouble, "z2"),
    ]->Array.forEach(
      ((axis, turn, token, text)) => {
        t->expect(CubeNotation.token(axis, turn))->Expect.toBe(token)
        t->expect(CubeNotation.regripFromString(text))->Expect.toBe(Some(token))
      },
    )
    t->expect(CubeNotation.regripFromString("q"))->Expect.toBe(None)
  })
})
