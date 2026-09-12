open Vitest

let xRotation = degrees =>
  Quaternion.fromEuler({x: Quaternion.degreesToRadians(degrees), y: 0., z: 0.})

let expectSamePose = (t, actual: Quaternion.t, expected: Quaternion.t) =>
  t->expect(Quaternion.angle(actual, expected))->Expect.Float.toBeCloseTo(0., 8)

describe("GyroPipeline", () => {
  test("normalizes, timestamps, and bypasses the magnet when disabled", t => {
    let config = GyroPipeline.makeConfig(OrientationStabilizer.defaults)
    let (state, first) = GyroPipeline.step(
      GyroPipeline.initial,
      Quaternion.identity,
      1000.,
      None,
      ~config,
      ~stabilizerEnabled=false,
    )
    let raw = xRotation(43.)
    let (_, second) = GyroPipeline.step(
      state,
      raw,
      1250.,
      Some({x: 3., y: 4., z: 0.}),
      ~config,
      ~stabilizerEnabled=false,
    )

    t->expect(first.dtSeconds)->Expect.Float.toBeCloseTo(0., 8)
    t->expect(second.dtSeconds)->Expect.Float.toBeCloseTo(0.25, 8)
    t->expect(second.velocityMagnitude)->Expect.Float.toBeCloseTo(5., 8)
    t->expect(Quaternion.angle(second.relative, second.stabilized))->Expect.Float.toBeCloseTo(0., 8)
  })

  test("composes calibration and the production stabilizer branch", t => {
    let stabilizerConfig = OrientationStabilizer.defaults
    let config = GyroPipeline.makeConfig(stabilizerConfig)
    let (pipelineState, first) = GyroPipeline.step(
      GyroPipeline.initial,
      Quaternion.identity,
      1000.,
      None,
      ~config,
      ~stabilizerEnabled=true,
    )
    let (directState, directFirst) = OrientationStabilizer.step(
      OrientationStabilizer.initial,
      Quaternion.identity,
      ~velocity=0.,
      ~dtSeconds=0.,
      ~config=stabilizerConfig,
    )
    let raw = xRotation(3.5)
    let (_, second) = GyroPipeline.step(
      pipelineState,
      raw,
      1100.,
      Some({x: 0., y: 0., z: 0.}),
      ~config,
      ~stabilizerEnabled=true,
    )
    let (_, directSecond) = OrientationStabilizer.step(
      directState,
      raw,
      ~velocity=0.,
      ~dtSeconds=0.1,
      ~config=stabilizerConfig,
    )

    expectSamePose(t, first.stabilized, directFirst)
    expectSamePose(t, second.relative, raw)
    expectSamePose(t, second.stabilized, directSecond)
    t->expect(second.dtSeconds)->Expect.Float.toBeCloseTo(0.1, 8)
  })
})
