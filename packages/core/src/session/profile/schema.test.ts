import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import schema from '../../profiles/smartcube-profile.schema.json';
import { bundledProfiles } from './bundled';

describe('bundled profile schema', () => {
  it('validates every bundled profile', () => {
    const validate = new Ajv2020().compile(schema);
    for (const profile of bundledProfiles)
      expect(validate(profile), JSON.stringify(validate.errors)).toBe(true);
  });

  it('accepts every supported shake trigger field', () => {
    const validate = new Ajv2020().compile(schema);
    const profile = {
      id: 'shake-test',
      features: {
        customTrigger: {
          enabled: true,
          triggers: [
            {
              kind: 'shake',
              minStepAngleDeg: 12,
              minSteps: 4,
              minReversals: 2,
              maxSampleGapMs: 80,
              burstWindowMs: 500,
              faceGuardMs: 150,
              cooldownMs: 1_000,
            },
          ],
        },
      },
    };

    expect(validate(profile), JSON.stringify(validate.errors)).toBe(true);
  });
});
