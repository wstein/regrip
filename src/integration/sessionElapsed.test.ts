import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSessionElapsedClock } from './sessionElapsed';

describe('session elapsed clock', () => {
  afterEach(() => vi.useRealTimers());

  it('ticks from the live-session start and stops cleanly', () => {
    vi.useFakeTimers();
    let now = 1_000;
    const setElapsed = vi.fn();
    const clock = createSessionElapsedClock({ now: () => now, setElapsed });

    clock.start();
    expect(setElapsed).toHaveBeenLastCalledWith(0);
    now = 1_375;
    vi.advanceTimersByTime(100);
    expect(setElapsed).toHaveBeenLastCalledWith(375);

    clock.stop();
    now = 2_000;
    vi.advanceTimersByTime(100);
    expect(setElapsed).toHaveBeenLastCalledWith(375);
  });

  it('accepts deterministic replay elapsed time without starting a wall-clock ticker', () => {
    vi.useFakeTimers();
    const setElapsed = vi.fn();
    const clock = createSessionElapsedClock({ now: () => 99_000, setElapsed });

    clock.setReplayElapsed(2_450);
    vi.advanceTimersByTime(500);

    expect(setElapsed).toHaveBeenCalledTimes(1);
    expect(setElapsed).toHaveBeenCalledWith(2_450);
  });
});
