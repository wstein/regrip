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

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('replay panel edge interactions', () => {
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
