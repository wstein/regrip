import { expect, test } from '@playwright/test';

test('keeps replay analysis and trace exports browser-local', async ({ page }) => {
  const networkRequests: Array<{ method: string; url: string }> = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      networkRequests.push({ method: request.method(), url: request.url() });
    }
  });

  await page.goto('/test/browser/mock-app.html?replay&fixture=gocube-edge&autoplay');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#moveCount')).not.toHaveText('0');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (value: string) => localStorage.setItem('privacy-copy', value) },
    });
  });
  await page.locator('#copy-log').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('privacy-copy'))).not.toBeNull();

  const downloadStarted = page.waitForEvent('download');
  await page.locator('#download-log').click();
  await downloadStarted;

  const pageOrigin = new URL(page.url()).origin;
  expect(networkRequests.filter(({ url }) => new URL(url).origin !== pageOrigin)).toEqual([]);
  expect(networkRequests.filter(({ method }) => method !== 'GET' && method !== 'HEAD')).toEqual([]);
});
