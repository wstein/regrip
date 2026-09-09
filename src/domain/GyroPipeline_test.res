open Vitest

let xRotation = degrees =>
  Quaternion.fromEuler({x: Quaternion.degreesToRadians(degrees), y: 0., z: 0.})

describe("GyroPipeline", () => {
  test("normalizes, timestamps, and bypasses the magnet when disabled", t => {
    let pipeline = GyroPipeline.make(OrientationStabilizer.defaults)
    let first =
      pipeline->GyroPipeline.update(Quaternion.identity, 1000., None, ~stabilizerEnabled=false)
    let raw = xRotation(43.)
    let second =
      pipeline->GyroPipeline.update(
        raw,
        1250.,
        Some({x: 3., y: 4., z: 0.}),
        ~stabilizerEnabled=false,
      )

    t->expect(first.dtSeconds)->Expect.Float.toBeCloseTo(0., 8)
    t->expect(second.dtSeconds)->Expect.Float.toBeCloseTo(0.25, 8)
    t->expect(second.velocityMagnitude)->Expect.Float.toBeCloseTo(5., 8)
    t->expect(Quaternion.angle(second.relative, second.stabilized))->Expect.Float.toBeCloseTo(0., 8)
  })
})
