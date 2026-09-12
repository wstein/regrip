import { expect, test } from '@playwright/test';

// Tall enough that the whole `#app` fits in one frame — Playwright's
// screenshot stitching skews the top strip when the element exceeds the
// viewport height.
// Keep this aligned with the committed baselines. The app is responsive, but
// screenshot assertions require one explicit capture size on every platform.
test.use({ viewport: { width: 1408, height: 1600 } });

test('keeps detected moves clear of cube telemetry', async ({ page }) => {
  await page.goto('/test/browser/mock-app.html');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  const moves = await page.locator('.detected-moves-panel').boundingBox();
  const telemetry = await page.locator('.device-card').boundingBox();
  expect(moves).not.toBeNull();
  expect(telemetry).not.toBeNull();
  const separatedHorizontally = moves!.x + moves!.width <= telemetry!.x;
  const separatedVertically =
    moves!.y + moves!.height <= telemetry!.y || telemetry!.y + telemetry!.height <= moves!.y;
  expect(separatedHorizontally || separatedVertically).toBe(true);
});

test('keeps cube state actions visually equal on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto('/test/browser/mock-app.html');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  const reset = await page.locator('#reset-state').boundingBox();
  const copy = await page.locator('#copy-cube-state').boundingBox();
  expect(reset).not.toBeNull();
  expect(copy).not.toBeNull();
  expect(Math.abs(reset!.width - copy!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(reset!.height - copy!.height)).toBeLessThanOrEqual(1);
});

for (const fixture of ['disconnected', 'gocube-edge', 'gan-ui12'] as const) {
  test(`captures ${fixture} UI`, async ({ page }) => {
    await page.goto(
      `/test/browser/mock-app.html${fixture === 'disconnected' ? '' : `?replay&fixture=${fixture}&autoplay`}`,
    );
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('#app')).toHaveScreenshot(`${fixture}.png`, {
      // The committed baselines are captured on macOS while CI renders on
      // Ubuntu. Native font rasterization accounts for roughly 3% of pixels
      // in either state, so keep a small cross-platform allowance.
      maxDiffPixelRatio: 0.035,
    });
  });
}
