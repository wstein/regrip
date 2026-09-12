import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test as baseTest } from '@playwright/test';

const outputDirectory = join(process.cwd(), '.nyc_output');

export const test = baseTest.extend({
  context: async ({ context }, use) => {
    await mkdir(outputDirectory, { recursive: true });
    await context.exposeFunction('collectIstanbulCoverage', async (coverage: unknown) => {
      if (!coverage) return;
      await writeFile(
        join(outputDirectory, `playwright-${randomUUID()}.json`),
        JSON.stringify(coverage),
      );
    });
    await context.addInitScript(() => {
      window.addEventListener('beforeunload', () => {
        void window.collectIstanbulCoverage?.(window.__coverage__);
      });
    });

    await use(context);

    for (const page of context.pages()) {
      await page
        .evaluate(() => window.collectIstanbulCoverage?.(window.__coverage__))
        .catch(() => undefined);
    }
  },
});

export const expect = test.expect;

declare global {
  interface Window {
    __coverage__?: unknown;
    collectIstanbulCoverage?: (coverage: unknown) => Promise<void>;
  }
}
