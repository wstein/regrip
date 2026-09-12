@genType
type axis = X | Y | Z
@genType
type component = {axis: axis, sign: float}
@genType
type t = {x: component, y: component, z: component}
@genType
let default: t
@genType
let apply: (t, Quaternion.t) => Quaternion.t
