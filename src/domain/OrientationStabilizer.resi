type config = {
  radiusDeg: float,
  snapDeg: float,
  hysteresisDeg: float,
  velocityMax: float,
  /** Maximum resting drift correction, in degrees per second. */
  driftDegPerSec: float,
}

type t

let defaults: config
let make: (~config: config=?) => t
let reset: t => unit
/** Reconfiguration starts a fresh lock so profiles cannot retain a stale pose. */
let setConfig: (t, config) => unit
let lockedPose: t => option<Quaternion.t>
let update: (t, Quaternion.t, ~velocity: float=?, ~dtSeconds: float=?) => Quaternion.t
