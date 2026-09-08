// Hand-written types for the compiled ReScript module src/Timer.res.
// Keep in sync with that file's variants and `step` signature.

export type State = "Idle" | "Ready" | "Running" | "Stopped";

export type Input = "Activate" | "MoveDetected" | "Solved" | "Disconnected";

export type Effect =
  | "ShowTimer"
  | "HideTimer"
  | "StartLocalTimer"
  | "StopLocalTimer"
  | "ClearSolutionMoves"
  | "ShowFinalTime"
  | { TAG: "SetColor"; _0: string }
  | { TAG: "SetValueMs"; _0: number };

export function step(state: State, input: Input, connected: boolean): [State, Effect[]];
