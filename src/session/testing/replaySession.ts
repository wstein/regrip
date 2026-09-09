import type {
  SmartCubeCommand,
  SmartCubeConnection,
  SmartCubeEvent,
  SmartCubeVendorCommand,
} from 'smartcube-web-bluetooth';

import * as ReplayCursor from '../../domain/ReplayCursor.res.mjs';
import { resolveSessionFeatures } from '../features';
import { bundledProfiles } from '../profile/bundled';
import { resolveProfile } from '../profile/resolveProfile';
import {
  createSmartCubeSession,
  type SmartCubeSession,
  type SmartCubeSessionEvent,
  type SmartCubeSessionState,
} from '../smartCubeSession';
import {
  createJsonlMockConnection,
  type JsonlMockIdentity,
  validateJsonlReplay,
} from './jsonlMock';

export type ReplayFeed = 'connection' | 'session';
/** Browser-local storage used only by the dev replay harness. */
export const REPLAY_STORAGE_KEY = 'regrip.replay.jsonl';

type ReplayItem = {
  timestamp: number;
  event?: SmartCubeSessionEvent;
  status?: SmartCubeSessionState['status'];
};

type ReplayListener = () => void;

const synchronousGyroScheduler = {
  schedule(flush: () => void): undefined {
    flush();
    return undefined;
  },
  cancel(): void {},
};

function isSmartCubeEvent(value: unknown): value is SmartCubeEvent {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

function recordedTimestamp(entry: { recordedAt: string }, fallback: number): number {
  const timestamp = Date.parse(entry.recordedAt);
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function parseReplayItems(contents: string, feed: ReplayFeed): ReplayItem[] {
  const { entries } = validateJsonlReplay(contents);
  const items: ReplayItem[] = [];
  entries.forEach((entry, index) => {
    const data = entry.data as Record<string, unknown>;
    const fallbackTimestamp = recordedTimestamp(entry, index);
    if (feed === 'connection') {
      if (entry.type === 'cube_event' && isSmartCubeEvent(data)) {
        items.push({
          timestamp: data.timestamp ?? fallbackTimestamp,
          event: data as SmartCubeSessionEvent,
        });
      }
      return;
    }
    if (entry.type === 'cube_event' && data.type !== 'GYRO' && isSmartCubeEvent(data)) {
      items.push({
        timestamp: data.timestamp ?? fallbackTimestamp,
        event: data as SmartCubeSessionEvent,
      });
    } else if (entry.type === 'gyro_stabilizer') {
      items.push({
        timestamp: typeof data.timestamp === 'number' ? data.timestamp : fallbackTimestamp,
        event: {
          type: 'GYRO',
          timestamp: typeof data.timestamp === 'number' ? data.timestamp : fallbackTimestamp,
          quaternion: data.quaternion as SmartCubeEvent extends infer _ ? never : never,
          velocity: (data.velocity ?? undefined) as never,
          relative: data.relative as never,
          stabilized: data.stabilized as never,
          velocityMagnitude: Number(data.velocityMagnitude ?? 0),
          dtSeconds: Number(data.dtSeconds ?? 0),
        } as SmartCubeSessionEvent,
      });
    } else if (entry.type === 'virtual_regrip') {
      items.push({
        timestamp: typeof data.timestamp === 'number' ? data.timestamp : fallbackTimestamp,
        event: {
          type: 'REGRIP',
          timestamp: Number(data.timestamp ?? fallbackTimestamp),
          notationToken: data.notationToken as never,
          sensorFrameToken: data.sensorFrameToken as never,
        },
      });
    } else if (entry.type === 'custom_trigger') {
      items.push({
        timestamp: typeof data.timestamp === 'number' ? data.timestamp : fallbackTimestamp,
        event: {
          type: 'CUSTOM_TRIGGER',
          timestamp: Number(data.timestamp ?? fallbackTimestamp),
          move: String(data.move),
        },
      });
    } else if (entry.type === 'session_status' && typeof data.status === 'string') {
      const status = data.status;
      if (
        status === 'disconnected' ||
        status === 'connecting' ||
        status === 'connected' ||
        status === 'error'
      ) {
        items.push({ timestamp: fallbackTimestamp, status });
      }
    }
  });
  return items.sort((left, right) => left.timestamp - right.timestamp);
}

function createOutputSession(connection: SmartCubeConnection): SmartCubeSession {
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
  const stateListeners = new Set<(state: SmartCubeSessionState) => void>();
  const eventListeners = new Set<(event: SmartCubeSessionEvent) => void>();
  const setState = (patch: Partial<SmartCubeSessionState>): void => {
    state = { ...state, ...patch };
    stateListeners.forEach((listener) => listener(state));
  };
  const emit = (event: SmartCubeSessionEvent): void => {
    setState({ lastEvent: event });
    eventListeners.forEach((listener) => listener(event));
  };

  return {
    getState: () => state,
    subscribe(listener) {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    subscribeEvents(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    on(type, listener) {
      return this.subscribeEvents((event) => {
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
  } as SmartCubeSession;
}

/**
 * Deterministic JSONL transport. Connection feed exercises the full session;
 * session feed pins recorded derived events for UI/adapters-only inspection.
 */
export type ReplaySessionController = ReturnType<typeof createReplaySession>;

export function createReplaySession(contents: string, feed: ReplayFeed = 'connection') {
  const items = parseReplayItems(contents, feed);
  const timestamps = items.map((item) => item.timestamp);
  let cursor = ReplayCursor.initial;
  let mock = createJsonlMockConnection(contents);
  let current!: SmartCubeSession;
  let unsubscribeState: (() => void) | undefined;
  let unsubscribeEvents: (() => void) | undefined;
  const stateListeners = new Set<(state: SmartCubeSessionState) => void>();
  const eventListeners = new Set<(event: SmartCubeSessionEvent) => void>();
  const cursorListeners = new Set<ReplayListener>();

  const notifyCursor = (): void => cursorListeners.forEach((listener) => listener());
  const bind = (): void => {
    unsubscribeState?.();
    unsubscribeEvents?.();
    unsubscribeState = current.subscribe((state) =>
      stateListeners.forEach((listener) => listener(state)),
    );
    unsubscribeEvents = current.subscribeEvents((event) =>
      eventListeners.forEach((listener) => listener(event)),
    );
  };
  const rebuild = (): void => {
    mock = createJsonlMockConnection(contents);
    current =
      feed === 'connection'
        ? createSmartCubeSession({
            connect: async () => mock.connection,
            gyroFrameScheduler: synchronousGyroScheduler,
          })
        : createOutputSession(mock.connection);
    bind();
  };
  rebuild();

  const emit = (index: number): void => {
    const item = items[index];
    if (!item) return;
    if (feed === 'connection' && item.event) mock.emit(item.event as SmartCubeEvent);
    if (feed === 'session') {
      const output = current as SmartCubeSession & {
        emit?: (event: SmartCubeSessionEvent) => void;
        setReplayStatus?: (status: SmartCubeSessionState['status']) => void;
      };
      if (item.event) output.emit?.(item.event);
      if (item.status) output.setReplayStatus?.(item.status);
    }
  };
  const ensureConnected = async (): Promise<void> => {
    if (!current.getState().connection) await current.connect();
  };
  const run = async (indices: readonly number[]): Promise<void> => {
    await ensureConnected();
    indices.forEach(emit);
    notifyCursor();
  };

  return {
    session: {
      getState: () => current.getState(),
      subscribe(listener: (state: SmartCubeSessionState) => void) {
        stateListeners.add(listener);
        return () => stateListeners.delete(listener);
      },
      subscribeEvents(listener: (event: SmartCubeSessionEvent) => void) {
        eventListeners.add(listener);
        return () => eventListeners.delete(listener);
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
    } as SmartCubeSession,
    get feed(): ReplayFeed {
      return feed;
    },
    get identity(): JsonlMockIdentity {
      return mock.identity;
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
      cursorListeners.add(listener);
      return () => cursorListeners.delete(listener);
    },
    async stepOne(): Promise<void> {
      const [next, index] = ReplayCursor.stepOne(cursor, timestamps);
      cursor = next;
      await run(index === undefined ? [] : [index]);
    },
    async advanceTo(targetMs: number): Promise<void> {
      const [next, indices] = ReplayCursor.advanceTo(cursor, timestamps, targetMs);
      cursor = next;
      await run(indices);
    },
    async seekTo(index: number): Promise<void> {
      rebuild();
      cursor = ReplayCursor.initial;
      const target = Math.max(0, Math.min(index, items.length));
      const prefix = Array.from({ length: target }, (_, itemIndex) => itemIndex);
      cursor = ReplayCursor.seekTo(timestamps, target);
      await run(prefix);
    },
    async seekToTimestamp(timestamp: number): Promise<void> {
      const index = timestamps.findIndex((candidate) => candidate >= timestamp);
      await this.seekTo(index === -1 ? items.length : index + 1);
    },
    async reset(): Promise<void> {
      await this.seekTo(0);
    },
  };
}
