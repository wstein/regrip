open Vitest

// Reference values produced by three.js (see scratchpad/q.mjs).
let home: Quaternion.t = {
  x: 0.12854320606946854,
  y: -0.17216259343480453,
  z: -0.022665635416815415,
  w: 0.9763825861650423,
}
let euler30: Quaternion.t = {
  x: 0.24999999999999997,
  y: -0.24999999999999997,
  z: -0.06698729810778066,
  w: 0.9330127018922194,
}

let expectClose = (t, a: Quaternion.t, b: Quaternion.t) => {
  t->expect(a.x)->Expect.Float.toBeCloseTo(b.x, 9)
  t->expect(a.y)->Expect.Float.toBeCloseTo(b.y, 9)
  t->expect(a.z)->Expect.Float.toBeCloseTo(b.z, 9)
  t->expect(a.w)->Expect.Float.toBeCloseTo(b.w, 9)
}

describe("Quaternion.fromEuler", () => {
  test("matches three.js for (15, -20, 0) degrees", t => {
    let q = Quaternion.fromEuler(
      ~x=Quaternion.degreesToRadians(15.),
      ~y=Quaternion.degreesToRadians(-20.),
      ~z=0.,
    )
    expectClose(t, q, home)
  })

  test("matches three.js for (30, -30, 0) degrees", t => {
    let q = Quaternion.fromEuler(
      ~x=Quaternion.degreesToRadians(30.),
      ~y=Quaternion.degreesToRadians(-30.),
      ~z=0.,
    )
    expectClose(t, q, euler30)
  })
})

describe("Quaternion algebra", () => {
  test("normalize scales to unit length", t => {
    let q = Quaternion.normalize({x: 0., y: 0., z: 0., w: 5.})
    expectClose(t, q, Quaternion.identity)
  })

  test("normalize of a zero quaternion is identity", t => {
    expectClose(t, Quaternion.normalize({x: 0., y: 0., z: 0., w: 0.}), Quaternion.identity)
  })

  test("conjugate is an involution", t => {
    expectClose(t, home->Quaternion.conjugate->Quaternion.conjugate, home)
  })

  test("multiplying by identity is a no-op", t => {
    expectClose(t, Quaternion.multiply(home, Quaternion.identity), home)
    expectClose(t, Quaternion.multiply(Quaternion.identity, home), home)
  })

  test("q * conjugate(q) is identity for a unit quaternion", t => {
    expectClose(t, Quaternion.multiply(home, Quaternion.conjugate(home)), Quaternion.identity)
  })

  test("premultiply(a, b) == multiply(b, a)", t => {
    expectClose(t, home->Quaternion.premultiply(euler30), Quaternion.multiply(euler30, home))
  })
})
