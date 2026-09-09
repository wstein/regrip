import { expect, test } from '@playwright/test';

for (const fixture of ['disconnected', 'gocube-edge', 'gan-ui12'] as const) {
  test(`captures ${fixture} UI`, async ({ page }) => {
    await page.goto(
      `/test/browser/mock-app.html${fixture === 'disconnected' ? '' : `?fixture=${fixture}`}`,
    );
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('#app')).toHaveScreenshot(`${fixture}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
}
