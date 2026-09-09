import type { ReplaySessionController } from '@wstein/regrip-core/session/replay/replaySession';

declare global {
  interface Window {
    /** Test/dev harness only: provides a virtual JSONL transport before bootstrap. */
    __smartcubeReplay?: ReplaySessionController;
  }
}

export {};
