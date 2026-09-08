// Minimal immutable quaternion, replacing the THREE.Quaternion math used for
// gyro orientation. Same conventions as three.js (Hamilton product,
// premultiply = left-multiply, XYZ Euler order).

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

let dot = (a: t, b: t): float => a.x *. b.x +. a.y *. b.y +. a.z *. b.z +. a.w *. b.w

let angle = (a: t, b: t): float => {
  let d = Math.abs(dot(normalize(a), normalize(b)))
  2. *. Math.acos(if d > 1. {1.} else {d})
}

let slerp = (a: t, b: t, t: float): t => {
  let b = dot(a, b) < 0. ? {x: -.b.x, y: -.b.y, z: -.b.z, w: -.b.w} : b
  let rawCosine = dot(normalize(a), normalize(b))
  let cosine = rawCosine > 1. ? 1. : rawCosine < -1. ? -1. : rawCosine
  if cosine > 0.9995 {
    normalize({x: a.x +. t *. (b.x -. a.x), y: a.y +. t *. (b.y -. a.y), z: a.z +. t *. (b.z -. a.z), w: a.w +. t *. (b.w -. a.w)})
  } else {
    let theta = Math.acos(cosine)
    let sinTheta = Math.sin(theta)
    let wa = Math.sin((1. -. t) *. theta) /. sinTheta
    let wb = Math.sin(t *. theta) /. sinTheta
    {x: wa *. a.x +. wb *. b.x, y: wa *. a.y +. wb *. b.y, z: wa *. a.z +. wb *. b.z, w: wa *. a.w +. wb *. b.w}
  }
}

type euler = {x: float, y: float, z: float}

// three.js Euler -> Quaternion, XYZ order (the THREE.Euler default)
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
