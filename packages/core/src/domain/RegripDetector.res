// Discrete virtual regrip detection. This is separate from OrientationStabilizer:
// it consumes calibrated relative poses and owns only an accumulated ratchet.

type config = {thresholdDeg: float}
type axis = CubeNotation.axis
type sensorFrameToken = CubeNotation.regripToken
type notationToken = CubeNotation.regripToken
type observation = {sensorFrameToken: sensorFrameToken, notationToken: notationToken}

let defaults = {thresholdDeg: 60.}

type state = Quaternion.t
let initial: state = Quaternion.identity

let quarter = (axis: axis, positive: bool): Quaternion.t => {
  let angle = Quaternion.degreesToRadians(
    if positive {
      90.
    } else {
      -90.
    },
  )
  switch axis {
  | CubeNotation.X => Quaternion.fromEuler({x: angle, y: 0., z: 0.})
  | CubeNotation.Y => Quaternion.fromEuler({x: 0., y: angle, z: 0.})
  | CubeNotation.Z => Quaternion.fromEuler({x: 0., y: 0., z: angle})
  }
}

let axisAndPolarity = (q: Quaternion.t): (axis, bool) => {
  let values = [(CubeNotation.X, q.x), (CubeNotation.Y, q.y), (CubeNotation.Z, q.z)]
  let (axis, value) = values->Array.reduce((CubeNotation.X, 0.), (
    (bestAxis, bestValue),
    (axis, value),
  ) =>
    if Math.abs(value) > Math.abs(bestValue) {
      (axis, value)
    } else {
      (bestAxis, bestValue)
    }
  )
  (axis, value >= 0.)
}

let sensorToken = (axis: axis, positive: bool): sensorFrameToken =>
  CubeNotation.token(
    axis,
    if positive {
      CubeNotation.Clockwise
    } else {
      CubeNotation.CounterClockwise
    },
  )

// Positive right-hand sensor rotations are counter-clockwise. Singmaster
// whole-cube x/y/z notation is clockwise, so only the emitted label inverts.
let notationToken = (axis: axis, positive: bool): notationToken =>
  CubeNotation.token(
    axis,
    if positive {
      CubeNotation.CounterClockwise
    } else {
      CubeNotation.Clockwise
    },
  )

let faceOrderForSensor = token =>
  switch token {
  | CubeNotation.XTurn => "BRUFLD"
  | CubeNotation.XPrime => "FRDBLU"
  | CubeNotation.YTurn => "UFLDBR"
  | CubeNotation.YPrime => "UBRDFL"
  | CubeNotation.ZTurn => "RDFLUB"
  | CubeNotation.ZPrime => "LUFRDB"
  | _ => "URFDLB"
  }

let faceOrderForNotation = token =>
  switch token {
  | CubeNotation.XTurn => "FRDBLU"
  | CubeNotation.XPrime => "BRUFLD"
  | CubeNotation.YTurn => "UBRDFL"
  | CubeNotation.YPrime => "UFLDBR"
  | CubeNotation.ZTurn => "LUFRDB"
  | CubeNotation.ZPrime => "RDFLUB"
  | _ => "URFDLB"
  }

let faceAt = (order: string, face: string): string =>
  switch face {
  | "U" => String.substring(order, ~start=0, ~end=1)
  | "R" => String.substring(order, ~start=1, ~end=2)
  | "F" => String.substring(order, ~start=2, ~end=3)
  | "D" => String.substring(order, ~start=3, ~end=4)
  | "L" => String.substring(order, ~start=4, ~end=5)
  | _ => String.substring(order, ~start=5, ~end=6)
  }

let permuteFaceOrder = (order: string, permutation: string): string =>
  permutation->String.split("")->Array.map(face => faceAt(order, face))->Array.join("")

let step = (state: state, current: Quaternion.t, ~config=defaults): (
  state,
  option<observation>,
) => {
  let current = Quaternion.normalize(current)
  // Precondition: `current` is GyroOrientation.relative output, whose
  // calibration zero is identity. The ratchet records only detected quarters.
  let delta = Quaternion.multiply(Quaternion.conjugate(state), current)
  let threshold = Quaternion.degreesToRadians(config.thresholdDeg)
  let deltaAngle = Quaternion.angle(Quaternion.identity, delta)
  if deltaAngle < threshold {
    (state, None)
  } else {
    // `cardinal` is an exact signed quarter generator. Both the emitted
    // label and ratchet must use it: q and -q represent the same pose.
    let cardinal = CubeSymmetry.nearestQuarterTurn(delta)
    let (axis, positive) = axisAndPolarity(cardinal)

    // A threshold crossing alone is not enough: the 24 cube orientations
    // have dead zones farther than the threshold from every cardinal pose.
    // Commit only when this exact quarter both improves the residual and puts
    // it back inside the same threshold band. This prevents a held, diagonal
    // pose from alternately ratcheting between two unrelated axes.
    let residualAngle = Quaternion.angle(cardinal, delta)
    if residualAngle >= deltaAngle || residualAngle >= threshold {
      (state, None)
    } else {
      // Project to one exact cardinal quarter rather than using the threshold
      // packet, so a continuous rotation yields four steps.
      let nextState = Quaternion.multiply(state, quarter(axis, positive))
      (
        nextState,
        Some({
          sensorFrameToken: sensorToken(axis, positive),
          notationToken: notationToken(axis, positive),
        }),
      )
    }
  }
}
