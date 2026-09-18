import type { OrientationIndicatorColors } from './orientationIndicator';

export type ColorScheme = 'western' | 'japanese' | 'custom';
export type CustomFaceColors = Partial<Record<string, number>>;

const WESTERN_FACE_COLORS: Readonly<Record<string, number>> = {
  U: 0xffffff,
  R: 0xff3131,
  F: 0x78ed3e,
  D: 0xfff34a,
  L: 0xff8a2a,
  B: 0x3568ff,
};

// The Japanese scheme keeps the standard arrangement where blue (B) and yellow (D)
// swap places relative to Western (white opposite blue, green opposite yellow).
const JAPANESE_FACE_COLORS: Readonly<Record<string, number>> = {
  ...WESTERN_FACE_COLORS,
  B: WESTERN_FACE_COLORS.D,
  D: WESTERN_FACE_COLORS.B,
};

export function faceColorsFor(
  scheme: ColorScheme,
  custom?: CustomFaceColors,
): Readonly<Record<string, number>> {
  if (scheme === 'japanese') return JAPANESE_FACE_COLORS;
  if (scheme === 'custom') {
    const result = { ...WESTERN_FACE_COLORS };
    if (custom) {
      for (const [key, value] of Object.entries(custom)) {
        if (typeof value === 'number') {
          result[key] = value;
        }
      }
    }
    return result;
  }
  return WESTERN_FACE_COLORS;
}

export function homeFrameColorsFor(
  scheme: ColorScheme,
  custom?: CustomFaceColors,
): OrientationIndicatorColors {
  const colors = faceColorsFor(scheme, custom);
  return { x: colors.R!, y: colors.U!, z: colors.F! };
}
