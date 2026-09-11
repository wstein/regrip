import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type {
  SmartCubeConnection,
  SmartCubeDiagnosticEvent,
  SmartCubeEvent,
} from 'smartcube-web-bluetooth';

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
  it('deduplicates ordinary snapshots but preserves a requested unchanged response', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({
      connect: async () =>
        connection(events$, {
          gyroscope: false,
          battery: false,
          facelets: true,
          hardware: false,
          reset: false,
        }),
    });
    const snapshots: SmartCubeSessionEvent[] = [];
    session.subscribeEvents((event) => {
      if (event.type === 'FACELETS') snapshots.push(event);
    });
    const facelets = 'U'.repeat(54);

    await session.connect();
    events$.next({ type: 'FACELETS', timestamp: 1, serial: 7, facelets });
    events$.next({ type: 'FACELETS', timestamp: 2, serial: 7, facelets });
    expect(snapshots).toHaveLength(1);

    const response = session.syncFacelets();
    events$.next({ type: 'FACELETS', timestamp: 3, serial: 7, facelets });
    await expect(response).resolves.toMatchObject({ type: 'FACELETS', timestamp: 3 });
    expect(snapshots).toHaveLength(2);
    await session.disconnect();
  });

  it('keeps optional transport diagnostics out of cube-state events and unsubscribes on disconnect', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const diagnostics$ = new Subject<SmartCubeDiagnosticEvent>();
    const session = createSmartCubeSession({
      connect: async () => ({ ...connection(events$), diagnostics$ }),
    });
    const diagnostics: SmartCubeDiagnosticEvent[] = [];
    const sessionEvents: SmartCubeSessionEvent[] = [];
    session.subscribeDiagnostics((event) => diagnostics.push(event));
    session.subscribeEvents((event) => sessionEvents.push(event));

    await session.connect();
    const diagnostic: SmartCubeDiagnosticEvent = {
      type: 'UNKNOWN_PACKET',
      protocol: 'qiyi',
      timestamp: 1,
      opcode: 0xff,
      bytes: [0x55, 0xff],
    };
    diagnostics$.next(diagnostic);

    expect(diagnostics).toEqual([diagnostic]);
    expect(sessionEvents).toEqual([]);

    await session.disconnect();
    diagnostics$.next({ ...diagnostic, timestamp: 2 });
    expect(diagnostics).toEqual([diagnostic]);
  });

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

  it('publishes each display-frame gyro sample, including sub-degree motion', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({ connect: async () => connection(events$) });
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
    ).toEqual([1, 2, 3]);
    await session.disconnect();
  });

  it('publishes each small drift correction for the virtual cube', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({
      connect: async () => connection(events$),
      features: {
        stabilizer: {
          radiusDeg: 0,
          snapDeg: 0,
          hysteresis: { enabled: false, marginDeg: 0 },
          drift: { enabled: true, degPerSec: 2 },
        },
      },
    });
    const received: SmartCubeSessionEvent[] = [];
    session.subscribeEvents((event) => received.push(event));

    await session.connect();
    const restingOffset = Quaternion.fromEuler({ x: Quaternion.degreesToRadians(10), y: 0, z: 0 });
    events$.next({ type: 'GYRO', timestamp: 0, quaternion: Quaternion.identity });
    events$.next({ type: 'GYRO', timestamp: 1000, quaternion: restingOffset });
    events$.next({ type: 'GYRO', timestamp: 2000, quaternion: restingOffset });

    const gyro = received.filter(
      (event): event is Extract<SmartCubeSessionEvent, { type: 'GYRO' }> => event.type === 'GYRO',
    );
    expect(gyro.map((event) => event.timestamp)).toEqual([0, 1000, 2000]);
    expect(Quaternion.angle(gyro[1]!.stabilized, gyro[2]!.stabilized)).toBeCloseTo(
      Quaternion.degreesToRadians(2),
      8,
    );
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

  it('requests facelets and emits MOVE_GAP before the discontinuous move', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const conn = connection(events$, {
      gyroscope: false,
      battery: false,
      facelets: true,
      hardware: false,
      reset: false,
    });
    const session = createSmartCubeSession({ connect: async () => conn });
    const received: SmartCubeSessionEvent[] = [];
    session.subscribeEvents((event) => received.push(event));

    await session.connect();
    vi.mocked(conn.sendCommand).mockClear();
    events$.next({
      type: 'FACELETS',
      timestamp: 1,
      serial: 10,
      facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
    });
    events$.next({
      type: 'MOVE',
      timestamp: 2,
      serial: 11,
      move: 'R',
      face: 1,
      direction: 0,
      localTimestamp: 2,
      cubeTimestamp: null,
    });
    events$.next({
      type: 'MOVE',
      timestamp: 3,
      serial: 14,
      move: 'U',
      face: 0,
      direction: 0,
      localTimestamp: 3,
      cubeTimestamp: null,
    });

    expect(received.map((event) => event.type)).toEqual(['FACELETS', 'MOVE', 'MOVE_GAP', 'MOVE']);
    expect(received.at(-2)).toMatchObject({
      type: 'MOVE_GAP',
      previousSerial: 11,
      serial: 14,
      missing: 2,
    });
    await vi.waitFor(() =>
      expect(conn.sendCommand).toHaveBeenCalledWith({ type: 'REQUEST_FACELETS' }),
    );

    events$.next({
      type: 'FACELETS',
      timestamp: 4,
      serial: 14,
      facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
    });
    events$.next({
      type: 'MOVE',
      timestamp: 5,
      serial: 15,
      move: 'F',
      face: 2,
      direction: 0,
      localTimestamp: 5,
      cubeTimestamp: null,
    });
    expect(received.filter((event) => event.type === 'MOVE_GAP')).toHaveLength(1);
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

  it('waits for the next FACELETS event when synchronizing state', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const conn = connection(events$, {
      gyroscope: false,
      battery: false,
      facelets: true,
      hardware: false,
      reset: false,
    });
    const session = createSmartCubeSession({ connect: async () => conn });
    await session.connect();
    vi.mocked(conn.sendCommand).mockClear();

    let completed = false;
    const syncing = session.syncFacelets().then(() => {
      completed = true;
    });
    await vi.waitFor(() =>
      expect(conn.sendCommand).toHaveBeenCalledWith({ type: 'REQUEST_FACELETS' }),
    );
    expect(completed).toBe(false);

    events$.next({
      type: 'FACELETS',
      timestamp: 1,
      serial: 1,
      facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
    });
    await syncing;
    expect(completed).toBe(true);
    await session.disconnect();
  });
});
