import { describe, expect, it } from 'vitest';

import {
  defaultSessionFeatures,
  featurePresets,
  resolveSessionFeatures,
  stabilizerConfig,
} from './features';

describe('session features', () => {
  it('preserves the legacy always-on move-back trigger by default', () => {
    expect(defaultSessionFeatures.customTrigger).toEqual({
      enabled: true,
      triggers: [{ kind: 'moveBack', windowMs: 300 }],
    });
  });

  it('deeply resolves a profile patch without dropping sibling defaults', () => {
    expect(
      resolveSessionFeatures({
        stabilizer: { hysteresis: { enabled: false } },
        customTrigger: { triggers: [{ kind: 'moveBack', windowMs: 250 }] },
      }),
    ).toMatchObject({
      stabilizer: { hysteresis: { enabled: false, marginDeg: 6 } },
      customTrigger: { enabled: true, triggers: [{ kind: 'moveBack', windowMs: 250 }] },
    });
  });

  it('offers an explicit fully disabled preset', () => {
    expect(featurePresets.none).toMatchObject({
      stabilizer: { enabled: false },
      regrip: { enabled: false },
      customTrigger: { enabled: false },
    });
  });

  it('enables every optional feature in the all preset', () => {
    expect(featurePresets.all.regrip.enabled).toBe(true);
    expect(featurePresets.all.customTrigger.enabled).toBe(true);
  });

  it('projects stabilizer settings into the domain configuration', () => {
    expect(stabilizerConfig(defaultSessionFeatures)).toEqual({
      radiusDeg: 35,
      snapDeg: 4,
      hysteresisDeg: 6,
      velocityMax: 2.5,
      driftDegPerSec: 2,
    });
  });
});
