// Pure synchronization policy for an authoritative cube-state snapshot and
// the moves received after it. It deliberately knows nothing about facelet
// permutations or cubing.js: adapters execute the effects it emits.

type state = {generation: int, syncing: bool, pendingMoves: array<string>}

@tag("kind")
type effect =
  | @as("setAlgorithm") SetAlgorithm({algorithm: string})
  | @as("addMove") AddMove({move: string})

let initial: state = {generation: 0, syncing: false, pendingMoves: []}

/** Begin resolving a newly received authoritative facelet snapshot. */
let beginSnapshot = (state: state): (state, int) => {
  let generation = state.generation + 1
  ({generation, syncing: true, pendingMoves: []}, generation)
}

/** A move either applies now or is held until the active snapshot resolves. */
let move = (state: state, token: string): (state, array<effect>) =>
  if state.syncing {
    ({...state, pendingMoves: Array.concat(state.pendingMoves, [token])}, [])
  } else {
    (state, [AddMove({move: token})])
  }

/**
 * Install the algorithm computed for a snapshot and replay its queued moves.
 * A result from an older snapshot is intentionally ignored.
 */
let resolve = (state: state, generation: int, algorithm: string): (state, array<effect>) =>
  if generation != state.generation {
    (state, [])
  } else {
    let effects: array<effect> = [SetAlgorithm({algorithm: algorithm})]
    state.pendingMoves->Array.forEach(move => effects->Array.push(AddMove({move: move})))
    ({...state, syncing: false, pendingMoves: []}, effects)
  }

/** Accept a matching snapshot without resetting the adapter's algorithm. */
let confirm = (state: state, generation: int): (state, array<effect>) =>
  if generation != state.generation {
    (state, [])
  } else {
    let effects: array<effect> = []
    state.pendingMoves->Array.forEach(move => effects->Array.push(AddMove({move: move})))
    ({...state, syncing: false, pendingMoves: []}, effects)
  }

/** Drop pending work and clear the adapter's player state. */
let reset = (state: state): (state, array<effect>) => (
  {generation: state.generation + 1, syncing: false, pendingMoves: []},
  [SetAlgorithm({algorithm: ""})],
)
