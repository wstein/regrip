import * as VirtualCubeFrame from '../domain/VirtualCubeFrame.res.mjs';

export type Vector = readonly [number, number, number];
export type VirtualOrientation = {
  right: Vector;
  up: Vector;
  front: Vector;
  faces: { right: string; up: string; front: string };
};

/**
 * Maps the cube's fixed body-local BLE face labels into the solver frame established
 * by emitted virtual x/y/z regrips. This is presentation/history state only;
 * the physical move stream and Twisty player remain in protocol URFDLB.
 */
export function createVirtualMoveFrame() {
  const frame = VirtualCubeFrame.make();
  const reset = (): void => VirtualCubeFrame.reset(frame);
  const applyRegrip = (notationToken: string): void =>
    VirtualCubeFrame.applyRegrip(frame, notationToken);
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
   * Express body-local Kociemba facelets in the current solver regrip frame.
   * Both sticker positions/grid orientation and sticker colour labels change.
   */
  const reframeFacelets = (facelets: string): string =>
    VirtualCubeFrame.reframeFacelets(frame, facelets);

  return { applyRegrip, orientation, reframeFacelets, reset, translate };
}
