import type { SmartCubeTransportConnection } from '../bindings/smartCubeTransport';

/** Request the common state snapshots supported by a connected cube. */
export async function requestInitialState(connection: SmartCubeTransportConnection): Promise<void> {
  if (connection.capabilities.hardware) await connection.sendCommand({ type: 'REQUEST_HARDWARE' });
  if (connection.capabilities.facelets) await connection.sendCommand({ type: 'REQUEST_FACELETS' });
  if (connection.capabilities.battery) await connection.sendCommand({ type: 'REQUEST_BATTERY' });
}

/** Disconnect without allowing transport cleanup errors to mask session teardown. */
export async function disconnectConnection(
  connection: SmartCubeTransportConnection | null,
): Promise<void> {
  await connection?.disconnect().catch(() => {});
}
