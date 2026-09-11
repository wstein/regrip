// Pure delivery policy for authoritative snapshots. The session owns request
// provenance, while the app only observes the semantically useful stream.

type snapshot = {serial: option<int>, facelets: string}
type state = {last: option<snapshot>, forced: int}

let initial: state = {last: None, forced: 0}

/** Reserve the next snapshot emission for a request issued by the session. */
let request = state => {...state, forced: state.forced + 1}

/** Release a reservation when its transport request fails before any response. */
let cancel = state =>
  if state.forced > 0 {
    {...state, forced: state.forced - 1}
  } else {
    state
  }

/** Return whether a snapshot is semantically new or answers a pending request. */
let observe = (state: state, snapshot: snapshot): (state, bool) => {
  let duplicate = switch state.last {
  | Some(previous) => previous.serial == snapshot.serial && previous.facelets == snapshot.facelets
  | None => false
  }
  let forced = state.forced > 0
  let next = {
    last: Some(snapshot),
    forced: if forced {
      state.forced - 1
    } else {
      state.forced
    },
  }
  (next, forced || !duplicate)
}
