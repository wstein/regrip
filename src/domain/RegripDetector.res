// Discrete virtual regrip detection. This is separate from OrientationStabilizer:
// it consumes calibrated, unmodified gyro poses and only owns an event baseline.

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

let defaults = {thresholdDeg: 60.}

type t = {mutable baseline: option<Quaternion.t>, config: config}

let make = (~config=defaults): t => {baseline: None, config}
let reset = (t: t): unit => t.baseline = None

let quarter = (axis: axis, positive: bool): Quaternion.t => {
  let angle = Quaternion.degreesToRadians(
    if positive {
      90.
    } else {
      -90.
    },
  )
  switch axis {
  | X => Quaternion.fromEuler({x: angle, y: 0., z: 0.})
  | Y => Quaternion.fromEuler({x: 0., y: angle, z: 0.})
  | Z => Quaternion.fromEuler({x: 0., y: 0., z: angle})
  }
}

let axisAndPolarity = (q: Quaternion.t): (axis, bool) => {
  let values = [(X, q.x), (Y, q.y), (Z, q.z)]
  let (axis, value) = values->Array.reduce((X, 0.), ((bestAxis, bestValue), (axis, value)) =>
    if Math.abs(value) > Math.abs(bestValue) {
      (axis, value)
    } else {
      (bestAxis, bestValue)
    }
  )
  (axis, value >= 0.)
}

let sensorToken = (axis: axis, positive: bool): sensorFrameToken =>
  switch (axis, positive) {
  | (X, true) => SensorX
  | (X, false) => SensorXPrime
  | (Y, true) => SensorY
  | (Y, false) => SensorYPrime
  | (Z, true) => SensorZ
  | (Z, false) => SensorZPrime
  }

// Positive right-hand sensor rotations are counter-clockwise. Singmaster
// whole-cube x/y/z notation is clockwise, so only the emitted label inverts.
let notationToken = (axis: axis, positive: bool): notationToken =>
  switch (axis, positive) {
  | (X, true) => NotationXPrime
  | (X, false) => NotationX
  | (Y, true) => NotationYPrime
  | (Y, false) => NotationY
  | (Z, true) => NotationZPrime
  | (Z, false) => NotationZ
  }

let faceOrderForSensor = token =>
  switch token {
  | "x" => "BRUFLD"
  | "x'" => "FRDBLU"
  | "y" => "UFLDBR"
  | "y'" => "UBRDFL"
  | "z" => "RDFLUB"
  | "z'" => "LUFRDB"
  | _ => "URFDLB"
  }

let faceOrderForNotation = token =>
  switch token {
  | "x" => "FRDBLU"
  | "x'" => "BRUFLD"
  | "y" => "UBRDFL"
  | "y'" => "UFLDBR"
  | "z" => "LUFRDB"
  | "z'" => "RDFLUB"
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

let observe = (t: t, current: Quaternion.t): option<observation> => {
  let current = Quaternion.normalize(current)
  switch t.baseline {
  | None => {
      t.baseline = Some(current)
      None
    }
  | Some(baseline) => {
      // GyroOrientation.relative is in the cube's local calibrated frame.
      let delta = Quaternion.multiply(Quaternion.conjugate(baseline), current)
      if (
        Quaternion.angle(Quaternion.identity, delta) <
        Quaternion.degreesToRadians(t.config.thresholdDeg)
      ) {
        None
      } else {
        let cardinal = CubeSymmetry.nearest(delta, None, 0.)
        if Quaternion.angle(Quaternion.identity, cardinal) < 0.00001 {
          None
        } else {
          let (axis, positive) = axisAndPolarity(delta)

          // Project to an exact cardinal quarter turn rather than using the
          // threshold packet, so a continuous rotation yields four steps.
          t.baseline = Some(Quaternion.multiply(baseline, quarter(axis, positive)))
          Some({
            sensorFrameToken: sensorToken(axis, positive),
            notationToken: notationToken(axis, positive),
          })
        }
      }
    }
  }
}
