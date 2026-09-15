import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

describe('landing page / console routing', () => {
  const landing = read('index.html');
  const console_ = read('console/index.html');
  const docsConfig = read('docs/site/.vitepress/config.mts');
  const viteConfig = read('vite.config.ts');
  const coverageDashboard = read('docs/site/coverage/index.md');

  it('serves the landing page at the site root, not the console', () => {
    expect(landing).toContain('Read every move your cube makes.');
    expect(landing).not.toContain('id="app"');
  });

  it('sends every landing CTA into the relocated console', () => {
    const ctaCount = landing.match(/href="\.\/console\/"/g)?.length ?? 0;
    expect(ctaCount).toBeGreaterThanOrEqual(3);
    expect(landing).not.toMatch(/href="\.\/index\.html"/);
  });

  it('links the landing page back to docs at the shared site root', () => {
    expect(landing).toContain('href="./docs/"');
  });

  it('uses the console screenshot as an accessible Console link', () => {
    expect(landing).toContain('href="./console/" aria-label="Open Console"');
    expect(landing).toContain('src="./docs/assets/regrip-console-main.png"');
    expect(landing).toContain('max-width: 688px');
  });

  it('serves the console app at /console/, linking back to the landing home', () => {
    expect(console_).toContain('id="app"');
    expect(console_).toContain('href="../"');
  });

  it("keeps the console's docs links correct one level down from the site root", () => {
    expect(console_).toContain('href="../docs/"');
    expect(console_).toContain('href="../docs/api/"');
    expect(console_).toContain('href="../docs/coverage/"');
  });

  it('does not serve the landing page as an SPA fallback for the separate docs site', () => {
    expect(viteConfig).toContain("appType: 'mpa'");
  });

  it('serves the docs site behind the Console dev server', () => {
    expect(packageJson.scripts.dev).toContain('dev:docs');
    expect(packageJson.scripts['dev:docs']).toContain('--host 127.0.0.1 --port 5174 --base /docs/');
    expect(viteConfig).toContain("target: 'http://127.0.0.1:5174'");
  });

  it('links docs navigation back to the landing page at the current site base', () => {
    expect(docsConfig).toContain("{ text: 'Home', link: '../' }");
  });

  it('builds documentation below the Vite landing artifact instead of replacing it', () => {
    expect(docsConfig).toContain("outDir: '../../dist/docs'");
    expect(packageJson.scripts['docs:build']).toBe(
      'npm run docs:api && node scripts/stage-profile-schema.mjs && vitepress build docs/site',
    );
  });

  it('keeps report detail pages out of the published coverage dashboard', () => {
    expect(coverageDashboard).not.toContain('./app/index.html');
    expect(coverageDashboard).not.toContain('./core/index.html');
    expect(coverageDashboard).not.toContain('<iframe');
    expect(docsConfig).not.toContain('mpa: true');
  });
});
