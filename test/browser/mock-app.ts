import { createReplaySession, REPLAY_STORAGE_KEY } from '../../src/session/testing/replaySession';
import gocube from '../../src/session/testing/fixtures/gocube-edge-ui.jsonl?raw';
import gan from '../../src/session/testing/fixtures/gan-ui12-ui.jsonl?raw';

const kind = new URLSearchParams(location.search).get('fixture');
const autoplay = new URLSearchParams(location.search).has('autoplay');
const replayRequested = new URLSearchParams(location.search).has('replay');
const contents =
  kind === 'gan-ui12'
    ? gan
    : kind === 'gocube-edge'
      ? gocube
      : kind === 'local'
        ? sessionStorage.getItem(REPLAY_STORAGE_KEY)
        : undefined;
if (replayRequested) {
  const feed =
    new URLSearchParams(location.search).get('feed') === 'session' ? 'session' : 'connection';
  window.__smartcubeReplay = createReplaySession(
    contents ??
      '{"recordedAt":"2026-01-01T00:00:00.000Z","type":"trace_header","data":{"format":"regrip","version":1}}',
    feed,
  );
}
const source = await fetch('/index.html').then((response) => response.text());
document.body.innerHTML = new DOMParser().parseFromString(source, 'text/html').body.innerHTML;
await import('../../src/app/index.ts');
if (contents) {
  (document.querySelector('#connect') as HTMLButtonElement).click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (autoplay) await window.__smartcubeReplay?.advanceTo(Number.MAX_SAFE_INTEGER);
}
// Wait for local/system fonts before capturing screenshots.
await document.fonts.ready;
document.documentElement.dataset.ready = 'true';
