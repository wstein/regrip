import type { ReplayFeed, ReplaySessionController } from '../session/testing/replaySession';
import { REPLAY_STORAGE_KEY } from '../session/testing/replaySession';
import { readJsonlMockIdentity, validateJsonlReplay } from '../session/testing/jsonlMock';

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
  const load = element<HTMLButtonElement>('replay-load');
  const identity = element<HTMLElement>('replay-identity');
  const importer = element<HTMLElement>('replay-import');
  const jsonl = element<HTMLTextAreaElement>('replay-jsonl');
  const dropzone = element<HTMLElement>('replay-dropzone');
  const submit = element<HTMLButtonElement>('replay-import-submit');
  const cancel = element<HTMLButtonElement>('replay-import-cancel');
  const importStatus = element<HTMLElement>('replay-import-status');
  panel.hidden = false;
  feed.value = replay.feed;
  scrubber.max = String(replay.length);
  identity.textContent = `${replay.identity.deviceName} · ${replay.identity.protocol.id}`;

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
    const target = Number(scrubber.value);
    pause();
    void replay.seekTo(target);
  });
  feed.addEventListener('change', () => {
    const params = new URLSearchParams(location.search);
    const nextFeed: ReplayFeed = feed.value === 'session' ? 'session' : 'connection';
    params.set('feed', nextFeed);
    location.search = params.toString();
  });
  const setImportStatus = (message = '', error = false): void => {
    importStatus.textContent = message;
    importStatus.dataset.error = String(error);
  };
  const showImporter = (): void => {
    importer.hidden = false;
    setImportStatus();
    jsonl.focus();
  };
  const importContents = (contents: string): void => {
    try {
      validateJsonlReplay(contents);
      const importedIdentity = readJsonlMockIdentity(contents);
      sessionStorage.setItem(REPLAY_STORAGE_KEY, contents);
      setImportStatus(`Loaded ${importedIdentity.deviceName} · ${importedIdentity.protocol.id}`);
      const params = new URLSearchParams(location.search);
      params.set('replay', '');
      params.set('fixture', 'local');
      location.search = params.toString();
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : 'Unable to load JSONL.', true);
    }
  };
  load.addEventListener('click', showImporter);
  cancel.addEventListener('click', () => {
    importer.hidden = true;
    setImportStatus();
  });
  submit.addEventListener('click', () => importContents(jsonl.value));
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragging');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragging'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
    const file = event.dataTransfer?.files.item(0);
    if (!file) return;
    void file.text().then(importContents, () => setImportStatus('Unable to read that file.', true));
  });
  replay.subscribeCursor(render);
  render();
}
