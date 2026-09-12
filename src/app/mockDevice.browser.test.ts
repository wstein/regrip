// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildMockDeviceUrl, loadReplayFromUrl, type MockDeviceReplayLoad } from './mockDevice';

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
});
