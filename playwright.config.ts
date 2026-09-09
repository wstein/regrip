import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1920, height: 1080 },
  },
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  webServer: {
    command: 'npm run dev:vite -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
