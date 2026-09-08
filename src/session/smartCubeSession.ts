import type { Subscription } from 'rxjs';
import type { SmartCubeConnection, SmartCubeEvent } from 'smartcube-web-bluetooth';

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

export type SmartCubeSessionOptions = {
  connect: () => Promise<SmartCubeConnection>;
};

export function createSmartCubeSession(options: SmartCubeSessionOptions) {
  let subscription: Subscription | null = null;
  let state: SmartCubeSessionState = {
    status: 'disconnected', connection: null, lastEvent: null, error: null,
    profile: resolveProfile({}, bundledProfiles),
  };
  const listeners = new Set<(next: SmartCubeSessionState) => void>();
  const eventListeners = new Set<(event: SmartCubeEvent) => void>();

  const publish = (): void => listeners.forEach(listener => listener(state));
  const setState = (next: Partial<SmartCubeSessionState>): void => {
    state = { ...state, ...next };
    publish();
  };

  const onEvent = (event: SmartCubeEvent): void => {
    setState({ lastEvent: event });
    if (event.type === 'HARDWARE' && state.connection) {
      setState({ profile: resolveProfile({
        protocol: state.connection.protocol.id,
        deviceName: state.connection.deviceName,
        deviceMAC: state.connection.deviceMAC,
        hardwareName: event.hardwareName,
        goCubeType: event.goCubeType?.name,
      }, bundledProfiles) });
    }
    eventListeners.forEach(listener => listener(event));
    if (event.type === 'DISCONNECT') void disconnect();
  };

  async function connect(): Promise<void> {
    if (state.status === 'connecting' || state.connection) return;
    setState({ status: 'connecting', error: null });
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
      setState({ status: 'connected', connection });
    } catch (error) {
      subscription?.unsubscribe();
      subscription = null;
      await disconnectConnection(connection);
      setState({ status: 'error', connection: null, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function disconnect(): Promise<void> {
    subscription?.unsubscribe();
    subscription = null;
    const connection = state.connection;
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
    subscribeEvents(listener: (event: SmartCubeEvent) => void): () => void {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    connect,
    disconnect,
  };
}
