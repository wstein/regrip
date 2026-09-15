// Immutable quaternion with three.js conventions.

@genType
type t = {x: float, y: float, z: float, w: float}
/** Radian angles about each axis, XYZ (intrinsic Tait-Bryan) order. */
@genType
type euler = {x: float, y: float, z: float}

/** The no-rotation quaternion. */
@genType
let identity: t
/** a * b (three.js multiplyQuaternions) */
@genType
let multiply: (t, t) => t
/** three.js `self.premultiply(other)`: other * self */
@genType
let premultiply: (t, t) => t
/** The inverse rotation, for a unit quaternion. */
@genType
let conjugate: t => t
/** Rescale to unit length. */
@genType
let normalize: t => t
/** The dot product, used to find the shorter of the two arcs between two orientations. */
@genType
let dot: (t, t) => float
/** The angle, in radians, between two orientations. */
@genType
let angle: (t, t) => float
/** Spherically interpolate from `a` to `b` by `t` in `[0, 1]`. */
@genType
let slerp: (t, t, float) => t
/** three.js Euler -> Quaternion, XYZ order */
@genType
let fromEuler: euler => t
@genType
let degreesToRadians: float => float
