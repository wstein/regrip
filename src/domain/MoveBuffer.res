// Move bookkeeping extracted from index.ts: a rolling window of recent moves
// (used for clock-skew estimation) and the current solution's moves. Pure and
// generic over the move type; timestamp calculations stay at the typed
// JavaScript boundary in index.ts.

type t<'m> = {
  mutable recent: array<'m>,
  mutable solution: array<'m>,
}

let maxRecent = 256

// Skew estimation needs a reasonable window before it means anything.
let skewThreshold = 10

let make = (): t<'m> => {recent: [], solution: []}

let pushRecent = (t: t<'m>, move: 'm): unit => {
  t.recent->Array.push(move)
  if Array.length(t.recent) > maxRecent {
    t.recent = t.recent->Array.slice(~start=Array.length(t.recent) - maxRecent)
  }
}

let pushSolution = (t: t<'m>, move: 'm): unit => t.solution->Array.push(move)

let clearSolution = (t: t<'m>): unit => t.solution = []

let reset = (t: t<'m>): unit => {
  t.recent = []
  t.solution = []
}

let recentReady = (t: t<'m>): bool => Array.length(t.recent) > skewThreshold

let recentMoves = (t: t<'m>): array<'m> => t.recent

let solutionMoves = (t: t<'m>): array<'m> => t.solution
