import type { SceneRenderer } from '../adapters/three/sceneView';
import { FACE_COLORS } from '../adapters/three/faceColors';
import type { SolverOrientation } from '../adapters/three/solverFrame';

type OrientationUiOptions = {
  orientation: () => SolverOrientation;
  renderer: () => SceneRenderer | undefined;
  setActiveGrip: (grip: string, gesture?: string) => void;
  setTrackingStatus: (tracking: boolean) => void;
};

export function formatGripDescription(faces: { front: string; up: string; right: string }): string {
  const isHome = faces.front === 'F' && faces.up === 'U' && faces.right === 'R';
  return isHome ? 'Home' : `F:${faces.front} U:${faces.up} R:${faces.right}`;
}

/** Keep renderer orientation and grip presentation behind one testable boundary. */
export function createOrientationUi(options: OrientationUiOptions) {
  let tracking = false;

  const syncVirtualFrame = (gesture?: string): void => {
    const { right, up, front, faces } = options.orientation();
    options.renderer()?.setVirtualFrameOrientation({
      right,
      up,
      front,
      colors: {
        x: FACE_COLORS[faces.right]!,
        y: FACE_COLORS[faces.up]!,
        z: FACE_COLORS[faces.front]!,
      },
    });
    options.setActiveGrip(formatGripDescription(faces), gesture);
  };

  const setTracking = (next: boolean): void => {
    tracking = next;
    options.renderer()?.setManualOrientationEnabled(!next);
    options.setTrackingStatus(next);
  };

  return {
    isTracking: (): boolean => tracking,
    resetView: (): void => options.renderer()?.resetCubeOrientation(),
    setTracking,
    syncVirtualFrame,
  };
}
