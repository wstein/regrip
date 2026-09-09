import { describe, expect, it, vi } from 'vitest';

import * as GyroOrientation from '../domain/GyroOrientation.res.mjs';
import * as Quaternion from '../domain/Quaternion.res.mjs';
import { createCubeEventController } from './cubeEvents';
import type { SessionGyroEvent } from './smartCubeSession';

function xRotation(degrees: number): Quaternion.Quaternion {
  return Quaternion.fromEuler({ x: Quaternion.degreesToRadians(degrees), y: 0, z: 0 });
}

function makeController() {
  const setOrientation = vi.fn();
  const timer = { dispatch: vi.fn(), onMove: vi.fn(), reset: vi.fn(), refresh: vi.fn() };
  const controller = createCubeEventController({
    timer,
    solveScramble: async () => '',
    addMove: vi.fn(),
    setOrientation,
    setPlayerAlgorithm: vi.fn(),
    setInfo: vi.fn(),
    showInfo: vi.fn(),
    onDisconnect: vi.fn(),
    onSolved: vi.fn(),
  });
  return { controller, setOrientation };
}

describe('cube event gyro bridge', () => {
  it('uses the session-provided stabilized orientation', () => {
    const { controller, setOrientation } = makeController();
    const rawTurn = xRotation(67.5);
    const stabilized = xRotation(90);
    controller.handleGyro({
      type: 'GYRO',
      timestamp: 2,
      quaternion: rawTurn,
      relative: rawTurn,
      stabilized,
      velocityMagnitude: 0,
      dtSeconds: 0,
    } satisfies SessionGyroEvent);

    const output = setOrientation.mock.calls.at(-1)?.[0] as Quaternion.Quaternion;
    const expected = Quaternion.multiply(GyroOrientation.home, stabilized);
    expect(Quaternion.angle(output, expected)).toBeCloseTo(0, 7);
  });

  it('forwards each detected move to the supplied move sink', () => {
    const { controller } = makeController();
    const moves: string[] = [];
    const moveController = createCubeEventController({
      timer: { dispatch: vi.fn(), onMove: vi.fn(), reset: vi.fn(), refresh: vi.fn() },
      solveScramble: async () => '',
      addMove: (move) => moves.push(move),
      setOrientation: vi.fn(),
      setPlayerAlgorithm: vi.fn(),
      setInfo: vi.fn(),
      showInfo: vi.fn(),
      onDisconnect: vi.fn(),
      onSolved: vi.fn(),
    });
    controller.reset();
    moveController.handle({
      type: 'MOVE',
      timestamp: 1,
      face: 0,
      direction: 0,
      move: 'U',
      localTimestamp: 1,
      cubeTimestamp: null,
    });
    moveController.handle({
      type: 'MOVE',
      timestamp: 2,
      face: 1,
      direction: 0,
      move: "R'",
      localTimestamp: 2,
      cubeTimestamp: null,
    });

    expect(moves).toEqual(['U', "R'"]);
  });
});
