export type VirtualCubeFrame = unknown;
export type Vector = { x: number; y: number; z: number };
export type VirtualOrientation = {
  right: Vector;
  up: Vector;
  front: Vector;
  rightFace: string;
  upFace: string;
  frontFace: string;
};

export function make(): VirtualCubeFrame;
export function reset(frame: VirtualCubeFrame): void;
export function applyRegrip(frame: VirtualCubeFrame, notationToken: RegripToken): void;
export function translate(frame: VirtualCubeFrame, move: string): string;
export function orientation(frame: VirtualCubeFrame): VirtualOrientation;
export function solverFaceForBody(frame: VirtualCubeFrame, bodyFace: string): string;
export function solverToken(frame: VirtualCubeFrame, bodyToken: RegripToken): RegripToken;
export function reframeFacelets(frame: VirtualCubeFrame, facelets: string): string;
import type { RegripToken } from './CubeNotation.res.mjs';
