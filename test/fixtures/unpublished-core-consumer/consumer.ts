import {
  createSmartCubeSession,
  defaultSessionFeatures,
  type SmartCubeSession,
  type SmartCubeTransportConnection,
} from '@wstein/regrip-core';

declare const connect: () => Promise<SmartCubeTransportConnection>;

const session: SmartCubeSession = createSmartCubeSession({
  connect,
  features: defaultSessionFeatures,
});

void session;
