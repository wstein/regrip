import { expect, test } from '@playwright/test';

// Tall enough that the whole `#app` fits in one frame — Playwright's
// screenshot stitching skews the top strip when the element exceeds the
// viewport height.
test.use({ viewport: { width: 1920, height: 1600 } });

for (const fixture of ['disconnected', 'gocube-edge', 'gan-ui12'] as const) {
  test(`captures ${fixture} UI`, async ({ page }) => {
    await page.goto(
      `/test/browser/mock-app.html${fixture === 'disconnected' ? '' : `?fixture=${fixture}`}`,
    );
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('#app')).toHaveScreenshot(`${fixture}.png`, {
      maxDiffPixelRatio: 0.02,
    });
  });
}
