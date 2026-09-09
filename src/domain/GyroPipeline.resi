type velocity = {x: float, y: float, z: float}
type sample = {
  relative: Quaternion.t,
  stabilized: Quaternion.t,
  velocityMagnitude: float,
  dtSeconds: float,
}
type t

let make: OrientationStabilizer.config => t
let reset: t => unit
let setStabilizerConfig: (t, OrientationStabilizer.config) => unit
let update: (t, Quaternion.t, float, option<velocity>, ~stabilizerEnabled: bool) => sample
