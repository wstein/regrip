// Pure policy reducer for synchronizing an authoritative snapshot and its
// subsequent move stream. Cube permutation math belongs in an adapter.

/** Move-replay bookkeeping: the pending/covered move queues and the
 * generation guarding late snapshot results. */
@genType
type state

/** A side effect for the adapter to apply: install an algorithm, or replay
 * one move on top of it. */
@genType @tag("kind")
type effect =
  | @as("setAlgorithm") SetAlgorithm({algorithm: string})
  | @as("addMove") AddMove({move: string})

@genType
let initial: state
/** Begin resolving a newly received authoritative facelet snapshot. */
@genType
let beginSnapshot: state => (state, int)
/** A move either applies now or is held until the active snapshot resolves. */
@genType
let move: (state, string) => (state, array<effect>)
/**
 * Install the algorithm computed for a snapshot and replay its queued moves.
 * A result from an older snapshot is intentionally ignored.
 */
@genType
let resolve: (state, int, string) => (state, array<effect>)
/** Accept a matching snapshot without resetting the adapter's algorithm. */
@genType
let confirm: (state, int) => (state, array<effect>)
/** Drop pending work and clear the adapter's player state. */
@genType
let reset: state => (state, array<effect>)
/** Invalidate a pending solve without changing the currently rendered player. */
@genType
let invalidate: state => state
