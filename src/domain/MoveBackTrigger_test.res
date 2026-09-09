open Vitest

describe("MoveBackTrigger", () => {
  test("emits the initiating move for an inverse pair within 300ms", t => {
    let detector = MoveBackTrigger.make()
    t->expect(MoveBackTrigger.observe(detector, "R", 1000.))->Expect.toBe(None)
    t->expect(MoveBackTrigger.observe(detector, "R'", 1300.))->Expect.toBe(Some("R"))
  })

  test("rejects different faces, double turns, and late returns", t => {
    let detector = MoveBackTrigger.make()
    MoveBackTrigger.observe(detector, "R", 1000.)->ignore
    t->expect(MoveBackTrigger.observe(detector, "U'", 1100.))->Expect.toBe(None)
    MoveBackTrigger.reset(detector)
    MoveBackTrigger.observe(detector, "R2", 1000.)->ignore
    t->expect(MoveBackTrigger.observe(detector, "R2", 1100.))->Expect.toBe(None)
    MoveBackTrigger.reset(detector)
    MoveBackTrigger.observe(detector, "F", 1000.)->ignore
    t->expect(MoveBackTrigger.observe(detector, "F'", 1301.))->Expect.toBe(None)
  })

  test("does not overlap a matched return into another trigger", t => {
    let detector = MoveBackTrigger.make()
    MoveBackTrigger.observe(detector, "R", 1000.)->ignore
    t->expect(MoveBackTrigger.observe(detector, "R'", 1100.))->Expect.toBe(Some("R"))
    t->expect(MoveBackTrigger.observe(detector, "R", 1200.))->Expect.toBe(None)
  })
})
