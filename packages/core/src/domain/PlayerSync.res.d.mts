/** Opaque pure reducer state for snapshot / move player synchronization. */
export type PlayerSyncState = unknown;

export type PlayerSyncEffect =
  | { readonly kind: 'setAlgorithm'; readonly algorithm: string }
  | { readonly kind: 'addMove'; readonly move: string };

export const initial: PlayerSyncState;
export function beginSnapshot(state: PlayerSyncState): readonly [PlayerSyncState, number];
export function move(
  state: PlayerSyncState,
  token: string,
): readonly [PlayerSyncState, PlayerSyncEffect[]];
export function resolve(
  state: PlayerSyncState,
  generation: number,
  algorithm: string,
): readonly [PlayerSyncState, PlayerSyncEffect[]];
export function confirm(
  state: PlayerSyncState,
  generation: number,
): readonly [PlayerSyncState, PlayerSyncEffect[]];
export function reset(state: PlayerSyncState): readonly [PlayerSyncState, PlayerSyncEffect[]];
