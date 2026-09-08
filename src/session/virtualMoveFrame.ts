import { faceOrderForNotation } from '../domain/RegripDetector.res.mjs';

const faceOrder = 'URFDLB';

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

  return { applyRegrip, reset, translate };
}
