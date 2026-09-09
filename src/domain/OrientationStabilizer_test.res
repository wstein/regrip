open Vitest

let xRotation = degrees =>
  Quaternion.fromEuler({x: Quaternion.degreesToRadians(degrees), y: 0., z: 0.})

let angleToIdentity = q => Quaternion.angle(q, Quaternion.identity)

let expectSamePose = (t, actual: Quaternion.t, expected: Quaternion.t) =>
  t->expect(Quaternion.angle(actual, expected))->Expect.Float.toBeCloseTo(0., 8)

describe("OrientationStabilizer", () => {
  test("noisy resting samples converge monotonically without changing their lock", t => {
    let stabilizer = OrientationStabilizer.make()
    let first = stabilizer->OrientationStabilizer.update(xRotation(20.))
    let second = stabilizer->OrientationStabilizer.update(xRotation(15.))
    let third = stabilizer->OrientationStabilizer.update(xRotation(10.))
    let fourth = stabilizer->OrientationStabilizer.update(xRotation(5.))
    let settled = stabilizer->OrientationStabilizer.update(xRotation(3.))

    let angles = [
      angleToIdentity(first),
      angleToIdentity(second),
      angleToIdentity(third),
      angleToIdentity(fourth),
      angleToIdentity(settled),
    ]
    angles->Array.forEachWithIndex(
      (angle, index) =>
        if index > 0 {
          t->expect(angle <= angles->Array.getUnsafe(index - 1))->Expect.toBe(true)
        },
    )
    expectSamePose(t, settled, Quaternion.identity)
    switch stabilizer->OrientationStabilizer.lockedPose {
    | Some(lock) => expectSamePose(t, lock, Quaternion.identity)
    | None => t->expect(false)->Expect.toBe(true)
    }
  })

  test("a deliberate quarter turn remains one-to-one, then relocks", t => {
    let stabilizer = OrientationStabilizer.make()
    let midTurnRaw = xRotation(67.5)
    let whileTurning =
      stabilizer->OrientationStabilizer.update(
        midTurnRaw,
        ~velocity=OrientationStabilizer.defaults.velocityMax,
      )
    expectSamePose(t, whileTurning, midTurnRaw)

    let atRest = stabilizer->OrientationStabilizer.update(xRotation(90.))
    expectSamePose(t, atRest, xRotation(90.))
    switch stabilizer->OrientationStabilizer.lockedPose {
    | Some(lock) => expectSamePose(t, lock, xRotation(90.))
    | None => t->expect(false)->Expect.toBe(true)
    }
  })

  test("absorbs resting drift at the configured two degrees per second", t => {
    let stabilizer = OrientationStabilizer.make(
      ~config={
        radiusDeg: 0.,
        snapDeg: 0.,
        hysteresisDeg: 0.,
        velocityMax: 2.5,
        driftDegPerSec: 2.,
      },
    )
    let raw = xRotation(10.)
    let afterOneSecond = stabilizer->OrientationStabilizer.update(raw, ~dtSeconds=1.)
    let afterTwoSeconds = stabilizer->OrientationStabilizer.update(raw, ~dtSeconds=1.)

    t
    ->expect(angleToIdentity(afterOneSecond))
    ->Expect.Float.toBeCloseTo(Quaternion.degreesToRadians(8.), 8)
    t
    ->expect(angleToIdentity(afterTwoSeconds))
    ->Expect.Float.toBeCloseTo(Quaternion.degreesToRadians(6.), 8)
  })

  test("does not absorb drift while the cube is turning", t => {
    let stabilizer = OrientationStabilizer.make(
      ~config={
        radiusDeg: 0.,
        snapDeg: 0.,
        hysteresisDeg: 0.,
        velocityMax: 2.5,
        driftDegPerSec: 2.,
      },
    )
    let raw = xRotation(10.)
    let output = stabilizer->OrientationStabilizer.update(raw, ~velocity=2.5, ~dtSeconds=1.)
    expectSamePose(t, output, raw)
  })

  test("keeps an oscillating resting hand bounded at one cardinal lock", t => {
    let stabilizer = OrientationStabilizer.make()
    let outputs = [3.8, 3.2, 3.9, 3.4, 3.7, 3.3]->Array.map(
      degrees =>
        stabilizer
        ->OrientationStabilizer.update(xRotation(degrees), ~dtSeconds=0.1)
        ->angleToIdentity,
    )
    let maximum = outputs->Array.reduce(0., (largest, value) => Math.max(largest, value))
    // The snap well eliminates the 3–4° raw tremor rather than alternating
    // between a raw sample and a cardinal pose at its former discontinuity.
    t->expect(maximum < Quaternion.degreesToRadians(0.1))->Expect.toBe(true)
    switch stabilizer->OrientationStabilizer.lockedPose {
    | Some(lock) => expectSamePose(t, lock, Quaternion.identity)
    | None => t->expect(false)->Expect.toBe(true)
    }
  })

  test("passes through a deliberate turn before relocking with drift active", t => {
    let stabilizer = OrientationStabilizer.make()
    let midTurn = xRotation(67.5)
    let whileTurning =
      stabilizer->OrientationStabilizer.update(
        midTurn,
        ~velocity=OrientationStabilizer.defaults.velocityMax,
        ~dtSeconds=0.1,
      )
    expectSamePose(t, whileTurning, midTurn)

    let landed = stabilizer->OrientationStabilizer.update(xRotation(90.), ~dtSeconds=0.1)
    expectSamePose(t, landed, xRotation(90.))
    switch stabilizer->OrientationStabilizer.lockedPose {
    | Some(lock) => expectSamePose(t, lock, xRotation(90.))
    | None => t->expect(false)->Expect.toBe(true)
    }
  })
})
