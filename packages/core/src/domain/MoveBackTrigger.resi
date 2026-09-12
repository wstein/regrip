@genType
type config = {windowMs: float}
@genType
type state

@genType
let defaults: config
@genType
let initial: state
/** Returns the initiating move when `move` returns it within the time window. */
@genType
let step: (state, string, float, ~config: config=?) => (state, option<string>)
