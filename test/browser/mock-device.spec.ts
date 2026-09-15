import { expect, test } from './baseFixtures';

test('returns the non-replay Console to a usable state when Bluetooth connection fails', async ({
  page,
}) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: {
        requestDevice: async () => {
          throw new Error('Bluetooth access denied');
        },
      },
    });
  });
  await page.goto('/test/browser/mock-app.html');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  await page.locator('#connect').click();
  await page.locator('#connect-bluetooth').click();

  await expect(page.locator('#connectionStatus')).toHaveValue(/^Failed:/);
  await expect(page.locator('#connect')).toHaveText('Connect ▾');
  await expect(page.locator('#command-panel')).toBeHidden();
});

test('selects and exits a bundled replay from the production app entry', async ({ page }) => {
  await page.goto('/console/?keep=yes');

  await page.locator('#connect').click();
  await expect(page.locator('#connect-menu')).toBeVisible();
  await expect(page.locator('#connect-bluetooth')).toHaveText(
    'Connect Bluetooth Cube (Web Bluetooth)',
  );
  await expect(page.locator('#connect-menu')).toContainText('Replay captures');
  await page.getByRole('button', { name: 'GoCube Edge (demo)' }).click();

  await expect(page).toHaveURL(/keep=yes.*replay=.*fixture=gocube-edge/);
  await expect(page.locator('#connectionStatus')).toHaveValue('Connected');
  await expect(page.locator('#replay-panel')).toBeVisible();
  await expect(page.locator('#command-panel')).toBeHidden();
  await expect(page.locator('#replay-identity')).toContainText('GoCube Edge');
  await expect(page.locator('#connect')).toHaveText('Replay mode ▾');

  await page.locator('#replay-next-move').click();
  await expect(page.locator('#detectedMoves')).not.toHaveValue('');

  await page.locator('#connect').click();
  await page.getByRole('button', { name: 'Exit replay mode' }).click();
  await expect(page).toHaveURL(/\?keep=yes$/);
  await expect(page.locator('#connect')).toHaveText('Connect ▾');
  await expect(page.locator('#replay-panel')).toBeHidden();
});
