import { describe, expect, it, vi } from 'vitest';

import { createOrientationUi, formatGripDescription } from './orientationUi';

describe('orientation UI', () => {
  it('formats the home grip and displaced grips', () => {
    expect(formatGripDescription({ front: 'F', up: 'U', right: 'R' })).toBe('Home');
    expect(formatGripDescription({ front: 'L', up: 'F', right: 'U' })).toBe('F:L U:F R:U');
  });

  it('synchronizes solver axes, face colors, tracking, and view reset', () => {
    const renderer = {
      setVirtualFrameOrientation: vi.fn(),
      setManualOrientationEnabled: vi.fn(),
      resetCubeOrientation: vi.fn(),
    };
    const setActiveGrip = vi.fn();
    const setTrackingStatus = vi.fn();
    const ui = createOrientationUi({
      orientation: () => ({
        right: [0, 0, 1],
        up: [1, 0, 0],
        front: [0, 1, 0],
        faces: { right: 'B', up: 'R', front: 'U' },
      }),
      renderer: () => renderer as never,
      setActiveGrip,
      setTrackingStatus,
    });

    ui.syncVirtualFrame('y');
    expect(renderer.setVirtualFrameOrientation).toHaveBeenCalledWith({
      right: [0, 0, 1],
      up: [1, 0, 0],
      front: [0, 1, 0],
      colors: { x: 0x3568ff, y: 0xff3131, z: 0xffffff },
    });
    expect(setActiveGrip).toHaveBeenCalledWith('F:U U:R R:B', 'y');

    ui.setTracking(true);
    expect(ui.isTracking()).toBe(true);
    expect(renderer.setManualOrientationEnabled).toHaveBeenCalledWith(false);
    expect(setTrackingStatus).toHaveBeenCalledWith(true);
    ui.resetView();
    expect(renderer.resetCubeOrientation).toHaveBeenCalledOnce();
  });
});
