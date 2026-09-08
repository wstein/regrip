// Gyro-to-scene orientation, extracted from handleGyroEvent in index.ts.
// Holds the "basis" captured on the first gyro sample so the cube starts at the
// home orientation; `update` returns the quaternion index.ts feeds to the
// THREE.Quaternion driving the scene.

let home = Quaternion.fromEuler(
  ~x=Quaternion.degreesToRadians(15.),
  ~y=Quaternion.degreesToRadians(-20.),
  ~z=0.,
)

type t = {mutable basis: option<Quaternion.t>}

let make = (): t => {basis: None}

let resetBasis = (t: t): unit => t.basis = None

// Raw components are the cube's reported quaternion (qx, qy, qz, qw). The axis
// swap {x, z, -y, w} matches `new THREE.Quaternion(qx, qz, -qy, qw)`.
let update = (t: t, ~x: float, ~y: float, ~z: float, ~w: float): Quaternion.t => {
  let q = Quaternion.normalize({x, y: z, z: -.y, w})
  let basis = switch t.basis {
  | Some(b) => b
  | None => {
      let b = Quaternion.conjugate(q)
      t.basis = Some(b)
      b
    }
  }
  q->Quaternion.premultiply(basis)->Quaternion.premultiply(home)
}
