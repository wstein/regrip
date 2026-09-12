import { expect, test } from './baseFixtures';

test('collapses live trace sidebar into slim rail and expands workspace', async ({ page }) => {
  await page.goto('/test/browser/mock-app.html?replay&fixture=gocube-edge');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  const eventLog = page.locator('#event-log');
  const toggleBtn = page.locator('#toggle-trace-collapse');
  const rail = page.locator('#trace-collapsed-rail');
  const workspaceCard = page.locator('.workspace-card');

  // 1. Initially expanded
  await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
  await expect(eventLog).toHaveAttribute('data-collapsed', 'false');
  await expect(rail).toBeHidden();

  const initialLogBox = await eventLog.boundingBox();
  const initialWsBox = await workspaceCard.boundingBox();
  expect(initialLogBox?.width).toBeGreaterThanOrEqual(250);

  // 2. Click collapse
  await toggleBtn.click();

  await expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  await expect(eventLog).toHaveAttribute('data-collapsed', 'true');
  await expect(rail).toBeVisible();

  // Wait for CSS transition
  await page.waitForTimeout(300);

  const collapsedLogBox = await eventLog.boundingBox();
  const expandedWsBox = await workspaceCard.boundingBox();

  // Event log width is slim rail (~3.2rem / ~52px)
  expect(collapsedLogBox?.width).toBeLessThanOrEqual(65);
  // Workspace card has expanded to take up released space
  expect(expandedWsBox?.width).toBeGreaterThan(initialWsBox?.width ?? 0);

  // 3. Captured events update the badge while collapsed
  const badge = page.locator('#trace-collapsed-badge');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(badge).not.toHaveText('0');

  // 4. Click collapsed rail to expand back
  await rail.click();
  await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
  await expect(eventLog).toHaveAttribute('data-collapsed', 'false');
  await expect(rail).toBeHidden();

  await page.waitForTimeout(300);
  const restoredLogBox = await eventLog.boundingBox();
  expect(restoredLogBox?.width).toBeGreaterThanOrEqual(250);
});
