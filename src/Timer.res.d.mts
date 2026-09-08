// Hand-written types for the compiled ReScript module src/Timer.res.
//
// Timer.res `@tag("kind")`-normalizes every variant with explicit lowercase
// wire values, so this stays a plain discriminated union:
//   - no-payload variants  -> the bare @as string ("idle", "showTimer", ...)
//   - payload variants      -> { kind: "...", ...fields }
// Keep these strings in sync with the @as attributes in Timer.res.

export type State = "idle" | "ready" | "running" | "stopped";

export type Input = "activate" | "moveDetected" | "solved" | "disconnected";

export type Phase = { kind: "ready" } | { kind: "running" } | { kind: "stopped" };

export type Effect =
  | "showTimer"
  | "hideTimer"
  | "startLocalTimer"
  | "stopLocalTimer"
  | "clearSolutionMoves"
  | "showFinalTime"
  | { kind: "setPhase"; phase: Phase }
  | { kind: "setValueMs"; ms: number };

export function step(state: State, input: Input, connected: boolean): [State, Effect[]];
