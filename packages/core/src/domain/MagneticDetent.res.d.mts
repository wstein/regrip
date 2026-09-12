import type { t as Quaternion } from './Quaternion.gen.js';
export type MagneticDetentConfig = { radiusDeg: number; snapDeg: number; velocityMax: number };
export const defaults: MagneticDetentConfig;
export function apply(raw: Quaternion, target: Quaternion, velocity?: number, config?: MagneticDetentConfig): Quaternion;
