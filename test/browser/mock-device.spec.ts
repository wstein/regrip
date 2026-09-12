import { expect, test } from '@playwright/test';

test('selects and exits a bundled mock cube from the production app entry', async ({ page }) => {
  await page.goto('/?keep=yes');

  await page.locator('#mock-device-toggle').click();
  await page.getByRole('button', { name: 'GoCube Edge (demo)' }).click();

  await expect(page).toHaveURL(/keep=yes.*replay=.*fixture=gocube-edge/);
  await expect(page.locator('#connectionStatus')).toHaveValue('Connected');
  await expect(page.locator('#replay-panel')).toBeVisible();
  await expect(page.locator('#replay-identity')).toContainText('GoCube Edge');
  await expect(page.locator('#mock-device-badge')).toBeVisible();
  await expect(page.locator('#connect')).toHaveText('Disconnect');

  await page.locator('#replay-next-move').click();
  await expect(page.locator('#detectedMoves')).not.toHaveValue('');

  await page.getByRole('button', { name: 'Exit mock' }).click();
  await expect(page).toHaveURL(/\?keep=yes$/);
  await expect(page.locator('#mock-device-toggle')).toBeVisible();
  await expect(page.locator('#connect')).toHaveText('Connect');
  await expect(page.locator('#replay-panel')).toBeHidden();
});
