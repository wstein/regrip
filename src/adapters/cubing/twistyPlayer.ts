import { TwistyPlayer } from 'cubing/twisty';
import type { ColorScheme } from '../three/faceColors';
import type { CustomColorScheme } from '../../app/colorSchemePreference';

export const twistyPlayer = new TwistyPlayer({
  puzzle: '3x3x3',
  visualization: 'PG3D',
  alg: '',
  experimentalSetupAnchor: 'start',
  background: 'none',
  controlPanel: 'none',
  hintFacelets: 'none',
  experimentalDragInput: 'none',
  cameraLatitude: 0,
  cameraLongitude: 0,
  cameraLatitudeLimit: 0,
  tempoScale: 5,
});

export function applyCubeColorScheme(
  player: Pick<TwistyPlayer, 'experimentalCubeColorScheme'>,
  scheme: ColorScheme,
  custom?: CustomColorScheme,
): void {
  if (scheme === 'western') {
    player.experimentalCubeColorScheme = 'western';
  } else if (scheme === 'japanese') {
    player.experimentalCubeColorScheme = 'japanese';
  } else if (scheme === 'custom' && custom) {
    player.experimentalCubeColorScheme = custom;
  }
}
