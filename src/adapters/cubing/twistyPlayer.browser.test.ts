// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyCubeColorScheme } from './twistyPlayer';
import type { CustomColorScheme } from '../../app/colorSchemePreference';

describe('applyCubeColorScheme', () => {
  it('assigns western preset to player', () => {
    const player = { experimentalCubeColorScheme: undefined as unknown };
    applyCubeColorScheme(player as never, 'western');
    expect(player.experimentalCubeColorScheme).toBe('western');
  });

  it('assigns japanese preset to player', () => {
    const player = { experimentalCubeColorScheme: undefined as unknown };
    applyCubeColorScheme(player as never, 'japanese');
    expect(player.experimentalCubeColorScheme).toBe('japanese');
  });

  it('assigns custom color map to player', () => {
    const player = { experimentalCubeColorScheme: undefined as unknown };
    const custom: CustomColorScheme = {
      U: '#111111',
      L: '#222222',
      F: '#333333',
      R: '#444444',
      B: '#555555',
      D: '#666666',
    };
    applyCubeColorScheme(player as never, 'custom', custom);
    expect(player.experimentalCubeColorScheme).toEqual(custom);
  });
});
