// Detects discrete virtual x/y/z regrips from calibrated gyro orientation.
// It is intentionally independent from display stabilization and detents.
// Input must be a calibrated relative pose whose zero is identity.

type config = {thresholdDeg: float}
@unboxed type axis = | @as("x") X | @as("y") Y | @as("z") Z
@unboxed
type sensorFrameToken =
  | @as("x") SensorX
  | @as("x'") SensorXPrime
  | @as("y") SensorY
  | @as("y'") SensorYPrime
  | @as("z") SensorZ
  | @as("z'") SensorZPrime
@unboxed
type notationToken =
  | @as("x") NotationX
  | @as("x'") NotationXPrime
  | @as("y") NotationY
  | @as("y'") NotationYPrime
  | @as("z") NotationZ
  | @as("z'") NotationZPrime
type observation = {sensorFrameToken: sensorFrameToken, notationToken: notationToken}
type state

let defaults: config
let initial: state
let step: (state, Quaternion.t, ~config: config=?) => (state, option<observation>)

/** Body face at each world URFDLB position after a sensor-frame quarter turn. */
let faceOrderForSensor: string => string
/** Body face at each world URFDLB position after a Singmaster x/y/z turn. */
let faceOrderForNotation: string => string
/** Apply a URFDLB permutation to any six-character face/color order. */
let permuteFaceOrder: (string, string) => string
