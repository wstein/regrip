/** Pure gyro calibration: the first calibrated sample becomes identity. */
let home: Quaternion.t
type state
let initial: state
let reset: state => state
/** `raw` normalized against the initial sample, before applying `home`. */
let relative: (state, Quaternion.t, ~sensorToBody: SensorToBody.t=?) => (state, Quaternion.t)
/** Apply a caller-selected resting pose to a calibrated orientation. */
let applyHome: (Quaternion.t, ~home: Quaternion.t=?) => Quaternion.t
/** Normalize `raw` and apply a resting pose in one reducer step. */
let step: (
  state,
  Quaternion.t,
  ~sensorToBody: SensorToBody.t=?,
  ~home: Quaternion.t=?,
) => (state, Quaternion.t)
