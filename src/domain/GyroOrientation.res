// Gyro-to-scene orientation, extracted from handleGyroEvent in index.ts.
// Holds the "basis" captured on the first gyro sample so the cube starts at the
// home orientation; `update` returns the quaternion index.ts feeds to the
// THREE.Quaternion driving the scene.

let home = Quaternion.fromEuler({
  x: Quaternion.degreesToRadians(15.),
  y: Quaternion.degreesToRadians(-20.),
  z: 0.,
})

type t = {mutable basis: option<Quaternion.t>, home: Quaternion.t}

let makeWithHome = (home: Quaternion.t): t => {basis: None, home}

let make = (): t => makeWithHome(home)

let resetBasis = (t: t): unit => t.basis = None

// `raw` is the cube's reported quaternion. The axis swap {x, z, -y, w} matches
// `new THREE.Quaternion(qx, qz, -qy, qw)` in the original handler.
let relative = (t: t, raw: Quaternion.t): Quaternion.t => {
  let q = Quaternion.normalize({x: raw.x, y: raw.z, z: -.raw.y, w: raw.w})
  let basis = switch t.basis {
  | Some(b) => b
  | None => {
      let b = Quaternion.conjugate(q)
      t.basis = Some(b)
      b
    }
  }
  q->Quaternion.premultiply(basis)
}

let applyHome = (t: t, relative: Quaternion.t): Quaternion.t =>
  relative->Quaternion.premultiply(t.home)

let update = (t: t, raw: Quaternion.t): Quaternion.t => applyHome(t, relative(t, raw))
