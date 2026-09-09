open Vitest

let xRotation = degrees =>
  Quaternion.fromEuler({x: Quaternion.degreesToRadians(degrees), y: 0., z: 0.})

let angleToIdentity = q => Quaternion.angle(q, Quaternion.identity)
let expectSamePose = (t, actual: Quaternion.t, expected: Quaternion.t) =>
  t->expect(Quaternion.angle(actual, expected))->Expect.Float.toBeCloseTo(0., 8)

type holder = {mutable state: OrientationStabilizer.state, config: OrientationStabilizer.config}
let make = (~config=OrientationStabilizer.defaults) => {
  state: OrientationStabilizer.initial,
  config,
}
let update = (holder, raw, ~velocity=0., ~dtSeconds=0.) => {
  let (state, output) = OrientationStabilizer.step(
    holder.state,
    raw,
    ~velocity,
    ~dtSeconds,
    ~config=holder.config,
  )
  holder.state = state
  output
}

describe("OrientationStabilizer reducer", () => {
  test("settles noisy resting samples at one cardinal lock", t => {
    let stabilizer = make()
    let outputs =
      [3.8, 3.2, 3.9, 3.4, 3.7, 3.3]->Array.map(
        degrees => stabilizer->update(xRotation(degrees), ~dtSeconds=0.1)->angleToIdentity,
      )
    let maximum = outputs->Array.reduce(0., (largest, value) => Math.max(largest, value))
    t->expect(maximum < Quaternion.degreesToRadians(0.1))->Expect.toBe(true)
    switch OrientationStabilizer.lockedPose(stabilizer.state) {
    | Some(lock) => expectSamePose(t, lock, Quaternion.identity)
    | None => t->expect(false)->Expect.toBe(true)
    }
  })

  test("passes through a deliberate turn, then relocks", t => {
    let stabilizer = make()
    let midTurn = xRotation(67.5)
    let whileTurning =
      stabilizer->update(midTurn, ~velocity=OrientationStabilizer.defaults.velocityMax)
    expectSamePose(t, whileTurning, midTurn)
    let landed = stabilizer->update(xRotation(90.), ~dtSeconds=0.1)
    expectSamePose(t, landed, xRotation(90.))
  })

  test("absorbs resting drift at the configured two degrees per second", t => {
    let config: OrientationStabilizer.config = {
      radiusDeg: 0.,
      snapDeg: 0.,
      hysteresisDeg: 0.,
      velocityMax: 2.5,
      driftDegPerSec: 2.,
    }
    let stabilizer = make(~config)
    let raw = xRotation(10.)
    let afterOneSecond = stabilizer->update(raw, ~dtSeconds=1.)
    let afterTwoSeconds = stabilizer->update(raw, ~dtSeconds=1.)
    t
    ->expect(angleToIdentity(afterOneSecond))
    ->Expect.Float.toBeCloseTo(Quaternion.degreesToRadians(8.), 8)
    t
    ->expect(angleToIdentity(afterTwoSeconds))
    ->Expect.Float.toBeCloseTo(Quaternion.degreesToRadians(6.), 8)
  })

  test("is deterministic from the same state and input", t => {
    let raw = xRotation(20.)
    let (_, first) = OrientationStabilizer.step(OrientationStabilizer.initial, raw)
    let (_, second) = OrientationStabilizer.step(OrientationStabilizer.initial, raw)
    expectSamePose(t, first, second)
  })
})
