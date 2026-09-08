// Detects discrete virtual x/y/z regrips from calibrated gyro orientation.
// It is intentionally independent from display stabilization and detents.

type config = {thresholdDeg: float}
type observation = {sensorFrameToken: string, notationToken: string}
type t

let defaults: config
let make: (~config: config=?) => t
let reset: t => unit
let observe: (t, Quaternion.t) => option<observation>

/** Body face at each world URFDLB position after a sensor-frame quarter turn. */
let faceOrderForSensor: string => string
/** Body face at each world URFDLB position after a Singmaster x/y/z turn. */
let faceOrderForNotation: string => string
/** Apply a URFDLB permutation to any six-character face/color order. */
let permuteFaceOrder: (string, string) => string
