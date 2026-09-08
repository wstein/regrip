// Minimal immutable quaternion, replacing the THREE.Quaternion math used for
// gyro orientation. Same conventions as three.js (Hamilton product,
// premultiply = left-multiply, XYZ Euler order).

@genType
type t = {
  x: float,
  y: float,
  z: float,
  w: float,
}

let identity = {x: 0., y: 0., z: 0., w: 1.}

// a * b (three.js multiplyQuaternions)
let multiply = (a: t, b: t): t => {
  x: a.x *. b.w +. a.w *. b.x +. a.y *. b.z -. a.z *. b.y,
  y: a.y *. b.w +. a.w *. b.y +. a.z *. b.x -. a.x *. b.z,
  z: a.z *. b.w +. a.w *. b.z +. a.x *. b.y -. a.y *. b.x,
  w: a.w *. b.w -. a.x *. b.x -. a.y *. b.y -. a.z *. b.z,
}

// three.js `self.premultiply(other)` sets self = other * self
let premultiply = (self: t, other: t): t => multiply(other, self)

let conjugate = (q: t): t => {x: -.q.x, y: -.q.y, z: -.q.z, w: q.w}

let normalize = (q: t): t => {
  let len = Math.sqrt(q.x *. q.x +. q.y *. q.y +. q.z *. q.z +. q.w *. q.w)
  if len == 0. {
    identity
  } else {
    {x: q.x /. len, y: q.y /. len, z: q.z /. len, w: q.w /. len}
  }
}

type euler = {x: float, y: float, z: float}

// three.js Euler -> Quaternion, XYZ order (the THREE.Euler default)
@genType
let fromEuler = (e: euler): t => {
  let c1 = Math.cos(e.x /. 2.)
  let c2 = Math.cos(e.y /. 2.)
  let c3 = Math.cos(e.z /. 2.)
  let s1 = Math.sin(e.x /. 2.)
  let s2 = Math.sin(e.y /. 2.)
  let s3 = Math.sin(e.z /. 2.)
  {
    x: s1 *. c2 *. c3 +. c1 *. s2 *. s3,
    y: c1 *. s2 *. c3 -. s1 *. c2 *. s3,
    z: c1 *. c2 *. s3 +. s1 *. s2 *. c3,
    w: c1 *. c2 *. c3 -. s1 *. s2 *. s3,
  }
}

let degreesToRadians = (deg: float): float => deg *. Math.Constants.pi /. 180.
