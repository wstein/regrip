import type { SmartCubeProfile, SmartCubeProfilePatch } from './types.js';
import { deepMergeRecord } from '../../internal/deepMergeRecord.js';

/** Layer a profile patch over a selected profile without mutating either input. */
export function mergeProfiles(
  base: SmartCubeProfile,
  next: SmartCubeProfile | SmartCubeProfilePatch,
): SmartCubeProfile {
  return deepMergeRecord(base, next) as SmartCubeProfile;
}
