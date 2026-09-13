import type { OrientationIndicatorColors } from './orientationIndicator';

export const FACE_COLORS: Readonly<Record<string, number>> = {
  U: 0xffffff,
  R: 0xff3131,
  F: 0x78ed3e,
  D: 0xfff34a,
  L: 0xff8a2a,
  B: 0x3568ff,
};

export const HOME_FRAME_COLORS: OrientationIndicatorColors = {
  x: FACE_COLORS.R!,
  y: FACE_COLORS.U!,
  z: FACE_COLORS.F!,
};
