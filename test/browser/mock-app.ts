import {
  createReplaySession,
  REPLAY_STORAGE_KEY,
} from '@wstein/regrip-core/session/replay/replaySession';
import gocube from '@wstein/regrip-core/session/replay/fixtures/gocube-edge-ui.jsonl?raw';
import gan from '@wstein/regrip-core/session/replay/fixtures/gan-ui12-ui.jsonl?raw';

const params = new URLSearchParams(location.search);
const kind = params.get('fixture');
const autoplay = params.has('autoplay');
const replayRequested = params.has('replay');
const contents =
  kind === 'gan-ui12'
    ? gan
    : kind === 'gocube-edge'
      ? gocube
      : kind === 'local'
        ? sessionStorage.getItem(REPLAY_STORAGE_KEY)
        : undefined;
if (replayRequested) {
  const feed = params.get('feed') === 'session' ? 'session' : 'connection';
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
  (document.querySelector('#connect-bluetooth') as HTMLButtonElement).click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (autoplay) await window.__smartcubeReplay?.advanceTo(Number.MAX_SAFE_INTEGER);
}
// Wait for local/system fonts before capturing screenshots.
await document.fonts.ready;
document.documentElement.dataset.ready = 'true';
