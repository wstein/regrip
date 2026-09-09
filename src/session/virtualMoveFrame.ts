import { faceOrderForNotation } from '../domain/RegripDetector.res.mjs';

const faceOrder = 'URFDLB';

export type Vector = readonly [number, number, number];
type FaceGeometry = { normal: Vector; right: Vector; down: Vector };
export type VirtualOrientation = {
  right: Vector;
  up: Vector;
  front: Vector;
  faces: { right: string; up: string; front: string };
};

// Kociemba URFDLB facelet grids, viewed from outside each face.
const geometry: Record<string, FaceGeometry> = {
  U: { normal: [0, 1, 0], right: [1, 0, 0], down: [0, 0, 1] },
  R: { normal: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0] },
  F: { normal: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] },
  D: { normal: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1] },
  L: { normal: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0] },
  B: { normal: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0] },
};

const dot = (left: Vector, right: Vector): number =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

const faceForNormal = (normal: Vector): string =>
  faceOrder.split('').find(face => dot(geometry[face]!.normal, normal) === 1)!;

/**
 * Maps the cube's fixed BLE face labels into the user-facing frame established
 * by emitted virtual x/y/z regrips. This is presentation/history state only;
 * the physical move stream and Twisty player remain in protocol URFDLB.
 */
export function createVirtualMoveFrame() {
  // For each logical URFDLB position, the currently occupying physical face.
  let logicalToPhysical = faceOrder;

  const reset = (): void => { logicalToPhysical = faceOrder; };

  const applyRegrip = (notationToken: string): void => {
    const step = faceOrderForNotation(notationToken);
    // RegripDetector emits turns in the cube's local calibrated frame. A new
    // local step therefore acts on the current physical face at each logical
    // position (step ∘ current), not the other way around. This only differs
    // after mixed x/y/z regrips, where rotations do not commute.
    logicalToPhysical = [...logicalToPhysical].map(physicalAtLogical =>
      step[faceOrder.indexOf(physicalAtLogical)]!,
    ).join('');
  };

  const translate = (move: string): string => {
    const match = /^([URFDLB])(.*)$/.exec(move);
    if (!match) return move;
    const physicalFace = match[1]!;
    const logicalIndex = logicalToPhysical.indexOf(physicalFace);
    return logicalIndex === -1 ? move : `${faceOrder[logicalIndex]}${match[2]}`;
  };

  /** Physical directions occupied by the user-facing logical R/U/F axes. */
  const orientation = (): VirtualOrientation => {
    const faces = {
      right: logicalToPhysical[1]!, up: logicalToPhysical[0]!, front: logicalToPhysical[2]!,
    };
    return {
      right: geometry[faces.right]!.normal,
      up: geometry[faces.up]!.normal,
      front: geometry[faces.front]!.normal,
      faces,
    };
  };

  /**
   * Express physical Kociemba facelets in the current logical regrip frame.
   * Both sticker positions/grid orientation and sticker colour labels change.
   */
  const reframeFacelets = (facelets: string): string => {
    if (facelets.length !== 54) return facelets;
    const physicalX = geometry[logicalToPhysical[1]!]!.normal;
    const physicalY = geometry[logicalToPhysical[0]!]!.normal;
    const physicalZ = geometry[logicalToPhysical[2]!]!.normal;
    const rotate = (vector: Vector): Vector => [
      vector[0] * physicalX[0] + vector[1] * physicalY[0] + vector[2] * physicalZ[0],
      vector[0] * physicalX[1] + vector[1] * physicalY[1] + vector[2] * physicalZ[1],
      vector[0] * physicalX[2] + vector[1] * physicalY[2] + vector[2] * physicalZ[2],
    ];
    const logicalForPhysicalColour = (colour: string): string => {
      const index = logicalToPhysical.indexOf(colour);
      return index === -1 ? colour : faceOrder[index]!;
    };

    return faceOrder.split('').flatMap(logicalFace => {
      const logical = geometry[logicalFace]!;
      const physicalFace = faceForNormal(rotate(logical.normal));
      const physical = geometry[physicalFace]!;
      return Array.from({ length: 9 }, (_, stickerIndex) => {
        const row = Math.floor(stickerIndex / 3) - 1;
        const column = stickerIndex % 3 - 1;
        const rotatedRight = rotate(logical.right);
        const rotatedDown = rotate(logical.down);
        const physicalRow = column * dot(rotatedRight, physical.down)
          + row * dot(rotatedDown, physical.down) + 1;
        const physicalColumn = column * dot(rotatedRight, physical.right)
          + row * dot(rotatedDown, physical.right) + 1;
        const rawIndex = faceOrder.indexOf(physicalFace) * 9
          + physicalRow * 3 + physicalColumn;
        return logicalForPhysicalColour(facelets[rawIndex]!);
      });
    }).join('');
  };

  return { applyRegrip, orientation, reframeFacelets, reset, translate };
}
