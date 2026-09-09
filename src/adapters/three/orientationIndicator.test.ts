import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { createOrientationIndicator, setOrientationIndicatorColors } from './orientationIndicator';

describe('orientation indicator', () => {
  it('contains one solid arrow through each local X/Y/Z direction', () => {
    const indicator = createOrientationIndicator(false);

    expect(indicator.name).toBe('orientation-indicator');
    expect(indicator.children.map((child) => child.name)).toEqual([
      'orientation-axis-x',
      'orientation-axis-y',
      'orientation-axis-z',
    ]);
  });

  it('recolors each logical axis independently', () => {
    const indicator = createOrientationIndicator(false);
    setOrientationIndicatorColors(indicator, { x: 0x0000ff, y: 0xffffff, z: 0xff0000 });

    const shaft = indicator.getObjectByName('orientation-axis-x')!.children[0] as THREE.Mesh;
    expect((shaft.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0x0000ff);
  });
});
