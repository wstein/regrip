import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { startSceneRenderLoop } from './sceneView';

type Frame = FrameRequestCallback;

function installAnimationFrames(): { flush(): Promise<void> } {
  const frames: Frame[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  return {
    async flush(): Promise<void> {
      while (frames.length > 0) {
        frames.shift()!(0);
        // Scene acquisition crosses several immediately-resolved promises.
        for (let index = 0; index < 8; index += 1) await Promise.resolve();
      }
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

function pointer(type: string, pointerId: number, clientX: number, clientY: number): Event {
  return Object.assign(new Event(type, { cancelable: true }), { pointerId, clientX, clientY });
}

describe('scene renderer lifecycle', () => {
  it('renders on demand, pauses while inactive, and rebuilds after WebGL restoration', async () => {
    const animation = installAnimationFrames();
    const canvas = new EventTarget() as HTMLCanvasElement;
    const scene = new THREE.Scene();
    const render = vi.fn();
    const onContextLost = vi.fn();
    const onContextRestored = vi.fn();
    const player = {
      experimentalCurrentVantages: async () => [
        {
          scene: { scene: async () => scene },
          canvasInfo: async () => ({ canvas }),
          render,
        },
      ],
    };

    const renderer = startSceneRenderLoop(
      player as never,
      new THREE.Quaternion(),
      new THREE.Quaternion(),
      { x: 0xff0000, y: 0xffffff, z: 0x00ff00 },
      { onContextLost, onContextRestored },
    );

    await animation.flush();
    expect(render).toHaveBeenCalledTimes(1);
    expect(scene.getObjectByName('orientation-indicator')).toBeDefined();

    renderer.requestRender();
    renderer.requestRender();
    await animation.flush();
    expect(render).toHaveBeenCalledTimes(2);

    renderer.setActive(false);
    renderer.requestRender();
    await animation.flush();
    expect(render).toHaveBeenCalledTimes(2);

    renderer.setActive(true);
    await animation.flush();
    expect(render).toHaveBeenCalledTimes(3);

    const lost = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(onContextLost).toHaveBeenCalledOnce();
    renderer.requestRender();
    await animation.flush();
    expect(render).toHaveBeenCalledTimes(3);

    canvas.dispatchEvent(new Event('webglcontextrestored'));
    await animation.flush();
    expect(onContextRestored).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledTimes(4);
    renderer.dispose();
  });
});

describe('manual scene orientation', () => {
  it('rotates from pointer drag only while enabled', async () => {
    const animation = installAnimationFrames();
    const canvas = new EventTarget() as HTMLCanvasElement;
    const scene = new THREE.Scene();
    const cubeQuaternion = new THREE.Quaternion();
    const player = {
      experimentalCurrentVantages: async () => [
        {
          scene: { scene: async () => scene },
          canvasInfo: async () => ({ canvas }),
          render: vi.fn(),
        },
      ],
    };
    const renderer = startSceneRenderLoop(player as never, cubeQuaternion, new THREE.Quaternion(), {
      x: 0xff0000,
      y: 0xffffff,
      z: 0x00ff00,
    });
    await animation.flush();

    renderer.setManualOrientationEnabled(true);
    canvas.dispatchEvent(pointer('pointerdown', 1, 20, 20));
    canvas.dispatchEvent(pointer('pointermove', 1, 60, 10));
    expect(cubeQuaternion.equals(new THREE.Quaternion())).toBe(false);

    renderer.setManualOrientationEnabled(false);
    const orientation = cubeQuaternion.clone();
    canvas.dispatchEvent(pointer('pointermove', 1, 100, 20));
    expect(cubeQuaternion.equals(orientation)).toBe(true);
    renderer.dispose();
  });
});
