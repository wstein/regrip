// Fixed sensor-to-body convention. This is profile data, distinct from the
// session basis captured by GyroOrientation.

@genType
type axis = X | Y | Z
/** One body axis's value read from a signed sensor axis. */
@genType
type component = {axis: axis, sign: float}
/** The sensor→body axis remap for one device profile. */
@genType
type t = {x: component, y: component, z: component}
/** The remap used when a profile doesn't override it. */
@genType
let default: t
/** Remap a sensor-frame quaternion into the body frame. */
@genType
let apply: (t, Quaternion.t) => Quaternion.t
