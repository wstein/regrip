/** Opaque state for the modulo-256 smart-cube move serial tracker. */
export type MoveTrackerState = unknown;

export type MoveGap = {
  previousSerial: number;
  serial: number;
  missing: number;
};

export const initial: MoveTrackerState;
export function trusted(state: MoveTrackerState): boolean;
export function observeSnapshot(
  state: MoveTrackerState,
  serial: number | undefined,
): MoveTrackerState;
export function observeMove(
  state: MoveTrackerState,
  serial: number | undefined,
): [MoveTrackerState, MoveGap | undefined];
