import type { ReplayFeed, ReplaySessionController } from '../session/testing/replaySession';

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!(value instanceof HTMLElement)) throw new Error(`Missing replay element #${id}`);
  return value as T;
}

/** Dev-only virtual transport UI for a JSONL replay controller. */
export function mountReplayPanel(replay: ReplaySessionController): void {
  const panel = element<HTMLElement>('replay-panel');
  const reset = element<HTMLButtonElement>('replay-reset');
  const play = element<HTMLButtonElement>('replay-play');
  const step = element<HTMLButtonElement>('replay-step');
  const scrubber = element<HTMLInputElement>('replay-scrubber');
  const position = element<HTMLElement>('replay-position');
  const speed = element<HTMLSelectElement>('replay-speed');
  const feed = element<HTMLSelectElement>('replay-feed');
  panel.hidden = false;
  feed.value = replay.feed;
  scrubber.max = String(replay.length);

  let playing = false;
  let frame: number | undefined;
  let previousNow = performance.now();

  const render = (): void => {
    scrubber.value = String(replay.position);
    position.textContent = `${replay.position} / ${replay.length}`;
    play.textContent = playing ? 'Pause' : 'Play';
    step.disabled = replay.done;
  };
  const pause = (): void => {
    playing = false;
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    render();
  };
  const tick = async (now: number): Promise<void> => {
    const delta = now - previousNow;
    previousNow = now;
    await replay.advanceTo(replay.virtualNowMs + delta * Number(speed.value));
    if (replay.done) pause();
    else frame = requestAnimationFrame((next) => void tick(next));
  };
  const start = (): void => {
    if (replay.done) return;
    playing = true;
    previousNow = performance.now();
    frame = requestAnimationFrame((now) => void tick(now));
    render();
  };

  play.addEventListener('click', () => (playing ? pause() : start()));
  step.addEventListener('click', () => void replay.stepOne());
  reset.addEventListener('click', () => {
    pause();
    void replay.reset();
  });
  scrubber.addEventListener('input', () => {
    pause();
    void replay.seekTo(Number(scrubber.value));
  });
  feed.addEventListener('change', () => {
    const params = new URLSearchParams(location.search);
    const nextFeed: ReplayFeed = feed.value === 'session' ? 'session' : 'connection';
    params.set('feed', nextFeed);
    location.search = params.toString();
  });
  replay.subscribeCursor(render);
  render();
}
