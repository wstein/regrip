// Detects regrips by locking calibrated gyro input to one of the 24 absolute
// cube orientations and emitting a deterministic shortest quarter-turn path.

@genType
type config = {snapDeg: float, hysteresisDeg: float}
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
@genType
let pose: state => Quaternion.t
@genType
let step: (state, Quaternion.t, ~config: config=?) => (state, option<observation>)
