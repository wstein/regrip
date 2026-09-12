import { expect, test } from '@playwright/test';
import { faceletsToPattern, kpuzzleReady } from '../../src/adapters/cubing/utils';

const replayHeader =
  '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"trace_header","data":{"format":"regrip","version":1}}';

test('drives elapsed time and expandable solve analysis from replay timestamps', async ({
  page,
}) => {
  const entries = [
    {
      at: '2026-09-09T10:00:00.000Z',
      type: 'cube_event',
      data: {
        type: 'FACELETS',
        timestamp: 100,
        facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
      },
    },
    { at: '2026-09-09T10:00:00.100Z', type: 'cube_event', data: moveData(200, 'R') },
    {
      at: '2026-09-09T10:00:00.300Z',
      type: 'virtual_regrip',
      data: { timestamp: 400, notationToken: 'x', sensorFrameToken: 'x' },
    },
    { at: '2026-09-09T10:00:00.600Z', type: 'cube_event', data: moveData(700, 'U2') },
    {
      at: '2026-09-09T10:00:00.700Z',
      type: 'custom_trigger',
      data: { timestamp: 800, move: "R U R'" },
    },
    { at: '2026-09-09T10:00:01.300Z', type: 'cube_event', data: moveData(1_400, "F'") },
    {
      at: '2026-09-09T10:00:01.500Z',
      type: 'cube_event',
      data: {
        type: 'FACELETS',
        timestamp: 1_600,
        facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
      },
    },
  ].map(({ at, type, data }) => JSON.stringify({ recordedAt: at, type, data }));
  await page.goto('/test/browser/mock-app.html?replay');
  await page.evaluate(
    (contents) => sessionStorage.setItem('regrip.replay.jsonl', contents),
    [replayHeader, ...entries].join('\n'),
  );
  await page.goto('/test/browser/mock-app.html?replay&fixture=local&feed=session');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  await page.evaluate(() => window.__smartcubeReplay?.advanceTo(Number.MAX_SAFE_INTEGER));

  await expect(page.locator('#sessionElapsed')).toHaveText('0:01.500');
  await page.locator('#solve-analysis').evaluate((details: HTMLDetailsElement) => {
    details.open = true;
  });
  await expect(page.locator('#solve-analysis-status')).toHaveText('Complete');
  await expect(page.locator('#solve-duration')).toHaveText('0:01.200');
  await expect(page.locator('#solve-tps')).toHaveText('2.50');
  await expect(page.locator('#solve-moves')).toHaveText('3 HTM · 4 QTM');
  await expect(page.locator('#solve-regrips')).toHaveText('1');
  await expect(page.locator('#solve-triggers')).toHaveText('1');
  await expect(page.locator('#solve-longest-pause')).toHaveText('0:00.700');
});

function moveData(timestamp: number, move: string) {
  return {
    type: 'MOVE',
    timestamp,
    localTimestamp: timestamp,
    cubeTimestamp: timestamp,
    face: 0,
    direction: 0,
    move,
  };
}

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
  await expect(page.locator('#copy-color-facelets')).toHaveText('Color facelets (WRGYOB)');
  await expect(page.locator('#copy-cubie-coordinates')).toHaveText('CP / CO / EP / EO');
  await expect(page.locator('#copy-sse-permutation')).toHaveText('SSE permutation');
  await expect(page.locator('#copy-kpattern-json')).toHaveText('KPattern JSON');
  await expect(page.locator('#copy-regrip-state-json')).toHaveText('Regrip state JSON');
  await expect(page.locator('.detected-moves-notation')).toContainText('Notation:');
  await expect(page.locator('#detected-notation-wca')).toHaveText('WCA');
  await expect(page.locator('#detected-notation-sign')).toHaveText('SiGN');
  await expect(page.locator('#detected-notation-sse')).toHaveText('SSE');
  await expect(page.locator('#detected-notation-raw-qtm')).toHaveText('Raw QTM');
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

  await page.locator('#detected-notation-sign').click();
  await expect(moves).toHaveValue("2D' f");

  await page.locator('#detected-notation-wca').click();
  await expect(moves).toHaveValue("E' Fw");

  await moves.fill("E2 M2 R L' R L'");
  await page.locator('#simplify-detected-moves').click();
  await expect(moves).toHaveValue('E2');
});

test('preserves the unsimplified body-frame move stream in Raw QTM', async ({ page }) => {
  await page.goto('/test/browser/mock-app.html?replay&fixture=gocube-edge');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => window.__smartcubeReplay?.advanceTo(Number.MAX_SAFE_INTEGER));

  const moves = page.locator('#detectedMoves');
  await page.locator('#simplify-detected-moves').click();
  await page.locator('#detected-notation-raw-qtm').click();

  await expect(moves).toHaveValue("R U U'");
  await expect(moves).toHaveAttribute('readonly', '');
  await expect(page.locator('#simplify-detected-moves')).toBeDisabled();

  await page.locator('#detected-notation-sign').click();
  await expect(moves).not.toHaveAttribute('readonly', '');
  await expect(page.locator('#simplify-detected-moves')).toBeEnabled();
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

test('navigates move keyframes and renders visual timeline markers', async ({ page }) => {
  await page.goto('/test/browser/mock-app.html?replay&fixture=gocube-edge');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  const markers = page.locator('#replay-markers .replay-marker');
  await expect(markers).toHaveCount(3);
  await expect(markers.first()).toHaveRole('button');
  await expect(markers.first()).toHaveAttribute('aria-label', 'Frame 6: R');
  await expect(markers.first()).toHaveAttribute('style', /left: 75%/);

  const nextMove = page.locator('#replay-next-move');
  const prevMove = page.locator('#replay-prev-move');

  await expect(prevMove).toBeDisabled();
  await expect(nextMove).toBeEnabled();

  // Move navigation lands after the selected event, so the turn is visible.
  await nextMove.click();
  await expect(page.locator('#replay-position')).toHaveText('6 / 8');
  await expect(page.locator('#detectedMoves')).toHaveValue('R');
  await expect(prevMove).toBeDisabled();

  await nextMove.click();
  await expect(page.locator('#replay-position')).toHaveText('7 / 8');
  await expect(page.locator('#detectedMoves')).toHaveValue('R U');
  await expect(prevMove).toBeEnabled();

  await page.locator('body').press('Shift+ArrowLeft');
  await expect(page.locator('#replay-position')).toHaveText('6 / 8');
  await expect(page.locator('#detectedMoves')).toHaveValue('R');

  await page.locator('body').press('Shift+ArrowRight');
  await expect(page.locator('#replay-position')).toHaveText('7 / 8');

  await markers.first().click();
  await expect(page.locator('#replay-position')).toHaveText('6 / 8');
  await expect(page.locator('#detectedMoves')).toHaveValue('R');

  await nextMove.click();
  await nextMove.click();
  await expect(page.locator('#replay-position')).toHaveText('8 / 8');
  await expect(nextMove).toBeDisabled();
});

test('renders accessible markers for replay move, regrip, and gesture events', async ({ page }) => {
  const records = [
    replayHeader,
    '{"recordedAt":"2026-09-09T10:00:00.010Z","type":"cube_event","data":{"type":"MOVE","timestamp":10,"move":"R"}}',
    '{"recordedAt":"2026-09-09T10:00:00.020Z","type":"virtual_regrip","data":{"timestamp":20,"notationToken":"y","sensorFrameToken":"y"}}',
    '{"recordedAt":"2026-09-09T10:00:00.030Z","type":"custom_trigger","data":{"timestamp":30,"move":"U"}}',
    '{"recordedAt":"2026-09-09T10:00:00.040Z","type":"shake_trigger","data":{"timestamp":40,"steps":4,"reversals":3,"spanMs":180}}',
  ].join('\n');
  await page.goto('/test/browser/mock-app.html?replay');
  await page.evaluate(
    (contents) => sessionStorage.setItem('regrip.replay.jsonl', contents),
    records,
  );
  await page.goto('/test/browser/mock-app.html?replay&fixture=local&feed=session');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  await expect(page.locator('.replay-marker-move')).toHaveAttribute('aria-label', 'Frame 1: R');
  await expect(page.locator('.replay-marker-regrip')).toHaveAttribute(
    'aria-label',
    'Frame 2: Regrip y',
  );
  await expect(page.locator('.replay-marker-trigger')).toHaveCount(2);
  await expect(page.locator('.replay-marker-trigger').nth(0)).toHaveAttribute(
    'aria-label',
    'Frame 3: Trigger U',
  );
  await expect(page.locator('.replay-marker-trigger').nth(1)).toHaveAttribute(
    'aria-label',
    'Frame 4: Shake (4 steps)',
  );
});
