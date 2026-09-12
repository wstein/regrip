import type { t as Quaternion } from './Quaternion.gen.js';

export type BodyAxis = 'X' | 'Y' | 'Z';
export type BodyComponent = { axis: BodyAxis; sign: number };
export type SensorToBody = { x: BodyComponent; y: BodyComponent; z: BodyComponent };
declare const defaultMap: SensorToBody;
export { defaultMap as default };
export function apply(map: SensorToBody, quaternion: Quaternion): Quaternion;
