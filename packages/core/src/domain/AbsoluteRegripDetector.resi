// Detects regrips by locking drift-corrected gyro input to one of the 24
// absolute cube orientations and emitting a deterministic shortest path.

/** Snap radius and release hysteresis, in degrees, around each of the 24
 * absolute cube orientations. */
@genType
type config = {snapDeg: float, hysteresisDeg: float}
/** A completed regrip, in both the raw sensor frame and Singmaster x/y/z
 * whole-cube turn notation. */
@genType
type observation = {
  sensorFrameToken: CubeNotation.regripToken,
  notationToken: CubeNotation.regripToken,
}
@genType
type state

@genType
let defaults: config
@genType
let initial: state
/** The absolute orientation currently locked onto, in sensor frame. */
@genType
let pose: state => Quaternion.t
/** Advance one gyro sample; emits an observation when a lock transitions to
 * a new absolute orientation. */
@genType
let step: (state, Quaternion.t, ~config: config=?) => (state, option<observation>)
