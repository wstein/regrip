type config
let defaults: config
let apply: (Quaternion.t, Quaternion.t, ~velocity: float=?, ~config: config=?) => Quaternion.t
