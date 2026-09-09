import * as THREE from 'three';
import { TwistyPlayer } from 'cubing/twisty';
import {
  createOrientationIndicator,
  setOrientationIndicatorColors,
  type OrientationIndicatorColors,
} from './orientationIndicator';

export function startSceneRenderLoop(
  player: TwistyPlayer,
  cubeQuaternion: THREE.Quaternion,
  virtualFrameQuaternion: THREE.Quaternion,
  virtualFrameColors: OrientationIndicatorColors,
): void {
  let scene: THREE.Scene | undefined;
  let vantage: any;
  let orientationIndicator: THREE.Group | undefined;
  // This is a stable world-space corner; the R/U/F axes still inherit the
  // scene rotation that renders the physical cube. Virtual regrips transform
  // move notation, but the gyro-driven scene already represents their pose.
  const indicatorPosition = new THREE.Vector3(-0.82, -0.8, 0);

  const render = async (): Promise<void> => {
    try {
      if (!scene || !vantage) {
        const vantages = await player.experimentalCurrentVantages();
        vantage = [...vantages][0];
        scene = vantage && (await vantage.scene.scene());
        if (scene) {
          orientationIndicator = createOrientationIndicator();
          // cubing.js scene units project much larger than the rendered cube;
          // keep the compass compact and comfortably inside the viewport.
          orientationIndicator.scale.setScalar(0.38);
          scene.add(orientationIndicator);
        }
      }
      if (scene && vantage) {
        // OrientationStabilizer provides the smoothing and detent behaviour.
        // Copying here keeps the scene responsive to deliberate turns.
        scene.quaternion.copy(cubeQuaternion);
        // Only the indicator is reframed: virtual x/y/z turns rename the
        // user's R/U/F frame without changing the physical gyro pose.
        orientationIndicator?.quaternion.copy(virtualFrameQuaternion);
        if (orientationIndicator)
          setOrientationIndicatorColors(orientationIndicator, virtualFrameColors);
        // Compensate the parent transform for position only: this pins the
        // gizmo in view while preserving the inherited axis rotation.
        orientationIndicator?.position
          .copy(indicatorPosition)
          .applyQuaternion(scene.quaternion.clone().invert());
        vantage.render();
      }
    } catch (error) {
      console.warn('cube render loop', error);
    }
    requestAnimationFrame(() => void render());
  };

  requestAnimationFrame(() => void render());
}
