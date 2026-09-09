import { createReplaySession } from '../../src/session/testing/replaySession';
import gocube from '../../src/session/testing/fixtures/gocube-edge-ui.jsonl?raw';
import gan from '../../src/session/testing/fixtures/gan-ui12-ui.jsonl?raw';

const kind = new URLSearchParams(location.search).get('fixture');
const autoplay = new URLSearchParams(location.search).has('autoplay');
if (kind) {
  const feed =
    new URLSearchParams(location.search).get('feed') === 'session' ? 'session' : 'connection';
  window.__smartcubeReplay = createReplaySession(kind === 'gan-ui12' ? gan : gocube, feed);
}
const source = await fetch('/index.html').then((response) => response.text());
document.body.innerHTML = new DOMParser().parseFromString(source, 'text/html').body.innerHTML;
await import('../../src/app/index.ts');
if (kind) {
  (document.querySelector('#connect') as HTMLButtonElement).click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (autoplay) await window.__smartcubeReplay?.advanceTo(Number.MAX_SAFE_INTEGER);
}
// Wait for local/system fonts before capturing screenshots.
await document.fonts.ready;
document.documentElement.dataset.ready = 'true';
