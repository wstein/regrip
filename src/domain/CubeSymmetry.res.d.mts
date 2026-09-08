import type { Quaternion } from './Quaternion.res.mjs';

/** The 24 orientation-preserving rotations of a cube. */
export const poses: Quaternion[];

/** Selects the closest cardinal pose, retaining `current` inside the hysteresis margin. */
export function nearest(raw: Quaternion, current: Quaternion | undefined, marginRad: number): Quaternion;
