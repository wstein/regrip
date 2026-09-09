// Hand-written types for the compiled ReScript module src/MoveBuffer.res.

/** Opaque reducer state; the phantom member preserves the move type for TS inference. */
export type MoveBufferState<M> = { readonly __moveBufferType?: M };

export function initial<M>(): MoveBufferState<M>;
export function pushRecent<M>(state: MoveBufferState<M>, move: M): MoveBufferState<M>;
export function pushSolution<M>(state: MoveBufferState<M>, move: M): MoveBufferState<M>;
export function clearSolution<M>(state: MoveBufferState<M>): MoveBufferState<M>;
export function reset<M>(state: MoveBufferState<M>): MoveBufferState<M>;
export function recentReady<M>(state: MoveBufferState<M>): boolean;
export function recentMoves<M>(state: MoveBufferState<M>): M[];
export function solutionMoves<M>(state: MoveBufferState<M>): M[];
