import { describe, expect, it } from 'vitest';

import { createOrientationIndicator } from './orientationIndicator';

describe('orientation indicator', () => {
  it('contains one coloured arrow through each local R/U/F direction', () => {
    const indicator = createOrientationIndicator(false);

    expect(indicator.name).toBe('orientation-indicator');
    expect(indicator.children.map(child => child.name)).toEqual([
      'orientation-axis-r', 'orientation-axis-u', 'orientation-axis-f',
    ]);
  });
});
