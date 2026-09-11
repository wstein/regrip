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
      // The disconnected state is mostly text and blank space, so macOS and
      // Ubuntu font rasterizers account for a larger fraction of its pixels.
      // Connected states retain the tighter UI-regression threshold.
      maxDiffPixelRatio: fixture === 'disconnected' ? 0.035 : 0.02,
    });
  });
}
