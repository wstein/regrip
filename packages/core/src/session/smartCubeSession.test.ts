import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { SmartCubeConnection, SmartCubeEvent } from 'smartcube-web-bluetooth';

import * as Quaternion from '@wstein/regrip-core/domain/Quaternion.res.mjs';
import {
  createSmartCubeSession,
  type GyroFrameScheduler,
  type SmartCubeSessionEvent,
} from './smartCubeSession';

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

function queuedGyroFrames(): { scheduler: GyroFrameScheduler; flush: () => void } {
  const callbacks = new Map<number, () => void>();
  let nextHandle = 0;
  return {
    scheduler: {
      schedule: (flush) => {
        nextHandle += 1;
        callbacks.set(nextHandle, flush);
        return nextHandle;
      },
      cancel: (handle) => callbacks.delete(handle as number),
    },
    flush: () => {
      const next = [...callbacks.values()];
      callbacks.clear();
      next.forEach((flush) => flush());
    },
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

  it('publishes a stabilized gyro pose from the session-owned magnet', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({ connect: async () => connection(events$) });
    const received: SmartCubeSessionEvent[] = [];
    session.subscribeEvents((event) => received.push(event));

    await session.connect();
    events$.next({ type: 'GYRO', timestamp: 1, quaternion: Quaternion.identity });
    const deliberateTurn = Quaternion.fromEuler({
      x: Quaternion.degreesToRadians(67.5),
      y: 0,
      z: 0,
    });
    events$.next({
      type: 'GYRO',
      timestamp: 2,
      quaternion: deliberateTurn,
      velocity: { x: 2.5, y: 0, z: 0 },
    });

    const gyro = received.at(-1);
    expect(gyro).toMatchObject({
      type: 'GYRO',
      relative: deliberateTurn,
      stabilized: deliberateTurn,
    });
    await session.disconnect();
  });

  it('coalesces a contiguous BLE gyro burst to the latest display-frame sample', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const frames = queuedGyroFrames();
    const session = createSmartCubeSession({
      connect: async () => connection(events$),
      gyroFrameScheduler: frames.scheduler,
    });
    const received: SmartCubeSessionEvent[] = [];
    session.subscribeEvents((event) => received.push(event));

    await session.connect();
    events$.next({ type: 'GYRO', timestamp: 1, quaternion: Quaternion.identity });
    events$.next({
      type: 'GYRO',
      timestamp: 2,
      quaternion: Quaternion.fromEuler({ x: Quaternion.degreesToRadians(5), y: 0, z: 0 }),
    });
    events$.next({
      type: 'GYRO',
      timestamp: 3,
      quaternion: Quaternion.fromEuler({ x: Quaternion.degreesToRadians(15), y: 0, z: 0 }),
    });

    expect(received.map((event) => event.type)).toEqual(['GYRO']);
    frames.flush();
    expect(
      received.filter((event) => event.type === 'GYRO').map((event) => event.timestamp),
    ).toEqual([1, 3]);
    await session.disconnect();
  });

  it('suppresses sub-threshold calibrated gyro microjitter', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({
      connect: async () => connection(events$),
      features: { stabilizer: { microJitterDeg: 0.5 } },
    });
    const received: SmartCubeSessionEvent[] = [];
    session.subscribeEvents((event) => received.push(event));

    await session.connect();
    events$.next({ type: 'GYRO', timestamp: 1, quaternion: Quaternion.identity });
    events$.next({
      type: 'GYRO',
      timestamp: 2,
      quaternion: Quaternion.fromEuler({ x: Quaternion.degreesToRadians(0.25), y: 0, z: 0 }),
    });
    events$.next({
      type: 'GYRO',
      timestamp: 3,
      quaternion: Quaternion.fromEuler({ x: Quaternion.degreesToRadians(0.75), y: 0, z: 0 }),
    });

    expect(
      received.filter((event) => event.type === 'GYRO').map((event) => event.timestamp),
    ).toEqual([1, 3]);
    await session.disconnect();
  });

  it('passes through calibrated gyro when the stabilizer feature is disabled', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({
      connect: async () => connection(events$),
      features: { stabilizer: { enabled: false } },
    });
    const received: SmartCubeSessionEvent[] = [];
    session.subscribeEvents((event) => received.push(event));

    await session.connect();
    events$.next({ type: 'GYRO', timestamp: 1, quaternion: Quaternion.identity });
    const rawTurn = Quaternion.fromEuler({
      x: Quaternion.degreesToRadians(43),
      y: 0,
      z: 0,
    });
    events$.next({ type: 'GYRO', timestamp: 2, quaternion: rawTurn });

    const gyro = received.at(-1);
    expect(gyro).toMatchObject({ type: 'GYRO', relative: rawTurn, stabilized: rawTurn });
    await session.disconnect();
  });

  it('gates virtual regrips with the resolved feature and filters them with session.on', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({
      connect: async () => connection(events$),
      features: { regrip: { enabled: true, thresholdDeg: 70 } },
    });
    const regrips: string[] = [];
    session.on('REGRIP', (event) => regrips.push(event.notationToken));

    await session.connect();
    events$.next({ type: 'GYRO', timestamp: 1, quaternion: Quaternion.identity });
    events$.next({
      type: 'GYRO',
      timestamp: 2,
      quaternion: Quaternion.fromEuler({ x: Quaternion.degreesToRadians(66), y: 0, z: 0 }),
    });
    events$.next({
      type: 'GYRO',
      timestamp: 3,
      quaternion: Quaternion.fromEuler({ x: Quaternion.degreesToRadians(75), y: 0, z: 0 }),
    });

    expect(regrips).toEqual(["x'"]);
    await session.disconnect();
  });

  it('does not emit move-back triggers when the feature is disabled', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({
      connect: async () => connection(events$),
      features: { customTrigger: { enabled: false } },
    });
    const triggers: SmartCubeSessionEvent[] = [];
    session.on('CUSTOM_TRIGGER', (event) => triggers.push(event));

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
      timestamp: 1100,
      move: "R'",
      face: 1,
      direction: 1,
      localTimestamp: 1100,
      cubeTimestamp: null,
    });

    expect(triggers).toEqual([]);
    await session.disconnect();
  });

  it('emits a SHAKE trigger from an oscillating gyro burst, once the guard elapses', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({
      connect: async () => connection(events$),
      features: {
        stabilizer: { enabled: false },
        customTrigger: { enabled: true, triggers: [{ kind: 'shake' }] },
      },
    });
    const shakes: SmartCubeSessionEvent[] = [];
    session.on('SHAKE', (event) => shakes.push(event));
    const pose = (degrees: number) =>
      Quaternion.fromEuler({ x: 0, y: Quaternion.degreesToRadians(degrees), z: 0 });

    await session.connect();
    // Calibration sample, then forward / back / forward / back.
    for (const [timestamp, degrees] of [
      [0, 0],
      [60, 15],
      [120, -15],
      [180, 15],
      [240, -15],
    ] as const) {
      events$.next({ type: 'GYRO', timestamp, quaternion: pose(degrees) });
    }
    expect(shakes).toEqual([]);

    // A later sample past the face-turn guard releases the held candidate.
    events$.next({ type: 'GYRO', timestamp: 700, quaternion: pose(-15) });
    expect(shakes).toMatchObject([{ type: 'SHAKE', timestamp: 240, steps: 4, reversals: 3 }]);

    await session.disconnect();
  });

  it('does not emit SHAKE when a face turn lands inside the guard', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({
      connect: async () => connection(events$),
      features: {
        stabilizer: { enabled: false },
        customTrigger: { enabled: true, triggers: [{ kind: 'shake' }] },
      },
    });
    const shakes: SmartCubeSessionEvent[] = [];
    session.on('SHAKE', (event) => shakes.push(event));
    const pose = (degrees: number) =>
      Quaternion.fromEuler({ x: 0, y: Quaternion.degreesToRadians(degrees), z: 0 });

    await session.connect();
    for (const [timestamp, degrees] of [
      [0, 0],
      [60, 15],
      [120, -15],
      [180, 15],
      [240, -15],
    ] as const) {
      events$.next({ type: 'GYRO', timestamp, quaternion: pose(degrees) });
    }
    events$.next({
      type: 'MOVE',
      timestamp: 300,
      move: 'R',
      face: 1,
      direction: 0,
      localTimestamp: 300,
      cubeTimestamp: null,
    });
    events$.next({ type: 'GYRO', timestamp: 700, quaternion: pose(-15) });

    expect(shakes).toEqual([]);
    await session.disconnect();
  });

  it('reconfigures features at runtime and resets affected detectors', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({ connect: async () => connection(events$) });
    const regrips: SmartCubeSessionEvent[] = [];
    session.on('REGRIP', (event) => regrips.push(event));

    await session.connect();
    session.configureFeatures({ regrip: { enabled: true, thresholdDeg: 60 } });
    expect(session.getState().features.regrip.enabled).toBe(true);
    events$.next({ type: 'GYRO', timestamp: 0, quaternion: Quaternion.identity });
    events$.next({
      type: 'GYRO',
      timestamp: 1,
      quaternion: Quaternion.fromEuler({ x: Quaternion.degreesToRadians(66), y: 0, z: 0 }),
    });
    expect(regrips).toHaveLength(1);

    session.configureFeatures({ regrip: { enabled: false } });
    events$.next({
      type: 'GYRO',
      timestamp: 2,
      quaternion: Quaternion.fromEuler({ x: Quaternion.degreesToRadians(156), y: 0, z: 0 }),
    });
    expect(regrips).toHaveLength(1);
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
