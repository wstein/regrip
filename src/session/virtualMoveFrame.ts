import * as VirtualCubeFrame from '../domain/VirtualCubeFrame.res.mjs';

const faceOrder = 'URFDLB';

export type Vector = readonly [number, number, number];
type FaceGeometry = { normal: Vector; right: Vector; down: Vector };
export type VirtualOrientation = {
  right: Vector; up: Vector; front: Vector;
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
  const frame = VirtualCubeFrame.make();
  const reset = (): void => VirtualCubeFrame.reset(frame);
  const applyRegrip = (notationToken: string): void => VirtualCubeFrame.applyRegrip(frame, notationToken);
  const translate = (move: string): string => VirtualCubeFrame.translate(frame, move);

  /** Physical directions occupied by the user-facing logical R/U/F axes. */
  const orientation = (): VirtualOrientation => {
    const orientation = VirtualCubeFrame.orientation(frame);
    return {
      right: [orientation.right.x, orientation.right.y, orientation.right.z],
      up: [orientation.up.x, orientation.up.y, orientation.up.z],
      front: [orientation.front.x, orientation.front.y, orientation.front.z],
      faces: { right: orientation.rightFace, up: orientation.upFace, front: orientation.frontFace },
    };
  };

  /**
   * Express physical Kociemba facelets in the current logical regrip frame.
   * Both sticker positions/grid orientation and sticker colour labels change.
   */
  const reframeFacelets = (facelets: string): string => {
    if (facelets.length !== 54) return facelets;
    const frameOrientation = VirtualCubeFrame.orientation(frame);
    const physicalX = geometry[frameOrientation.rightFace]!.normal;
    const physicalY = geometry[frameOrientation.upFace]!.normal;
    const physicalZ = geometry[frameOrientation.frontFace]!.normal;
    const rotate = (vector: Vector): Vector => [
      vector[0] * physicalX[0] + vector[1] * physicalY[0] + vector[2] * physicalZ[0],
      vector[0] * physicalX[1] + vector[1] * physicalY[1] + vector[2] * physicalZ[1],
      vector[0] * physicalX[2] + vector[1] * physicalY[2] + vector[2] * physicalZ[2],
    ];
    const logicalForPhysicalColour = (colour: string): string =>
      VirtualCubeFrame.logicalFaceForPhysical(frame, colour);

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
