import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import schema from '../../profiles/smartcube-profile.schema.json';
import { bundledProfiles } from './bundled';

describe('bundled profile schema', () => {
  it('accepts only supported regrip detector modes', () => {
    const validate = new Ajv2020().compile(schema);
    expect(
      validate({ id: 'absolute-regrip', features: { regrip: { detector: 'absolute' } } }),
      JSON.stringify(validate.errors),
    ).toBe(true);
    expect(
      validate({ id: 'invalid-regrip', features: { regrip: { detector: 'guessing' } } }),
      JSON.stringify(validate.errors),
    ).toBe(false);
  });

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

  it.each([
    { trigger: { kind: 'moveBack', windowMs: -1 }, description: 'negative move-back window' },
    { trigger: { kind: 'shake', minStepAngleDeg: 0 }, description: 'zero shake angle' },
    { trigger: { kind: 'shake', minSteps: 2.5 }, description: 'fractional step count' },
    { trigger: { kind: 'shake', minReversals: -1 }, description: 'negative reversal count' },
    { trigger: { kind: 'shake', cooldownMs: -1 }, description: 'negative cooldown' },
  ])('rejects $description', ({ trigger }) => {
    const validate = new Ajv2020().compile(schema);
    expect(
      validate({
        id: 'invalid-trigger',
        features: { customTrigger: { enabled: true, triggers: [trigger] } },
      }),
      JSON.stringify(validate.errors),
    ).toBe(false);
  });
});
