open Vitest

let xRotation = degrees =>
  Quaternion.fromEuler({x: Quaternion.degreesToRadians(degrees), y: 0., z: 0.})

let expectSamePose = (t, actual: Quaternion.t, expected: Quaternion.t) =>
  t->expect(Quaternion.angle(actual, expected))->Expect.Float.toBeCloseTo(0., 8)

describe("CubeSymmetry", () => {
  test("enumerates exactly the 24 orientation-preserving cube rotations", t => {
    t->expect(Array.length(CubeSymmetry.poses))->Expect.toBe(24)
    CubeSymmetry.poses->Array.forEach(pose =>
      t->expect(Quaternion.angle(pose, pose))->Expect.Float.toBeCloseTo(0., 8)
    )
  })

  test("keeps the current pose inside the sticky hysteresis band", t => {
    let identity = Quaternion.identity
    let x90 = xRotation(90.)
    let nearBoundary = CubeSymmetry.nearest(xRotation(47.), Some(identity), Quaternion.degreesToRadians(5.))
    let pastBoundary = CubeSymmetry.nearest(xRotation(50.), Some(identity), Quaternion.degreesToRadians(5.))
    expectSamePose(t, nearBoundary, identity)
    expectSamePose(t, pastBoundary, x90)
  })
})
