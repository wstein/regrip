import { describe, expect, it } from 'vitest';

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
});
