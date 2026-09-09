// Move bookkeeping extracted from index.ts: a rolling window of recent moves
// (used for clock-skew estimation) and the current solution's moves. Pure and
// generic over the move type; timestamp calculations stay at the typed
// JavaScript boundary in index.ts.

type state<'m> = {recent: array<'m>, solution: array<'m>}

let maxRecent = 256

// Skew estimation needs a reasonable window before it means anything.
let skewThreshold = 10

let initial = (): state<'m> => {recent: [], solution: []}

let pushRecent = (state: state<'m>, move: 'm): state<'m> => {
  let recent = Array.concat(state.recent, [move])
  let recent = if Array.length(recent) > maxRecent {
    recent->Array.slice(~start=Array.length(recent) - maxRecent)
  } else {
    recent
  }
  {...state, recent}
}

let pushSolution = (state: state<'m>, move: 'm): state<'m> => {
  ...state,
  solution: Array.concat(state.solution, [move]),
}

let clearSolution = (state: state<'m>): state<'m> => {...state, solution: []}

let reset = (_: state<'m>): state<'m> => initial()

let recentReady = (state: state<'m>): bool => Array.length(state.recent) > skewThreshold

let recentMoves = (state: state<'m>): array<'m> => state.recent

let solutionMoves = (state: state<'m>): array<'m> => state.solution
