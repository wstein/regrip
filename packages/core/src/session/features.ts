/** Runtime-configurable session features. Nested objects deliberately mirror
 * the profile JSON so the normal profile merge and provenance rules apply. */
export type MoveBackTriggerSpec = {
  kind: 'moveBack';
  windowMs: number;
};

/** A shake gesture over the calibrated gyro stream. Params default to
 * `ShakeTrigger.defaults`; a profile or host overrides only what it needs. */
export type ShakeTriggerSpec = {
  kind: 'shake';
  minStepAngleDeg?: number;
  minSteps?: number;
  minReversals?: number;
  maxSampleGapMs?: number;
  burstWindowMs?: number;
  faceGuardMs?: number;
  cooldownMs?: number;
};

/** One configured app-level gesture detector. */
export type CustomTriggerSpec = MoveBackTriggerSpec | ShakeTriggerSpec;

/** Complete runtime feature configuration after profile resolution. */
export type SessionFeatures = {
  stabilizer: {
    enabled: boolean;
    radiusDeg: number;
    snapDeg: number;
    velocityMax: number;
    hysteresis: { enabled: boolean; marginDeg: number };
    drift: { enabled: boolean; degPerSec: number };
  };
  regrip: { enabled: boolean; thresholdDeg: number };
  customTrigger: { enabled: boolean; triggers: CustomTriggerSpec[] };
};

/** Partial profile or host override for session features. */
export type SessionFeaturesPatch = {
  stabilizer?: {
    enabled?: boolean;
    radiusDeg?: number;
    snapDeg?: number;
    velocityMax?: number;
    hysteresis?: { enabled?: boolean; marginDeg?: number };
    drift?: { enabled?: boolean; degPerSec?: number };
  };
  regrip?: { enabled?: boolean; thresholdDeg?: number };
  customTrigger?: { enabled?: boolean; triggers?: CustomTriggerSpec[] };
};

/** Baseline feature configuration used when no profile overrides it. */
export const defaultSessionFeatures: SessionFeatures = {
  stabilizer: {
    enabled: true,
    radiusDeg: 35,
    snapDeg: 4,
    velocityMax: 2.5,
    hysteresis: { enabled: true, marginDeg: 6 },
    drift: { enabled: true, degPerSec: 2 },
  },
  // Virtual regrips were opt-in before the feature model.
  regrip: { enabled: false, thresholdDeg: 60 },
  // Move-back gestures were always enabled before the feature model.
  customTrigger: { enabled: true, triggers: [{ kind: 'moveBack', windowMs: 300 }] },
};

/** Useful explicit starting points for hosts which do not use profiles. */
export const featurePresets: Record<'all' | 'minimal' | 'none', SessionFeatures> = {
  all: {
    ...defaultSessionFeatures,
    regrip: { ...defaultSessionFeatures.regrip, enabled: true },
    customTrigger: {
      enabled: true,
      triggers: [{ kind: 'moveBack', windowMs: 300 }, { kind: 'shake' }],
    },
  },
  minimal: {
    ...defaultSessionFeatures,
    regrip: { ...defaultSessionFeatures.regrip, enabled: false },
    customTrigger: { ...defaultSessionFeatures.customTrigger, enabled: false },
  },
  none: {
    ...defaultSessionFeatures,
    stabilizer: { ...defaultSessionFeatures.stabilizer, enabled: false },
    regrip: { ...defaultSessionFeatures.regrip, enabled: false },
    customTrigger: { ...defaultSessionFeatures.customTrigger, enabled: false },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Deeply merge a feature patch. Arrays (the trigger list) replace wholesale. */
export function mergeSessionFeatures(
  base: SessionFeatures,
  patch: SessionFeaturesPatch | undefined,
): SessionFeatures {
  if (!patch) return base;
  const merge = (
    left: Record<string, unknown>,
    right: Record<string, unknown>,
  ): Record<string, unknown> => {
    const result = { ...left };
    for (const [key, value] of Object.entries(right)) {
      result[key] = isRecord(left[key]) && isRecord(value) ? merge(left[key], value) : value;
    }
    return result;
  };
  return merge(base, patch) as SessionFeatures;
}

/** Resolve profile feature overrides onto the baseline configuration. */
export function resolveSessionFeatures(profileFeatures?: SessionFeaturesPatch): SessionFeatures {
  return mergeSessionFeatures(defaultSessionFeatures, profileFeatures);
}

/** Adapter for the existing domain stabilizer configuration. */
export function stabilizerConfig(features: SessionFeatures): {
  radiusDeg: number;
  snapDeg: number;
  hysteresisDeg: number;
  velocityMax: number;
  driftDegPerSec: number;
} {
  const { stabilizer } = features;
  return {
    radiusDeg: stabilizer.radiusDeg,
    snapDeg: stabilizer.snapDeg,
    hysteresisDeg: stabilizer.hysteresis.enabled ? stabilizer.hysteresis.marginDeg : 0,
    velocityMax: stabilizer.velocityMax,
    driftDegPerSec: stabilizer.drift.enabled ? stabilizer.drift.degPerSec : 0,
  };
}
