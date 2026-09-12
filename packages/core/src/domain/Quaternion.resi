// Immutable quaternion with three.js conventions.

@genType
type t = {x: float, y: float, z: float, w: float}
@genType
type euler = {x: float, y: float, z: float}

@genType
let identity: t
/** a * b (three.js multiplyQuaternions) */
@genType
let multiply: (t, t) => t
/** three.js `self.premultiply(other)`: other * self */
@genType
let premultiply: (t, t) => t
@genType
let conjugate: t => t
@genType
let normalize: t => t
@genType
let dot: (t, t) => float
@genType
let angle: (t, t) => float
@genType
let slerp: (t, t, float) => t
/** three.js Euler -> Quaternion, XYZ order */
@genType
let fromEuler: euler => t
@genType
let degreesToRadians: float => float
