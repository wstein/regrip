import type { ReplayFeed, ReplaySessionController } from '../session/replay/replaySession';
import { REPLAY_STORAGE_KEY } from '../session/replay/replaySession';
import { readJsonlMockIdentity, validateJsonlReplay } from '../session/replay/jsonlMock';
import { byId } from './dom';

/** Dev-only virtual transport UI for a JSONL replay controller. */
export function mountReplayPanel(replay: ReplaySessionController): void {
  const panel = byId('replay-panel');
  const reset = byId<HTMLButtonElement>('replay-reset');
  const play = byId<HTMLButtonElement>('replay-play');
  const step = byId<HTMLButtonElement>('replay-step');
  const scrubber = byId<HTMLInputElement>('replay-scrubber');
  const position = byId('replay-position');
  const speed = byId<HTMLSelectElement>('replay-speed');
  const feed = byId<HTMLSelectElement>('replay-feed');
  const load = byId<HTMLButtonElement>('replay-load');
  const identity = byId('replay-identity');
  const importer = byId('replay-import');
  const jsonl = byId<HTMLTextAreaElement>('replay-jsonl');
  const dropzone = byId('replay-dropzone');
  const submit = byId<HTMLButtonElement>('replay-import-submit');
  const cancel = byId<HTMLButtonElement>('replay-import-cancel');
  const importStatus = byId('replay-import-status');
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
    if (!playing) return;
    const delta = now - previousNow;
    previousNow = now;
    await replay.advanceTo(replay.virtualNowMs + delta * Number(speed.value));
    if (!playing) return;
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
  // Seek once on release rather than rebuilding the session for every pixel
  // crossed while dragging the range control.
  scrubber.addEventListener('change', () => {
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
