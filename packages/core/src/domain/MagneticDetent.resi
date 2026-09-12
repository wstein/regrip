@genType
type config = {
  radiusDeg: float,
  snapDeg: float,
  velocityMax: float,
}
@genType
let defaults: config
@genType
let apply: (Quaternion.t, Quaternion.t, ~velocity: float=?, ~config: config=?) => Quaternion.t
