import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { SmartCubeConnection, SmartCubeEvent } from 'smartcube-web-bluetooth';

import * as Quaternion from '../domain/Quaternion.res.mjs';
import { createSmartCubeSession, type SmartCubeSessionEvent } from './smartCubeSession';

function connection(
  events$: Subject<SmartCubeEvent>,
  capabilities: SmartCubeConnection['capabilities'] = { gyroscope: true, battery: false, facelets: false, hardware: false, reset: false },
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
    session.subscribeEvents(event => {
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
    const received: string[] = [];
    session.subscribeEvents(event => {
      received.push(event.type === 'REGRIP' ? event.notationToken : event.type);
    });

    await session.connect();
    events$.next({ type: 'GYRO', timestamp: 1, quaternion: Quaternion.identity });
    events$.next({
      type: 'GYRO', timestamp: 2,
      quaternion: Quaternion.fromEuler({ x: Quaternion.degreesToRadians(80), y: 0, z: 0 }),
    });

    expect(received).toEqual(['GYRO', 'CALIBRATED_GYRO', 'GYRO', 'CALIBRATED_GYRO', "x'"]);
    await session.disconnect();
  });

  it('does not revive a connection disconnected during initial state requests', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const conn = connection(events$, { gyroscope: true, battery: false, facelets: false, hardware: true, reset: false });
    let finishRequest: (() => void) | undefined;
    conn.sendCommand = vi.fn(() => new Promise<void>(resolve => { finishRequest = resolve; }));
    const session = createSmartCubeSession({ connect: async () => conn });

    const connecting = session.connect();
    await vi.waitFor(() => expect(conn.sendCommand).toHaveBeenCalledOnce());
    events$.next({ type: 'DISCONNECT', timestamp: 1 });
    finishRequest?.();
    await connecting;

    expect(session.getState().status).toBe('disconnected');
    expect(session.getState().connection).toBeNull();
  });
});
