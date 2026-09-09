import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { SmartCubeConnection, SmartCubeEvent } from 'smartcube-web-bluetooth';

import * as Quaternion from '../domain/Quaternion.res.mjs';
import { createSmartCubeSession, type SmartCubeSessionEvent } from './smartCubeSession';

function connection(
  events$: Subject<SmartCubeEvent>,
  capabilities: SmartCubeConnection['capabilities'] = {
    gyroscope: true,
    battery: false,
    facelets: false,
    hardware: false,
    reset: false,
  },
): SmartCubeConnection {
  return {
    deviceName: 'GoCube',
    deviceMAC: '',
    protocol: { id: 'gocube', name: 'GoCube' },
    capabilities,
    events$,
    sendCommand: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
  };
}

describe('smart cube session', () => {
  it('owns the event subscription and reprofiles before notifying event observers', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({ connect: async () => connection(events$) });
    const received: SmartCubeSessionEvent[] = [];
    let profileAtHardware = '';
    session.subscribeEvents((event) => {
      received.push(event);
      if (event.type === 'HARDWARE') profileAtHardware = session.getState().profile.id;
    });

    await session.connect();
    events$.next({ type: 'HARDWARE', timestamp: 1, hardwareName: 'GoCube' });

    expect(received).toHaveLength(1);
    expect(profileAtHardware).toBe('gocube');
    const profile = session.getState().profile;
    events$.next({ type: 'HARDWARE', timestamp: 2, hardwareName: 'GoCube' });
    expect(session.getState().profile).toBe(profile);
    await session.disconnect();
  });

  it('publishes an optional virtual regrip after its source gyro event', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({
      connect: async () => connection(events$),
      virtualRegrips: true,
    });
    const received: SmartCubeSessionEvent[] = [];
    session.subscribeEvents((event) => {
      received.push(event);
    });

    await session.connect();
    events$.next({ type: 'GYRO', timestamp: 1, quaternion: Quaternion.identity });
    events$.next({
      type: 'GYRO',
      timestamp: 2,
      quaternion: Quaternion.fromEuler({ x: Quaternion.degreesToRadians(66), y: 0, z: 0 }),
    });

    expect(
      received.map((event) => (event.type === 'REGRIP' ? event.notationToken : event.type)),
    ).toEqual(['GYRO', 'GYRO', "x'"]);
    expect(received[0]).toMatchObject({ type: 'GYRO', relative: Quaternion.identity });
    await session.disconnect();
  });

  it('exposes profile-resolved features and maps the deprecated regrip option once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const session = createSmartCubeSession({
      connect: async () => connection(new Subject<SmartCubeEvent>()),
      virtualRegrips: true,
    });

    expect(session.getState().features.regrip.enabled).toBe(true);
    expect(session.getState().profile.sources['features.regrip.enabled']).toBe('app');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('prefers the feature override over the deprecated regrip option', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const session = createSmartCubeSession({
      connect: async () => connection(new Subject<SmartCubeEvent>()),
      virtualRegrips: true,
      features: { regrip: { enabled: false } },
    });

    expect(session.getState().features.regrip.enabled).toBe(false);
    expect(session.getState().profile.sources['features.regrip.enabled']).toBe('app');
    warn.mockRestore();
  });

  it('does not revive a connection disconnected during initial state requests', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const conn = connection(events$, {
      gyroscope: true,
      battery: false,
      facelets: false,
      hardware: true,
      reset: false,
    });
    let finishRequest: (() => void) | undefined;
    conn.sendCommand = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRequest = resolve;
        }),
    );
    const session = createSmartCubeSession({ connect: async () => conn });

    const connecting = session.connect();
    await vi.waitFor(() => expect(conn.sendCommand).toHaveBeenCalledOnce());
    events$.next({ type: 'DISCONNECT', timestamp: 1 });
    finishRequest?.();
    await connecting;

    expect(session.getState().status).toBe('disconnected');
    expect(session.getState().connection).toBeNull();
  });

  it('publishes a custom trigger after an inverse move pair within 300ms', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({ connect: async () => connection(events$) });
    const received: SmartCubeSessionEvent[] = [];
    session.subscribeEvents((event) => received.push(event));

    await session.connect();
    events$.next({
      type: 'MOVE',
      timestamp: 1000,
      move: 'R',
      face: 1,
      direction: 0,
      localTimestamp: 1000,
      cubeTimestamp: null,
    });
    events$.next({
      type: 'MOVE',
      timestamp: 1299,
      move: "R'",
      face: 1,
      direction: 1,
      localTimestamp: 1299,
      cubeTimestamp: null,
    });

    expect(received.map((event) => event.type)).toEqual(['MOVE', 'MOVE', 'CUSTOM_TRIGGER']);
    expect(received.at(-1)).toMatchObject({ type: 'CUSTOM_TRIGGER', move: 'R', timestamp: 1299 });
    await session.disconnect();
  });

  it('owns universal and capability-gated vendor commands', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const conn = connection(events$, {
      gyroscope: true,
      battery: false,
      facelets: true,
      hardware: false,
      reset: false,
      vendorCommands: ['TOGGLE_BACKLIGHT'],
    });
    conn.sendVendorCommand = vi.fn(async () => {});
    const session = createSmartCubeSession({ connect: async () => conn });

    await expect(session.sendCommand({ type: 'REQUEST_FACELETS' })).rejects.toThrow(
      'not connected',
    );
    await session.connect();
    await session.sendCommand({ type: 'REQUEST_FACELETS' });
    await session.sendVendorCommand({ vendor: 'gocube', type: 'TOGGLE_BACKLIGHT' });
    await expect(session.sendVendorCommand({ vendor: 'gocube', type: 'REBOOT' })).rejects.toThrow(
      'Unsupported cube command',
    );

    expect(conn.sendCommand).toHaveBeenCalledWith({ type: 'REQUEST_FACELETS' });
    expect(conn.sendVendorCommand).toHaveBeenCalledWith({
      vendor: 'gocube',
      type: 'TOGGLE_BACKLIGHT',
    });
  });
});
