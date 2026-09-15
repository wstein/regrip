// Pure, renderer-independent orientation magnet. The caller owns reducer
// state; this module only decides when to lock, hold, and release it.

/** Snap/release radii, hysteresis, velocity gate, and resting drift
 * correction rate for the magnetic lock. */
@genType
type config = {
  radiusDeg: float,
  snapDeg: float,
  hysteresisDeg: float,
  velocityMax: float,
  driftDegPerSec: float,
}
@genType
type state
/** A stepped sample: the drift-corrected pose and the final,
 * detent-stabilized pose shown to the user. */
@genType
type sample = {driftCorrected: Quaternion.t, stabilized: Quaternion.t}
@genType
let defaults: config
@genType
let initial: state
@genType
let reset: state => state
/** The absolute pose currently locked onto, if any. */
@genType
let lockedPose: state => option<Quaternion.t>
/** `step` without the resting drift correction; used where the caller
 * supplies an already drift-corrected pose. */
@genType
let stepSample: (
  state,
  Quaternion.t,
  ~velocity: float=?,
  ~dtSeconds: float=?,
  ~config: config=?,
) => (state, sample)
/** Advance one raw pose sample: apply resting drift correction, then the
 * velocity-gated magnetic detent, returning the stabilized pose. */
@genType
let step: (
  state,
  Quaternion.t,
  ~velocity: float=?,
  ~dtSeconds: float=?,
  ~config: config=?,
) => (state, Quaternion.t)
