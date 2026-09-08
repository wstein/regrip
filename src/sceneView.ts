import * as THREE from 'three';
import { TwistyPlayer } from 'cubing/twisty';

export function startSceneRenderLoop(player: TwistyPlayer, cubeQuaternion: THREE.Quaternion): void {
  let scene: THREE.Scene | undefined;
  let vantage: any;

  const render = async (): Promise<void> => {
    try {
      if (!scene || !vantage) {
        const vantages = await player.experimentalCurrentVantages();
        vantage = [...vantages][0];
        scene = vantage && await vantage.scene.scene();
      }
      if (scene && vantage) {
        scene.quaternion.slerp(cubeQuaternion, 0.25);
        vantage.render();
      }
    } catch (error) {
      console.warn('cube render loop', error);
    }
    requestAnimationFrame(() => void render());
  };

  requestAnimationFrame(() => void render());
}
