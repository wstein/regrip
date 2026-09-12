import { describe, expect, it, vi } from 'vitest';

import * as GyroOrientation from '@wstein/regrip-core/domain/GyroOrientation';
import * as Quaternion from '@wstein/regrip-core/domain/Quaternion';
import * as CubeFacelets from '@wstein/regrip-core/domain/CubeFacelets';
import { createCubeEventController } from './cubeEvents';
import type { SessionGyroEvent } from '@wstein/regrip-core/session/smartCubeSession';

function xRotation(degrees: number): Quaternion.t {
  return Quaternion.fromEuler({ x: Quaternion.degreesToRadians(degrees), y: 0, z: 0 });
}

function makeController() {
  const setOrientation = vi.fn();
  const controller = createCubeEventController({
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
  it('publishes velocity, protocol metadata, hardware details, and disconnects', () => {
    const setInfo = vi.fn();
    const showInfo = vi.fn();
    const onDisconnect = vi.fn();
    const onHardware = vi.fn();
    const controller = createCubeEventController({
      solveScramble: async () => '',
      addMove: vi.fn(),
      setOrientation: vi.fn(),
      setPlayerAlgorithm: vi.fn(),
      setInfo,
      showInfo,
      onDisconnect,
      onHardware,
    });

    controller.handle({
      type: 'GYRO',
      timestamp: 1,
      quaternion: Quaternion.identity,
      relative: Quaternion.identity,
      stabilized: Quaternion.identity,
      velocityMagnitude: 3,
      velocity: { x: 1, y: 2, z: 3 },
      dtSeconds: 0.01,
    });
    controller.handle({
      type: 'MOVE',
      timestamp: 2,
      face: 0,
      direction: 0,
      move: 'U',
      localTimestamp: 2,
      cubeTimestamp: null,
      serial: 7,
      goCubeCenterOrientation: 4,
    });
    const hardware = {
      type: 'HARDWARE',
      timestamp: 3,
      hardwareName: 'GoCube',
      hardwareVersion: '1',
      softwareVersion: '2',
      productDate: '2026-01-01',
      gyroSupported: true,
      goCubeType: { name: 'Edge', code: 2 },
      goCubeOfflineStats: { moves: 12, timeSeconds: 65, solves: 3 },
    } as const;
    controller.handle(hardware);
    controller.handle({ type: 'BATTERY', timestamp: 4, batteryLevel: 88 });
    controller.handle({ type: 'DISCONNECT', timestamp: 5 });

    expect(setInfo).toHaveBeenCalledWith('velocity', 'x: 1, y: 2, z: 3');
    expect(setInfo).toHaveBeenCalledWith('eventSerial', '7');
    expect(setInfo).toHaveBeenCalledWith('centerOrientation', '4');
    expect(setInfo).toHaveBeenCalledWith('goCubeType', 'Edge (2)');
    expect(setInfo).toHaveBeenCalledWith('batteryLevel', '88%');
    expect(showInfo).toHaveBeenCalledWith('offlineMoves', 0, expect.any(Array));
    expect(onHardware).toHaveBeenCalledWith(hardware);
    expect(onDisconnect).toHaveBeenCalledOnce();
  });

  it('routes derived session events through one ordered integration boundary', () => {
    const calls: string[] = [];
    const onMoveGap = vi.fn();
    const onShake = vi.fn();
    const controller = createCubeEventController({
      solveScramble: async () => '',
      addMove: (move) => calls.push(`player:${move}`),
      recordMove: (move) => calls.push(`detected:${move}`),
      projectMove: (move) => `solver:${move}`,
      projectRegrip: (token) => `solver:${token}`,
      applyRegrip: (token) => calls.push(`apply:${token}`),
      onRegrip: (_event, solverToken) => calls.push(`regrip:${solverToken}`),
      onCustomTrigger: (_event, solverMove) => calls.push(`trigger:${solverMove}`),
      onShake,
      onMoveGap,
      setOrientation: vi.fn(),
      setPlayerAlgorithm: vi.fn(),
      setInfo: vi.fn(),
      showInfo: vi.fn(),
      onDisconnect: vi.fn(),
    });

    controller.handle({
      type: 'REGRIP',
      timestamp: 1,
      notationToken: 'y',
      sensorFrameToken: 'y',
    });
    controller.handle({ type: 'CUSTOM_TRIGGER', timestamp: 2, move: 'R' });
    const shake = { type: 'SHAKE', timestamp: 3, steps: 4, reversals: 3, spanMs: 200 } as const;
    controller.handle(shake);
    const gap = {
      type: 'MOVE_GAP',
      timestamp: 4,
      previousSerial: 10,
      serial: 13,
      missing: 2,
    } as const;
    controller.handle(gap);
    controller.handle({
      type: 'MOVE',
      timestamp: 5,
      face: 1,
      direction: 0,
      move: 'R',
      localTimestamp: 5,
      cubeTimestamp: null,
    });

    expect(calls).toEqual([
      'detected:solver:y',
      'apply:y',
      'regrip:solver:y',
      'trigger:solver:R',
      'detected:solver:R',
    ]);
    expect(onShake).toHaveBeenCalledWith(shake);
    expect(onMoveGap).toHaveBeenCalledWith(gap);
  });

  it('reports raw protocol events from the same dispatcher but keeps gyro separate', () => {
    const onProtocolEvent = vi.fn();
    const controller = createCubeEventController({
      solveScramble: async () => '',
      addMove: vi.fn(),
      setOrientation: vi.fn(),
      setPlayerAlgorithm: vi.fn(),
      setInfo: vi.fn(),
      showInfo: vi.fn(),
      onDisconnect: vi.fn(),
      onProtocolEvent,
    });
    const move = {
      type: 'MOVE',
      timestamp: 1,
      face: 0,
      direction: 0,
      move: 'U',
      localTimestamp: 1,
      cubeTimestamp: null,
    } as const;

    controller.handle(move);
    controller.handle({
      type: 'GYRO',
      timestamp: 2,
      quaternion: Quaternion.identity,
      relative: Quaternion.identity,
      stabilized: Quaternion.identity,
      velocityMagnitude: 0,
      dtSeconds: 0,
    });

    expect(onProtocolEvent).toHaveBeenCalledOnce();
    expect(onProtocolEvent).toHaveBeenCalledWith(move);
  });

  it('reports an unknown normalized event without mutating cube state', () => {
    const onUnknownEvent = vi.fn();
    const addMove = vi.fn();
    const setOrientation = vi.fn();
    const setPlayerAlgorithm = vi.fn();
    const setInfo = vi.fn();
    const showInfo = vi.fn();
    const controller = createCubeEventController({
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
    controller.handle({
      type: 'GYRO',
      timestamp: 2,
      quaternion: rawTurn,
      relative: rawTurn,
      stabilized,
      velocityMagnitude: 0,
      dtSeconds: 0,
    } satisfies SessionGyroEvent);

    const output = setOrientation.mock.calls.at(-1)?.[0] as Quaternion.t;
    const expected = Quaternion.multiply(GyroOrientation.home, stabilized);
    expect(Quaternion.angle(output, expected)).toBeCloseTo(0, 7);
  });

  it('forwards each detected move to the supplied move sink', () => {
    const { controller } = makeController();
    const moves: string[] = [];
    const moveController = createCubeEventController({
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

  it('publishes a facelet packet serial before reconciling it', async () => {
    const setInfo = vi.fn();
    const showInfo = vi.fn();
    const controller = createCubeEventController({
      solveScramble: async () => '',
      shouldReconcilePlayer: async () => false,
      addMove: vi.fn(),
      setOrientation: vi.fn(),
      setPlayerAlgorithm: vi.fn(),
      setInfo,
      showInfo,
      onDisconnect: vi.fn(),
    });
    controller.handle({ type: 'FACELETS', timestamp: 1, serial: 12, facelets: solvedFacelets });
    await flushAsyncWork();
    expect(showInfo).toHaveBeenCalledWith('eventSerial');
    expect(setInfo).toHaveBeenCalledWith('eventSerial', '12');
  });

  it('formats GAN snapshots in Kociemba coordinates rather than cubing.js orbit order', () => {
    const cubieStates: string[] = [];
    const exports: Array<{ facelets: string; state?: { CP: number[]; CO: number[] } }> = [];
    const controller = createCubeEventController({
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

    expect(cubieStates).toEqual(['(DFR,URF) (UBR+,ULB-)']);
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

  it('advances normalized cubie state and export state independently of solver-frame notation', () => {
    const cubieStates: string[] = [];
    const exports: string[] = [];
    const controller = createCubeEventController({
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

    expect(cubieStates).toEqual(['', '(UBR,ULB,UFL,URF) (UB,UL,UF,UR)']);
    expect(exports).toHaveLength(2);
    expect(exports[1]).not.toBe(solvedFacelets);
  });

  it('reports a solve reached through normalized move tracking without another facelet packet', () => {
    const decoded = CubeFacelets.decodeFacelets(solvedFacelets);
    if (decoded.TAG !== 'Ok') throw new Error(decoded._0);
    const oneTurnAway = CubeFacelets.patternDataToFacelets(
      CubeFacelets.applyMove(decoded._0!, "U'")!,
    );
    const onSolved = vi.fn();
    const controller = createCubeEventController({
      solveScramble: async () => '',
      shouldReconcilePlayer: async () => false,
      addMove: vi.fn(),
      setOrientation: vi.fn(),
      setPlayerAlgorithm: vi.fn(),
      setInfo: vi.fn(),
      showInfo: vi.fn(),
      onDisconnect: vi.fn(),
      onSolved,
    });

    controller.handle({ type: 'FACELETS', timestamp: 1, facelets: oneTurnAway });
    controller.handle({
      type: 'MOVE',
      timestamp: 2,
      face: 0,
      direction: 0,
      move: 'U',
      localTimestamp: 2,
      cubeTimestamp: null,
    });

    expect(onSolved).toHaveBeenCalledOnce();
  });
});
