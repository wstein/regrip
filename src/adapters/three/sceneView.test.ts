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

class FakeDocument extends EventTarget {
  hidden = false;
  // orientationIndicator's label() falls back gracefully when getContext()
  // returns null; keep this stub narrowly about document.hidden mechanics.
  createElement(): { width: number; height: number; getContext: () => null } {
    return { width: 0, height: 0, getContext: () => null };
  }
}

/** Must be stubbed before `startSceneRenderLoop` runs: it attaches the listener at creation. */
function installDocument(): FakeDocument {
  const fakeDocument = new FakeDocument();
  vi.stubGlobal('document', fakeDocument);
  return fakeDocument;
}

function setHidden(fakeDocument: FakeDocument, hidden: boolean): void {
  fakeDocument.hidden = hidden;
  fakeDocument.dispatchEvent(new Event('visibilitychange'));
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

describe('tab visibility', () => {
  it('repaints on return even with no cube event pending while hidden', async () => {
    const animation = installAnimationFrames();
    const fakeDocument = installDocument();
    const canvas = new EventTarget() as HTMLCanvasElement;
    const scene = new THREE.Scene();
    const render = vi.fn();
    const player = {
      experimentalCurrentVantages: async () => [
        { scene: { scene: async () => scene }, canvasInfo: async () => ({ canvas }), render },
      ],
    };

    const renderer = startSceneRenderLoop(
      player as never,
      new THREE.Quaternion(),
      new THREE.Quaternion(),
      { x: 0xff0000, y: 0xffffff, z: 0x00ff00 },
    );
    await animation.flush();
    expect(render).toHaveBeenCalledTimes(1);

    // Backgrounding a tab for a while can lose the GPU context with no cube
    // event to mark the scene dirty again — returning must still repaint.
    setHidden(fakeDocument, true);
    setHidden(fakeDocument, false);
    await animation.flush();
    expect(render).toHaveBeenCalledTimes(2);

    renderer.dispose();
  });
});

describe('manual scene orientation', () => {
  it('rotates from pointer drag only while enabled', async () => {
    const animation = installAnimationFrames();
    const canvas = new EventTarget() as HTMLCanvasElement;
    const scene = new THREE.Scene();
    const initialOrientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.3, 0));
    const cubeQuaternion = initialOrientation.clone();
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
    canvas.dispatchEvent(pointer('pointerdown', 1, 0, 0));
    canvas.dispatchEvent(pointer('pointermove', 1, 20, 10));
    canvas.dispatchEvent(pointer('pointermove', 1, 40, 20));
    const expected = initialOrientation
      .clone()
      .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 40 * 0.008))
      .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 20 * 0.008));
    expect(cubeQuaternion.angleTo(expected)).toBeLessThan(1e-12);
    expect(cubeQuaternion.x).toBeGreaterThan(0);

    renderer.setManualOrientationEnabled(false);
    const orientation = cubeQuaternion.clone();
    canvas.dispatchEvent(pointer('pointermove', 1, 100, 20));
    expect(cubeQuaternion.equals(orientation)).toBe(true);
    renderer.dispose();
  });
});
