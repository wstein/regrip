import type { Subscription } from 'rxjs';
import type {
  SmartCubeCommand,
  SmartCubeConnection,
  SmartCubeEvent,
  SmartCubeVendorCommand,
} from 'smartcube-web-bluetooth';

import * as GyroOrientation from '../domain/GyroOrientation.res.mjs';
import * as MoveBackTrigger from '../domain/MoveBackTrigger.res.mjs';
import * as RegripDetector from '../domain/RegripDetector.res.mjs';
import { disconnectConnection, requestInitialState } from './connection';
import {
  resolveSessionFeatures,
  type SessionFeatures,
  type SessionFeaturesPatch,
} from './features';
import { bundledProfiles } from './profile/bundled';
import { resolveProfile } from './profile/resolveProfile';
import type { ProfileOverrides, ResolvedProfile } from './profile/types';

export type VirtualRegripEvent = {
  type: 'REGRIP';
  timestamp: number;
  /** Clockwise Singmaster x/y/z notation. */
  notationToken: string;
  /** The corresponding positive/negative calibrated sensor axis. */
  sensorFrameToken: string;
};

export type CustomTriggerEvent = {
  type: 'CUSTOM_TRIGGER';
  timestamp: number;
  /** The initiating quarter-turn, e.g. `R` for `R R'`. */
  move: string;
};

export type SessionGyroEvent = Extract<SmartCubeEvent, { type: 'GYRO' }> & {
  /** One session-owned, basis-normalized pose for every gyro consumer. */
  relative: { x: number; y: number; z: number; w: number };
};

export type SmartCubeSessionEvent =
  | Exclude<SmartCubeEvent, { type: 'GYRO' }>
  | SessionGyroEvent
  | VirtualRegripEvent
  | CustomTriggerEvent;

export type SmartCubeSessionState = {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connection: SmartCubeConnection | null;
  lastEvent: SmartCubeSessionEvent | null;
  profile: ResolvedProfile;
  /** Fully resolved feature configuration for the selected device profile. */
  features: SessionFeatures;
  error: string | null;
};

export type SmartCubeSessionOptions = {
  connect: () => Promise<SmartCubeConnection>;
  /**
   * @deprecated Use `features.regrip.enabled`. This compatibility option will
   * be removed after downstream callers migrate to the profile feature model.
   */
  virtualRegrips?: boolean;
  /** App-layer feature overrides, applied after the selected device profile. */
  features?: SessionFeaturesPatch;
};

export function createSmartCubeSession(options: SmartCubeSessionOptions) {
  let subscription: Subscription | null = null;
  let connectionGeneration = 0;
  if (options.virtualRegrips !== undefined) {
    console.warn(
      'virtualRegrips is deprecated; use features: { regrip: { enabled: ... } } instead.',
    );
  }
  // Preserve the former explicit option while keeping the resulting value in
  // the normal app profile layer. An explicit new feature value takes priority.
  const featurePatch: SessionFeaturesPatch | undefined =
    options.features?.regrip?.enabled === undefined && options.virtualRegrips !== undefined
      ? {
          ...options.features,
          regrip: { ...options.features?.regrip, enabled: options.virtualRegrips },
        }
      : options.features;
  const profileOverrides: ProfileOverrides = featurePatch
    ? { app: { features: featurePatch } }
    : {};
  const resolveSessionProfile = (context: Parameters<typeof resolveProfile>[0]): ResolvedProfile =>
    resolveProfile(context, bundledProfiles, profileOverrides);
  const initialProfile = resolveSessionProfile({});
  let state: SmartCubeSessionState = {
    status: 'disconnected',
    connection: null,
    lastEvent: null,
    error: null,
    profile: initialProfile,
    features: resolveSessionFeatures(initialProfile.value.features),
  };
  const listeners = new Set<(next: SmartCubeSessionState) => void>();
  const eventListeners = new Set<(event: SmartCubeSessionEvent) => void>();
  // The session owns calibration once; both regrip detection and display
  // stabilization consume the resulting calibrated pose.
  const gyro = GyroOrientation.make();
  const regripDetector = RegripDetector.make();
  const moveBackTrigger = MoveBackTrigger.make();

  const publish = (): void => listeners.forEach((listener) => listener(state));
  const setState = (next: Partial<SmartCubeSessionState>): void => {
    state = { ...state, ...next };
    publish();
  };
  const sameProfile = (left: ResolvedProfile, right: ResolvedProfile): boolean =>
    left.id === right.id && JSON.stringify(left.value) === JSON.stringify(right.value);

  const onEvent = (event: SmartCubeEvent): void => {
    const sessionEvent: SmartCubeSessionEvent =
      event.type === 'GYRO'
        ? { ...event, relative: GyroOrientation.relative(gyro, event.quaternion) }
        : event;
    const calibrated = sessionEvent.type === 'GYRO' ? sessionEvent.relative : undefined;
    const regrip =
      calibrated && state.features.regrip.enabled
        ? RegripDetector.observe(regripDetector, calibrated)
        : undefined;
    const customTrigger =
      event.type === 'MOVE'
        ? MoveBackTrigger.observe(moveBackTrigger, event.move, event.timestamp)
        : undefined;
    setState({ lastEvent: sessionEvent });
    if (event.type === 'HARDWARE' && state.connection) {
      const profile = resolveSessionProfile({
        protocol: state.connection.protocol.id,
        deviceName: state.connection.deviceName,
        deviceMAC: state.connection.deviceMAC,
        hardwareName: event.hardwareName,
        goCubeType: event.goCubeType?.name,
      });
      if (!sameProfile(state.profile, profile)) {
        setState({ profile, features: resolveSessionFeatures(profile.value.features) });
      }
    }
    eventListeners.forEach((listener) => listener(sessionEvent));
    if (regrip) {
      eventListeners.forEach((listener) =>
        listener({
          type: 'REGRIP',
          timestamp: event.timestamp,
          notationToken: regrip.notationToken,
          sensorFrameToken: regrip.sensorFrameToken,
        }),
      );
    }
    if (customTrigger) {
      eventListeners.forEach((listener) =>
        listener({
          type: 'CUSTOM_TRIGGER',
          timestamp: event.timestamp,
          move: customTrigger,
        }),
      );
    }
    if (event.type === 'DISCONNECT') void disconnect();
  };

  const resetGyro = (): void => {
    GyroOrientation.resetBasis(gyro);
    RegripDetector.reset(regripDetector);
    MoveBackTrigger.reset(moveBackTrigger);
  };

  async function connect(): Promise<void> {
    if (state.status === 'connecting' || state.connection) return;
    const generation = ++connectionGeneration;
    setState({ status: 'connecting', error: null });
    resetGyro();
    let connection: SmartCubeConnection | null = null;
    try {
      connection = await options.connect();
      const profile = resolveSessionProfile({
        protocol: connection.protocol.id,
        deviceName: connection.deviceName,
        deviceMAC: connection.deviceMAC,
      });
      setState({
        connection,
        profile,
        features: resolveSessionFeatures(profile.value.features),
      });
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
      setState({
        status: 'error',
        connection: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function disconnect(): Promise<void> {
    connectionGeneration += 1;
    subscription?.unsubscribe();
    subscription = null;
    const connection = state.connection;
    resetGyro();
    setState({ status: 'disconnected', connection: null });
    await disconnectConnection(connection);
  }

  async function sendCommand(command: SmartCubeCommand): Promise<void> {
    const connection = state.connection;
    if (!connection) throw new Error('Cube is not connected');
    await connection.sendCommand(command);
  }

  async function sendVendorCommand(command: SmartCubeVendorCommand): Promise<void> {
    const connection = state.connection;
    if (!connection) throw new Error('Cube is not connected');
    if (
      !connection.sendVendorCommand ||
      !connection.capabilities.vendorCommands?.includes(command.type)
    ) {
      throw new Error(`Unsupported cube command: ${command.type}`);
    }
    await connection.sendVendorCommand(command);
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
    resetGyro,
    sendCommand,
    sendVendorCommand,
  };
}
