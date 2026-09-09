import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { createOrientationIndicator, setOrientationIndicatorColors } from './orientationIndicator';

describe('orientation indicator', () => {
  it('contains one coloured arrow through each local R/U/F direction', () => {
    const indicator = createOrientationIndicator(false);

    expect(indicator.name).toBe('orientation-indicator');
    expect(indicator.children.map((child) => child.name)).toEqual([
      'orientation-axis-r',
      'orientation-axis-u',
      'orientation-axis-f',
    ]);
  });

  it('recolors each logical axis independently', () => {
    const indicator = createOrientationIndicator(false);
    setOrientationIndicatorColors(indicator, { r: 0x0000ff, u: 0xffffff, f: 0xff0000 });

    const line = indicator.getObjectByName('orientation-axis-r')!.children[0] as THREE.Line;
    expect((line.material as THREE.LineBasicMaterial).color.getHex()).toBe(0x0000ff);
  });
});
