import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import schema from '../../domain/profiles/smartcube-profile.schema.json';
import { bundledProfiles } from './bundled';

describe('bundled profile schema', () => {
  it('validates every bundled profile', () => {
    const validate = new Ajv2020().compile(schema);
    for (const profile of bundledProfiles) expect(validate(profile), JSON.stringify(validate.errors)).toBe(true);
  });
});
