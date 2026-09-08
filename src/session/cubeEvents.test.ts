import { describe, expect, it, vi } from 'vitest';

import * as GyroOrientation from '../domain/GyroOrientation.res.mjs';
import * as OrientationStabilizer from '../domain/OrientationStabilizer.res.mjs';
import * as Quaternion from '../domain/Quaternion.res.mjs';
import { createCubeEventController } from './cubeEvents';

function xRotation(degrees: number): Quaternion.Quaternion {
  return Quaternion.fromEuler({ x: Quaternion.degreesToRadians(degrees), y: 0, z: 0 });
}

function makeController() {
  const gyro = GyroOrientation.make();
  const stabilizer = OrientationStabilizer.make();
  const setOrientation = vi.fn();
  const timer = { dispatch: vi.fn(), onMove: vi.fn(), reset: vi.fn() };
  const controller = createCubeEventController({
    gyro,
    stabilizer,
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
  return { controller, gyro, setOrientation };
}

describe('cube event gyro bridge', () => {
  it('does not magnetize a high-velocity deliberate turn', () => {
    const { controller, gyro, setOrientation } = makeController();
    controller.handle({ type: 'GYRO', timestamp: 1, quaternion: Quaternion.identity });
    const rawTurn = xRotation(67.5);
    controller.handle({
      type: 'GYRO', timestamp: 2, quaternion: rawTurn,
      velocity: { x: OrientationStabilizer.defaults.velocityMax, y: 0, z: 0 },
    });

    const output = setOrientation.mock.calls.at(-1)?.[0] as Quaternion.Quaternion;
    const expected = GyroOrientation.applyHome(gyro, rawTurn);
    expect(Quaternion.angle(output, expected)).toBeCloseTo(0, 7);
  });

  it('forwards each detected move to the supplied move sink', () => {
    const { controller } = makeController();
    const moves: string[] = [];
    const gyro = GyroOrientation.make();
    const stabilizer = OrientationStabilizer.make();
    const moveController = createCubeEventController({
      gyro,
      stabilizer,
      timer: { dispatch: vi.fn(), onMove: vi.fn(), reset: vi.fn() },
      solveScramble: async () => '',
      addMove: move => moves.push(move),
      setOrientation: vi.fn(),
      setPlayerAlgorithm: vi.fn(),
      setInfo: vi.fn(),
      showInfo: vi.fn(),
      onDisconnect: vi.fn(),
      onSolved: vi.fn(),
    });
    controller.reset();
    moveController.handle({
      type: 'MOVE', timestamp: 1, face: 0, direction: 0, move: 'U', localTimestamp: 1, cubeTimestamp: null,
    });
    moveController.handle({
      type: 'MOVE', timestamp: 2, face: 1, direction: 0, move: "R'", localTimestamp: 2, cubeTimestamp: null,
    });

    expect(moves).toEqual(['U', "R'"]);
  });
});
