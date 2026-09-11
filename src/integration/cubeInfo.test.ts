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

  it('formats cubie state in Singmaster cycle notation', () => {
    expect(
      formatCubieState({
        CP: [0, 1, 2, 3, 4, 5, 6, 7],
        CO: [0, 0, 0, 0, 0, 0, 0, 0],
        EP: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        EO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      }),
    ).toBe('');
  });

  it('shows oriented piece cycles and handles incomplete protocol state', () => {
    expect(
      formatCubieState({
        CP: [1, 0, 2, 3, 4, 5, 6, 7],
        CO: [1, 2, 0, 0, 0, 0, 0, 0],
        EP: [0, 1],
        EO: [0, 0],
      }),
    ).toBe('(UFL+,URF-) (unavailable)');
  });
});
