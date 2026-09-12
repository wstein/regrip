type SessionElapsedClockOptions = {
  now: () => number;
  setElapsed: (milliseconds: number) => void;
};

/** Drive elapsed-time presentation from either a live monotonic clock or replay time. */
export function createSessionElapsedClock(options: SessionElapsedClockOptions) {
  let startedAt: number | undefined;
  let ticker: ReturnType<typeof setInterval> | undefined;

  const refresh = (): void => {
    if (startedAt !== undefined) options.setElapsed(Math.max(0, options.now() - startedAt));
  };

  function stop(): void {
    if (ticker !== undefined) clearInterval(ticker);
    ticker = undefined;
    startedAt = undefined;
  }

  function start(): void {
    stop();
    startedAt = options.now();
    options.setElapsed(0);
    ticker = setInterval(refresh, 100);
  }

  function setReplayElapsed(milliseconds: number): void {
    stop();
    options.setElapsed(Math.max(0, milliseconds));
  }

  function reset(): void {
    stop();
    options.setElapsed(0);
  }

  return { start, stop, reset, refresh, setReplayElapsed };
}

export type SessionElapsedClock = ReturnType<typeof createSessionElapsedClock>;
