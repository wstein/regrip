/** Opaque pure reducer state for authoritative snapshot delivery. */
export type SnapshotDeduperState = unknown;

export type Snapshot = { readonly serial?: number; readonly facelets: string };

export const initial: SnapshotDeduperState;
export function request(state: SnapshotDeduperState): SnapshotDeduperState;
export function cancel(state: SnapshotDeduperState): SnapshotDeduperState;
export function observe(
  state: SnapshotDeduperState,
  snapshot: Snapshot,
): readonly [SnapshotDeduperState, boolean];
