// Session-facing pure gyro reducer: calibration, timing, and stabilization.

type velocity = {x: float, y: float, z: float}
type config = {stabilizer: OrientationStabilizer.config, sensorToBody: SensorToBody.t}
type sample = {
  relative: Quaternion.t,
  driftCorrected: Quaternion.t,
  stabilized: Quaternion.t,
  velocityMagnitude: float,
  dtSeconds: float,
}
type state = {
  gyro: GyroOrientation.state,
  stabilizer: OrientationStabilizer.state,
  previousTimestamp: option<float>,
}

let makeConfig = (stabilizer: OrientationStabilizer.config): config => {
  stabilizer,
  sensorToBody: SensorToBody.default,
}
let initial: state = {
  gyro: GyroOrientation.initial,
  stabilizer: OrientationStabilizer.initial,
  previousTimestamp: None,
}

let reset = (_: state): state => initial
/** Preserve calibration/timing while discarding a stale stabilizer lock. */
let resetStabilizer = (state: state): state => {...state, stabilizer: OrientationStabilizer.initial}
let withStabilizerConfig = (config: config, stabilizer: OrientationStabilizer.config): config => {
  ...config,
  stabilizer,
}
let withSensorToBody = (config: config, sensorToBody: SensorToBody.t): config => {
  ...config,
  sensorToBody,
}

let step = (
  state: state,
  raw: Quaternion.t,
  timestamp: float,
  velocity: option<velocity>,
  ~config: config,
  ~stabilizerEnabled: bool,
): (state, sample) => {
  let (gyro, relative) = GyroOrientation.relative(
    state.gyro,
    raw,
    ~sensorToBody=config.sensorToBody,
  )
  let velocityMagnitude = switch velocity {
  | Some({x, y, z}) => Math.sqrt(x *. x +. y *. y +. z *. z)
  | None => 0.
  }
  let dtSeconds = switch state.previousTimestamp {
  | Some(previous) => Math.max(0., (timestamp -. previous) /. 1000.)
  | None => 0.
  }
  let (stabilizer, stabilizerSample) = if stabilizerEnabled {
    OrientationStabilizer.stepSample(
      state.stabilizer,
      relative,
      ~velocity=velocityMagnitude,
      ~dtSeconds,
      ~config=config.stabilizer,
    )
  } else {
    (
      state.stabilizer,
      ({driftCorrected: relative, stabilized: relative}: OrientationStabilizer.sample),
    )
  }
  (
    {gyro, stabilizer, previousTimestamp: Some(timestamp)},
    {
      relative,
      driftCorrected: stabilizerSample.driftCorrected,
      stabilized: stabilizerSample.stabilized,
      velocityMagnitude,
      dtSeconds,
    },
  )
}
