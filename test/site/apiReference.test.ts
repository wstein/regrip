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

  it('identifies the developer surface as Regrip Dev Console', () => {
    expect(app).toContain('<title>Regrip Dev Console</title>');
    expect(app).toContain('>Regrip Dev Console</a>');
    expect(docs).toContain('# Regrip Dev Console documentation');
  });

  it('places the global fullscreen action in the site navigation', () => {
    const navigation = app.match(/<nav class="site-topbar-nav"[\s\S]*?<\/nav>/)?.[0];
    const cubeActions = app.match(/<div class="control-actions">[\s\S]*?<\/div>/)?.[0];

    expect(navigation).toContain('id="fullscreen"');
    expect(cubeActions).not.toContain('id="fullscreen"');
  });

  it('keeps the documentation in its single dark theme', () => {
    expect(vitepress).toMatch(/cleanUrls: true,\s+appearance: false,/);
  });

  it('generates VitePress-compatible Markdown API documentation', () => {
    expect(typedoc.out).toBe('docs/site/api');
    expect(typedoc.plugin).toEqual(['typedoc-plugin-markdown', 'typedoc-vitepress-theme']);
    expect(typedoc.docsRoot).toBe('docs/site');
    expect(typedoc.entryPoints).toEqual([
      'packages/core/src/**/*.gen.ts',
      'packages/core/src/bindings/**/*.ts',
      'packages/core/src/session/**/*.ts',
    ]);
    expect(typedoc.tsconfig).toBe('packages/core/tsconfig.json');
  });

  it('draws sidebar expanders without depending on VitePress icon masks', () => {
    const theme = read('docs/site/.vitepress/theme/regrip.css');

    expect(theme).toContain('.VPSidebarItem .caret::after');
    expect(theme).toContain('.VPSidebarItem.collapsed .caret::after');
  });

  it('preserves TypeDoc item kinds in the API sidebar', () => {
    expect(vitepress).toContain('decorateApiSidebar');
    expect(vitepress).toContain("'folder' | 'module' | 'type' | 'variable' | 'function'");
    expect(vitepress).toContain('api-sidebar-kind--${kind}');
  });
});
