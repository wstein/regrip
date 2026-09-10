// Pure policy reducer for synchronizing an authoritative snapshot and its
// subsequent move stream. Cube permutation math belongs in an adapter.

type state

@tag("kind")
type effect =
  | @as("setAlgorithm") SetAlgorithm({algorithm: string})
  | @as("addMove") AddMove({move: string})

let initial: state
let beginSnapshot: state => (state, int)
let move: (state, string) => (state, array<effect>)
let resolve: (state, int, string) => (state, array<effect>)
let confirm: (state, int) => (state, array<effect>)
let reset: state => (state, array<effect>)
