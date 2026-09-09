import type { Subscription } from 'rxjs';
import type { SmartCubeConnection, SmartCubeEvent } from 'smartcube-web-bluetooth';

import * as GyroOrientation from '../domain/GyroOrientation.res.mjs';
import * as RegripDetector from '../domain/RegripDetector.res.mjs';
import { disconnectConnection, requestInitialState } from './connection';
import { bundledProfiles } from './profile/bundled';
import { resolveProfile } from './profile/resolveProfile';
import type { ResolvedProfile } from './profile/types';

export type SmartCubeSessionState = {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connection: SmartCubeConnection | null;
  lastEvent: SmartCubeEvent | null;
  profile: ResolvedProfile;
  error: string | null;
};

export type VirtualRegripEvent = {
  type: 'REGRIP';
  timestamp: number;
  /** Clockwise Singmaster x/y/z notation. */
  notationToken: string;
  /** The corresponding positive/negative calibrated sensor axis. */
  sensorFrameToken: string;
};

export type SmartCubeSessionEvent = SmartCubeEvent | VirtualRegripEvent;

export type SmartCubeSessionOptions = {
  connect: () => Promise<SmartCubeConnection>;
  /** Publish detected x/y/z regrips in addition to BLE events. Disabled by default. */
  virtualRegrips?: boolean;
};

export function createSmartCubeSession(options: SmartCubeSessionOptions) {
  let subscription: Subscription | null = null;
  let connectionGeneration = 0;
  let state: SmartCubeSessionState = {
    status: 'disconnected', connection: null, lastEvent: null, error: null,
    profile: resolveProfile({}, bundledProfiles),
  };
  const listeners = new Set<(next: SmartCubeSessionState) => void>();
  const eventListeners = new Set<(event: SmartCubeSessionEvent) => void>();
  // This calibration and detector are deliberately independent of the display
  // gyro/magnet pipeline. They only derive optional virtual regrip events.
  const regripGyro = GyroOrientation.make();
  const regripDetector = RegripDetector.make();

  const publish = (): void => listeners.forEach(listener => listener(state));
  const setState = (next: Partial<SmartCubeSessionState>): void => {
    state = { ...state, ...next };
    publish();
  };
  const sameProfile = (left: ResolvedProfile, right: ResolvedProfile): boolean =>
    left.id === right.id && JSON.stringify(left.value) === JSON.stringify(right.value);

  const onEvent = (event: SmartCubeEvent): void => {
    const regrip = event.type === 'GYRO' && options.virtualRegrips
      ? RegripDetector.observe(regripDetector, GyroOrientation.relative(regripGyro, event.quaternion))
      : undefined;
    setState({ lastEvent: event });
    if (event.type === 'HARDWARE' && state.connection) {
      const profile = resolveProfile({
        protocol: state.connection.protocol.id,
        deviceName: state.connection.deviceName,
        deviceMAC: state.connection.deviceMAC,
        hardwareName: event.hardwareName,
        goCubeType: event.goCubeType?.name,
      }, bundledProfiles);
      if (!sameProfile(state.profile, profile)) setState({ profile });
    }
    eventListeners.forEach(listener => listener(event));
    if (regrip) {
      eventListeners.forEach(listener => listener({
        type: 'REGRIP', timestamp: event.timestamp,
        notationToken: regrip.notationToken,
        sensorFrameToken: regrip.sensorFrameToken,
      }));
    }
    if (event.type === 'DISCONNECT') void disconnect();
  };

  const resetVirtualRegrips = (): void => {
    GyroOrientation.resetBasis(regripGyro);
    RegripDetector.reset(regripDetector);
  };

  async function connect(): Promise<void> {
    if (state.status === 'connecting' || state.connection) return;
    const generation = ++connectionGeneration;
    setState({ status: 'connecting', error: null });
    resetVirtualRegrips();
    let connection: SmartCubeConnection | null = null;
    try {
      connection = await options.connect();
      setState({ connection, profile: resolveProfile({
        protocol: connection.protocol.id,
        deviceName: connection.deviceName,
        deviceMAC: connection.deviceMAC,
      }, bundledProfiles) });
      subscription = connection.events$.subscribe(onEvent);
      await requestInitialState(connection);
      // A device can send DISCONNECT while initial commands are in flight.
      // Never let that earlier attempt restore a dead connection afterwards.
      if (generation !== connectionGeneration || state.connection !== connection) return;
      setState({ status: 'connected', connection });
    } catch (error) {
      if (generation !== connectionGeneration) return;
      subscription?.unsubscribe();
      subscription = null;
      await disconnectConnection(connection);
      setState({ status: 'error', connection: null, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function disconnect(): Promise<void> {
    connectionGeneration += 1;
    subscription?.unsubscribe();
    subscription = null;
    const connection = state.connection;
    resetVirtualRegrips();
    setState({ status: 'disconnected', connection: null });
    await disconnectConnection(connection);
  }

  return {
    getState: (): SmartCubeSessionState => state,
    subscribe(listener: (next: SmartCubeSessionState) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Events remain owned by the session; consumers only observe them here. */
    subscribeEvents(listener: (event: SmartCubeSessionEvent) => void): () => void {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    connect,
    disconnect,
    resetVirtualRegrips,
  };
}
