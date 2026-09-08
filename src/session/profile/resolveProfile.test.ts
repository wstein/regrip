import { describe, expect, it } from 'vitest';
import { bundledProfiles } from './bundled';
import { resolveProfile } from './resolveProfile';

describe('resolveProfile', () => {
  it('selects the most specific matching profile and retains base defaults', () => {
    const profile = resolveProfile({ protocol: 'gan', deviceName: 'GAN i4' }, bundledProfiles);
    expect(profile.id).toBe('gan-i4');
    expect(profile.value.stabilizer?.snapDeg).toBe(4);
    expect(profile.value.stabilizer?.driftDegPerSec).toBe(2);
    expect(profile.sources.stabilizer).toBe('base');
  });

  it('selects the clockless GoCube profile', () => {
    expect(resolveProfile({ protocol: 'gocube' }, bundledProfiles).value.quirks?.clockless).toBe(true);
  });
});
