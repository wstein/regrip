function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Deeply merge plain records without mutating inputs; arrays replace wholesale. */
export function deepMergeRecord(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    merged[key] =
      isRecord(base[key]) && isRecord(value) ? deepMergeRecord(base[key], value) : value;
  }
  return merged;
}
