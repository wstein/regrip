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
    let q = Quaternion.fromEuler({
      x: Quaternion.degreesToRadians(15.),
      y: Quaternion.degreesToRadians(-20.),
      z: 0.,
    })
    expectClose(t, q, home)
  })

  test("matches three.js for (30, -30, 0) degrees", t => {
    let q = Quaternion.fromEuler({
      x: Quaternion.degreesToRadians(30.),
      y: Quaternion.degreesToRadians(-30.),
      z: 0.,
    })
    expectClose(t, q, euler30)
  })

  test("matches three.js for three non-zero angles (0.3, -0.5, 0.7 rad)", t => {
    let q = Quaternion.fromEuler({x: 0.3, y: -0.5, z: 0.7})
    expectClose(
      t,
      q,
      {
        x: 0.052132410889547995,
        y: -0.2794438940784743,
        z: 0.29377717233096856,
        w: 0.9126271389863014,
      },
    )
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

  test("multiply matches a hand-checked three.js Hamilton product", t => {
    let a: Quaternion.t = {x: 0.1, y: 0.2, z: 0.3, w: 0.4}
    let b: Quaternion.t = {x: 0.5, y: 0.6, z: 0.7, w: 0.8}
    expectClose(
      t,
      Quaternion.multiply(a, b),
      {x: 0.24, y: 0.48, z: 0.48, w: -0.06},
    )
  })

  test("multiply is not commutative", t => {
    let a: Quaternion.t = {x: 0.1, y: 0.2, z: 0.3, w: 0.4}
    let b: Quaternion.t = {x: 0.5, y: 0.6, z: 0.7, w: 0.8}
    let ab = Quaternion.multiply(a, b)
    let ba = Quaternion.multiply(b, a)
    // same scalar part, different vector part
    t->expect(ab.w)->Expect.Float.toBeCloseTo(ba.w, 9)
    t->expect(Math.abs(ab.x -. ba.x) +. Math.abs(ab.y -. ba.y) +. Math.abs(ab.z -. ba.z) > 0.1)->Expect.toBe(true)
  })
})
