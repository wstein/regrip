import { expect, test } from '@playwright/test';

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
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(position).toHaveText(/\d+ \/ \d+/);

  await page.locator('#replay-reset').click();
  await expect(position).toHaveText(/0 \/ \d+/);
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
