import type { Quaternion } from './Quaternion.res.mjs';

export type BodyAxis = 'x' | 'y' | 'z';
export type BodyComponent = { axis: BodyAxis; sign: number };
export type SensorToBody = { x: BodyComponent; y: BodyComponent; z: BodyComponent };
declare const defaultMap: SensorToBody;
export { defaultMap as default };
export function apply(map: SensorToBody, quaternion: Quaternion): Quaternion;
