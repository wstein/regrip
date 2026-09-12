@genType
type velocity = {x: float, y: float, z: float}
@genType
type config
@genType
type sample = {
  relative: Quaternion.t,
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
@genType
let resetStabilizer: state => state
@genType
let withStabilizerConfig: (config, OrientationStabilizer.config) => config
@genType
let withSensorToBody: (config, SensorToBody.t) => config
@genType
let step: (
  state,
  Quaternion.t,
  float,
  option<velocity>,
  ~config: config,
  ~stabilizerEnabled: bool,
) => (state, sample)
