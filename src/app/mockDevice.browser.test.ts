// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildMockDeviceUrl,
  loadReplayFromUrl,
  mountMockDevicePicker,
  type MockDeviceReplayLoad,
} from './mockDevice';

const localReplay = [
  JSON.stringify({
    recordedAt: '2026-09-12T10:00:00.000Z',
    type: 'trace_header',
    data: {
      format: 'regrip',
      version: 1,
      session: { device: 'Local test cube', protocol: 'jsonl-mock' },
    },
  }),
  JSON.stringify({
    recordedAt: '2026-09-12T10:00:00.010Z',
    type: 'cube_event',
    data: { type: 'MOVE', timestamp: 10, move: 'R' },
  }),
].join('\n');

afterEach(() => {
  history.replaceState(null, '', '/');
  sessionStorage.clear();
  vi.restoreAllMocks();
});

function expectLoaded(result: MockDeviceReplayLoad) {
  expect(result.requested).toBe(true);
  if (!result.requested || !result.replay) throw new Error('Expected a loaded replay');
  return result.replay;
}

function mountPicker(): void {
  document.body.innerHTML = `
    <button id="connect">Connect ▾</button>
    <menu id="connect-menu" hidden>
      <li><button id="connect-bluetooth"></button></li>
      <li><button data-mock-fixture="gocube-edge"></button></li>
      <li><button data-mock-fixture="gan-ui12"></button></li>
      <li><button data-mock-fixture="invalid"></button></li>
      <li><button data-mock-load></button></li>
      <li hidden><button id="mock-device-exit"></button></li>
      <li><button id="disconnect-cube"></button></li>
    </menu>
    <input id="mock-device-file" type="file">
    <span id="mock-device-status" hidden></span>`;
}

function click(selector: string): void {
  document.querySelector<HTMLElement>(selector)?.click();
}

describe('mock device replay selection', () => {
  it('does nothing when replay mode was not requested', async () => {
    history.replaceState(null, '', '/?keep=yes');
    await expect(loadReplayFromUrl()).resolves.toEqual({ requested: false });
  });

  it.each([
    ['gocube-edge', 'GoCube Edge'],
    ['gan-ui12', 'GAN12 UI'],
  ])('loads the bundled %s fixture', async (fixture, deviceName) => {
    history.replaceState(null, '', `/?replay&fixture=${fixture}`);
    const replay = expectLoaded(await loadReplayFromUrl());
    expect(replay.identity.deviceName).toBe(deviceName);
  });

  it('loads a validated local fixture from session storage', async () => {
    sessionStorage.setItem('regrip.replay.jsonl', localReplay);
    history.replaceState(null, '', '/?replay&fixture=local');
    const replay = expectLoaded(await loadReplayFromUrl());
    expect(replay.identity.deviceName).toBe('Local test cube');
    expect(replay.feed).toBe('session');
  });

  it('allows explicit connection-feed re-detection for a local fixture', async () => {
    sessionStorage.setItem('regrip.replay.jsonl', localReplay);
    history.replaceState(null, '', '/?replay&fixture=local&feed=connection');

    expect(expectLoaded(await loadReplayFromUrl()).feed).toBe('connection');
  });

  it('reports invalid local JSONL without throwing', async () => {
    sessionStorage.setItem('regrip.replay.jsonl', '{broken');
    history.replaceState(null, '', '/?replay&fixture=local');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await loadReplayFromUrl();

    expect(result.requested).toBe(true);
    expect(result).toMatchObject({ replay: undefined });
    if (!result.requested) throw new Error('Expected a requested replay');
    expect(result.error).toMatch(/Invalid JSONL replay input/);
    expect(warning).toHaveBeenCalledOnce();
  });

  it('builds entry and exit URLs without discarding unrelated parameters', () => {
    const current = 'https://example.test/regrip/?keep=yes&replay&fixture=local&feed=session';
    expect(buildMockDeviceUrl(current, 'gan-ui12')).toBe(
      'https://example.test/regrip/?keep=yes&replay=&fixture=gan-ui12',
    );
    expect(buildMockDeviceUrl(current)).toBe('https://example.test/regrip/?keep=yes');
  });

  it('does not mount against incomplete markup', () => {
    document.body.innerHTML = '<button id="connect"></button>';
    expect(() => mountMockDevicePicker({ load: { requested: false } })).not.toThrow();
  });

  it('navigates among bundled fixtures and exits active replay mode', () => {
    mountPicker();
    history.replaceState(null, '', '/console?keep=yes&replay&fixture=local');
    const navigate = vi.fn();
    mountMockDevicePicker({
      load: { requested: true, replay: {} as never },
      navigate,
    });

    expect(document.querySelector('#connect')?.textContent).toBe('Replay mode ▾');
    expect(document.querySelector<HTMLElement>('#mock-device-exit')?.closest('li')?.hidden).toBe(
      false,
    );
    click('[data-mock-fixture="gocube-edge"]');
    click('[data-mock-fixture="gan-ui12"]');
    click('[data-mock-fixture="invalid"]');
    click('#mock-device-exit');

    expect(navigate).toHaveBeenNthCalledWith(1, expect.stringContaining('fixture=gocube-edge'));
    expect(navigate).toHaveBeenNthCalledWith(2, expect.stringContaining('fixture=gan-ui12'));
    expect(navigate).toHaveBeenNthCalledWith(3, 'http://localhost:3000/console?keep=yes');
  });

  it('opens the JSONL chooser and ignores an empty selection', async () => {
    mountPicker();
    const input = document.querySelector<HTMLInputElement>('#mock-device-file')!;
    const inputClick = vi.spyOn(input, 'click');
    mountMockDevicePicker({ load: { requested: false }, navigate: vi.fn() });

    click('[data-mock-load]');
    expect(inputClick).toHaveBeenCalledOnce();
    input.dispatchEvent(new Event('change'));
    await Promise.resolve();
  });

  it('validates, stores, and opens a selected JSONL capture', async () => {
    mountPicker();
    const input = document.querySelector<HTMLInputElement>('#mock-device-file')!;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ text: async () => localReplay }],
    });
    const navigate = vi.fn();
    mountMockDevicePicker({ load: { requested: false }, navigate });

    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce());
    expect(sessionStorage.getItem('regrip.replay.jsonl')).toBe(localReplay);
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('fixture=local'));
  });

  it('shows validation errors for a bad selected capture', async () => {
    mountPicker();
    const input = document.querySelector<HTMLInputElement>('#mock-device-file')!;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ text: async () => '{broken' }],
    });
    mountMockDevicePicker({ load: { requested: false }, navigate: vi.fn() });

    input.dispatchEvent(new Event('change'));
    const status = document.querySelector<HTMLElement>('#mock-device-status')!;
    await vi.waitFor(() => expect(status.hidden).toBe(false));
    expect(status.textContent).toMatch(/Invalid JSONL replay input/);
    expect(input.value).toBe('');
  });
});
