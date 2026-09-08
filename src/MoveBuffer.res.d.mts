// Hand-written types for the compiled ReScript module src/MoveBuffer.res.

export type MoveBuffer<M> = {
  recent: M[];
  solution: M[];
};

export function make<M>(): MoveBuffer<M>;
export function pushRecent<M>(t: MoveBuffer<M>, move: M): void;
export function pushSolution<M>(t: MoveBuffer<M>, move: M): void;
export function clearSolution<M>(t: MoveBuffer<M>): void;
export function reset<M>(t: MoveBuffer<M>): void;
export function recentReady<M>(t: MoveBuffer<M>): boolean;
export function recentMoves<M>(t: MoveBuffer<M>): M[];
export function solutionMoves<M>(t: MoveBuffer<M>): M[];
export function recentSkew<M>(t: MoveBuffer<M>): number;
export function fittedSolution<M>(t: MoveBuffer<M>): M[];
