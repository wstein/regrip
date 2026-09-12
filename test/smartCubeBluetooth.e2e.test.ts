import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectSmartCube } from 'smartcube-web-bluetooth';

import { installMockBluetoothFromFixture } from '../node_modules/smartcube-web-bluetooth/src/test/bluetooth-mock/index.ts';
import type { FixtureSession } from '../node_modules/smartcube-web-bluetooth/src/test/fixtures/types.ts';
import { ganProtocol } from '../node_modules/smartcube-web-bluetooth/src/smartcube/protocols/gan.ts';
import { createSmartCubeSession } from '@wstein/regrip-core/session/smartCubeSession';

const fixtureUrl = new URL(
  '../node_modules/smartcube-web-bluetooth/captures/fixture_GoCube_gocube_2026-04-14T11-43-52.json',
  import.meta.url,
);

const ganFixtureUrl = new URL(
  '../node_modules/smartcube-web-bluetooth/captures/fixture_GANicXXX_gan-gen2_2026-04-14T11-39-47.json',
  import.meta.url,
);

afterEach(() => vi.unstubAllGlobals());

const capturesAvailable = existsSync(fixtureUrl) && existsSync(ganFixtureUrl);

describe.skipIf(!capturesAvailable)('smart cube session over the library Bluetooth mock', () => {
  it('connects, requests initial state, decodes captured GoCube events, and tears down', async () => {
    const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8')) as FixtureSession;
    // Node 26 provides a read-only Navigator getter; give the upstream mock
    // the mutable browser-shaped global it expects.
    vi.stubGlobal('navigator', {});
    const { device, replayer } = installMockBluetoothFromFixture(fixture, {
      deviceId: 'regrip-e2e',
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
      features: { regrip: { enabled: true } },
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

  it('replays a MAC-salted GAN gen2 capture through the session lifecycle', async () => {
    const fixture = JSON.parse(await readFile(ganFixtureUrl, 'utf8')) as FixtureSession;
    vi.stubGlobal('navigator', {});
    // Node 26 exposes a warning-only localStorage getter unless a backing file
    // is configured. The GAN adapter only needs this browser cache contract.
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
    const { device, replayer } = installMockBluetoothFromFixture(fixture, {
      deviceId: 'regrip-gan-e2e',
      maxAutoFlushNotifies: 0,
    });
    const serviceUuids = new Set(
      fixture.traffic
        .filter((entry) => entry.op === 'discover-service')
        .map((entry) => entry.service),
    );
    const session = createSmartCubeSession({
      connect: async () => {
        const connection = await ganProtocol.connect(
          device,
          async () => fixture.device.mac ?? null,
          {
            serviceUuids,
            advertisementManufacturerData: null,
            enableAddressSearch: false,
            onStatus: undefined,
            signal: undefined,
          },
        );
        // The transport fixture starts with GAN initialization traffic, not
        // app-level REQUEST_* writes. Preserve strict replay matching while its
        // unsolicited FACELETS/HARDWARE/BATTERY packets establish state.
        connection.capabilities.hardware = false;
        connection.capabilities.facelets = false;
        connection.capabilities.battery = false;
        return connection;
      },
    });
    const received: string[] = [];
    session.subscribeEvents((event) => received.push(event.type));

    await session.connect();
    await replayer.drainNotificationsAsync();
    await vi.waitFor(() => expect(received).toContain('FACELETS'));

    expect(session.getState().status, session.getState().error ?? undefined).toBe('connected');
    expect(session.getState().connection?.protocol.id).toBe('gan-gen2');
    expect(received).toEqual(expect.arrayContaining(['FACELETS', 'MOVE']));

    await session.disconnect();
    expect(session.getState().status).toBe('disconnected');
    expect(device.gatt?.connected).toBe(false);
  }, 20_000);
});
