export type DeviceContext = {
  protocol?: string;
  deviceName?: string;
  deviceMAC?: string;
  hardwareName?: string;
  goCubeType?: string;
};

export type SmartCubeProfile = {
  id: string;
  extends?: string;
  match?: Partial<Record<'protocol' | 'deviceName' | 'hardwareName' | 'goCubeType', string>>;
  stabilizer?: {
    radiusDeg?: number;
    snapDeg?: number;
    hysteresisDeg?: number;
    velocityMax?: number;
  };
  battery?: { curve?: string };
  gyro?: { axisMap?: string };
  quirks?: Record<string, unknown>;
};

export type ResolvedProfile = {
  id: string;
  value: SmartCubeProfile;
  sources: Record<string, string>;
};
