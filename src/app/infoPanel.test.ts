// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  countDetectedMoves,
  setOrientationTracking,
  setOrientationTrackingAvailable,
  setResetOrientationEnabled,
} from './infoPanel';

describe('countDetectedMoves', () => {
  it('counts editable whitespace-delimited move and virtual-regrip tokens', () => {
    expect(countDetectedMoves("  R  U'\ny  x2  ")).toBe(4);
    expect(countDetectedMoves('   ')).toBe(0);
  });
});

describe('orientation controls', () => {
  it('enables tracking only for gyro cubes and changes reset to the active orientation mode', () => {
    document.body.innerHTML =
      '<button id="track-orientation" aria-pressed="false"></button><button id="reset-gyro"></button>';
    const tracker = document.querySelector<HTMLButtonElement>('#track-orientation')!;
    const resetGyro = document.querySelector<HTMLButtonElement>('#reset-gyro')!;

    setOrientationTrackingAvailable(false);
    setResetOrientationEnabled(false);
    expect(tracker.disabled).toBe(true);
    expect(resetGyro.disabled).toBe(true);

    setOrientationTrackingAvailable(true);
    setOrientationTracking(true);
    setResetOrientationEnabled(true);
    expect(tracker.disabled).toBe(false);
    expect(tracker.getAttribute('aria-pressed')).toBe('true');
    expect(resetGyro.textContent).toBe('Reset Gyro');
    expect(resetGyro.disabled).toBe(false);

    setOrientationTracking(false);
    expect(tracker.getAttribute('aria-pressed')).toBe('false');
    expect(resetGyro.textContent).toBe('Reset View');
  });
});
