// Detects a quarter-turn immediately returned on the same face. Pure domain
// state: session code supplies move tokens and transport timestamps.

type config = {windowMs: float}
type t = {mutable previous: option<(string, float)>, config: config}

let defaults = {windowMs: 300.}
let make = (~config=defaults): t => {previous: None, config}
let reset = (detector: t): unit => detector.previous = None

let inverse = (move: string): option<string> => {
  switch String.length(move) {
  | 1 => Some(`${move}'`)
  | 2 if String.substring(move, ~start=1, ~end=2) == "'" =>
    Some(String.substring(move, ~start=0, ~end=1))
  | _ => None
  }
}

/** Returns the initiating move when `move` returns it within the time window. */
let observe = (detector: t, move: string, timestamp: float): option<string> => {
  let result = switch (detector.previous, inverse(move)) {
  | (Some((previousMove, previousTimestamp)), Some(expected))
    if previousMove == expected &&
    timestamp >= previousTimestamp &&
    timestamp -. previousTimestamp <= detector.config.windowMs =>
    Some(previousMove)
  | _ => None
  }

  // Gestures are non-overlapping: a matched return cannot become the start
  // of a second trigger. An unmatched move starts a fresh candidate instead.
  detector.previous = switch result {
  | Some(_) => None
  | None => Some((move, timestamp))
  }
  result
}
