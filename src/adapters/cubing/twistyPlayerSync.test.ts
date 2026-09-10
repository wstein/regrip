import { describe, expect, it, vi } from 'vitest';

import { createTwistyPlayerSync } from './twistyPlayerSync';

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('TwistyPlayer sync', () => {
  it('serializes asynchronous move appends in capture order', async () => {
    const completedWrites: string[] = [];
    let algorithm = '';
    const player = {
      get alg() {
        return algorithm;
      },
      set alg(value: string) {
        algorithm = value;
      },
      experimentalAddMove(move: string) {
        algorithm = `${algorithm} ${move}`.trim();
      },
      experimentalModel: { alg: { get: async () => undefined } },
    };
    const sync = createTwistyPlayerSync(player, () => completedWrites.push(algorithm));

    sync.setAlgorithm('R U');
    sync.addMove("F'");
    sync.addMove('D2');
    await sync.whenIdle();

    expect(algorithm).toBe("R U F' D2");
    expect(completedWrites).toEqual(['R U', "R U F'", "R U F' D2"]);
  });

  it('waits for each player-model write before starting the next', async () => {
    const gates = [deferred<void>(), deferred<void>()];
    let calls = 0;
    const player = {
      alg: '',
      experimentalAddMove: () => undefined,
      experimentalModel: {
        alg: {
          get: () => gates[calls++]!.promise,
        },
      },
    };
    const sync = createTwistyPlayerSync(player);

    sync.setAlgorithm('R');
    sync.addMove('U');
    await nextTask();
    expect(calls).toBe(1);

    gates[0]!.resolve();
    await nextTask();
    expect(calls).toBe(2);
    gates[1]!.resolve();
    await sync.whenIdle();
  });

  it('reports a failed player write and keeps processing later updates', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let reads = 0;
    let appended = 0;
    const player = {
      alg: '',
      experimentalAddMove: () => {
        appended += 1;
      },
      experimentalModel: {
        alg: {
          get: async () => {
            reads += 1;
            if (reads === 1) throw new Error('bad player state');
          },
        },
      },
    };
    const sync = createTwistyPlayerSync(player);

    sync.setAlgorithm('R');
    sync.addMove('U');
    await sync.whenIdle();

    expect(report).toHaveBeenCalledWith('TwistyPlayer state update failed.', expect.any(Error));
    expect(appended).toBe(1);
    report.mockRestore();
  });
});
