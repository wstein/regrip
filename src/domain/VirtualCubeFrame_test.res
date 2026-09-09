open Vitest

describe("VirtualCubeFrame", () => {
  test("translates moves and exposes R/U/F directions after y", t => {
    let frame = VirtualCubeFrame.make()
    t->expect(VirtualCubeFrame.translate(frame, "R'"))->Expect.toBe("R'")
    VirtualCubeFrame.applyRegrip(frame, "y")
    t->expect(VirtualCubeFrame.translate(frame, "F'"))->Expect.toBe("L'")
    let orientation = VirtualCubeFrame.orientation(frame)
    t->expect((orientation.rightFace, orientation.upFace, orientation.frontFace))->Expect.toEqual(("B", "U", "R"))
    t->expect(VirtualCubeFrame.logicalFaceForPhysical(frame, "B"))->Expect.toBe("R")
  })
})
