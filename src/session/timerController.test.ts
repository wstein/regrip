import { describe, expect, it, vi } from 'vitest';

import { createLocalTimer, createTimerController } from './timerController';

const move = (cubeTimestamp: number | null = 1000) => ({
  timestamp: 1000,
  type: 'MOVE' as const,
  face: 0,
  direction: 0,
  move: 'U',
  localTimestamp: 1000,
  cubeTimestamp,
});

function makeController(connected = true) {
  const ui = {
    setTimer: vi.fn(),
    showTimer: vi.fn(),
    setTimerColor: vi.fn(),
    setSkew: vi.fn(),
  };
  return { ui, timer: createTimerController({ isConnected: () => connected, ...ui }) };
}

describe('timer controller', () => {
  it('uses an injected replay clock instead of wall time for local elapsed display', () => {
    vi.useFakeTimers();
    try {
      let virtualNow = 1_000;
      const setValue = vi.fn();
      const timer = createLocalTimer(setValue, () => virtualNow);

      timer.start();
      vi.advanceTimersByTime(90);
      expect(setValue).toHaveBeenLastCalledWith(0);

      virtualNow = 1_250;
      vi.advanceTimersByTime(30);
      expect(setValue).toHaveBeenLastCalledWith(250);
      timer.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('drives the visible timer through activation and a first move', () => {
    const { timer, ui } = makeController();

    timer.dispatch('activate');
    expect(ui.setTimer).toHaveBeenCalledWith('0:00.000');
    expect(ui.showTimer).toHaveBeenCalledWith(true);
    expect(ui.setTimerColor).toHaveBeenCalledWith('#0f0');

    timer.onMove(move());
    expect(ui.setTimerColor).toHaveBeenCalledWith('#999');
    timer.reset();
  });

  it('reports clock skew as unavailable when a cube has no clock', () => {
    const { timer, ui } = makeController();

    timer.onMove(move(null));

    expect(ui.setSkew).toHaveBeenCalledWith('- n/a - (cube clock unavailable)');
    timer.reset();
  });

  it('keeps the local elapsed time when a clockless cube solves', () => {
    const { timer, ui } = makeController();

    timer.dispatch('activate');
    timer.onMove(move(null));
    timer.dispatch('solved');

    expect(ui.setTimer).toHaveBeenCalledTimes(1);
    timer.reset();
  });
});
