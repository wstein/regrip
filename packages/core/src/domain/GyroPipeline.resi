type velocity = {x: float, y: float, z: float}
type config
type sample = {
  relative: Quaternion.t,
  stabilized: Quaternion.t,
  velocityMagnitude: float,
  dtSeconds: float,
}
type state

let makeConfig: OrientationStabilizer.config => config
let initial: state
let reset: state => state
let resetStabilizer: state => state
let withStabilizerConfig: (config, OrientationStabilizer.config) => config
let withSensorToBody: (config, SensorToBody.t) => config
let step: (
  state,
  Quaternion.t,
  float,
  option<velocity>,
  ~config: config,
  ~stabilizerEnabled: bool,
) => (state, sample)
