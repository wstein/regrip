// Session-owned gyro normalization and stabilization. This remains renderer
// independent: callers choose how to apply their display-home orientation.

type velocity = {x: float, y: float, z: float}
type sample = {
  relative: Quaternion.t,
  stabilized: Quaternion.t,
  velocityMagnitude: float,
  dtSeconds: float,
}

type t = {
  gyro: GyroOrientation.t,
  stabilizer: OrientationStabilizer.t,
  mutable previousTimestamp: option<float>,
}

let make = (config: OrientationStabilizer.config): t => {
  gyro: GyroOrientation.make(),
  stabilizer: OrientationStabilizer.make(~config),
  previousTimestamp: None,
}

let reset = (pipeline: t): unit => {
  pipeline.gyro->GyroOrientation.resetBasis
  pipeline.stabilizer->OrientationStabilizer.reset
  pipeline.previousTimestamp = None
}

let setStabilizerConfig = (pipeline: t, config: OrientationStabilizer.config): unit =>
  pipeline.stabilizer->OrientationStabilizer.setConfig(config)

let update = (
  pipeline: t,
  raw: Quaternion.t,
  timestamp: float,
  velocity: option<velocity>,
  ~stabilizerEnabled: bool,
): sample => {
  let relative = pipeline.gyro->GyroOrientation.relative(raw)
  let velocityMagnitude = switch velocity {
  | Some({x, y, z}) => Math.sqrt(x *. x +. y *. y +. z *. z)
  | None => 0.
  }
  let dtSeconds = switch pipeline.previousTimestamp {
  | Some(previous) => Math.max(0., (timestamp -. previous) /. 1000.)
  | None => 0.
  }
  pipeline.previousTimestamp = Some(timestamp)
  let stabilized = if stabilizerEnabled {
    pipeline.stabilizer->OrientationStabilizer.update(
      relative,
      ~velocity=velocityMagnitude,
      ~dtSeconds,
    )
  } else {
    relative
  }
  {relative, stabilized, velocityMagnitude, dtSeconds}
}
