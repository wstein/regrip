import base from '../../domain/profiles/profiles/base.json';
import ganGen2 from '../../domain/profiles/profiles/gan-gen2.json';
import ganI4 from '../../domain/profiles/profiles/gan-i4.json';
import gocube from '../../domain/profiles/profiles/gocube.json';
import moyu from '../../domain/profiles/profiles/moyu-ai.json';
import qiyi from '../../domain/profiles/profiles/qiyi.json';
import giiker from '../../domain/profiles/profiles/giiker.json';
import unknown from '../../domain/profiles/profiles/unknown.json';
import type { SmartCubeProfile } from './types';

export const bundledProfiles: SmartCubeProfile[] = [
  // JSON imports widen discriminant literals to `string`; schema.test.ts
  // validates this bundled data before it reaches the typed session boundary.
  base as SmartCubeProfile,
  ganGen2,
  ganI4,
  gocube,
  moyu,
  qiyi,
  giiker,
  unknown,
];
