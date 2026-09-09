type config = {windowMs: float}
type state

let defaults: config
let initial: state
/** Returns the initiating move when `move` returns it within the time window. */
let step: (state, string, float, ~config: config=?) => (state, option<string>)
