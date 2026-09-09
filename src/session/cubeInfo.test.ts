import { describe, expect, it } from 'vitest';

import { formatCapabilities, formatCubieState, formatOfflineStats } from './cubeInfo';

describe('cube information formatters', () => {
  it('summarizes available capabilities and vendor controls', () => {
    expect(
      formatCapabilities({
        gyroscope: true,
        battery: true,
        facelets: true,
        hardware: true,
        reset: true,
        vendorCommands: ['REBOOT', 'TOGGLE_BACKLIGHT'],
      }),
    ).toBe('gyro, battery, facelets, hardware, reset; controls: REBOOT, TOGGLE_BACKLIGHT');
  });

  it('formats GoCube cumulative offline statistics', () => {
    expect(formatOfflineStats({ moves: 1234, timeSeconds: 3661, solves: 42 })).toEqual({
      moves: '1,234',
      duration: '1:01:01',
      solves: '42',
    });
  });

  it('formats optional cubie state compactly', () => {
    expect(
      formatCubieState({
        CP: [0, 1],
        CO: [2, 0],
        EP: [3, 4],
        EO: [1, 0],
      }),
    ).toBe('CP 0,1 | CO 2,0 | EP 3,4 | EO 1,0');
  });
});
