type config = {
  radiusDeg: float,
  snapDeg: float,
  velocityMax: float,
}
let defaults: config
let apply: (Quaternion.t, Quaternion.t, ~velocity: float=?, ~config: config=?) => Quaternion.t
