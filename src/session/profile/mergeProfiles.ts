import type { SmartCubeProfile, SmartCubeProfilePatch } from './types';

export function mergeProfiles(
  base: SmartCubeProfile,
  next: SmartCubeProfile | SmartCubeProfilePatch,
): SmartCubeProfile {
  return {
    ...base,
    ...next,
    match: { ...base.match, ...('match' in next ? next.match : undefined) },
    stabilizer: { ...base.stabilizer, ...next.stabilizer },
    battery: { ...base.battery, ...next.battery },
    gyro: { ...base.gyro, ...next.gyro },
    quirks: { ...base.quirks, ...next.quirks },
  };
}
