import { describe, expect, it } from 'vitest';

import { deepMergeRecord } from './deepMergeRecord.js';

describe('deepMergeRecord', () => {
  it('ignores explicit undefined patch values without deleting base branches', () => {
    const stabilizer = { radiusDeg: 35, snapDeg: 4 };

    expect(deepMergeRecord({ stabilizer }, { stabilizer: undefined })).toEqual({ stabilizer });
    expect(deepMergeRecord({ stabilizer }, { stabilizer: { snapDeg: undefined } })).toEqual({
      stabilizer,
    });
  });
});
