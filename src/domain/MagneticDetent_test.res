open Vitest

let xRotation = degrees =>
  Quaternion.fromEuler({x: Quaternion.degreesToRadians(degrees), y: 0., z: 0.})

let residual = degrees =>
  MagneticDetent.apply(xRotation(degrees), Quaternion.identity)
  ->Quaternion.angle(Quaternion.identity)
  ->(radians => radians *. 180. /. Math.Constants.pi)

describe("MagneticDetent", () => {
  test("is monotonic throughout the magnetic well", t => {
    let residuals = [0., 1., 2., 3., 3.5, 3.9, 4., 4.1, 5., 10., 20., 34., 35.]->Array.map(residual)
    residuals->Array.forEachWithIndex(
      (value, index) =>
        if index > 0 {
          t->expect(value >= residuals->Array.getUnsafe(index - 1))->Expect.toBe(true)
        },
    )
  })

  test("has no residual jump at the snap boundary", t => {
    let justInside = residual(3.99)
    let atBoundary = residual(4.)
    let justOutside = residual(4.01)
    t->expect(Math.abs(atBoundary -. justInside) < 0.05)->Expect.toBe(true)
    t->expect(Math.abs(justOutside -. atBoundary) < 0.05)->Expect.toBe(true)
    // The boundary is a near-lock, not a raw four-degree passthrough.
    t->expect(atBoundary < 0.1)->Expect.toBe(true)
  })

  test("does not pull against a turn at the configured velocity limit", t => {
    let raw = xRotation(20.)
    let output = MagneticDetent.apply(
      raw,
      Quaternion.identity,
      ~velocity=MagneticDetent.defaults.velocityMax,
    )
    t->expect(Quaternion.angle(output, raw))->Expect.Float.toBeCloseTo(0., 8)
  })
})
