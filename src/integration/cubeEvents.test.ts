import { describe, expect, it, vi } from 'vitest';

import * as GyroOrientation from '@wstein/regrip-core/domain/GyroOrientation.res.mjs';
import * as Quaternion from '@wstein/regrip-core/domain/Quaternion.res.mjs';
import { createCubeEventController } from './cubeEvents';
import type { SessionGyroEvent } from '@wstein/regrip-core/session/smartCubeSession';

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

const solvedFacelets = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('cube event gyro bridge', () => {
  it('reports an unknown normalized event without mutating cube state', () => {
    const onUnknownEvent = vi.fn();
    const timer = { dispatch: vi.fn(), onMove: vi.fn(), reset: vi.fn(), refresh: vi.fn() };
    const addMove = vi.fn();
    const setOrientation = vi.fn();
    const setPlayerAlgorithm = vi.fn();
    const setInfo = vi.fn();
    const showInfo = vi.fn();
    const controller = createCubeEventController({
      timer,
      solveScramble: async () => '',
      addMove,
      setOrientation,
      setPlayerAlgorithm,
      setInfo,
      showInfo,
      onDisconnect: vi.fn(),
      onSolved: vi.fn(),
      onUnknownEvent,
    });
    const event = { type: 'FUTURE_EVENT', timestamp: 1, payload: { mode: 7 } };

    controller.handle(event as unknown as Parameters<typeof controller.handle>[0]);

    expect(onUnknownEvent).toHaveBeenCalledWith(event);
    expect(timer.onMove).not.toHaveBeenCalled();
    expect(addMove).not.toHaveBeenCalled();
    expect(setOrientation).not.toHaveBeenCalled();
    expect(setPlayerAlgorithm).not.toHaveBeenCalled();
    expect(setInfo).not.toHaveBeenCalled();
    expect(showInfo).not.toHaveBeenCalled();
  });

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

  it('buffers moves while an authoritative facelet snapshot is being solved', async () => {
    const solving = deferred<string>();
    const calls: string[] = [];
    const controller = createCubeEventController({
      timer: { dispatch: vi.fn(), onMove: vi.fn(), reset: vi.fn(), refresh: vi.fn() },
      solveScramble: () => solving.promise,
      addMove: (move) => calls.push(`move:${move}`),
      setOrientation: vi.fn(),
      setPlayerAlgorithm: (algorithm) => calls.push(`algorithm:${algorithm}`),
      setInfo: vi.fn(),
      showInfo: vi.fn(),
      onDisconnect: vi.fn(),
      onSolved: vi.fn(),
      solveDetector: () => false,
    });

    controller.handle({ type: 'FACELETS', timestamp: 1, facelets: solvedFacelets });
    controller.handle({
      type: 'MOVE',
      timestamp: 2,
      face: 1,
      direction: 0,
      move: 'R',
      localTimestamp: 2,
      cubeTimestamp: null,
    });
    expect(calls).toEqual([]);

    solving.resolve('F U');
    await flushAsyncWork();
    expect(calls).toEqual(['algorithm:F U', 'move:R']);
  });

  it('lets the newest facelet snapshot supersede an older pending solve', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const solves = [first, second];
    const calls: string[] = [];
    const controller = createCubeEventController({
      timer: { dispatch: vi.fn(), onMove: vi.fn(), reset: vi.fn(), refresh: vi.fn() },
      solveScramble: () => solves.shift()!.promise,
      addMove: (move) => calls.push(`move:${move}`),
      setOrientation: vi.fn(),
      setPlayerAlgorithm: (algorithm) => calls.push(`algorithm:${algorithm}`),
      setInfo: vi.fn(),
      showInfo: vi.fn(),
      onDisconnect: vi.fn(),
      onSolved: vi.fn(),
      solveDetector: () => false,
    });

    controller.handle({ type: 'FACELETS', timestamp: 1, facelets: solvedFacelets });
    controller.handle({ type: 'FACELETS', timestamp: 2, facelets: solvedFacelets });
    controller.handle({
      type: 'MOVE',
      timestamp: 3,
      face: 0,
      direction: 0,
      move: 'U',
      localTimestamp: 3,
      cubeTimestamp: null,
    });

    first.resolve('ignored');
    await flushAsyncWork();
    expect(calls).toEqual([]);
    second.resolve('R2');
    await flushAsyncWork();
    expect(calls).toEqual(['algorithm:R2', 'move:U']);
  });

  it('releases queued moves without solving when the body-frame snapshot matches', async () => {
    const calls: string[] = [];
    const solveScramble = vi.fn(async () => 'unneeded');
    const controller = createCubeEventController({
      timer: { dispatch: vi.fn(), onMove: vi.fn(), reset: vi.fn(), refresh: vi.fn() },
      solveScramble,
      shouldReconcilePlayer: async () => false,
      addMove: (move) => calls.push(`move:${move}`),
      setOrientation: vi.fn(),
      setPlayerAlgorithm: (algorithm) => calls.push(`algorithm:${algorithm}`),
      setInfo: vi.fn(),
      showInfo: vi.fn(),
      onDisconnect: vi.fn(),
      onSolved: vi.fn(),
      solveDetector: () => false,
    });

    controller.handle({ type: 'FACELETS', timestamp: 1, facelets: solvedFacelets });
    controller.handle({
      type: 'MOVE',
      timestamp: 2,
      face: 1,
      direction: 0,
      move: 'R',
      localTimestamp: 2,
      cubeTimestamp: null,
    });
    await flushAsyncWork();

    expect(solveScramble).not.toHaveBeenCalled();
    expect(calls).toEqual(['move:R']);
  });

  it('formats GAN snapshots in Kociemba coordinates rather than cubing.js orbit order', () => {
    const cubieStates: string[] = [];
    const exports: Array<{ facelets: string; state?: { CP: number[]; CO: number[] } }> = [];
    const controller = createCubeEventController({
      timer: { dispatch: vi.fn(), onMove: vi.fn(), reset: vi.fn(), refresh: vi.fn() },
      solveScramble: async () => '',
      shouldReconcilePlayer: async () => false,
      addMove: vi.fn(),
      setOrientation: vi.fn(),
      setPlayerAlgorithm: vi.fn(),
      setInfo: (id, value) => {
        if (id === 'cubieState') cubieStates.push(value);
      },
      showInfo: vi.fn(),
      onFacelets: (source) => exports.push(source),
      onDisconnect: vi.fn(),
      onSolved: vi.fn(),
    });
    const facelets = 'BUBUUUUUDFRLRRRFRRFFRFFFFFRDDUDDDDDDRLLLLLLLLUBUBBBBBB';
    controller.handle({
      type: 'FACELETS',
      timestamp: 1,
      facelets,
      state: {
        CP: [4, 1, 3, 2, 0, 5, 6, 7],
        CO: [0, 0, 2, 1, 0, 0, 0, 0],
        EP: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        EO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    });

    expect(cubieStates).toEqual(['(DFR,URF) (UBR;o:2,ULB;o:1)']);
    expect(exports.at(-1)?.state).toMatchObject({
      CP: [4, 1, 3, 2, 0, 5, 6, 7],
      CO: [0, 0, 2, 1, 0, 0, 0, 0],
    });
  });

  it('keeps the player unchanged after a packet gap while retaining detected notation', () => {
    const playerMoves: string[] = [];
    const detectedMoves: string[] = [];
    const invalidate = vi.fn();
    const controller = createCubeEventController({
      timer: { dispatch: vi.fn(), onMove: vi.fn(), reset: vi.fn(), refresh: vi.fn() },
      solveScramble: async () => '',
      addMove: (move) => playerMoves.push(move),
      recordMove: (move) => detectedMoves.push(move),
      invalidatePlayerTracking: invalidate,
      setOrientation: vi.fn(),
      setPlayerAlgorithm: vi.fn(),
      setInfo: vi.fn(),
      showInfo: vi.fn(),
      onDisconnect: vi.fn(),
      onSolved: vi.fn(),
    });

    controller.invalidatePlayerState();
    controller.handle({
      type: 'MOVE',
      timestamp: 1,
      face: 1,
      direction: 0,
      move: 'R',
      localTimestamp: 1,
      cubeTimestamp: null,
    });

    expect(invalidate).toHaveBeenCalledOnce();
    expect(playerMoves).toEqual([]);
    expect(detectedMoves).toEqual(['R']);
  });

  it('advances displayed cubie state and export state for each solver-frame move', () => {
    const cubieStates: string[] = [];
    const exports: string[] = [];
    const controller = createCubeEventController({
      timer: { dispatch: vi.fn(), onMove: vi.fn(), reset: vi.fn(), refresh: vi.fn() },
      solveScramble: async () => '',
      shouldReconcilePlayer: async () => false,
      projectMove: () => 'R',
      addMove: vi.fn(),
      setOrientation: vi.fn(),
      setPlayerAlgorithm: vi.fn(),
      setInfo: (id, value) => {
        if (id === 'cubieState') cubieStates.push(value);
      },
      showInfo: vi.fn(),
      onFacelets: (source) => exports.push(source.facelets),
      onDisconnect: vi.fn(),
      onSolved: vi.fn(),
    });

    controller.handle({ type: 'FACELETS', timestamp: 1, facelets: solvedFacelets });
    controller.handle({
      type: 'MOVE',
      timestamp: 2,
      face: 0,
      direction: 0,
      move: 'U',
      localTimestamp: 2,
      cubeTimestamp: null,
    });

    expect(cubieStates).toEqual(['', '(DFR;o:2,DRB;o:1,UBR;o:2,URF;o:1) (FR,DR,BR,UR)']);
    expect(exports).toHaveLength(2);
    expect(exports[1]).not.toBe(solvedFacelets);
  });
});
