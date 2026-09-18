import type { ColorScheme, CustomFaceColors } from '../adapters/three/faceColors';

export type { ColorScheme };

export type CubeFace = 'U' | 'L' | 'F' | 'R' | 'B' | 'D';
export type CustomColorScheme = Record<CubeFace, string>;

export const CUBE_FACES: readonly CubeFace[] = ['U', 'L', 'F', 'R', 'B', 'D'] as const;

export const DEFAULT_CUSTOM_COLOR_SCHEME: Readonly<CustomColorScheme> = {
  U: '#ffffff',
  L: '#ff8a2a',
  F: '#78ed3e',
  R: '#ff3131',
  B: '#3568ff',
  D: '#fff34a',
};

const STORAGE_KEY = 'regrip-color-scheme';
const CUSTOM_STORAGE_KEY = 'regrip-custom-color-scheme';

function isColorScheme(value: string | null): value is ColorScheme {
  return value === 'western' || value === 'japanese' || value === 'custom';
}

function loadInitialColorScheme(): ColorScheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isColorScheme(stored) ? stored : 'western';
  } catch {
    return 'western';
  }
}

function loadInitialCustomColorScheme(): CustomColorScheme {
  try {
    const stored = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!stored) return { ...DEFAULT_CUSTOM_COLOR_SCHEME };
    const parsed = JSON.parse(stored) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_CUSTOM_COLOR_SCHEME };
    const scheme: CustomColorScheme = { ...DEFAULT_CUSTOM_COLOR_SCHEME };
    for (const face of CUBE_FACES) {
      const val = (parsed as Record<string, unknown>)[face];
      if (typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val)) {
        scheme[face] = val.toLowerCase();
      }
    }
    return scheme;
  } catch {
    return { ...DEFAULT_CUSTOM_COLOR_SCHEME };
  }
}

let current: ColorScheme = loadInitialColorScheme();
let currentCustom: CustomColorScheme = loadInitialCustomColorScheme();

export function getColorScheme(): ColorScheme {
  return current;
}

export function setColorScheme(scheme: ColorScheme): void {
  current = scheme;
  try {
    localStorage.setItem(STORAGE_KEY, scheme);
  } catch {
    // Private browsing or a full quota still keeps the in-memory selection.
  }
}

export function getCustomColorScheme(): CustomColorScheme {
  return { ...currentCustom };
}

export function setCustomColorScheme(updates: Partial<CustomColorScheme>): void {
  currentCustom = { ...currentCustom, ...updates };
  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(currentCustom));
  } catch {
    // Keep in-memory selection.
  }
}

export function resetCustomColorScheme(): void {
  currentCustom = { ...DEFAULT_CUSTOM_COLOR_SCHEME };
  try {
    localStorage.removeItem(CUSTOM_STORAGE_KEY);
  } catch {
    // Keep in-memory selection.
  }
}

export function customColorsToNumeric(custom: CustomColorScheme): CustomFaceColors {
  const result: Record<string, number> = {};
  for (const face of CUBE_FACES) {
    const hex = custom[face];
    if (hex) {
      result[face] = parseInt(hex.replace('#', ''), 16);
    }
  }
  return result;
}
