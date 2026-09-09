// Gyro calibration is a pure reducer. The first sensor-to-body pose establishes
// identity in the calibrated world frame; display-home composition stays pure.

let home = Quaternion.fromEuler({
  x: Quaternion.degreesToRadians(15.),
  y: Quaternion.degreesToRadians(-20.),
  z: 0.,
})

type state = {basis: option<Quaternion.t>}
let initial: state = {basis: None}

let reset = (_: state): state => initial

let relative = (state: state, raw: Quaternion.t, ~sensorToBody=SensorToBody.default): (
  state,
  Quaternion.t,
) => {
  let q = SensorToBody.apply(sensorToBody, raw)
  let basis = switch state.basis {
  | Some(basis) => basis
  | None => Quaternion.conjugate(q)
  }
  ({basis: Some(basis)}, q->Quaternion.premultiply(basis))
}

let applyHome = (relative: Quaternion.t, ~home=home): Quaternion.t =>
  relative->Quaternion.premultiply(home)

let step = (state: state, raw: Quaternion.t, ~sensorToBody=SensorToBody.default, ~home=home): (
  state,
  Quaternion.t,
) => {
  let (nextState, calibrated) = relative(state, raw, ~sensorToBody)
  (nextState, applyHome(calibrated, ~home))
}
