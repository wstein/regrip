// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ReplaySessionController } from '@wstein/regrip-core/session/replay/replaySession';
import { mountReplayPanel } from './replayPanel';

function mountMarkup(): void {
  document.body.innerHTML = `
    <section id="replay-panel" hidden>
      <button id="replay-reset"></button><button id="replay-play"></button>
      <button id="replay-step"></button><button id="replay-prev-move"></button>
      <button id="replay-next-move"></button><input id="replay-scrubber">
      <span id="replay-position"></span><select id="replay-speed"><option value="1">1</option></select>
      <select id="replay-feed"><option value="session">session</option><option value="connection">connection</option></select>
      <button id="replay-load"></button><div id="replay-markers"></div>
      <span id="replay-identity"></span><section id="replay-import" hidden></section>
      <textarea id="replay-jsonl"></textarea><div id="replay-dropzone"></div>
      <button id="replay-import-submit"></button><button id="replay-import-cancel"></button>
      <span id="replay-import-status"></span>
    </section>`;
}

function replayController(overrides: Record<string, unknown> = {}): ReplaySessionController {
  return {
    feed: 'session',
    length: 0,
    position: 0,
    done: false,
    virtualNowMs: 0,
    identity: { deviceName: 'Test cube', protocol: { id: 'mock' } },
    items: [],
    seekTo: vi.fn().mockResolvedValue(undefined),
    stepOne: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
    advanceTo: vi.fn().mockResolvedValue(undefined),
    subscribeCursor: vi.fn(),
    ...overrides,
  } as unknown as ReplaySessionController;
}

function click(selector: string): void {
  document.querySelector<HTMLElement>(selector)?.click();
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('replay panel edge interactions', () => {
  it('plays, advances on animation frames, and pauses cleanly', async () => {
    mountMarkup();
    const callbacks: FrameRequestCallback[] = [];
    const cancelFrame = vi.fn();
    const advanceTo = vi.fn().mockResolvedValue(undefined);
    const replay = replayController({
      length: 2,
      items: [{ timestamp: 1 }, { timestamp: 2 }],
      advanceTo,
    });
    mountReplayPanel(replay, {
      now: () => 100,
      requestFrame: (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      cancelFrame,
    });

    click('#replay-play');
    expect(document.querySelector('#replay-play')?.textContent).toBe('Pause');
    callbacks.shift()?.(150);
    await vi.waitFor(() => expect(advanceTo).toHaveBeenCalledWith(50));
    click('#replay-play');
    expect(cancelFrame).toHaveBeenCalled();
    expect(document.querySelector('#replay-play')?.textContent).toBe('Play');
  });

  it('renders event markers and seeks from markers and the scrubber', async () => {
    mountMarkup();
    const seekTo = vi.fn().mockResolvedValue(undefined);
    const replay = replayController({
      length: 4,
      position: 0,
      seekTo,
      items: [
        { timestamp: 1, event: { type: 'MOVE', move: 'R' } },
        { timestamp: 2, event: { type: 'REGRIP', notationToken: 'x' } },
        { timestamp: 3, event: { type: 'SHAKE', steps: 4 } },
        { timestamp: 4 },
      ],
    });
    mountReplayPanel(replay);

    expect(document.querySelectorAll('.replay-marker')).toHaveLength(3);
    expect(document.querySelector('.replay-marker-move')?.getAttribute('aria-label')).toBe(
      'Frame 1: R',
    );
    click('.replay-marker-trigger');
    await vi.waitFor(() => expect(seekTo).toHaveBeenCalledWith(3));

    const scrubber = document.querySelector<HTMLInputElement>('#replay-scrubber')!;
    scrubber.value = '2';
    scrubber.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(seekTo).toHaveBeenCalledWith(2));
  });

  it('switches feeds and imports valid JSONL into session-local storage', () => {
    mountMarkup();
    const navigate = vi.fn();
    const storage = { setItem: vi.fn() };
    const replay = replayController();
    mountReplayPanel(replay, { navigate, storage });

    const feed = document.querySelector<HTMLSelectElement>('#replay-feed')!;
    feed.value = 'connection';
    feed.dispatchEvent(new Event('change'));
    expect(navigate).toHaveBeenLastCalledWith('feed=connection');

    const contents =
      '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"trace_header","data":{"format":"regrip","version":1,"session":{"device":"Imported cube","protocol":{"id":"mock","name":"Mock"}}}}';
    document.querySelector<HTMLTextAreaElement>('#replay-jsonl')!.value = contents;
    click('#replay-import-submit');

    expect(storage.setItem).toHaveBeenCalledWith('regrip.replay.jsonl', contents);
    expect(document.querySelector('#replay-import-status')?.textContent).toBe(
      'Loaded Imported cube · mock',
    );
    expect(navigate).toHaveBeenLastCalledWith('replay=&fixture=local&feed=session');
  });

  it('guards unavailable move navigation and keyboard shortcuts inside editors', async () => {
    mountMarkup();
    const seekTo = vi.fn().mockResolvedValue(undefined);
    const replay = {
      feed: 'session',
      length: 1,
      position: 0,
      done: false,
      virtualNowMs: 0,
      identity: { deviceName: 'Test cube', protocol: { id: 'mock' } },
      items: [{ timestamp: 1, event: { type: 'MOVE', move: 'R' } }],
      seekTo,
      stepOne: vi.fn(),
      reset: vi.fn(),
      advanceTo: vi.fn(),
      subscribeCursor: vi.fn(),
    } as unknown as ReplaySessionController;
    mountReplayPanel(replay);

    document.querySelector('#replay-prev-move')?.dispatchEvent(new Event('click'));
    expect(seekTo).not.toHaveBeenCalled();
    document.querySelector('#replay-next-move')?.dispatchEvent(new Event('click'));
    await Promise.resolve();
    expect(seekTo).toHaveBeenCalledWith(1);

    document
      .querySelector('#replay-jsonl')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft', shiftKey: true }),
      );
    expect(seekTo).toHaveBeenCalledTimes(1);
  });

  it('reports a rejected dropped-file read', async () => {
    mountMarkup();
    const replay = {
      feed: 'session',
      length: 0,
      position: 0,
      done: true,
      virtualNowMs: 0,
      items: [],
      identity: { deviceName: 'Test cube', protocol: { id: 'mock' } },
      seekTo: vi.fn(),
      stepOne: vi.fn(),
      reset: vi.fn(),
      advanceTo: vi.fn(),
      subscribeCursor: vi.fn(),
    } as unknown as ReplaySessionController;
    mountReplayPanel(replay);
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', {
      value: { files: { item: () => ({ text: () => Promise.reject(new Error('read failed')) }) } },
    });
    document.querySelector('#replay-dropzone')?.dispatchEvent(drop);
    await vi.waitFor(() =>
      expect(document.querySelector('#replay-import-status')?.textContent).toBe(
        'Unable to read that file.',
      ),
    );
  });
});
