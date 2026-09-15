import { expect, test } from './baseFixtures';

const liveConnectionModule = `
export async function connectCube() {
  const listeners = new Set();
  return {
    deviceName: 'Browser mock cube',
    deviceMAC: '',
    protocol: { id: 'mock', name: 'Mock' },
    capabilities: {
      gyroscope: true,
      battery: true,
      facelets: true,
      hardware: true,
      reset: true,
    },
    events$: {
      subscribe(listener) {
        listeners.add(listener);
        return { unsubscribe: () => listeners.delete(listener) };
      },
    },
    sendCommand: async (command) => {
      if (command.type === 'REQUEST_FACELETS') {
        const event = {
          type: 'FACELETS',
          timestamp: 1,
          facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
        };
        listeners.forEach((listener) => listener(event));
      }
    },
    disconnect: async () => {},
  };
}
`;

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

test('runs live cube controls against a connected transport', async ({ page }) => {
  await page.route('**/src/integration/connection.ts*', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: liveConnectionModule }),
  );
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/test/browser/mock-app.html');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');

  await page.locator('#connect').click();
  await page.locator('#connect-bluetooth').click();
  await expect(page.locator('#connectionStatus')).toHaveValue('Connected');
  await expect(page.locator('#command-panel')).toBeVisible();

  await page.locator('#sync-state').click();
  await expect(page.locator('#app-feedback')).toHaveText('Cube state synchronized.');

  await page.locator('#reset-gyro').click();
  await expect(page.locator('#app-feedback')).toHaveText('Gyro and virtual move frame reset.');
  await page.locator('#track-orientation').click();
  await expect(page.locator('#app-feedback')).toHaveText(
    'Gyro orientation tracking paused; drag the cube to set the view.',
  );

  await page.getByRole('button', { name: 'Reset state' }).click();
  await expect(page.locator('#app-feedback')).toHaveText('Cube state reset requested.');

  await page.locator('#connect').click();
  await page.locator('#disconnect-cube').click();
  await expect(page.locator('#connectionStatus')).toHaveValue('Disconnected');
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
