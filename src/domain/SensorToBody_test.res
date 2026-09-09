open Vitest

describe("SensorToBody", () => {
  test("applies the base profile x,z,-y sensor convention", t => {
    let result = SensorToBody.apply(SensorToBody.default, {x: 1., y: 2., z: 3., w: 4.})
    t->expect(result.x)->Expect.Float.toBeCloseTo(1. /. Math.sqrt(30.), 8)
    t->expect(result.y)->Expect.Float.toBeCloseTo(3. /. Math.sqrt(30.), 8)
    t->expect(result.z)->Expect.Float.toBeCloseTo(-2. /. Math.sqrt(30.), 8)
  })
})
