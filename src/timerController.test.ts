import { describe, expect, it, vi } from 'vitest';

import { createTimerController } from './timerController';

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
});
