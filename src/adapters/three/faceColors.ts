import type { OrientationIndicatorColors } from './orientationIndicator';

export type ColorScheme = 'western' | 'japanese';

const WESTERN_FACE_COLORS: Readonly<Record<string, number>> = {
  U: 0xffffff,
  R: 0xff3131,
  F: 0x78ed3e,
  D: 0xfff34a,
  L: 0xff8a2a,
  B: 0x3568ff,
};

// The Japanese scheme keeps the same three opposite-color pairs as Western;
// the only documented difference is that green (F) and blue (B) swap places.
const JAPANESE_FACE_COLORS: Readonly<Record<string, number>> = {
  ...WESTERN_FACE_COLORS,
  F: WESTERN_FACE_COLORS.B,
  B: WESTERN_FACE_COLORS.F,
};

export function faceColorsFor(scheme: ColorScheme): Readonly<Record<string, number>> {
  return scheme === 'japanese' ? JAPANESE_FACE_COLORS : WESTERN_FACE_COLORS;
}

export function homeFrameColorsFor(scheme: ColorScheme): OrientationIndicatorColors {
  const colors = faceColorsFor(scheme);
  return { x: colors.R!, y: colors.U!, z: colors.F! };
}
