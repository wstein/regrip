// Detects a quarter-turn immediately returned on the same face. Pure domain
// state: session code supplies move tokens and transport timestamps.

/** How long, in ms, a move may wait for its inverse before the window closes. */
@genType
type config = {windowMs: float}
/** The move awaiting its inverse, if any, and when it was observed. */
@genType
type state

@genType
let defaults: config
@genType
let initial: state
/** Returns the initiating move when `move` returns it within the time window. */
@genType
let step: (state, string, float, ~config: config=?) => (state, option<string>)
