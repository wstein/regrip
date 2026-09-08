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

describe("GyroOrientation.update", () => {
  test("first sample lands exactly on the home orientation", t => {
    let g = GyroOrientation.make()
    let out = g->GyroOrientation.update(~x=0.1, ~y=0.2, ~z=0.3, ~w=w1)
    expectClose(t, out, GyroOrientation.home)
  })

  test("later samples are relative to the captured basis", t => {
    let g = GyroOrientation.make()
    let _ = g->GyroOrientation.update(~x=0.1, ~y=0.2, ~z=0.3, ~w=w1)
    let out = g->GyroOrientation.update(~x=0.2, ~y=0.1, ~z=0., ~w=w2)
    expectClose(t, out, secondSample)
  })

  test("resetBasis re-captures on the next sample", t => {
    let g = GyroOrientation.make()
    let _ = g->GyroOrientation.update(~x=0.1, ~y=0.2, ~z=0.3, ~w=w1)
    let _ = g->GyroOrientation.update(~x=0.2, ~y=0.1, ~z=0., ~w=w2)
    g->GyroOrientation.resetBasis
    let out = g->GyroOrientation.update(~x=0.2, ~y=0.1, ~z=0., ~w=w2)
    expectClose(t, out, GyroOrientation.home)
  })
})
