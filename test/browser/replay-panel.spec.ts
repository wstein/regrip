import { expect, test } from '@playwright/test';
import { faceletsToPattern, kpuzzleReady } from '../../src/adapters/cubing/utils';

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

test('copies the complete current JSONL trace', async ({ page }) => {
  await page.goto('/test/browser/mock-app.html?replay&fixture=gocube-edge');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => window.__smartcubeReplay?.advanceTo(Number.MAX_SAFE_INTEGER));

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (value: string) => localStorage.setItem('copied-jsonl', value) },
    });
  });
  await page.locator('#copy-log').click();

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('copied-jsonl')))
    .toContain('"type":"trace_header"');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('copied-jsonl')))
    .toContain('"type":"cube_event"');
  await expect(page.locator('#app-feedback')).toHaveText('Trace JSONL copied.');
});

test('renders the replayed cubie permutation, not only its algorithm text', async ({ page }) => {
  await page.goto('/test/browser/mock-app.html?replay&fixture=gocube-edge');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  await page.evaluate(() => window.__smartcubeReplay?.advanceTo(Number.MAX_SAFE_INTEGER));
  const player = page.locator('twisty-player');
  await expect(player).toBeVisible();

  await expect
    .poll(() =>
      player.evaluate(async (element) => {
        const model = (
          element as unknown as {
            experimentalModel: {
              currentPattern: {
                get: () => Promise<{ patternData: { EDGES: { pieces: number[] } } }>;
              };
            };
          }
        ).experimentalModel;
        return (await model.currentPattern.get()).patternData.EDGES.pieces;
      }),
    )
    .not.toEqual(Array.from({ length: 12 }, (_, index) => index));
  await expect(page.locator('#cubieState')).not.toHaveValue('');
  await page.locator('#copy-cube-state').click();
  await expect(page.locator('#copy-cubie-coordinates')).toHaveText('CP / CO / EP / EO');
  await expect(page.locator('#copy-sse-permutation')).toHaveText('SSE permutation');
  await expect(page.locator('#detected-notation-wca')).toHaveText('WCA');
  await expect(page.locator('#detected-notation-twizzle')).toHaveText('Twizzle');
  await expect(page.locator('#detected-notation-sse')).toHaveText('SSE');
});

test('switches the editable detected-move notation without changing its canonical stream', async ({
  page,
}) => {
  await page.goto('/test/browser/mock-app.html?replay&fixture=gocube-edge');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  const moves = page.locator('#detectedMoves');
  await moves.fill("U' D Rw x");
  await expect(page.locator('#moveCount')).toHaveText('4');

  await page.locator('#detected-notation-sse').click();
  await expect(moves).toHaveValue("U' D TR CR");
  await expect(page.locator('#moveCount')).toHaveText('4');

  await page.locator('#simplify-detected-moves').click();
  await expect(moves).toHaveValue("MD' TF");
  await expect(page.locator('#moveCount')).toHaveText('2');

  await page.locator('#detected-notation-twizzle').click();
  await expect(moves).toHaveValue("2D' f");

  await page.locator('#detected-notation-wca').click();
  await expect(moves).toHaveValue("E' Fw");

  await moves.fill("E2 M2 R L' R L'");
  await page.locator('#simplify-detected-moves').click();
  await expect(moves).toHaveValue('E2');
});

test('aligns syntax-highlighted tokens pixel-for-pixel with textarea caret position', async ({
  page,
}) => {
  await page.goto('/test/browser/mock-app.html?replay&fixture=gocube-edge');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  const moves = page.locator('#detectedMoves');
  await moves.fill('B F d Dw2');

  const { diff, minGap } = await page.evaluate(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>('#detectedMoves')!;
    const tokens = Array.from(document.querySelectorAll<HTMLElement>('.move-token'));
    const dToken = tokens[2]; // 'd'
    const measurer = document.createElement('span');
    measurer.style.font = window.getComputedStyle(textarea).font;
    measurer.style.wordSpacing = window.getComputedStyle(textarea).wordSpacing;
    measurer.style.letterSpacing = '0';
    measurer.style.whiteSpace = 'pre';
    measurer.textContent = 'B F ';
    document.body.appendChild(measurer);
    const expectedX =
      textarea.getBoundingClientRect().left +
      parseFloat(window.getComputedStyle(textarea).paddingLeft) +
      measurer.getBoundingClientRect().width;
    const dTextRange = document.createRange();
    dTextRange.selectNodeContents(dToken.firstChild!);
    const actualTextX = dTextRange.getBoundingClientRect().left;
    measurer.remove();

    let minGap = Infinity;
    for (let i = 0; i < tokens.length - 1; i++) {
      const gap =
        tokens[i + 1].getBoundingClientRect().left - tokens[i].getBoundingClientRect().right;
      if (gap < minGap) minGap = gap;
    }

    return { diff: Math.abs(expectedX - actualTextX), minGap };
  });

  expect(diff).toBeLessThanOrEqual(0.5);
  expect(minGap).toBeGreaterThanOrEqual(8);
});

test('renders the authoritative facelet snapshot after repeated sync requests', async ({
  page,
}) => {
  const header =
    '{"recordedAt":"2026-09-10T17:30:11.611Z","type":"trace_header","data":{"format":"regrip","version":1}}';
  const events = [
    {
      type: 'FACELETS',
      timestamp: 142_229,
      facelets: 'UUUUUUUUURRRRRRDDRFFFFFFFDLRFBDDLDDDLLLLLLFBDBBBBBBBRL',
    },
    {
      type: 'FACELETS',
      timestamp: 144_447,
      facelets: 'UUUUUUUUURRRRRRDDRFFFFFFFDLRFBDDLDDDLLLLLLFBDBBBBBBBRL',
    },
    { type: 'MOVE', timestamp: 145_616, move: 'D', face: 3, direction: 0 },
    { type: 'MOVE', timestamp: 145_766, move: 'D', face: 3, direction: 0 },
    {
      type: 'FACELETS',
      timestamp: 146_971,
      facelets: 'UUUUUUUUURRRRRRFBDFFFFFFBRLDDDLDDBFRLLLLLLDDRBBBBBBFDL',
    },
  ].map((data) =>
    JSON.stringify({
      recordedAt: '2026-09-10T17:30:00.000Z',
      type: 'cube_event',
      data: { ...data, localTimestamp: data.timestamp, cubeTimestamp: null },
    }),
  );
  await page.goto('/test/browser/mock-app.html?replay');
  await page.evaluate(
    (contents) => sessionStorage.setItem('regrip.replay.jsonl', contents),
    [header, ...events].join('\n'),
  );
  await page.goto('/test/browser/mock-app.html?replay&fixture=local');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  await page.evaluate(() => window.__smartcubeReplay?.advanceTo(Number.MAX_SAFE_INTEGER));
  const player = page.locator('twisty-player');
  const finalFacelets = 'UUUUUUUUURRRRRRFBDFFFFFFBRLDDDLDDBFRLLLLLLDDRBBBBBBFDL';
  await kpuzzleReady;
  const pattern = faceletsToPattern(finalFacelets).patternData;
  const expected = {
    EDGES: pattern.EDGES,
    CORNERS: pattern.CORNERS,
    CENTERS: pattern.CENTERS,
  };
  await expect
    .poll(() =>
      player.evaluate(async (element) => {
        const model = (
          element as unknown as {
            experimentalModel: { currentPattern: { get: () => Promise<{ patternData: unknown }> } };
          }
        ).experimentalModel;
        const pattern = (await model.currentPattern.get()).patternData as Record<string, unknown>;
        return {
          EDGES: pattern.EDGES,
          CORNERS: pattern.CORNERS,
          CENTERS: pattern.CENTERS,
        };
      }),
    )
    .toEqual(expected);
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
