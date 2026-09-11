// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { countDetectedMoves, setResetGyroEnabled } from './infoPanel';

describe('countDetectedMoves', () => {
  it('counts editable whitespace-delimited move and virtual-regrip tokens', () => {
    expect(countDetectedMoves("  R  U'\ny  x2  ")).toBe(4);
    expect(countDetectedMoves('   ')).toBe(0);
  });
});

describe('setResetGyroEnabled', () => {
  it('disables Reset Gyro when the connected cube has no gyroscope', () => {
    document.body.innerHTML = '<button id="reset-gyro"></button>';
    const resetGyro = document.querySelector<HTMLButtonElement>('#reset-gyro')!;

    setResetGyroEnabled(false);
    expect(resetGyro.disabled).toBe(true);

    setResetGyroEnabled(true);
    expect(resetGyro.disabled).toBe(false);
  });
});
