// Discrete virtual regrip detection. This is separate from OrientationStabilizer:
// it consumes calibrated, unmodified gyro poses and only owns an event baseline.

type config = {thresholdDeg: float, confirmDeg: float}
type observation = {sensorFrameToken: string, notationToken: string}

// Threshold avoids treating tiny ordinary handling as a regrip. Confirmation
// requires reaching the intended 90° pose before a virtual move is emitted.
let defaults = {thresholdDeg: 60., confirmDeg: 15.}

type t = {mutable baseline: option<Quaternion.t>, config: config}

let make = (~config=defaults): t => {baseline: None, config}
let reset = (t: t): unit => t.baseline = None

let quarter = (axis: string, positive: bool): Quaternion.t => {
  let angle = Quaternion.degreesToRadians(if positive {90.} else {-90.})
  switch axis {
  | "x" => Quaternion.fromEuler({x: angle, y: 0., z: 0.})
  | "y" => Quaternion.fromEuler({x: 0., y: angle, z: 0.})
  | _ => Quaternion.fromEuler({x: 0., y: 0., z: angle})
  }
}

let axisAndPolarity = (q: Quaternion.t): (string, bool) => {
  let values = [("x", q.x), ("y", q.y), ("z", q.z)]
  let (axis, value) = values->Array.reduce(("x", 0.), ((bestAxis, bestValue), (axis, value)) =>
    if Math.abs(value) > Math.abs(bestValue) {(axis, value)} else {(bestAxis, bestValue)}
  )
  (axis, value >= 0.)
}

let sensorToken = (axis: string, positive: bool): string =>
  positive ? axis : `${axis}'`

// Positive right-hand sensor rotations are counter-clockwise. Singmaster
// whole-cube x/y/z notation is clockwise, so only the emitted label inverts.
let notationToken = (axis: string, positive: bool): string =>
  sensorToken(axis, !positive)

let faceOrderForSensor = token => switch token {
| "x" => "BRUFLD"
| "x'" => "FRDBLU"
| "y" => "UFLDBR"
| "y'" => "UBRDFL"
| "z" => "RDFLUB"
| "z'" => "LUFRDB"
| _ => "URFDLB"
}

let faceOrderForNotation = token => switch token {
| "x" => "FRDBLU"
| "x'" => "BRUFLD"
| "y" => "UBRDFL"
| "y'" => "UFLDBR"
| "z" => "LUFRDB"
| "z'" => "RDFLUB"
| _ => "URFDLB"
}

let faceAt = (order: string, face: string): string => switch face {
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
      let deltaAngle = Quaternion.angle(Quaternion.identity, delta)
      let cardinal = CubeSymmetry.nearest(delta, None, 0.)
      let confirmsCardinal = Quaternion.angle(delta, cardinal) <= Quaternion.degreesToRadians(t.config.confirmDeg)
      if deltaAngle < Quaternion.degreesToRadians(t.config.thresholdDeg)
        || Quaternion.angle(Quaternion.identity, cardinal) < 0.00001
        || !confirmsCardinal {
        None
      } else {
        let (axis, positive) = axisAndPolarity(delta)
        // Project to an exact cardinal quarter turn rather than using the
        // confirmation packet, so a continuous rotation yields four steps.
        t.baseline = Some(Quaternion.multiply(baseline, quarter(axis, positive)))
        Some({sensorFrameToken: sensorToken(axis, positive), notationToken: notationToken(axis, positive)})
      }
    }
  }
}
