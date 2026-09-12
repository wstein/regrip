import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import type { SmartCubeEvent, SmartCubeTransportConnection } from '../bindings/smartCubeTransport';
import { disconnectConnection, requestInitialState } from './connectionLifecycle';

function connection(
  capabilities: SmartCubeTransportConnection['capabilities'],
): SmartCubeTransportConnection {
  return {
    deviceName: 'Test cube',
    deviceMAC: '',
    protocol: { id: 'test', name: 'Test' },
    capabilities,
    events$: new Subject<SmartCubeEvent>(),
    sendCommand: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
  };
}

describe('connection lifecycle', () => {
  it('requests only supported initial snapshots in deterministic order', async () => {
    const cube = connection({
      gyroscope: false,
      hardware: true,
      facelets: false,
      battery: true,
      reset: false,
    });

    await requestInitialState(cube);

    expect(cube.sendCommand).toHaveBeenCalledTimes(2);
    expect(cube.sendCommand).toHaveBeenNthCalledWith(1, { type: 'REQUEST_HARDWARE' });
    expect(cube.sendCommand).toHaveBeenNthCalledWith(2, { type: 'REQUEST_BATTERY' });
  });

  it('sends no initial commands when the transport supports no snapshots', async () => {
    const cube = connection({
      gyroscope: false,
      hardware: false,
      facelets: false,
      battery: false,
      reset: false,
    });

    await requestInitialState(cube);

    expect(cube.sendCommand).not.toHaveBeenCalled();
  });

  it('treats absent connections and transport cleanup failures as successful teardown', async () => {
    await expect(disconnectConnection(null)).resolves.toBeUndefined();
    const cube = connection({
      gyroscope: false,
      hardware: false,
      facelets: false,
      battery: false,
      reset: false,
    });
    cube.disconnect = vi.fn(async () => {
      throw new Error('radio disappeared');
    });

    await expect(disconnectConnection(cube)).resolves.toBeUndefined();
    expect(cube.disconnect).toHaveBeenCalledOnce();
  });
});
