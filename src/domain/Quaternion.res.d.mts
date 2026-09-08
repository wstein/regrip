// Hand-written types for the compiled ReScript module src/Quaternion.res.

export type Quaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type Euler = { x: number; y: number; z: number };

export const identity: Quaternion;
export function multiply(a: Quaternion, b: Quaternion): Quaternion;
export function premultiply(self: Quaternion, other: Quaternion): Quaternion;
export function conjugate(q: Quaternion): Quaternion;
export function normalize(q: Quaternion): Quaternion;
export function fromEuler(e: Euler): Quaternion;
export function degreesToRadians(deg: number): number;
