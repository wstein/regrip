import { connectSmartCube } from 'smartcube-web-bluetooth';
import type { SmartCubeTransportConnection } from '@wstein/regrip-core/bindings/smartCubeTransport';

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
  return connectSmartCube(macAddressProvider);
}

export async function requestInitialState(connection: SmartCubeTransportConnection): Promise<void> {
  if (connection.capabilities.hardware) await connection.sendCommand({ type: 'REQUEST_HARDWARE' });
  if (connection.capabilities.facelets) await connection.sendCommand({ type: 'REQUEST_FACELETS' });
  if (connection.capabilities.battery) await connection.sendCommand({ type: 'REQUEST_BATTERY' });
}

export async function disconnectConnection(
  connection: SmartCubeTransportConnection | null,
): Promise<void> {
  await connection?.disconnect().catch(() => {});
}
