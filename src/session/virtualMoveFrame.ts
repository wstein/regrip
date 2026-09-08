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
    logicalToPhysical = [...step].map(physicalAtPriorLogical =>
      logicalToPhysical[faceOrder.indexOf(physicalAtPriorLogical)]!,
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
