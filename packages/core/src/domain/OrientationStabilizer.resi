@genType
type config = {
  radiusDeg: float,
  snapDeg: float,
  hysteresisDeg: float,
  velocityMax: float,
  /** Maximum resting drift correction, in degrees per second. */
  driftDegPerSec: float,
}
@genType
type state
@genType
type sample = {driftCorrected: Quaternion.t, stabilized: Quaternion.t}
@genType
let defaults: config
@genType
let initial: state
@genType
let reset: state => state
@genType
let lockedPose: state => option<Quaternion.t>
@genType
let stepSample: (
  state,
  Quaternion.t,
  ~velocity: float=?,
  ~dtSeconds: float=?,
  ~config: config=?,
) => (state, sample)
@genType
let step: (
  state,
  Quaternion.t,
  ~velocity: float=?,
  ~dtSeconds: float=?,
  ~config: config=?,
) => (state, Quaternion.t)
