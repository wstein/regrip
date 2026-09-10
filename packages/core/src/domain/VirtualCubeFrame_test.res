open Vitest

describe("VirtualCubeFrame", () => {
  test("translates moves and exposes R/U/F directions after y", t => {
    let frame = VirtualCubeFrame.make()
    t->expect(VirtualCubeFrame.translate(frame, "R'"))->Expect.toBe("R'")
    VirtualCubeFrame.applyRegrip(frame, CubeNotation.YTurn)
    t->expect(VirtualCubeFrame.translate(frame, "F'"))->Expect.toBe("L'")
    let orientation = VirtualCubeFrame.orientation(frame)
    t
    ->expect((orientation.rightFace, orientation.upFace, orientation.frontFace))
    ->Expect.toEqual(("B", "U", "R"))
    t->expect(VirtualCubeFrame.solverFaceForBody(frame, "B"))->Expect.toBe("R")
  })

  test("expresses body regrip tokens in the current solver frame", t => {
    let frame = VirtualCubeFrame.make()
    t
    ->expect(VirtualCubeFrame.solverToken(frame, CubeNotation.XTurn))
    ->Expect.toBe(CubeNotation.XTurn)
    t
    ->expect(VirtualCubeFrame.solverToken(frame, CubeNotation.YPrime))
    ->Expect.toBe(CubeNotation.YPrime)
    t
    ->expect(VirtualCubeFrame.solverToken(frame, CubeNotation.ZDouble))
    ->Expect.toBe(CubeNotation.ZDouble)

    // A body x rotation is about the solver z axis after this body y regrip.
    VirtualCubeFrame.applyRegrip(frame, CubeNotation.YTurn)
    t
    ->expect(VirtualCubeFrame.solverToken(frame, CubeNotation.XTurn))
    ->Expect.toBe(CubeNotation.ZTurn)
    t
    ->expect(VirtualCubeFrame.solverToken(frame, CubeNotation.XPrime))
    ->Expect.toBe(CubeNotation.ZPrime)
    t
    ->expect(VirtualCubeFrame.solverToken(frame, CubeNotation.ZTurn))
    ->Expect.toBe(CubeNotation.XPrime)
  })

  test("reframes all 54 facelets after a virtual regrip", t => {
    let solved =
      "U"->String.repeat(9) ++
      "R"->String.repeat(9) ++
      "F"->String.repeat(9) ++
      "D"->String.repeat(9) ++
      "L"->String.repeat(9) ++
      "B"->String.repeat(9)
    let frame = VirtualCubeFrame.make()
    VirtualCubeFrame.applyRegrip(frame, CubeNotation.YTurn)
    t->expect(VirtualCubeFrame.reframeFacelets(frame, solved))->Expect.toBe(solved)
    t->expect(VirtualCubeFrame.reframeFacelets(frame, "short"))->Expect.toBe("short")
  })
})
