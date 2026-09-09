// Detects a quarter-turn immediately returned on the same face. Pure domain
// state: session code supplies move tokens and transport timestamps.

type config = {windowMs: float}
type state = option<(string, float)>

let defaults = {windowMs: 300.}
let initial: state = None

let inverse = (move: string): option<string> => {
  switch String.length(move) {
  | 1 => Some(`${move}'`)
  | 2 if String.substring(move, ~start=1, ~end=2) == "'" =>
    Some(String.substring(move, ~start=0, ~end=1))
  | _ => None
  }
}

/** Returns the initiating move when `move` returns it within the time window. */
let step = (state: state, move: string, timestamp: float, ~config=defaults): (
  state,
  option<string>,
) => {
  let result = switch (state, inverse(move)) {
  | (Some((previousMove, previousTimestamp)), Some(expected))
    if previousMove == expected &&
    timestamp >= previousTimestamp &&
    timestamp -. previousTimestamp <= config.windowMs =>
    Some(previousMove)
  | _ => None
  }

  // Gestures are non-overlapping: a matched return cannot become the start
  // of a second trigger. An unmatched move starts a fresh candidate instead.
  let nextState = switch result {
  | Some(_) => None
  | None => Some((move, timestamp))
  }
  (nextState, result)
}
