import { signal, type Signal } from '@preact/signals-core';

import type {
  SmartCubeSessionEvent,
  SmartCubeSessionState,
} from '@wstein/regrip-core/session/smartCubeSession';

type SessionStore = {
  getState: () => SmartCubeSessionState;
  subscribe: (listener: (state: SmartCubeSessionState) => void) => () => void;
  subscribeEvents: (listener: (event: SmartCubeSessionEvent) => void) => () => void;
};

/**
 * App-only reactive view of a headless session. The session neither imports
 * signals nor knows about rendering frameworks; dispose this bridge with the
 * UI that owns it.
 */
export type SessionSignals = {
  state: Signal<SmartCubeSessionState>;
  event: Signal<SmartCubeSessionEvent | null>;
  dispose: () => void;
};

export function createSessionSignals(session: SessionStore): SessionSignals {
  const state = signal(session.getState());
  const event = signal<SmartCubeSessionEvent | null>(null);
  const unsubscribeState = session.subscribe((next) => {
    state.value = next;
  });
  const unsubscribeEvents = session.subscribeEvents((next) => {
    event.value = next;
  });
  return {
    state,
    event,
    dispose: () => {
      unsubscribeState();
      unsubscribeEvents();
    },
  };
}
