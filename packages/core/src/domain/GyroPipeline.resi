// Session-facing pure gyro reducer: composes calibration (GyroOrientation),
// stabilization (OrientationStabilizer), and the fixed sensor-to-body axis
// convention into one step function.

@genType
type velocity = {x: float, y: float, z: float}
@genType
type config
/** One stepped gyro sample at every stage: calibrated relative pose,
 * drift-corrected pose, display-stabilized pose, and the timing/velocity
 * that produced them. */
@genType
type sample = {
  relative: Quaternion.t,
  driftCorrected: Quaternion.t,
  stabilized: Quaternion.t,
  velocityMagnitude: float,
  dtSeconds: float,
}
@genType
type state

@genType
let makeConfig: OrientationStabilizer.config => config
@genType
let initial: state
@genType
let reset: state => state
/** Preserve calibration/timing while discarding a stale stabilizer lock. */
@genType
let resetStabilizer: state => state
@genType
let withStabilizerConfig: (config, OrientationStabilizer.config) => config
@genType
let withSensorToBody: (config, SensorToBody.t) => config
/** Advance one raw gyro sample through calibration and, when
 * `stabilizerEnabled`, display stabilization. */
@genType
let step: (
  state,
  Quaternion.t,
  float,
  option<velocity>,
  ~config: config,
  ~stabilizerEnabled: bool,
) => (state, sample)
