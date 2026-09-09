type config = {windowMs: float}
type t

let defaults: config
let make: (~config: config=?) => t
let reset: t => unit
/** Returns the initiating move when `move` returns it within the time window. */
let observe: (t, string, float) => option<string>
