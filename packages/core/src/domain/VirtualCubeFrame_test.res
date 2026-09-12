open Vitest

describe("VirtualCubeFrame", () => {
  test("returns new frame states without mutating earlier values", t => {
    let home = VirtualCubeFrame.make()
    let regripped = VirtualCubeFrame.applyRegrip(home, CubeNotation.YTurn)
    let reset = VirtualCubeFrame.reset(regripped)

    t->expect(VirtualCubeFrame.translate(home, "F"))->Expect.toBe("F")
    t->expect(VirtualCubeFrame.translate(regripped, "F"))->Expect.toBe("L")
    t->expect(VirtualCubeFrame.translate(reset, "F"))->Expect.toBe("F")
  })

  test("translates moves and exposes R/U/F directions after y", t => {
    let home = VirtualCubeFrame.make()
    t->expect(VirtualCubeFrame.translate(home, ""))->Expect.toBe("")
    t->expect(VirtualCubeFrame.translate(home, "?"))->Expect.toBe("?")
    t->expect(VirtualCubeFrame.solverFaceForBody(home, "?"))->Expect.toBe("?")
    t->expect(VirtualCubeFrame.translate(home, "R'"))->Expect.toBe("R'")
    let frame = VirtualCubeFrame.applyRegrip(home, CubeNotation.YTurn)
    t->expect(VirtualCubeFrame.translate(frame, "F'"))->Expect.toBe("L'")
    let orientation = VirtualCubeFrame.orientation(frame)
    t
    ->expect((orientation.rightFace, orientation.upFace, orientation.frontFace))
    ->Expect.toEqual(("B", "U", "R"))
    t->expect(VirtualCubeFrame.solverFaceForBody(frame, "B"))->Expect.toBe("R")
  })

  test("expresses body regrip tokens in the current solver frame", t => {
    let home = VirtualCubeFrame.make()
    [
      CubeNotation.XTurn,
      CubeNotation.XPrime,
      CubeNotation.XDouble,
      CubeNotation.YTurn,
      CubeNotation.YPrime,
      CubeNotation.YDouble,
      CubeNotation.ZTurn,
      CubeNotation.ZPrime,
      CubeNotation.ZDouble,
    ]->Array.forEach(
      token => t->expect(VirtualCubeFrame.solverToken(home, token))->Expect.toBe(token),
    )

    // A body x rotation is about the solver z axis after this body y regrip.
    let frame = VirtualCubeFrame.applyRegrip(home, CubeNotation.YTurn)
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
    let frame = VirtualCubeFrame.make()->VirtualCubeFrame.applyRegrip(CubeNotation.YTurn)
    t->expect(VirtualCubeFrame.reframeFacelets(frame, solved))->Expect.toBe(solved)
    t->expect(VirtualCubeFrame.reframeFacelets(frame, "short"))->Expect.toBe("short")
  })

  test("reframes a scramble across mixed axes and a half turn", t => {
    let scrambled = "FBFRULDLFUBUURDBDBFFRLFFLURDBDUDFURLDBRLLURRBLDLRBDUFB"
    let frame =
      VirtualCubeFrame.make()
      ->VirtualCubeFrame.applyRegrip(CubeNotation.XTurn)
      ->VirtualCubeFrame.applyRegrip(CubeNotation.ZDouble)
      ->VirtualCubeFrame.applyRegrip(CubeNotation.YTurn)

    let reframed = VirtualCubeFrame.reframeFacelets(frame, scrambled)
    t
    ->expect(reframed)
    ->Expect.toBe("BRBBUFRFRBUDLRFRFDFLDRFUFBBRUUBDDURFULULLBLDDLDLRBDLUF")
    t->expect(CubeFacelets.decodeFacelets(reframed)->Result.isOk)->Expect.toBe(true)
  })
})
