type config = {
  radiusDeg: float,
  snapDeg: float,
  hysteresisDeg: float,
  velocityMax: float,
  /** Maximum resting drift correction, in degrees per second. */
  driftDegPerSec: float,
}
type state
let defaults: config
let initial: state
let reset: state => state
let lockedPose: state => option<Quaternion.t>
let step: (
  state,
  Quaternion.t,
  ~velocity: float=?,
  ~dtSeconds: float=?,
  ~config: config=?,
) => (state, Quaternion.t)
