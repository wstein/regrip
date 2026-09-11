import { expect, test } from '@playwright/test';

// Tall enough that the whole `#app` fits in one frame — Playwright's
// screenshot stitching skews the top strip when the element exceeds the
// viewport height.
// Keep this aligned with the committed baselines. The app is responsive, but
// screenshot assertions require one explicit capture size on every platform.
test.use({ viewport: { width: 1408, height: 1600 } });

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
