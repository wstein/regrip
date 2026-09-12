import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('VitePress documentation integration', () => {
  const docs = read('docs/site/index.md');
  const vitepress = read('docs/site/.vitepress/config.mts');
  const app = read('index.html');
  const typedoc = JSON.parse(read('typedoc.json')) as Record<string, unknown>;

  it('links narrative documentation to the generated API route', () => {
    expect(docs).toContain('](/api/)');
  });

  it('uses Console, Docs, API, and GitHub navigation across the app and docs', () => {
    expect(vitepress).toMatch(/text: 'Console'/);
    expect(vitepress).toMatch(/text: 'Docs'/);
    expect(vitepress).toMatch(/text: 'API'/);
    expect(vitepress).toMatch(/text: 'GitHub'/);
    expect(app).toMatch(/class="site-topbar"/);
    expect(app).toMatch(/>Console</);
    expect(app).toMatch(/>Docs</);
    expect(app).toMatch(/>API</);
    expect(app).toMatch(/>GitHub@unknown</);
  });

  it('generates VitePress-compatible Markdown API documentation', () => {
    expect(typedoc.out).toBe('docs/site/api');
    expect(typedoc.plugin).toEqual(['typedoc-plugin-markdown', 'typedoc-vitepress-theme']);
    expect(typedoc.docsRoot).toBe('docs/site');
  });
});
