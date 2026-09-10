import { expect, test } from '@playwright/test';

const replayHeader =
  '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"trace_header","data":{"format":"regrip","version":1}}';

test('serializes a burst of real TwistyPlayer moves from the replay stream', async ({ page }) => {
  const events = [
    {
      type: 'FACELETS',
      timestamp: 10,
      facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
    },
    { type: 'MOVE', timestamp: 11, move: 'R', face: 1, direction: 0 },
    { type: 'MOVE', timestamp: 11, move: 'U', face: 0, direction: 0 },
    { type: 'MOVE', timestamp: 11, move: 'F', face: 2, direction: 0 },
  ].map((data) =>
    JSON.stringify({
      recordedAt: '2026-09-09T10:00:00.011Z',
      type: 'cube_event',
      data: { ...data, localTimestamp: data.timestamp, cubeTimestamp: null },
    }),
  );
  await page.goto('/test/browser/mock-app.html?replay');
  await page.evaluate(
    (contents) => sessionStorage.setItem('regrip.replay.jsonl', contents),
    [replayHeader, ...events].join('\n'),
  );
  await page.goto('/test/browser/mock-app.html?replay&fixture=local');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  await page.evaluate(() => window.__smartcubeReplay?.advanceTo(Number.MAX_SAFE_INTEGER));
  const player = page.locator('twisty-player');
  await expect(player).toBeVisible();
  await expect
    .poll(() =>
      player.evaluate(async (element) => {
        const model = (
          element as unknown as {
            experimentalModel: { alg: { get: () => Promise<{ alg: { toString: () => string } }> } };
          }
        ).experimentalModel;
        return (await model.alg.get()).alg.toString();
      }),
    )
    .toBe('R U F');
});

test('steps, seeks, and resets a JSONL fixture in the real lab', async ({ page }) => {
  await page.goto('/test/browser/mock-app.html?replay&fixture=gocube-edge');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  const panel = page.locator('#replay-panel');
  const position = page.locator('#replay-position');
  await expect(panel).toBeVisible();
  await expect(position).toHaveText(/0 \/ \d+/);

  await page.locator('#replay-step').click();
  await expect(position).not.toHaveText(/0 \/ \d+/);

  await page.locator('#replay-scrubber').evaluate((node: HTMLInputElement) => {
    node.value = node.max;
    node.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(position).toHaveText(/^(\d+) \/ \1$/);

  await page.locator('#replay-reset').click();
  await expect(position).toHaveText(/0 \/ \d+/);
});

test('plays immediately from the first capture timestamp', async ({ page }) => {
  await page.goto('/test/browser/mock-app.html?replay&fixture=gocube-edge');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  await page.locator('#replay-play').click();

  await expect(page.locator('#replay-position')).not.toHaveText(/0 \/ \d+/);
});

test('pause stops the virtual transport before another frame can advance it', async ({ page }) => {
  const header =
    '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"trace_header","data":{"format":"regrip","version":1}}';
  const events = Array.from({ length: 4 }, (_, index) =>
    JSON.stringify({
      recordedAt: `2026-09-09T10:00:0${index + 1}.000Z`,
      type: 'cube_event',
      data: { type: 'BATTERY', timestamp: (index + 1) * 1_000, batteryLevel: 98 },
    }),
  );
  await page.goto('/test/browser/mock-app.html?replay');
  await page.evaluate(
    (contents) => sessionStorage.setItem('regrip.replay.jsonl', contents),
    [header, ...events].join('\n'),
  );
  await page.goto('/test/browser/mock-app.html?replay&fixture=local');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  await page.locator('#replay-play').click();
  await expect(page.locator('#replay-position')).toHaveText('1 / 4');
  await page.locator('#replay-play').click();
  await expect(page.locator('#replay-play')).toHaveText('Play');
  await page.waitForTimeout(150);
  await expect(page.locator('#replay-position')).toHaveText('1 / 4');
});

test('loads a pasted JSONL capture locally and exposes its identity', async ({ page }) => {
  await page.goto('/test/browser/mock-app.html?replay');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  await page.locator('#replay-load').click();
  await page
    .locator('#replay-jsonl')
    .fill(
      [
        '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"trace_header","data":{"format":"regrip","version":1,"session":{"device":"GoCube Edge","protocol":"gocube"}}}',
        '{"recordedAt":"2026-09-09T10:00:00.010Z","type":"cube_event","data":{"type":"BATTERY","timestamp":10,"batteryLevel":98}}',
      ].join('\n'),
    );
  await page.locator('#replay-import-submit').click();

  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#replay-identity')).toHaveText('GoCube Edge · gocube');
  await expect(page.locator('#replay-position')).toHaveText('0 / 1');
});

test('reports JSONL import validation errors without replacing the current replay', async ({
  page,
}) => {
  await page.goto('/test/browser/mock-app.html?replay');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.locator('#replay-load').click();

  const input = page.locator('#replay-jsonl');
  const status = page.locator('#replay-import-status');
  await input.fill('{invalid}');
  await page.locator('#replay-import-submit').click();
  await expect(status).toContainText('line 1: invalid JSON');

  await input.fill(
    '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"trace_header","data":{"format":"regrip","version":2}}',
  );
  await page.locator('#replay-import-submit').click();
  await expect(status).toContainText('line 1: unsupported version 2');

  await input.fill(
    '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"cube_event","data":{"type":"MOVE"}}',
  );
  await page.locator('#replay-import-submit').click();
  await expect(status).toContainText('cube_event data requires string type and numeric timestamp');
});

test('pauses trace auto-follow after scrolling and resumes it with Newest', async ({ page }) => {
  const header =
    '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"trace_header","data":{"format":"regrip","version":1}}';
  const events = Array.from({ length: 40 }, (_, index) =>
    JSON.stringify({
      recordedAt: `2026-09-09T10:00:00.${String(index + 1).padStart(3, '0')}Z`,
      type: 'cube_event',
      data: { type: 'BATTERY', timestamp: index + 1, batteryLevel: 98 },
    }),
  );
  await page.goto('/test/browser/mock-app.html?replay');
  await page.evaluate(
    (contents) => sessionStorage.setItem('regrip.replay.jsonl', contents),
    [header, ...events].join('\n'),
  );
  await page.goto('/test/browser/mock-app.html?replay&fixture=local');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  await page.evaluate(() => window.__smartcubeReplay?.seekTo(30));
  await expect(page.locator('#replay-position')).toHaveText('30 / 40');
  const rows = page.locator('#event-log-rows');
  await expect
    .poll(() => rows.evaluate((node) => node.scrollHeight > node.clientHeight))
    .toBe(true);

  await rows.evaluate((node: HTMLElement) => {
    node.scrollTop = node.scrollHeight;
    node.dispatchEvent(new Event('scroll'));
  });
  await expect(page.locator('#follow-trace')).toBeEnabled();
  await page.locator('#replay-step').click();
  await expect.poll(() => rows.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);

  await page.locator('#follow-trace').click();
  await expect.poll(() => rows.evaluate((node) => node.scrollTop)).toBe(0);
  await expect(page.locator('#follow-trace')).toBeDisabled();
});
