import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectSmartCube } from 'smartcube-web-bluetooth';

import { installMockBluetoothFromFixture } from '../node_modules/smartcube-web-bluetooth/src/test/bluetooth-mock/index.ts';
import type { FixtureSession } from '../node_modules/smartcube-web-bluetooth/src/test/fixtures/types.ts';
import { createSmartCubeSession } from '../src/session/smartCubeSession';

const fixtureUrl = new URL(
  '../node_modules/smartcube-web-bluetooth/captures/fixture_GoCube_gocube_2026-04-14T11-43-52.json',
  import.meta.url,
);

afterEach(() => vi.unstubAllGlobals());

describe('smart cube session over the library Bluetooth mock', () => {
  it('connects, requests initial state, decodes captured GoCube events, and tears down', async () => {
    const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8')) as FixtureSession;
    // Node 26 provides a read-only Navigator getter; give the upstream mock
    // the mutable browser-shaped global it expects.
    vi.stubGlobal('navigator', {});
    const { device, replayer } = installMockBluetoothFromFixture(fixture, {
      deviceId: 'smartcube-example-e2e',
      maxAutoFlushNotifies: 5,
    });
    const session = createSmartCubeSession({
      connect: async () => {
        const connection = await connectSmartCube({
          deviceSelection: 'any',
          enableAddressSearch: false,
        });
        // This transport capture has unsolicited hardware/battery data but no
        // matching request writes. Keep replay strict for its captured I/O.
        connection.capabilities.hardware = false;
        connection.capabilities.battery = false;
        return connection;
      },
      virtualRegrips: true,
    });
    const received: string[] = [];
    session.subscribeEvents((event) => received.push(event.type));

    await session.connect();
    await replayer.drainNotificationsAsync();
    await vi.waitFor(() => expect(received).toContain('FACELETS'));

    expect(session.getState().status, session.getState().error ?? undefined).toBe('connected');
    expect(session.getState().connection?.protocol.id).toBe('gocube');
    expect(received).toEqual(expect.arrayContaining(['FACELETS', 'GYRO', 'MOVE', 'REGRIP']));

    await session.disconnect();
    expect(session.getState().status).toBe('disconnected');
    expect(device.gatt?.connected).toBe(false);
  }, 20_000);
});
