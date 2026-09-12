// Detects discrete virtual x/y/z regrips from calibrated gyro orientation.
// It is intentionally independent from display stabilization and detents.
// Input must be a calibrated relative pose whose zero is identity.

@genType
type config = {thresholdDeg: float}
@genType
type axis = CubeNotation.axis
@genType
type sensorFrameToken = CubeNotation.regripToken
@genType
type notationToken = CubeNotation.regripToken
@genType
type observation = {sensorFrameToken: sensorFrameToken, notationToken: notationToken}
@genType
type state

@genType
let defaults: config
@genType
let initial: state
@genType
let step: (state, Quaternion.t, ~config: config=?) => (state, option<observation>)

/** Body face at each world URFDLB position after a sensor-frame quarter turn. */
@genType
let faceOrderForSensor: CubeNotation.regripToken => string
/** Body face at each world URFDLB position after a Singmaster x/y/z turn. */
@genType
let faceOrderForNotation: CubeNotation.regripToken => string
/** Apply a URFDLB permutation to any six-character face/color order. */
@genType
let permuteFaceOrder: (string, string) => string
