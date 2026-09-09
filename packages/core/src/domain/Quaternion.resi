// Immutable quaternion with three.js conventions.

type t = {x: float, y: float, z: float, w: float}
type euler = {x: float, y: float, z: float}

let identity: t
/** a * b (three.js multiplyQuaternions) */
let multiply: (t, t) => t
/** three.js `self.premultiply(other)`: other * self */
let premultiply: (t, t) => t
let conjugate: t => t
let normalize: t => t
let dot: (t, t) => float
let angle: (t, t) => float
let slerp: (t, t, float) => t
/** three.js Euler -> Quaternion, XYZ order */
let fromEuler: euler => t
let degreesToRadians: float => float
