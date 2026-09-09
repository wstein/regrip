import type {
  SmartCubeCommand,
  SmartCubeConnection,
  SmartCubeEvent,
  SmartCubeVendorCommand,
} from 'smartcube-web-bluetooth';

import * as ReplayCursor from '@wstein/regrip-core/domain/ReplayCursor.res.mjs';
import type { RegripToken } from '../../domain/CubeNotation.res.mjs';
import { resolveSessionFeatures } from '../features';
import { bundledProfiles } from '../profile/bundled';
import { resolveProfile } from '../profile/resolveProfile';
import {
  createSmartCubeSession,
  type CustomTriggerEvent,
  type SessionGyroEvent,
  type SmartCubeSession,
  type SmartCubeSessionEvent,
  type SmartCubeSessionState,
  type VirtualRegripEvent,
} from '../smartCubeSession';
import {
  createJsonlReplay,
  createJsonlMockConnection,
  isSmartCubeEvent,
  type JsonlMockIdentity,
  type JsonlReplay,
} from './jsonlMock';

export type ReplayFeed = 'connection' | 'session';
/** Browser-local storage used only by the dev replay harness. */
export const REPLAY_STORAGE_KEY = 'regrip.replay.jsonl';

type ReplayItem = {
  timestamp: number;
  event?: SmartCubeEvent | SmartCubeSessionEvent;
  status?: SmartCubeSessionState['status'];
};
type ReplayItemPayload = Omit<ReplayItem, 'timestamp'>;
type BuiltReplayItem = { payload: ReplayItemPayload; sourceTimestamp?: number };
type ReplayItemBuilder = (
  data: Record<string, unknown>,
  fallbackTimestamp: number,
) => BuiltReplayItem | undefined;

type ReplayListener = () => void;
type RawGyroEvent = Extract<SmartCubeEvent, { type: 'GYRO' }>;
type Quaternion = RawGyroEvent['quaternion'];
type Vector3 = NonNullable<RawGyroEvent['velocity']>;
type ReplayOutputSession = SmartCubeSession & {
  /** Replay-only injection seam; never exposed from a production session. */
  emit(event: SmartCubeSessionEvent): void;
  setReplayStatus(status: SmartCubeSessionState['status']): void;
};

const regripTokens = new Set<RegripToken>(['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2']);

const synchronousGyroScheduler = {
  schedule(flush: () => void): void {
    flush();
  },
  cancel(): void {},
};

function createFanout<T>() {
  const listeners = new Set<(value: T) => void>();
  return {
    emit(value: T): void {
      listeners.forEach((listener) => listener(value));
    },
    subscribe(listener: (value: T) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function isRawSessionEvent(
  value: unknown,
): value is Exclude<SmartCubeSessionEvent, { type: 'GYRO' }> {
  return isSmartCubeEvent(value) && value.type !== 'GYRO';
}

function isSmartCubeSessionEvent(
  value: SmartCubeEvent | SmartCubeSessionEvent,
): value is SmartCubeSessionEvent {
  return (
    value.type !== 'GYRO' ||
    ('relative' in value &&
      'stabilized' in value &&
      'velocityMagnitude' in value &&
      'dtSeconds' in value)
  );
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function quaternion(value: unknown): Quaternion | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.x !== 'number' ||
    typeof candidate.y !== 'number' ||
    typeof candidate.z !== 'number' ||
    typeof candidate.w !== 'number'
  ) {
    return undefined;
  }
  return { x: candidate.x, y: candidate.y, z: candidate.z, w: candidate.w };
}

function vector3(value: unknown): Vector3 | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  const x = number(candidate.x);
  const y = number(candidate.y);
  const z = number(candidate.z);
  return x === undefined || y === undefined || z === undefined ? undefined : { x, y, z };
}

/**
 * Older app exports only persisted derived gyro samples. They still contain
 * the raw quaternion needed to reconstruct the connection/session pipeline.
 */
function gyroFromStabilizer(
  data: Record<string, unknown>,
  fallbackTimestamp: number,
): RawGyroEvent | undefined {
  const quaternionValue = quaternion(data.quaternion);
  if (!quaternionValue) return undefined;
  const validVelocity = vector3(data.velocity);
  return {
    type: 'GYRO',
    timestamp: number(data.timestamp) ?? fallbackTimestamp,
    quaternion: quaternionValue,
    ...(validVelocity ? { velocity: validVelocity } : {}),
  };
}

function sessionGyroFromRecord(
  data: Record<string, unknown>,
  fallbackTimestamp: number,
): SessionGyroEvent | undefined {
  const timestamp = number(data.timestamp) ?? fallbackTimestamp;
  const quaternionValue = quaternion(data.quaternion);
  const relative = quaternion(data.relative);
  const stabilized = quaternion(data.stabilized);
  const velocityMagnitude = number(data.velocityMagnitude);
  const dtSeconds = number(data.dtSeconds);
  if (
    !quaternionValue ||
    !relative ||
    !stabilized ||
    velocityMagnitude === undefined ||
    dtSeconds === undefined
  ) {
    return undefined;
  }
  const velocity = vector3(data.velocity);
  return {
    type: 'GYRO',
    timestamp,
    quaternion: quaternionValue,
    ...(velocity ? { velocity } : {}),
    relative,
    stabilized,
    velocityMagnitude,
    dtSeconds,
  };
}

function regripFromRecord(
  data: Record<string, unknown>,
  fallbackTimestamp: number,
): VirtualRegripEvent | undefined {
  const timestamp = number(data.timestamp) ?? fallbackTimestamp;
  const notationToken = data.notationToken;
  const sensorFrameToken = data.sensorFrameToken;
  if (
    typeof notationToken !== 'string' ||
    !regripTokens.has(notationToken as RegripToken) ||
    typeof sensorFrameToken !== 'string' ||
    !regripTokens.has(sensorFrameToken as RegripToken)
  ) {
    return undefined;
  }
  return {
    type: 'REGRIP',
    timestamp,
    notationToken: notationToken as RegripToken,
    sensorFrameToken: sensorFrameToken as RegripToken,
  };
}

function customTriggerFromRecord(
  data: Record<string, unknown>,
  fallbackTimestamp: number,
): CustomTriggerEvent | undefined {
  const timestamp = number(data.timestamp) ?? fallbackTimestamp;
  return typeof data.move === 'string' && data.move.length > 0
    ? { type: 'CUSTOM_TRIGGER', timestamp, move: data.move }
    : undefined;
}

function statusFromRecord(
  data: Record<string, unknown>,
): SmartCubeSessionState['status'] | undefined {
  const status = data.status;
  return status === 'disconnected' ||
    status === 'connecting' ||
    status === 'connected' ||
    status === 'error'
    ? status
    : undefined;
}

function connectionBuilders(hasRawGyro: boolean): Record<string, ReplayItemBuilder> {
  return {
    cube_event: (data) =>
      isSmartCubeEvent(data)
        ? { payload: { event: data }, sourceTimestamp: data.timestamp }
        : undefined,
    gyro_stabilizer: (data, fallbackTimestamp) => {
      if (hasRawGyro) return undefined;
      const event = gyroFromStabilizer(data, fallbackTimestamp);
      return event ? { payload: { event }, sourceTimestamp: event.timestamp } : undefined;
    },
  };
}

const sessionBuilders: Record<string, ReplayItemBuilder> = {
  cube_event: (data) =>
    isRawSessionEvent(data)
      ? { payload: { event: data }, sourceTimestamp: data.timestamp }
      : undefined,
  gyro_stabilizer: (data, fallbackTimestamp) => {
    const event = sessionGyroFromRecord(data, fallbackTimestamp);
    return event ? { payload: { event }, sourceTimestamp: event.timestamp } : undefined;
  },
  virtual_regrip: (data, fallbackTimestamp) => {
    const event = regripFromRecord(data, fallbackTimestamp);
    return event ? { payload: { event }, sourceTimestamp: event.timestamp } : undefined;
  },
  custom_trigger: (data, fallbackTimestamp) => {
    const event = customTriggerFromRecord(data, fallbackTimestamp);
    return event ? { payload: { event }, sourceTimestamp: event.timestamp } : undefined;
  },
  session_status: (data) => {
    const status = statusFromRecord(data);
    return status ? { payload: { status } } : undefined;
  },
};

function parseReplayItems(entries: JsonlReplay['entries'], feed: ReplayFeed): ReplayItem[] {
  const items: ReplayItem[] = [];
  let firstRecordedAt: number | undefined;
  let firstTimelineTimestamp: number | undefined;
  let previousTimelineTimestamp = 0;
  const hasRawGyro = entries.some(
    (entry) => entry.type === 'cube_event' && entry.data.type === 'GYRO',
  );
  const builders = feed === 'connection' ? connectionBuilders(hasRawGyro) : sessionBuilders;
  const add = (
    entry: (typeof entries)[number],
    index: number,
    value: ReplayItemPayload,
    sourceTimestamp?: number,
  ): void => {
    const recordedAt = Date.parse(entry.recordedAt);
    if (firstRecordedAt === undefined && Number.isFinite(recordedAt)) firstRecordedAt = recordedAt;
    if (firstTimelineTimestamp === undefined) firstTimelineTimestamp = sourceTimestamp ?? index;
    const elapsed =
      firstRecordedAt === undefined || !Number.isFinite(recordedAt)
        ? index
        : recordedAt - firstRecordedAt;
    const timestamp = Math.max(
      previousTimelineTimestamp,
      firstTimelineTimestamp + Math.max(0, elapsed),
    );
    previousTimelineTimestamp = timestamp;
    items.push({ ...value, timestamp });
  };
  entries.forEach((entry, index) => {
    const built = builders[entry.type]?.(entry.data, index);
    if (built) add(entry, index, built.payload, built.sourceTimestamp);
  });
  return items;
}

function createOutputSession(connection: SmartCubeConnection): ReplayOutputSession {
  // A2 bypasses the production connection lifecycle, but must still present
  // the same profile selected by the capture identity to the UI.
  const profile = resolveProfile(
    {
      protocol: connection.protocol.id,
      deviceName: connection.deviceName,
      deviceMAC: connection.deviceMAC,
    },
    bundledProfiles,
  );
  let state: SmartCubeSessionState = {
    status: 'disconnected',
    connection: null,
    lastEvent: null,
    profile,
    features: resolveSessionFeatures(profile.value.features),
    error: null,
  };
  const states = createFanout<SmartCubeSessionState>();
  const events = createFanout<SmartCubeSessionEvent>();
  const setState = (patch: Partial<SmartCubeSessionState>): void => {
    state = { ...state, ...patch };
    states.emit(state);
  };
  const emit = (event: SmartCubeSessionEvent): void => {
    setState({ lastEvent: event });
    events.emit(event);
  };

  const subscribeEvents: SmartCubeSession['subscribeEvents'] = (listener) => {
    return events.subscribe(listener);
  };
  const output: ReplayOutputSession = {
    getState: () => state,
    subscribe(listener) {
      return states.subscribe(listener);
    },
    subscribeEvents,
    on(type, listener) {
      return subscribeEvents((event) => {
        if (event.type === type) listener(event as never);
      });
    },
    async connect() {
      setState({ status: 'connecting', error: null });
      setState({ status: 'connected', connection });
    },
    async disconnect() {
      setState({ status: 'disconnected', connection: null });
    },
    resetGyro() {},
    configureFeatures() {},
    async sendCommand(command: SmartCubeCommand) {
      await connection.sendCommand(command);
    },
    async sendVendorCommand(command: SmartCubeVendorCommand) {
      if (!connection.sendVendorCommand)
        throw new Error(`Unsupported cube command: ${command.type}`);
      await connection.sendVendorCommand(command);
    },
    // Testing-only seam used by the replay facade; production sessions never expose it.
    emit,
    setReplayStatus(status: SmartCubeSessionState['status']) {
      setState({ status, connection: status === 'connected' ? connection : null });
    },
  };
  return output;
}

/**
 * Deterministic JSONL transport. Connection feed exercises the full session;
 * session feed pins recorded derived events for UI/adapters-only inspection.
 */
export type ReplaySessionController = ReturnType<typeof createReplaySession>;

export function createReplaySession(contents: string, feed: ReplayFeed = 'connection') {
  const replayData = createJsonlReplay(contents);
  const items = parseReplayItems(replayData.entries, feed);
  const timestamps = items.map((item) => item.timestamp);
  let cursor = ReplayCursor.seekTo(timestamps, 0);
  let mock!: ReturnType<typeof createJsonlMockConnection>;
  let current!: SmartCubeSession;
  let output: ReplayOutputSession | undefined;
  let unsubscribeState: (() => void) | undefined;
  let unsubscribeEvents: (() => void) | undefined;
  let transportGeneration = 0;
  let transport = Promise.resolve();
  const states = createFanout<SmartCubeSessionState>();
  const events = createFanout<SmartCubeSessionEvent>();
  const cursors = createFanout<void>();
  const rebuilds = createFanout<void>();

  const notifyCursor = (): void => cursors.emit();
  const notifyRebuild = (): void => rebuilds.emit();
  const enqueue = <T>(operation: (generation: number) => Promise<T>): Promise<T> => {
    const generation = ++transportGeneration;
    const task = transport.then(
      () => operation(generation),
      () => operation(generation),
    );
    transport = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };
  const isCurrent = (generation: number): boolean => generation === transportGeneration;
  const bind = (): void => {
    unsubscribeState?.();
    unsubscribeEvents?.();
    unsubscribeState = current.subscribe(states.emit);
    unsubscribeEvents = current.subscribeEvents(events.emit);
  };
  const rebuild = (notify = false): void => {
    if (notify) notifyRebuild();
    mock = createJsonlMockConnection(replayData);
    if (feed === 'connection') {
      output = undefined;
      current = createSmartCubeSession({
        connect: async () => mock.connection,
        gyroFrameScheduler: synchronousGyroScheduler,
      });
    } else {
      output = createOutputSession(mock.connection);
      current = output;
    }
    bind();
  };
  rebuild();

  const emit = (index: number): void => {
    const item = items[index];
    if (!item) return;
    if (feed === 'connection' && item.event && isSmartCubeEvent(item.event)) mock.emit(item.event);
    if (feed === 'session') {
      if (item.event && isSmartCubeSessionEvent(item.event)) output?.emit(item.event);
      if (item.status) output?.setReplayStatus(item.status);
    }
  };
  const ensureConnected = async (): Promise<void> => {
    if (!current.getState().connection) await current.connect();
  };
  const run = async (indices: readonly number[], generation: number): Promise<void> => {
    if (!isCurrent(generation)) return;
    await ensureConnected();
    if (!isCurrent(generation)) return;
    indices.forEach(emit);
    notifyCursor();
  };

  const session: SmartCubeSession = {
    getState: () => current.getState(),
    subscribe(listener: (state: SmartCubeSessionState) => void) {
      return states.subscribe(listener);
    },
    subscribeEvents(listener: (event: SmartCubeSessionEvent) => void) {
      return events.subscribe(listener);
    },
    on(type, listener) {
      return this.subscribeEvents((event) => {
        if (event.type === type) listener(event as never);
      });
    },
    connect: () => current.connect(),
    disconnect: () => current.disconnect(),
    resetGyro: () => current.resetGyro(),
    configureFeatures: (patch: Parameters<SmartCubeSession['configureFeatures']>[0]) =>
      current.configureFeatures(patch),
    sendCommand: (command: SmartCubeCommand) => current.sendCommand(command),
    sendVendorCommand: (command: SmartCubeVendorCommand) => current.sendVendorCommand(command),
  };

  return {
    session,
    get feed(): ReplayFeed {
      return feed;
    },
    get identity(): JsonlMockIdentity {
      return replayData.identity;
    },
    get length(): number {
      return items.length;
    },
    get position(): number {
      return ReplayCursor.position(cursor);
    },
    get virtualNowMs(): number {
      return ReplayCursor.virtualNowMs(cursor);
    },
    get done(): boolean {
      return ReplayCursor.done(cursor, timestamps);
    },
    subscribeCursor(listener: ReplayListener): () => void {
      return cursors.subscribe(listener);
    },
    /** Fires immediately before a backward seek reconstructs the session. */
    subscribeRebuild(listener: ReplayListener): () => void {
      return rebuilds.subscribe(listener);
    },
    async stepOne(): Promise<void> {
      return enqueue(async (generation) => {
        if (!isCurrent(generation)) return;
        const [next, index] = ReplayCursor.stepOne(cursor, timestamps);
        cursor = next;
        await run(index === undefined ? [] : [index], generation);
      });
    },
    async advanceTo(targetMs: number): Promise<void> {
      return enqueue(async (generation) => {
        if (!isCurrent(generation)) return;
        const [next, indices] = ReplayCursor.advanceTo(cursor, timestamps, targetMs);
        cursor = next;
        await run(indices, generation);
      });
    },
    async seekTo(index: number): Promise<void> {
      return enqueue(async (generation) => {
        if (!isCurrent(generation)) return;
        const target = Math.max(0, Math.min(index, items.length));
        const currentPosition = ReplayCursor.position(cursor);
        // Forward seeks can continue the current deterministic session. Only
        // backward seeks need a clean connection/session plus prefix replay.
        if (target >= currentPosition) {
          const forward = Array.from(
            { length: target - currentPosition },
            (_, offset) => currentPosition + offset,
          );
          cursor = ReplayCursor.seekTo(timestamps, target);
          await run(forward, generation);
          return;
        }
        rebuild(true);
        const prefix = Array.from({ length: target }, (_, itemIndex) => itemIndex);
        cursor = ReplayCursor.seekTo(timestamps, target);
        await run(prefix, generation);
      });
    },
    async seekToTimestamp(timestamp: number): Promise<void> {
      const index = timestamps.findIndex((candidate) => candidate > timestamp);
      await this.seekTo(index === -1 ? items.length : index);
    },
    async reset(): Promise<void> {
      await this.seekTo(0);
    },
  };
}
