import type { SmartCubeProfile } from './types';

export function mergeProfiles(base: SmartCubeProfile, next: SmartCubeProfile): SmartCubeProfile {
  return {
    ...base,
    ...next,
    match: { ...base.match, ...next.match },
    stabilizer: { ...base.stabilizer, ...next.stabilizer },
    battery: { ...base.battery, ...next.battery },
    gyro: { ...base.gyro, ...next.gyro },
    quirks: { ...base.quirks, ...next.quirks },
  };
}
