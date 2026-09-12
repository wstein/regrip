// Pure policy reducer for synchronizing an authoritative snapshot and its
// subsequent move stream. Cube permutation math belongs in an adapter.

@genType
type state

@genType @tag("kind")
type effect =
  | @as("setAlgorithm") SetAlgorithm({algorithm: string})
  | @as("addMove") AddMove({move: string})

@genType
let initial: state
@genType
let beginSnapshot: state => (state, int)
@genType
let move: (state, string) => (state, array<effect>)
@genType
let resolve: (state, int, string) => (state, array<effect>)
@genType
let confirm: (state, int) => (state, array<effect>)
@genType
let reset: state => (state, array<effect>)
@genType
let invalidate: state => state
