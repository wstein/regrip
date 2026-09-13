// Pure synchronization policy for an authoritative cube-state snapshot and
// the moves received after it. It deliberately knows nothing about facelet
// permutations or cubing.js: adapters execute the effects it emits.

type state = {
  generation: int,
  syncing: bool,
  // Moves queued for a superseded snapshot. A matching newer snapshot can
  // release them without resetting the player; a mismatching one replaces
  // their state authoritatively.
  coveredMoves: array<string>,
  pendingMoves: array<string>,
}

@tag("kind")
type effect =
  | @as("setAlgorithm") SetAlgorithm({algorithm: string})
  | @as("addMove") AddMove({move: string})

let initial: state = {generation: 0, syncing: false, coveredMoves: [], pendingMoves: []}

/** Begin resolving a newly received authoritative facelet snapshot. */
let beginSnapshot = (state: state): (state, int) => {
  let generation = state.generation + 1
  let coveredMoves = if state.syncing {
    Array.concat(state.coveredMoves, state.pendingMoves)
  } else {
    []
  }
  ({generation, syncing: true, coveredMoves, pendingMoves: []}, generation)
}

/** A move either applies now or is held until the active snapshot resolves. */
let move = (state: state, token: string): (state, array<effect>) =>
  if state.syncing {
    ({...state, pendingMoves: Array.concat(state.pendingMoves, [token])}, [])
  } else {
    (state, [AddMove({move: token})])
  }

let finish = (state: state, effects: array<effect>): (state, array<effect>) => (
  {...state, syncing: false, coveredMoves: [], pendingMoves: []},
  effects,
)

/** Flush queued moves into `AddMove` effects, optionally preceded by a prefix
 * effect (e.g. installing a newly computed algorithm), then clear the queue. */
let flushEffects = (state: state, moves: array<string>, ~prefix: array<effect>=[]): (
  state,
  array<effect>,
) => {
  let effects = prefix
  moves->Array.forEach(move => effects->Array.push(AddMove({move: move})))
  finish(state, effects)
}

/**
 * Install the algorithm computed for a snapshot and replay its queued moves.
 * A result from an older snapshot is intentionally ignored.
 */
let resolve = (state: state, generation: int, algorithm: string): (state, array<effect>) =>
  if generation != state.generation {
    (state, [])
  } else {
    flushEffects(state, state.pendingMoves, ~prefix=[SetAlgorithm({algorithm: algorithm})])
  }

/** Accept a matching snapshot without resetting the adapter's algorithm. */
let confirm = (state: state, generation: int): (state, array<effect>) =>
  if generation != state.generation {
    (state, [])
  } else {
    flushEffects(state, Array.concat(state.coveredMoves, state.pendingMoves))
  }

/** Drop pending work and clear the adapter's player state. */
let reset = (state: state): (state, array<effect>) => (
  {generation: state.generation + 1, syncing: false, coveredMoves: [], pendingMoves: []},
  [SetAlgorithm({algorithm: ""})],
)

/** Invalidate a pending solve without changing the currently rendered player. */
let invalidate = (state: state): state => {
  generation: state.generation + 1,
  syncing: false,
  coveredMoves: [],
  pendingMoves: [],
}
