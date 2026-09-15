// Pure delivery policy for authoritative snapshots. The session owns request
// provenance, while the app only observes the semantically useful stream.

/** A facelet snapshot as received from the transport, with its serial if any. */
@genType
type snapshot = {serial: option<int>, facelets: string}
/** The last observed snapshot, and how many `request`s are still pending. */
@genType
type state

@genType
let initial: state
/** Reserve the next snapshot emission for a request issued by the session. */
@genType
let request: state => state
/** Release a reservation when its transport request fails before any response. */
@genType
let cancel: state => state
/** Return whether a snapshot is semantically new or answers a pending request. */
@genType
let observe: (state, snapshot) => (state, bool)
