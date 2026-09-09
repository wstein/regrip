import type { Quaternion } from './Quaternion.res.mjs';

export type BodyAxis = 'x' | 'y' | 'z';
export type BodyComponent = { axis: BodyAxis; sign: number };
export type BodyToWorld = { x: BodyComponent; y: BodyComponent; z: BodyComponent };
declare const defaultMap: BodyToWorld;
export { defaultMap as default };
export function apply(map: BodyToWorld, quaternion: Quaternion): Quaternion;
