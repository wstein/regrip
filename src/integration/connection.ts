import { connectSmartCube } from 'smartcube-web-bluetooth';
import type { ConnectSmartCubeOptions } from 'smartcube-web-bluetooth';
import type { SmartCubeTransportConnection } from '@wstein/regrip-core/bindings/smartCubeTransport';
export {
  disconnectConnection,
  requestInitialState,
} from '@wstein/regrip-core/session/connectionLifecycle';

export const macAddressProvider = async (
  device: BluetoothDevice,
  isFallbackCall?: boolean,
): Promise<string | null> => {
  if (isFallbackCall) {
    return prompt(
      'Unable to determine cube MAC address!\nEnable chrome://flags/#enable-experimental-web-platform-features and reload, or enter it manually:',
    );
  }
  return typeof device.watchAdvertisements === 'function'
    ? null
    : prompt(
        'Web Bluetooth advertisement watching is unavailable.\nEnable chrome://flags/#enable-experimental-web-platform-features and reload, or enter the cube MAC address manually:',
      );
};

export async function connectCube(): Promise<SmartCubeTransportConnection> {
  const options: ConnectSmartCubeOptions & { diagnostics?: boolean } = {
    macAddressProvider,
    // Enhanced transports expose rejected decoder packets; stock v4 safely
    // ignores this forward-compatible option.
    diagnostics: true,
  };
  return connectSmartCube(options);
}
