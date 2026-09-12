import type {
  DeviceContext,
  ProfileOverrides,
  ResolvedProfile,
  SmartCubeProfile,
  SmartCubeProfilePatch,
} from './types';
import { mergeProfiles } from './mergeProfiles';

const keys = ['protocol', 'deviceName', 'deviceMAC', 'hardwareName', 'goCubeType'] as const;

function score(profile: SmartCubeProfile, context: DeviceContext): number {
  if (!profile.match) return profile.id === 'base' ? 0 : 1;
  let result = 0;
  for (const key of keys) {
    const expected = profile.match[key];
    if (!expected) continue;
    const actual = context[key];
    try {
      if (!actual || !new RegExp(`^(?:${expected})$`, 'i').test(actual)) return -1;
    } catch {
      return -1;
    }
    result += 10;
  }
  return result;
}

function recordLeafSources(
  value: object,
  source: string,
  sources: Record<string, string>,
  prefix = '',
): void {
  for (const [key, child] of Object.entries(value) as Array<[string, unknown]>) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      recordLeafSources(child, source, sources, path);
    } else {
      sources[path] = source;
    }
  }
}

/** Select and resolve the most specific profile for a cube identity. */
export function resolveProfile(
  context: DeviceContext,
  profiles: readonly SmartCubeProfile[],
  overrides: ProfileOverrides = {},
): ResolvedProfile {
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  const resolveChain = (
    profile: SmartCubeProfile,
    visiting = new Set<string>(),
  ): SmartCubeProfile[] => {
    if (visiting.has(profile.id)) throw new Error(`Profile inheritance cycle at '${profile.id}'`);
    const nextVisiting = new Set(visiting).add(profile.id);
    if (!profile.extends) return [profile];
    const parent = byId.get(profile.extends);
    if (!parent)
      throw new Error(`Profile '${profile.id}' extends missing profile '${profile.extends}'`);
    return [...resolveChain(parent, nextVisiting), profile];
  };
  const matches = profiles
    .filter((profile) => score(profile, context) >= 0)
    .sort((a, b) => score(a, context) - score(b, context));
  const selected = matches.at(-1) ?? byId.get('unknown')!;
  const chain = resolveChain(selected);
  const layers: Array<[string, SmartCubeProfile | SmartCubeProfilePatch]> = [
    ...chain.map((profile) => [profile.id, profile] as [string, SmartCubeProfile]),
    ...(['app', 'user', 'runtime'] as const).flatMap((layer) =>
      overrides[layer] ? [[layer, overrides[layer]] as [string, SmartCubeProfilePatch]] : [],
    ),
  ];
  const value = layers.reduce(
    (merged, [, layer]) => mergeProfiles(merged, layer),
    {} as SmartCubeProfile,
  );
  const sources: Record<string, string> = {};
  for (const [source, layer] of layers) recordLeafSources(layer, source, sources);
  return { id: selected.id, value, sources };
}
