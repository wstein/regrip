import { connectSmartCube } from 'smartcube-web-bluetooth';
import type { SmartCubeConnection } from 'smartcube-web-bluetooth';
import type { ReplaySessionController } from './testing/replaySession';

declare global {
  interface Window {
    /** Test harness only: supplies an in-memory connection before app bootstrap. */
    __smartcubeMockConnect?: () => Promise<SmartCubeConnection>;
    __smartcubeMockReplay?: () => void;
    /** Test/dev harness only: provides a virtual JSONL transport before app bootstrap. */
    __smartcubeReplay?: ReplaySessionController;
  }
}

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

export async function connectCube(): Promise<SmartCubeConnection> {
  if (window.__smartcubeMockConnect) return window.__smartcubeMockConnect();
  return connectSmartCube(macAddressProvider);
}

export async function requestInitialState(connection: SmartCubeConnection): Promise<void> {
  if (connection.capabilities.hardware) await connection.sendCommand({ type: 'REQUEST_HARDWARE' });
  if (connection.capabilities.facelets) await connection.sendCommand({ type: 'REQUEST_FACELETS' });
  if (connection.capabilities.battery) await connection.sendCommand({ type: 'REQUEST_BATTERY' });
}

export async function disconnectConnection(connection: SmartCubeConnection | null): Promise<void> {
  await connection?.disconnect().catch(() => {});
}
