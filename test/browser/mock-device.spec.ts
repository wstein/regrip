import { expect, test } from '@playwright/test';

test('selects and exits a bundled mock cube from the production app entry', async ({ page }) => {
  await page.goto('/?keep=yes');

  await page.locator('#connect').click();
  await expect(page.locator('#connect-menu')).toBeVisible();
  await expect(page.locator('#connect-bluetooth')).toHaveText(
    'Connect Bluetooth Cube (Web Bluetooth)',
  );
  await expect(page.locator('#connect-menu')).toContainText('Demo mock cubes');
  await page.getByRole('button', { name: 'GoCube Edge (demo)' }).click();

  await expect(page).toHaveURL(/keep=yes.*replay=.*fixture=gocube-edge/);
  await expect(page.locator('#connectionStatus')).toHaveValue('Connected');
  await expect(page.locator('#replay-panel')).toBeVisible();
  await expect(page.locator('#replay-identity')).toContainText('GoCube Edge');
  await expect(page.locator('#connect')).toHaveText('Mock cube active ▾');

  await page.locator('#replay-next-move').click();
  await expect(page.locator('#detectedMoves')).not.toHaveValue('');

  await page.locator('#connect').click();
  await page.getByRole('button', { name: 'Exit mock mode' }).click();
  await expect(page).toHaveURL(/\?keep=yes$/);
  await expect(page.locator('#connect')).toHaveText('Connect ▾');
  await expect(page.locator('#replay-panel')).toBeHidden();
});
