import type { TwistyPlayer } from 'cubing/twisty';
import * as THREE from 'three';
import {
  createOrientationIndicator,
  setOrientationIndicatorColors,
  type OrientationIndicatorColors,
} from './orientationIndicator';

type Vantage = {
  scene: { scene(): Promise<THREE.Scene> } | null;
  canvasInfo(): Promise<{ canvas: HTMLCanvasElement }>;
  render(): Promise<void> | void;
};

type ScenePlayer = Pick<TwistyPlayer, 'experimentalCurrentVantages'>;

export type SceneRenderer = {
  /** Queue a single frame. Repeated calls before it runs are coalesced. */
  requestRender(): void;
  /** Stop or resume rendering while the smart-cube session is inactive. */
  setActive(active: boolean): void;
  /** Let mouse/touch drag rotate the scene when a cube has no gyro. */
  setManualOrientationEnabled(enabled: boolean): void;
  /** Remove browser listeners and discard the attached orientation gizmo. */
  dispose(): void;
};

export type SceneRenderOptions = {
  onContextLost?: () => void;
  onContextRestored?: () => void;
};

/**
 * Attach the regrip gizmo to cubing.js' existing WebGL scene.
 *
 * This intentionally renders on demand rather than running a permanent 60fps
 * loop: gyro, virtual-frame, and player updates call `requestRender`. That
 * keeps mobile GPUs idle between cube events and makes context loss recoverable.
 */
export function startSceneRenderLoop(
  player: ScenePlayer,
  cubeQuaternion: THREE.Quaternion,
  virtualFrameQuaternion: THREE.Quaternion,
  virtualFrameColors: OrientationIndicatorColors,
  { onContextLost, onContextRestored }: SceneRenderOptions = {},
): SceneRenderer {
  let scene: THREE.Scene | undefined;
  let vantage: Vantage | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let orientationIndicator: THREE.Group | undefined;
  let active = true;
  let contextLost = false;
  let disposed = false;
  let scheduled = false;
  let rendering = false;
  let dirty = true;
  let animationFrame: number | undefined;
  let manualOrientationEnabled = false;
  let manualPointer: { id: number; x: number; y: number } | undefined;
  let manualListenersAttached = false;
  // This is a stable world-space corner; the R/U/F axes still inherit the
  // scene rotation that renders the physical cube. Virtual regrips transform
  // move notation, but the gyro-driven scene already represents their pose.
  const indicatorPosition = new THREE.Vector3(-0.82, -0.8, 0);
  const inverseSceneQuaternion = new THREE.Quaternion();
  const yawAxis = new THREE.Vector3(0, 1, 0);
  const pitchAxis = new THREE.Vector3(1, 0, 0);
  const manualYaw = new THREE.Quaternion();
  const manualPitch = new THREE.Quaternion();

  const updateCanvasCursor = (): void => {
    if (!canvas?.style) return;
    canvas.style.cursor = manualOrientationEnabled ? 'grab' : '';
    canvas.style.touchAction = manualOrientationEnabled ? 'none' : '';
  };

  const handlePointerDown = (event: PointerEvent): void => {
    if (!manualOrientationEnabled || !canvas) return;
    manualPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
    if (canvas.style) canvas.style.cursor = 'grabbing';
    event.preventDefault();
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (!manualOrientationEnabled || !manualPointer || event.pointerId !== manualPointer.id) return;
    const dx = event.clientX - manualPointer.x;
    const dy = event.clientY - manualPointer.y;
    manualPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    manualYaw.setFromAxisAngle(yawAxis, dx * 0.008);
    manualPitch.setFromAxisAngle(pitchAxis, -dy * 0.008);
    cubeQuaternion.premultiply(manualYaw).premultiply(manualPitch);
    event.preventDefault();
    dirty = true;
    schedule();
  };

  const handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== manualPointer?.id) return;
    manualPointer = undefined;
    if (canvas?.style) canvas.style.cursor = 'grab';
  };

  const detachManualOrientation = (): void => {
    if (!canvas || !manualListenersAttached) return;
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('pointercancel', handlePointerUp);
    manualListenersAttached = false;
    manualPointer = undefined;
  };

  const syncManualOrientation = (): void => {
    if (!canvas) return;
    if (manualOrientationEnabled && !manualListenersAttached) {
      canvas.addEventListener('pointerdown', handlePointerDown);
      canvas.addEventListener('pointermove', handlePointerMove);
      canvas.addEventListener('pointerup', handlePointerUp);
      canvas.addEventListener('pointercancel', handlePointerUp);
      manualListenersAttached = true;
    } else if (!manualOrientationEnabled) {
      detachManualOrientation();
    }
    updateCanvasCursor();
  };

  const canRender = (): boolean =>
    active && !contextLost && !disposed && (typeof document === 'undefined' || !document.hidden);

  const detachScene = (): void => {
    if (scene && orientationIndicator) scene.remove(orientationIndicator);
    scene = undefined;
    vantage = undefined;
    orientationIndicator = undefined;
  };

  const cancelFrame = (): void => {
    if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    animationFrame = undefined;
    scheduled = false;
  };

  const handleContextLost = (event: Event): void => {
    event.preventDefault();
    contextLost = true;
    cancelFrame();
    onContextLost?.();
  };

  const handleContextRestored = (): void => {
    contextLost = false;
    detachScene();
    dirty = true;
    onContextRestored?.();
    schedule();
  };

  const attachCanvas = async (nextVantage: Vantage): Promise<void> => {
    const nextCanvas = (await nextVantage.canvasInfo()).canvas;
    if (canvas === nextCanvas) return;
    detachManualOrientation();
    canvas?.removeEventListener('webglcontextlost', handleContextLost);
    canvas?.removeEventListener('webglcontextrestored', handleContextRestored);
    canvas = nextCanvas;
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    syncManualOrientation();
  };

  const ensureScene = async (): Promise<void> => {
    if (scene && vantage) return;
    const vantages = await player.experimentalCurrentVantages();
    const nextVantage = [...vantages][0] as Vantage | undefined;
    const nextScene = nextVantage?.scene && (await nextVantage.scene.scene());
    if (!nextVantage || !nextScene) return;
    vantage = nextVantage;
    scene = nextScene;
    orientationIndicator = createOrientationIndicator();
    // cubing.js scene units project much larger than the rendered cube; keep
    // the compass compact and comfortably inside the viewport.
    orientationIndicator.scale.setScalar(0.38);
    scene.add(orientationIndicator);
    await attachCanvas(nextVantage);
  };

  const render = async (): Promise<void> => {
    if (!canRender() || !dirty || rendering) return;
    rendering = true;
    dirty = false;
    try {
      await ensureScene();
      if (!canRender() || !scene || !vantage) return;
      // OrientationStabilizer provides the smoothing and detent behaviour.
      scene.quaternion.copy(cubeQuaternion);
      // Only the indicator is reframed: virtual x/y/z turns rename the
      // user's R/U/F frame without changing the physical gyro pose.
      orientationIndicator?.quaternion.copy(virtualFrameQuaternion);
      if (orientationIndicator)
        setOrientationIndicatorColors(orientationIndicator, virtualFrameColors);
      // Compensate the parent transform for position only: this pins the
      // gizmo in view while preserving the inherited axis rotation.
      inverseSceneQuaternion.copy(scene.quaternion).invert();
      orientationIndicator?.position
        .copy(indicatorPosition)
        .applyQuaternion(inverseSceneQuaternion);
      await vantage.render();
    } catch (error) {
      console.warn('cube scene render', error);
    } finally {
      rendering = false;
      if (dirty) schedule();
    }
  };

  const schedule = (): void => {
    if (!canRender() || !dirty || scheduled) return;
    scheduled = true;
    animationFrame = requestAnimationFrame(() => {
      animationFrame = undefined;
      scheduled = false;
      void render();
    });
  };

  const handleVisibilityChange = (): void => {
    if (typeof document === 'undefined' || document.hidden) cancelFrame();
    else schedule();
  };

  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', handleVisibilityChange);
  schedule();

  return {
    requestRender: () => {
      dirty = true;
      schedule();
    },
    setActive: (nextActive) => {
      active = nextActive;
      if (!active) cancelFrame();
      else {
        dirty = true;
        schedule();
      }
    },
    setManualOrientationEnabled: (enabled) => {
      manualOrientationEnabled = enabled;
      if (!enabled) manualPointer = undefined;
      syncManualOrientation();
    },
    dispose: () => {
      disposed = true;
      cancelFrame();
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      canvas?.removeEventListener('webglcontextlost', handleContextLost);
      canvas?.removeEventListener('webglcontextrestored', handleContextRestored);
      detachManualOrientation();
      detachScene();
    },
  };
}
