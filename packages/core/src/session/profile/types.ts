import type { SessionFeaturesPatch } from '../features';

/** Identity fields available when selecting a smart-cube profile. */
export type DeviceContext = {
  protocol?: string;
  deviceName?: string;
  deviceMAC?: string;
  hardwareName?: string;
  goCubeType?: string;
};

/** Declarative configuration for one family of smart cubes. */
export type SmartCubeProfile = {
  id: string;
  extends?: string;
  match?: Partial<
    Record<'protocol' | 'deviceName' | 'deviceMAC' | 'hardwareName' | 'goCubeType', string>
  >;
  stabilizer?: {
    radiusDeg?: number;
    snapDeg?: number;
    hysteresisDeg?: number;
    velocityMax?: number;
    driftDegPerSec?: number;
  };
  battery?: { curve?: string };
  gyro?: { axisMap?: string };
  features?: SessionFeaturesPatch;
  quirks?: Record<string, unknown>;
};

/** Runtime-owned values layered after the bundled profile inheritance chain. */
export type SmartCubeProfilePatch = Partial<Omit<SmartCubeProfile, 'id' | 'extends' | 'match'>>;

/** Host-owned profile layers applied after bundled profile inheritance. */
export type ProfileOverrides = {
  app?: SmartCubeProfilePatch;
  user?: SmartCubeProfilePatch;
  runtime?: SmartCubeProfilePatch;
};

/** The selected profile together with its resolved inheritance chain. */
export type ResolvedProfile = {
  id: string;
  value: SmartCubeProfile;
  /** Source by dot-separated leaf path, e.g. `stabilizer.snapDeg`. */
  sources: Record<string, string>;
};
