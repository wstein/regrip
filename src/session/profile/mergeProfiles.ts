import type { SmartCubeProfile, SmartCubeProfilePatch } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Deep merge records while replacing arrays wholesale. */
function deepMerge(
  base: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(next)) {
    merged[key] = isRecord(base[key]) && isRecord(value) ? deepMerge(base[key], value) : value;
  }
  return merged;
}

export function mergeProfiles(
  base: SmartCubeProfile,
  next: SmartCubeProfile | SmartCubeProfilePatch,
): SmartCubeProfile {
  return deepMerge(base, next) as SmartCubeProfile;
}
