// Fixed sensor-to-body convention. This is profile data, distinct from the
// session basis captured by GyroOrientation.
type axis = X | Y | Z
type component = {axis: axis, sign: float}
type t = {x: component, y: component, z: component}
let default = {x: {axis: X, sign: 1.}, y: {axis: Z, sign: 1.}, z: {axis: Y, sign: -1.}}
let value = (q: Quaternion.t, component: component) =>
  component.sign *.
  switch component.axis {
  | X => q.x
  | Y => q.y
  | Z => q.z
  }
let apply = (map: t, q: Quaternion.t): Quaternion.t =>
  Quaternion.normalize({x: value(q, map.x), y: value(q, map.y), z: value(q, map.z), w: q.w})
