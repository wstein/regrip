/** Singmaster face labels. */
export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
/** Whole-cube rotation axes. */
export type Axis = 'x' | 'y' | 'z';
/** A whole-cube turn suffix. */
export type Turn = '' | "'" | '2';
/** Complete whole-cube rotation tokens. */
export type RegripToken = 'x' | "x'" | 'x2' | 'y' | "y'" | 'y2' | 'z' | "z'" | 'z2';

export function faceFromString(value: string): Face | undefined;
export function faceToString(value: Face): string;
export function token(axis: Axis, turn: Turn): RegripToken;
export function regripFromString(value: string): RegripToken | undefined;
