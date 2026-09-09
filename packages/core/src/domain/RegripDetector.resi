// Detects discrete virtual x/y/z regrips from calibrated gyro orientation.
// It is intentionally independent from display stabilization and detents.
// Input must be a calibrated relative pose whose zero is identity.

type config = {thresholdDeg: float}
type axis = CubeNotation.axis
type sensorFrameToken = CubeNotation.regripToken
type notationToken = CubeNotation.regripToken
type observation = {sensorFrameToken: sensorFrameToken, notationToken: notationToken}
type state

let defaults: config
let initial: state
let step: (state, Quaternion.t, ~config: config=?) => (state, option<observation>)

/** Body face at each world URFDLB position after a sensor-frame quarter turn. */
let faceOrderForSensor: CubeNotation.regripToken => string
/** Body face at each world URFDLB position after a Singmaster x/y/z turn. */
let faceOrderForNotation: CubeNotation.regripToken => string
/** Apply a URFDLB permutation to any six-character face/color order. */
let permuteFaceOrder: (string, string) => string
