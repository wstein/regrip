open Vitest

let expectClose = (t, a: Quaternion.t, b: Quaternion.t) => {
  t->expect(a.x)->Expect.Float.toBeCloseTo(b.x, 9)
  t->expect(a.y)->Expect.Float.toBeCloseTo(b.y, 9)
  t->expect(a.z)->Expect.Float.toBeCloseTo(b.z, 9)
  t->expect(a.w)->Expect.Float.toBeCloseTo(b.w, 9)
}

// Second-sample reference from three.js (see scratchpad/q.mjs): basis captured
// from raw (0.1, 0.2, 0.3, sqrt(1-0.14)), then updated with (0.2, 0.1, 0, sqrt(1-0.05)).
let w1 = Math.sqrt(1. -. 0.14)
let w2 = Math.sqrt(1. -. 0.05)
let secondSample: Quaternion.t = {
  x: 0.2026746247795968,
  y: -0.4422317642556727,
  z: 0.12356103110254077,
  w: 0.8649200741956692,
}

describe("GyroOrientation reducer", () => {
  test("first sample lands exactly on the home orientation", t => {
    let (_, out) = GyroOrientation.step(GyroOrientation.initial, {x: 0.1, y: 0.2, z: 0.3, w: w1})
    expectClose(t, out, GyroOrientation.home)
  })

  test("a caller can supply a custom resting orientation", t => {
    let customHome = Quaternion.fromEuler({x: 0., y: 0.5, z: 0.})
    let (_, out) = GyroOrientation.step(
      GyroOrientation.initial,
      {x: 0.1, y: 0.2, z: 0.3, w: w1},
      ~home=customHome,
    )
    expectClose(t, out, customHome)
  })

  test("later samples are relative to the captured basis", t => {
    let (state, _) = GyroOrientation.step(GyroOrientation.initial, {x: 0.1, y: 0.2, z: 0.3, w: w1})
    let (_, out) = GyroOrientation.step(state, {x: 0.2, y: 0.1, z: 0., w: w2})
    expectClose(t, out, secondSample)
  })

  test("reset re-captures on the next sample", t => {
    let (state, _) = GyroOrientation.step(GyroOrientation.initial, {x: 0.1, y: 0.2, z: 0.3, w: w1})
    let (state, _) = GyroOrientation.step(state, {x: 0.2, y: 0.1, z: 0., w: w2})
    let (_, out) = GyroOrientation.step(
      GyroOrientation.reset(state),
      {x: 0.2, y: 0.1, z: 0., w: w2},
    )
    expectClose(t, out, GyroOrientation.home)
  })

  test("returns the same output from identical state and input", t => {
    let raw: Quaternion.t = {x: 0.1, y: 0.2, z: 0.3, w: w1}
    let (_, first) = GyroOrientation.step(GyroOrientation.initial, raw)
    let (_, second) = GyroOrientation.step(GyroOrientation.initial, raw)
    expectClose(t, first, second)
  })
})
