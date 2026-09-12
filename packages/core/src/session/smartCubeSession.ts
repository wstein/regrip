import type { Subscription } from 'rxjs';
import type {
  SmartCubeCommand,
  SmartCubeDiagnosticEvent,
  SmartCubeEvent,
  SmartCubeTransportConnection,
  SmartCubeVendorCommand,
} from '@wstein/regrip-core/bindings/smartCubeTransport';

import * as GyroPipeline from '@wstein/regrip-core/domain/GyroPipeline';
import * as MoveBackTrigger from '@wstein/regrip-core/domain/MoveBackTrigger';
import * as MoveTracker from '@wstein/regrip-core/domain/MoveTracker';
import * as SnapshotDeduper from '@wstein/regrip-core/domain/SnapshotDeduper';
import * as RegripDetector from '@wstein/regrip-core/domain/RegripDetector';
import * as ShakeTrigger from '@wstein/regrip-core/domain/ShakeTrigger';
import type { regripToken as RegripToken } from '@wstein/regrip-core/domain/CubeNotation';
import {
  disconnectConnection,
  requestInitialState,
} from '@wstein/regrip-core/session/connectionLifecycle';
import {
  resolveSessionFeatures,
  mergeSessionFeatures,
  stabilizerConfig,
  type SessionFeatures,
  type SessionFeaturesPatch,
} from '@wstein/regrip-core/session/features';
import { bundledProfiles } from '@wstein/regrip-core/session/profile/bundled';
import { resolveProfile } from '@wstein/regrip-core/session/profile/resolveProfile';
import { parseSensorToBodyAxisMap } from '@wstein/regrip-core/session/profile/axisMap';
import * as SensorToBody from '@wstein/regrip-core/domain/SensorToBody';
import type { ProfileOverrides, ResolvedProfile } from '@wstein/regrip-core/session/profile/types';

/** A whole-cube rotation inferred from calibrated gyro orientation. */
export type VirtualRegripEvent = {
  type: 'REGRIP';
  timestamp: number;
  /** Clockwise Singmaster x/y/z notation. */
  notationToken: RegripToken;
  /** The corresponding positive/negative calibrated sensor axis. */
  sensorFrameToken: RegripToken;
};

/** A configured move-based gesture recognized by the session. */
export type CustomTriggerEvent = {
  type: 'CUSTOM_TRIGGER';
  timestamp: number;
  /** The initiating quarter-turn, e.g. `R` for `R R'`. */
  move: string;
};

/** A shake gesture recognized from the calibrated gyro stream. */
export type ShakeTriggerEvent = {
  type: 'SHAKE';
  /** Time of the final reversal-bearing gyro sample; emission lags by the guard. */
  timestamp: number;
  steps: number;
  reversals: number;
  spanMs: number;
};

/** A protocol move serial skipped one or more turns; await FACELETS recovery. */
export type MoveGapEvent = {
  type: 'MOVE_GAP';
  timestamp: number;
  previousSerial: number;
  serial: number;
  missing: number;
};

/** Raw gyro data enriched with the session's calibrated orientation. */
export type SessionGyroEvent = Extract<SmartCubeEvent, { type: 'GYRO' }> & {
  /** One session-owned, basis-normalized pose for every gyro consumer. */
  relative: { x: number; y: number; z: number; w: number };
  /** Magnet/drift-adjusted relative pose; equals `relative` when disabled. */
  stabilized: { x: number; y: number; z: number; w: number };
  velocityMagnitude: number;
  dtSeconds: number;
};

/** Union of raw cube events and session-derived events. */
export type SmartCubeSessionEvent =
  | Exclude<SmartCubeEvent, { type: 'GYRO' }>
  | SessionGyroEvent
  | VirtualRegripEvent
  | CustomTriggerEvent
  | ShakeTriggerEvent
  | MoveGapEvent;

type FaceletsEvent = Extract<SmartCubeEvent, { type: 'FACELETS' }>;

type SessionEventType = SmartCubeSessionEvent['type'];
type SessionEventOf<T extends SessionEventType> = Extract<SmartCubeSessionEvent, { type: T }>;

/** Observable state owned by a smart-cube session. */
export type SmartCubeSessionState = {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connection: SmartCubeTransportConnection | null;
  lastEvent: SmartCubeSessionEvent | null;
  profile: ResolvedProfile;
  /** Fully resolved feature configuration for the selected device profile. */
  features: SessionFeatures;
  error: string | null;
};

/** Dependencies and optional host overrides for a smart-cube session. */
export type SmartCubeSessionOptions = {
  connect: () => Promise<SmartCubeTransportConnection>;
  /**
   * Schedules the latest contiguous gyro packet at display cadence. Supplying
   * this is primarily useful for deterministic hosts and tests.
   */
  gyroFrameScheduler?: GyroFrameScheduler;
  /**
   * @deprecated Use `features.regrip.enabled`. This compatibility option will
   * be removed after downstream callers migrate to the profile feature model.
   */
  virtualRegrips?: boolean;
  /** App-layer feature overrides, applied after the selected device profile. */
  features?: SessionFeaturesPatch;
};

/** Host scheduler used to coalesce gyro updates at display cadence. */
export type GyroFrameScheduler = {
  schedule: (flush: () => void) => unknown;
  cancel: (handle: unknown) => void;
};

/** Public controller returned by {@link createSmartCubeSession}. */
export type SmartCubeSession = ReturnType<typeof createSmartCubeSession>;

/**
 * Raw protocol evidence kept outside `SmartCubeSessionEvent`: it must never
 * affect cube state, gyro processing, or feature detectors.
 */
export type SmartCubeSessionDiagnostic = SmartCubeDiagnosticEvent;

const browserGyroFrameScheduler: GyroFrameScheduler =
  typeof requestAnimationFrame === 'function'
    ? {
        schedule: (flush) => requestAnimationFrame(flush),
        cancel: (handle) => cancelAnimationFrame(handle as number),
      }
    : {
        // Keep headless replay synchronous. Browsers use requestAnimationFrame
        // and therefore receive the real 60 Hz coalescing behavior.
        schedule: (flush) => {
          flush();
          return undefined;
        },
        cancel: () => {},
      };

/** Create a connection-safe smart-cube session and derived-event pipeline. */
export function createSmartCubeSession(options: SmartCubeSessionOptions) {
  let subscription: Subscription | null = null;
  let diagnosticSubscription: Subscription | null = null;
  let connectionGeneration = 0;
  const gyroFrameScheduler = options.gyroFrameScheduler ?? browserGyroFrameScheduler;
  let pendingGyro: Extract<SmartCubeEvent, { type: 'GYRO' }> | undefined;
  let pendingGyroFrame: unknown;
  let hasCalibratedGyro = false;
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
  const diagnosticListeners = new Set<(event: SmartCubeSessionDiagnostic) => void>();
  const pendingFaceletSyncs = new Set<(error: Error) => void>();
  // The session owns calibration once; both regrip detection and display
  // stabilization consume the resulting calibrated pose.
  let gyroConfig = GyroPipeline.makeConfig(stabilizerConfig(state.features));
  let gyroState = GyroPipeline.initial;
  let runtimeFeatures: SessionFeatures | undefined;
  const applyProfileAxisMap = (profile: ResolvedProfile): void => {
    gyroConfig = GyroPipeline.withSensorToBody(
      gyroConfig,
      parseSensorToBodyAxisMap(profile.value.gyro?.axisMap) ?? SensorToBody.default,
    );
  };
  let regripState = RegripDetector.initial;
  let moveBackState = MoveBackTrigger.initial;
  let shakeState = ShakeTrigger.initial;
  let moveTrackerState = MoveTracker.initial;
  let snapshotDeduperState = SnapshotDeduper.initial;

  function moveBackWindow(features: SessionFeatures): number | undefined {
    return features.customTrigger.triggers.find((trigger) => trigger.kind === 'moveBack')?.windowMs;
  }

  function shakeConfig(features: SessionFeatures): ShakeTrigger.config | undefined {
    const spec = features.customTrigger.triggers.find((trigger) => trigger.kind === 'shake');
    if (!spec) return undefined;
    const { kind: _kind, ...overrides } = spec;
    return { ...ShakeTrigger.defaults, ...overrides };
  }

  function resetFeatureDetectors(): void {
    regripState = RegripDetector.initial;
    moveBackState = MoveBackTrigger.initial;
    shakeState = ShakeTrigger.initial;
  }

  function resetMoveTracker(): void {
    moveTrackerState = MoveTracker.initial;
  }

  function resetSnapshotDeduper(): void {
    snapshotDeduperState = SnapshotDeduper.initial;
  }

  function requestFaceletsAfterMoveGap(): void {
    const connection = state.connection;
    if (!connection?.capabilities.facelets) return;
    snapshotDeduperState = SnapshotDeduper.request(snapshotDeduperState);
    void connection.sendCommand({ type: 'REQUEST_FACELETS' }).catch((error: unknown) => {
      snapshotDeduperState = SnapshotDeduper.cancel(snapshotDeduperState);
      console.warn('Could not request facelets after a move serial gap.', error);
    });
  }

  function observeMoveBack(move: string, timestamp: number): string | undefined {
    const [nextState, trigger] = MoveBackTrigger.step(moveBackState, move, timestamp, {
      windowMs: moveBackWindow(state.features) ?? 300,
    });
    moveBackState = nextState;
    return trigger;
  }

  function observeShake(
    orientation: { x: number; y: number; z: number; w: number },
    timestamp: number,
    config: ShakeTrigger.config,
  ): ShakeTrigger.detection | undefined {
    const [nextState, detection] = ShakeTrigger.observe(shakeState, timestamp, orientation, config);
    shakeState = nextState;
    return detection;
  }

  function observeShakeMove(timestamp: number, config: ShakeTrigger.config): void {
    shakeState = ShakeTrigger.observeMove(shakeState, timestamp, config);
  }

  function observeRegrip(orientation: { x: number; y: number; z: number; w: number }) {
    const [nextState, observation] = RegripDetector.step(regripState, orientation, {
      thresholdDeg: state.features.regrip.thresholdDeg,
    });
    regripState = nextState;
    return observation;
  }

  function applyFeatures(features: SessionFeatures): void {
    gyroConfig = GyroPipeline.withStabilizerConfig(gyroConfig, stabilizerConfig(features));
    gyroState = GyroPipeline.resetStabilizer(gyroState);
    resetFeatureDetectors();
    setState({ features });
  }

  const publish = (): void => listeners.forEach((listener) => listener(state));
  const setState = (next: Partial<SmartCubeSessionState>): void => {
    state = { ...state, ...next };
    publish();
  };
  const sameProfile = (left: ResolvedProfile, right: ResolvedProfile): boolean =>
    left.id === right.id && JSON.stringify(left.value) === JSON.stringify(right.value);

  const processEvent = (event: SmartCubeEvent): void => {
    const sessionEvent: SmartCubeSessionEvent = (() => {
      if (event.type !== 'GYRO') return event;
      const [nextGyroState, sample] = GyroPipeline.step(
        gyroState,
        event.quaternion,
        event.timestamp,
        event.velocity,
        gyroConfig,
        state.features.stabilizer.enabled,
      );
      gyroState = nextGyroState;
      return { ...event, ...sample };
    })();
    // Gyro packets are already coalesced to display cadence by `scheduleGyro`.
    // Do not filter them again: sub-degree drift corrections are intentional
    // visual motion, while MagneticDetent handles resting sensor noise.
    if (event.type === 'FACELETS') {
      moveTrackerState = MoveTracker.observeSnapshot(moveTrackerState, event.serial);
      const [nextSnapshotDeduperState, shouldPublish] = SnapshotDeduper.observe(
        snapshotDeduperState,
        { serial: event.serial, facelets: event.facelets },
      );
      snapshotDeduperState = nextSnapshotDeduperState;
      if (!shouldPublish) return;
    }
    const [nextMoveTrackerState, moveGap] =
      event.type === 'MOVE'
        ? MoveTracker.observeMove(moveTrackerState, event.serial)
        : [moveTrackerState, undefined];
    moveTrackerState = nextMoveTrackerState;
    const calibrated = sessionEvent.type === 'GYRO' ? sessionEvent.relative : undefined;
    const regrip =
      calibrated && state.features.regrip.enabled ? observeRegrip(calibrated) : undefined;
    const customTrigger =
      event.type === 'MOVE' &&
      state.features.customTrigger.enabled &&
      moveBackWindow(state.features) !== undefined
        ? observeMoveBack(event.move, event.timestamp)
        : undefined;
    const shakeCfg = state.features.customTrigger.enabled ? shakeConfig(state.features) : undefined;
    const shake =
      shakeCfg && calibrated ? observeShake(calibrated, event.timestamp, shakeCfg) : undefined;
    if (shakeCfg && event.type === 'MOVE') observeShakeMove(event.timestamp, shakeCfg);
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
        const features = runtimeFeatures ?? resolveSessionFeatures(profile.value.features);
        applyProfileAxisMap(profile);
        setState({ profile });
        applyFeatures(features);
      }
    }
    if (moveGap) {
      eventListeners.forEach((listener) =>
        listener({
          type: 'MOVE_GAP',
          timestamp: event.timestamp,
          previousSerial: moveGap.previousSerial,
          serial: moveGap.serial,
          missing: moveGap.missing,
        }),
      );
      requestFaceletsAfterMoveGap();
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
    if (shake) {
      eventListeners.forEach((listener) =>
        listener({
          type: 'SHAKE',
          timestamp: shake.at,
          steps: shake.steps,
          reversals: shake.reversals,
          spanMs: shake.spanMs,
        }),
      );
    }
    if (event.type === 'DISCONNECT') void disconnect();
  };

  const flushPendingGyro = (): void => {
    const event = pendingGyro;
    pendingGyro = undefined;
    if (pendingGyroFrame !== undefined) {
      gyroFrameScheduler.cancel(pendingGyroFrame);
      pendingGyroFrame = undefined;
    }
    if (event) processEvent(event);
  };

  const scheduleGyro = (event: Extract<SmartCubeEvent, { type: 'GYRO' }>): void => {
    // The calibration sample establishes an exact identity-relative pose for
    // both the regrip ratchet and render pipeline. Do not drop it in a burst.
    if (!hasCalibratedGyro) {
      hasCalibratedGyro = true;
      processEvent(event);
      return;
    }
    pendingGyro = event;
    if (pendingGyroFrame !== undefined) return;
    const handle = gyroFrameScheduler.schedule(flushPendingGyro);
    // The headless scheduler may flush synchronously. Only retain a handle
    // when a gyro packet is still pending after schedule() returns.
    if (pendingGyro !== undefined && pendingGyroFrame === undefined) pendingGyroFrame = handle;
  };

  const onEvent = (event: SmartCubeEvent): void => {
    if (event.type === 'GYRO') {
      scheduleGyro(event);
      return;
    }
    // Do not let a following MOVE/FACELETS/DISCONNECT overtake the final gyro
    // sample in the preceding BLE packet burst.
    flushPendingGyro();
    processEvent(event);
  };

  const resetGyro = (): void => {
    pendingGyro = undefined;
    if (pendingGyroFrame !== undefined) gyroFrameScheduler.cancel(pendingGyroFrame);
    pendingGyroFrame = undefined;
    hasCalibratedGyro = false;
    gyroState = GyroPipeline.reset(gyroState);
    regripState = RegripDetector.initial;
    moveBackState = MoveBackTrigger.initial;
    shakeState = ShakeTrigger.initial;
    resetMoveTracker();
    resetSnapshotDeduper();
  };

  async function connect(): Promise<void> {
    if (state.status === 'connecting' || state.connection) return;
    const generation = ++connectionGeneration;
    setState({ status: 'connecting', error: null });
    resetGyro();
    let connection: SmartCubeTransportConnection | null = null;
    try {
      connection = await options.connect();
      const profile = resolveSessionProfile({
        protocol: connection.protocol.id,
        deviceName: connection.deviceName,
        deviceMAC: connection.deviceMAC,
      });
      const features = runtimeFeatures ?? resolveSessionFeatures(profile.value.features);
      applyProfileAxisMap(profile);
      applyFeatures(features);
      setState({
        connection,
        profile,
        features,
      });
      subscription = connection.events$.subscribe(onEvent);
      diagnosticSubscription =
        connection.diagnostics$?.subscribe((diagnostic) => {
          // Diagnostics have a deliberately separate channel. Keeping this
          // guard here also prevents late emissions from a replaced transport
          // from reaching a newly connected session.
          if (generation !== connectionGeneration || state.connection !== connection) return;
          diagnosticListeners.forEach((listener) => listener(diagnostic));
        }) ?? null;
      await requestInitialState(connection);
      // A device can send DISCONNECT while initial commands are in flight.
      // Never let that earlier attempt restore a dead connection afterwards.
      if (generation !== connectionGeneration || state.connection !== connection) return;
      setState({ status: 'connected', connection });
    } catch (error) {
      if (generation !== connectionGeneration) return;
      subscription?.unsubscribe();
      subscription = null;
      diagnosticSubscription?.unsubscribe();
      diagnosticSubscription = null;
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
    pendingFaceletSyncs.forEach((reject) =>
      reject(new Error('Cube disconnected before state sync')),
    );
    pendingFaceletSyncs.clear();
    subscription?.unsubscribe();
    subscription = null;
    diagnosticSubscription?.unsubscribe();
    diagnosticSubscription = null;
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

  /** Request an authoritative snapshot and resolve only when it arrives. */
  function syncFacelets(): Promise<FaceletsEvent> {
    const connection = state.connection;
    if (!connection) return Promise.reject(new Error('Cube is not connected'));
    if (!connection.capabilities.facelets)
      return Promise.reject(new Error('Cube does not support facelet snapshots'));

    snapshotDeduperState = SnapshotDeduper.request(snapshotDeduperState);
    return new Promise<FaceletsEvent>((resolve, reject) => {
      let unsubscribe = (): void => {};
      const finish = (result: FaceletsEvent | Error): void => {
        unsubscribe();
        pendingFaceletSyncs.delete(rejectSync);
        if (result instanceof Error) reject(result);
        else resolve(result);
      };
      const rejectSync = (error: Error): void => finish(error);
      pendingFaceletSyncs.add(rejectSync);
      const listener = (event: SmartCubeSessionEvent): void => {
        if (event.type === 'FACELETS') finish(event);
        else if (event.type === 'DISCONNECT')
          finish(new Error('Cube disconnected before state sync'));
      };
      eventListeners.add(listener);
      unsubscribe = () => eventListeners.delete(listener);
      void connection.sendCommand({ type: 'REQUEST_FACELETS' }).catch((error: unknown) => {
        snapshotDeduperState = SnapshotDeduper.cancel(snapshotDeduperState);
        finish(error instanceof Error ? error : new Error(String(error)));
      });
    });
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
    /**
     * Observe raw transport diagnostics without admitting them to the typed
     * cube-state stream. A transport may omit this capability entirely.
     */
    subscribeDiagnostics(listener: (event: SmartCubeSessionDiagnostic) => void): () => void {
      diagnosticListeners.add(listener);
      return () => diagnosticListeners.delete(listener);
    },
    /** Observe one event type without creating a parallel event channel. */
    on<T extends SessionEventType>(
      type: T,
      listener: (event: SessionEventOf<T>) => void,
    ): () => void {
      return this.subscribeEvents((event) => {
        if (event.type === type) listener(event as SessionEventOf<T>);
      });
    },
    connect,
    disconnect,
    resetGyro,
    /** Apply a runtime feature patch and reset any detector state it affects. */
    configureFeatures(patch: SessionFeaturesPatch): void {
      runtimeFeatures = mergeSessionFeatures(state.features, patch);
      applyFeatures(runtimeFeatures);
    },
    sendCommand,
    syncFacelets,
    sendVendorCommand,
  };
}
