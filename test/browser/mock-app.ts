import { createJsonlMockConnection } from '../../src/session/testing/jsonlMock';
import gocube from '../../src/session/testing/fixtures/gocube-edge-ui.jsonl?raw';
import gan from '../../src/session/testing/fixtures/gan-ui12-ui.jsonl?raw';

const kind = new URLSearchParams(location.search).get('fixture');
if (kind) {
  const mock = createJsonlMockConnection(kind === 'gan-ui12' ? gan : gocube);
  window.__smartcubeMockConnect = async () => mock.connection;
  window.__smartcubeMockReplay = () => mock.replay();
}
const source = await fetch('/index.html').then((response) => response.text());
document.body.innerHTML = new DOMParser().parseFromString(source, 'text/html').body.innerHTML;
await import('../../src/app/index.ts');
if (kind) {
  (document.querySelector('#connect') as HTMLButtonElement).click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  window.__smartcubeMockReplay?.();
}
document.documentElement.dataset.ready = 'true';
