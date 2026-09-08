import type { DeviceContext, ResolvedProfile, SmartCubeProfile } from './types';
import { mergeProfiles } from './mergeProfiles';

const keys = ['protocol', 'deviceName', 'hardwareName', 'goCubeType'] as const;

function score(profile: SmartCubeProfile, context: DeviceContext): number {
  if (!profile.match) return profile.id === 'base' ? 0 : 1;
  let result = 0;
  for (const key of keys) {
    const expected = profile.match[key];
    if (!expected) continue;
    const actual = context[key];
    if (!actual || !new RegExp(expected, 'i').test(actual)) return -1;
    result += 10;
  }
  return result;
}

export function resolveProfile(context: DeviceContext, profiles: readonly SmartCubeProfile[]): ResolvedProfile {
  const byId = new Map(profiles.map(profile => [profile.id, profile]));
  const resolveChain = (profile: SmartCubeProfile): SmartCubeProfile[] => [
    ...(profile.extends && byId.get(profile.extends) ? resolveChain(byId.get(profile.extends)!) : []),
    profile,
  ];
  const matches = profiles.filter(profile => score(profile, context) >= 0).sort((a, b) => score(a, context) - score(b, context));
  const selected = matches.at(-1) ?? byId.get('unknown')!;
  const chain = resolveChain(selected);
  const value = chain.reduce(mergeProfiles, {} as SmartCubeProfile);
  const sources: Record<string, string> = {};
  for (const profile of chain) for (const key of Object.keys(profile)) sources[key] = profile.id;
  return { id: selected.id, value, sources };
}
