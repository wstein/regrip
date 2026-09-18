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
      colorScheme: () => 'western',
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

  it('reads the current color scheme on every sync, not just at construction', () => {
    const renderer = {
      setVirtualFrameOrientation: vi.fn(),
      setManualOrientationEnabled: vi.fn(),
      resetCubeOrientation: vi.fn(),
    };
    let scheme: 'western' | 'japanese' | 'custom' = 'western';
    let customColors: Record<string, number> = {};
    const ui = createOrientationUi({
      orientation: () => ({
        right: [0, 0, 1],
        up: [1, 0, 0],
        front: [0, 1, 0],
        faces: { right: 'B', up: 'U', front: 'D' },
      }),
      renderer: () => renderer as never,
      colorScheme: () => scheme,
      customColors: () => customColors,
      setActiveGrip: vi.fn(),
      setTrackingStatus: vi.fn(),
    });

    ui.syncVirtualFrame();
    // In Western: right B is blue (0x3568ff), front D is yellow (0xfff34a)
    expect(renderer.setVirtualFrameOrientation).toHaveBeenLastCalledWith(
      expect.objectContaining({ colors: { x: 0x3568ff, y: 0xffffff, z: 0xfff34a } }),
    );

    scheme = 'japanese';
    ui.syncVirtualFrame();
    // In Japanese: B and D swap -> right B is yellow (0xfff34a), front D is blue (0x3568ff)
    expect(renderer.setVirtualFrameOrientation).toHaveBeenLastCalledWith(
      expect.objectContaining({ colors: { x: 0xfff34a, y: 0xffffff, z: 0x3568ff } }),
    );

    scheme = 'custom';
    customColors = { B: 0x111111, D: 0x222222, U: 0x333333 };
    ui.syncVirtualFrame();
    expect(renderer.setVirtualFrameOrientation).toHaveBeenLastCalledWith(
      expect.objectContaining({ colors: { x: 0x111111, y: 0x333333, z: 0x222222 } }),
    );
  });
});
