import type { TwistyPlayer } from 'cubing/twisty';

type TwistyPlayerModel = {
  alg: { get: () => Promise<unknown> };
};

type TwistyPlayerPort = Pick<TwistyPlayer, 'experimentalAddMove'> & {
  alg: string;
  experimentalModel: TwistyPlayerModel;
};

/**
 * Serializes TwistyPlayer writes.
 *
 * `experimentalAddMove` reads and updates its algorithm asynchronously. Calling
 * it once per BLE packet without awaiting its model update lets concurrent calls
 * append to the same old algorithm, so all but one move can be lost.
 */
export function createTwistyPlayerSync(player: TwistyPlayerPort, onUpdate?: () => void) {
  let writes = Promise.resolve();

  function enqueue(write: () => void): void {
    writes = writes
      .then(async () => {
        write();
        await player.experimentalModel.alg.get();
        onUpdate?.();
      })
      .catch((error: unknown) => {
        console.error('TwistyPlayer state update failed.', error);
      });
  }

  return {
    setAlgorithm(algorithm: string): void {
      enqueue(() => {
        player.alg = algorithm;
      });
    },
    addMove(move: string): void {
      enqueue(() => player.experimentalAddMove(move, { cancel: false }));
    },
    async whenIdle(): Promise<void> {
      await writes;
    },
  };
}
