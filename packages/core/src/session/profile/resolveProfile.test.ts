import { describe, expect, it } from 'vitest';
import { bundledProfiles } from './bundled';
import { resolveProfile } from './resolveProfile';
import type { SmartCubeProfile } from './types';

describe('resolveProfile', () => {
  it('selects the most specific matching profile and retains base defaults', () => {
    const profile = resolveProfile({ protocol: 'gan', deviceName: 'GAN i4' }, bundledProfiles);
    expect(profile.id).toBe('gan-i4');
    expect(profile.value.stabilizer?.snapDeg).toBe(4);
    expect(profile.value.stabilizer?.driftDegPerSec).toBe(2);
    expect(profile.sources['stabilizer.snapDeg']).toBe('base');
  });

  it('selects the clockless GoCube profile', () => {
    expect(resolveProfile({ protocol: 'gocube' }, bundledProfiles).value.quirks?.clockless).toBe(
      true,
    );
  });

  it('selects the dedicated GAN Gen4 profile for GANi4 devices', () => {
    const profile = resolveProfile(
      { protocol: 'gan-gen4', deviceName: 'GANi4_REDACTED' },
      bundledProfiles,
    );
    expect(profile.id).toBe('gan-gen4');
    expect(profile.sources['gyro.axisMap']).toBe('base');
  });

  it('preserves per-field provenance across app, user, and runtime layers', () => {
    const profile = resolveProfile({ protocol: 'gocube' }, bundledProfiles, {
      app: { stabilizer: { snapDeg: 5 } },
      user: { stabilizer: { radiusDeg: 40 } },
      runtime: { quirks: { clockless: false } },
    });
    expect(profile.value.stabilizer).toMatchObject({ radiusDeg: 40, snapDeg: 5, hysteresisDeg: 6 });
    expect(profile.value.quirks?.clockless).toBe(false);
    expect(profile.sources['stabilizer.hysteresisDeg']).toBe('base');
    expect(profile.sources['stabilizer.snapDeg']).toBe('app');
    expect(profile.sources['stabilizer.radiusDeg']).toBe('user');
    expect(profile.sources['quirks.clockless']).toBe('runtime');
  });

  it('recursively merges feature settings and preserves their leaf provenance', () => {
    const profile = resolveProfile({ protocol: 'gocube' }, bundledProfiles, {
      app: { features: { stabilizer: { hysteresis: { enabled: false } } } },
      user: { features: { regrip: { enabled: true } } },
      runtime: { features: { customTrigger: { triggers: [{ kind: 'moveBack', windowMs: 250 }] } } },
    });

    expect(profile.value.features).toMatchObject({
      stabilizer: { hysteresis: { enabled: false, marginDeg: 6 } },
      regrip: { enabled: true, thresholdDeg: 60 },
      customTrigger: { enabled: true, triggers: [{ kind: 'moveBack', windowMs: 250 }] },
    });
    expect(profile.sources['features.stabilizer.hysteresis.enabled']).toBe('app');
    expect(profile.sources['features.stabilizer.hysteresis.marginDeg']).toBe('base');
    expect(profile.sources['features.regrip.enabled']).toBe('user');
    expect(profile.sources['features.customTrigger.triggers']).toBe('runtime');
  });

  it('anchors match expressions and treats invalid expressions as non-matches', () => {
    const profiles: SmartCubeProfile[] = [
      { id: 'base' },
      { id: 'gan', extends: 'base', match: { protocol: 'gan' } },
      { id: 'invalid', extends: 'base', match: { protocol: '[' } },
      { id: 'unknown', extends: 'base' },
    ];
    expect(resolveProfile({ protocol: 'organ' }, profiles).id).toBe('unknown');
    expect(resolveProfile({ protocol: 'gan' }, profiles).id).toBe('gan');
  });

  it('rejects inheritance cycles clearly', () => {
    const profiles: SmartCubeProfile[] = [
      { id: 'base', extends: 'cycle' },
      { id: 'cycle', extends: 'base' },
      { id: 'unknown', extends: 'base' },
    ];
    expect(() => resolveProfile({}, profiles)).toThrow("Profile inheritance cycle at 'base'");
  });
});
