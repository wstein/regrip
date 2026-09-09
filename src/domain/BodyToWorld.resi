type axis = X | Y | Z
type component = {axis: axis, sign: float}
type t = {x: component, y: component, z: component}
let default: t
let apply: (t, Quaternion.t) => Quaternion.t
