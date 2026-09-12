import type { ReplaySessionController } from '@wstein/regrip-core/session/replay/replaySession';
import { createDropdownMenu } from './dom';

type MockFixture = 'gocube-edge' | 'gan-ui12' | 'local';

export type MockDeviceReplayLoad =
  | { requested: false }
  | {
      requested: true;
      replay: ReplaySessionController | undefined;
      error?: string;
    };

async function bundledFixture(fixture: Exclude<MockFixture, 'local'>): Promise<string> {
  if (fixture === 'gan-ui12') {
    return (await import('@wstein/regrip-core/session/replay/fixtures/gan-ui12-ui.jsonl?raw'))
      .default;
  }
  return (await import('@wstein/regrip-core/session/replay/fixtures/gocube-edge-ui.jsonl?raw'))
    .default;
}

/** Resolve an explicitly requested replay without loading replay code on the normal path. */
export async function loadReplayFromUrl(): Promise<MockDeviceReplayLoad> {
  const params = new URLSearchParams(location.search);
  if (!params.has('replay')) return { requested: false };

  try {
    const fixture = params.get('fixture');
    if (fixture !== 'gocube-edge' && fixture !== 'gan-ui12' && fixture !== 'local') {
      throw new Error('Choose a bundled fixture or load a local JSONL file.');
    }
    const { createReplaySession, REPLAY_STORAGE_KEY } =
      await import('@wstein/regrip-core/session/replay/replaySession');
    const contents =
      fixture === 'local'
        ? sessionStorage.getItem(REPLAY_STORAGE_KEY)
        : await bundledFixture(fixture);
    if (!contents) throw new Error('The local replay is no longer available in this tab.');
    const requestedFeed = params.get('feed');
    const feed =
      requestedFeed === 'session'
        ? 'session'
        : requestedFeed === 'connection'
          ? 'connection'
          : fixture === 'local'
            ? 'session'
            : 'connection';
    return { requested: true, replay: createReplaySession(contents, feed) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Unable to load mock cube replay:', error);
    return { requested: true, replay: undefined, error: message };
  }
}

/** Build a mock-mode or real-device URL while retaining unrelated query parameters. */
export function buildMockDeviceUrl(currentHref: string, fixture?: MockFixture): string {
  const url = new URL(currentHref);
  for (const parameter of ['replay', 'fixture', 'feed', 'autoplay']) {
    url.searchParams.delete(parameter);
  }
  if (fixture) {
    url.searchParams.set('replay', '');
    url.searchParams.set('fixture', fixture);
  }
  return url.href;
}

type MockDevicePickerOptions = {
  load: MockDeviceReplayLoad;
  navigate?: (href: string) => void;
};

/** Mount the transport picker without eagerly importing replay validation or fixtures. */
export function mountMockDevicePicker({
  load,
  navigate = (href) => location.assign(href),
}: MockDevicePickerOptions): void {
  const toggle = document.getElementById('connect');
  const menu = document.getElementById('connect-menu');
  const fileInput = document.getElementById('mock-device-file');
  const exit = document.getElementById('mock-device-exit');
  const activeMenuItem = exit?.closest('li');
  const status = document.getElementById('mock-device-status');
  if (
    !(toggle instanceof HTMLButtonElement) ||
    !(menu instanceof HTMLElement) ||
    !(fileInput instanceof HTMLInputElement) ||
    !(exit instanceof HTMLButtonElement) ||
    !(activeMenuItem instanceof HTMLElement) ||
    !(status instanceof HTMLElement)
  ) {
    return;
  }

  const active = load.requested && load.replay !== undefined;
  toggle.dataset.mockActive = String(active);
  if (active) toggle.textContent = 'Replay mode ▾';
  activeMenuItem.hidden = !active;
  status.textContent = load.requested && load.error ? load.error : '';
  status.hidden = status.textContent === '';

  const { close: closeMenu } = createDropdownMenu({ toggle, menu });
  menu.querySelectorAll<HTMLButtonElement>('[data-mock-fixture]').forEach((button) => {
    button.addEventListener('click', () => {
      const fixture = button.dataset.mockFixture;
      if (fixture === 'gocube-edge' || fixture === 'gan-ui12') {
        navigate(buildMockDeviceUrl(location.href, fixture));
      }
    });
  });
  for (const id of ['connect-bluetooth', 'disconnect-cube']) {
    document.getElementById(id)?.addEventListener('click', closeMenu);
  }
  menu.querySelector<HTMLButtonElement>('[data-mock-load]')?.addEventListener('click', () => {
    closeMenu();
    fileInput.click();
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    status.hidden = true;
    status.textContent = '';
    try {
      const contents = await file.text();
      const [{ validateJsonlReplay }, { REPLAY_STORAGE_KEY }] = await Promise.all([
        import('@wstein/regrip-core/session/replay/jsonlMock'),
        import('@wstein/regrip-core/session/replay/replaySession'),
      ]);
      validateJsonlReplay(contents);
      sessionStorage.setItem(REPLAY_STORAGE_KEY, contents);
      navigate(buildMockDeviceUrl(location.href, 'local'));
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
      status.hidden = false;
      fileInput.value = '';
    }
  });
  exit.addEventListener('click', () => navigate(buildMockDeviceUrl(location.href)));
}
