type config = {
  radiusDeg: float,
  snapDeg: float,
  hysteresisDeg: float,
  velocityMax: float,
}

type t

let defaults: config
let make: (~config: config=?) => t
let reset: t => unit
let lockedPose: t => option<Quaternion.t>
let update: (t, Quaternion.t, ~velocity: float=?) => Quaternion.t
