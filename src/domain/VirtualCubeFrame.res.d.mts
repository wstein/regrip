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
export function applyRegrip(frame: VirtualCubeFrame, notationToken: string): void;
export function translate(frame: VirtualCubeFrame, move: string): string;
export function orientation(frame: VirtualCubeFrame): VirtualOrientation;
export function logicalFaceForPhysical(frame: VirtualCubeFrame, physicalFace: string): string;
export function reframeFacelets(frame: VirtualCubeFrame, facelets: string): string;
