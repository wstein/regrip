import { expect, test } from '@playwright/test';

test('renders a visible X/Y/Z orientation gizmo in a real WebGL canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/test/browser/gizmo-harness.html');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  const canvas = page.locator('#fixture canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('width', '320');
  const pixels = JSON.parse((await canvas.getAttribute('data-axis-pixels')) ?? '{}') as Record<
    string,
    number
  >;

  // X is red, Y is white, and Z is green. Counting their rendered pixels is
  // intentionally less brittle than a cross-platform screenshot baseline.
  expect(pixels.red).toBeGreaterThan(30);
  expect(pixels.white).toBeGreaterThan(30);
  expect(pixels.green).toBeGreaterThan(30);
  expect(errors).toEqual([]);
});
