import { connectSmartCube, SmartCubeConnection } from 'smartcube-web-bluetooth';

export const macAddressProvider = async (
  device: BluetoothDevice,
  isFallbackCall?: boolean,
): Promise<string | null> => {
  if (isFallbackCall) {
    return prompt('Unable to determine cube MAC address!\nPlease enter it manually:');
  }
  return typeof device.watchAdvertisements === 'function'
    ? null
    : prompt('Web Bluetooth advertisement watching is unavailable.\nPlease enter the cube MAC address manually:');
};

export async function connectCube(): Promise<SmartCubeConnection> {
  return connectSmartCube(macAddressProvider);
}

export async function requestInitialState(connection: SmartCubeConnection): Promise<void> {
  if (connection.capabilities.hardware) await connection.sendCommand({type: 'REQUEST_HARDWARE'});
  if (connection.capabilities.facelets) await connection.sendCommand({type: 'REQUEST_FACELETS'});
  if (connection.capabilities.battery) await connection.sendCommand({type: 'REQUEST_BATTERY'});
}

export async function disconnectCube(connection: SmartCubeConnection | null): Promise<void> {
  await connection?.disconnect().catch(() => {});
}
