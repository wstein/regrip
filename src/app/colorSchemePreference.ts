import type { ColorScheme } from '../adapters/three/faceColors';

export type { ColorScheme };

const STORAGE_KEY = 'regrip-color-scheme';

function isColorScheme(value: string | null): value is ColorScheme {
  return value === 'western' || value === 'japanese';
}

function loadInitialColorScheme(): ColorScheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isColorScheme(stored) ? stored : 'western';
  } catch {
    return 'western';
  }
}

let current: ColorScheme = loadInitialColorScheme();

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
