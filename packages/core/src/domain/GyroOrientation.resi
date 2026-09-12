/** Pure gyro calibration: the first calibrated sample becomes identity. */
@genType
let home: Quaternion.t
@genType
type state
@genType
let initial: state
@genType
let reset: state => state
/** `raw` normalized against the initial sample, before applying `home`. */
@genType
let relative: (state, Quaternion.t, ~sensorToBody: SensorToBody.t=?) => (state, Quaternion.t)
/** Apply a caller-selected resting pose to a calibrated orientation. */
@genType
let applyHome: (Quaternion.t, ~home: Quaternion.t=?) => Quaternion.t
/** Normalize `raw` and apply a resting pose in one reducer step. */
@genType
let step: (
  state,
  Quaternion.t,
  ~sensorToBody: SensorToBody.t=?,
  ~home: Quaternion.t=?,
) => (state, Quaternion.t)
