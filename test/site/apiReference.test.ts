import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('VitePress documentation integration', () => {
  const docs = read('docs/site/index.md');
  const vitepress = read('docs/site/.vitepress/config.mts');
  const app = read('index.html');
  const appStyles = read('src/app/style.css');
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

  it('places the global fullscreen action in the topbar controls', () => {
    const topbar = app.match(/<header class="site-topbar">[\s\S]*?<\/header>/)?.[0];
    const cubeActions = app.match(/<div class="control-actions[^"]*"[^>]*>[\s\S]*?<\/div>/)?.[0];

    expect(topbar).toContain('id="fullscreen"');
    expect(cubeActions).not.toContain('id="fullscreen"');
  });

  it('keeps global device controls in the topbar and telemetry controls out of the card header', () => {
    const topbar = app.match(/<header class="site-topbar">[\s\S]*?<\/header>/)?.[0];
    const navigation = app.match(/<nav class="site-topbar-nav"[\s\S]*?<\/nav>/)?.[0];
    const telemetryHeader = app.match(/<div class="device-card-header">[\s\S]*?<\/div>/)?.[0];

    expect(topbar).toContain('class="site-topbar-device-actions"');
    expect(topbar).toContain('id="connect"');
    expect(topbar).toContain('aria-controls="connect-menu"');
    expect(topbar).toContain('id="connect-bluetooth"');
    expect(topbar).toContain('Connect Bluetooth Cube (Web Bluetooth)');
    expect(topbar).toContain('Demo Mock Cubes');
    expect(topbar).not.toContain('id="mock-device-toggle"');
    expect(topbar!.indexOf('site-topbar-brand')).toBeLessThan(
      topbar!.indexOf('site-topbar-device-actions'),
    );
    expect(topbar!.indexOf('id="fullscreen"')).toBeLessThan(
      topbar!.indexOf('site-topbar-device-actions'),
    );
    expect(topbar!.indexOf('site-topbar-device-actions')).toBeLessThan(
      topbar!.indexOf('site-topbar-nav'),
    );
    expect(navigation).not.toContain('id="connect"');
    expect(navigation).not.toContain('id="fullscreen"');
    expect(telemetryHeader).toContain('<h2>Cube Telemetry</h2>');
    expect(telemetryHeader).not.toContain('id="connect"');
  });

  it('groups global controls and separates them from navigation', () => {
    expect(app).toContain(
      'class="site-topbar-controls" role="group" aria-label="Global console controls"',
    );
    expect(appStyles).toMatch(/\.site-topbar-nav\s*\{[^}]*border-left:/s);
    const deviceActionsRule = appStyles.match(/\.site-topbar-device-actions\s*\{([^}]*)\}/)?.[1];
    expect(deviceActionsRule).not.toContain('border-left');
  });

  it('constrains ultrawide topbar content in a centered inner layout', () => {
    const topbar = app.match(/<header class="site-topbar">[\s\S]*?<\/header>/)?.[0];

    expect(topbar).toContain('class="site-topbar-inner"');
    expect(appStyles).toMatch(/\.site-topbar-inner\s*\{[^}]*max-width:\s*96rem;/s);
    expect(appStyles).toMatch(/\.site-topbar-inner\s*\{[^}]*margin:\s*0 auto;/s);
  });

  it('keeps detected-move editing actions above the algorithm editor', () => {
    const panel = app.match(/<section class="detected-moves-panel"[\s\S]*?<\/section>/)?.[0];

    expect(panel).toContain('class="detected-moves-toolbar"');
    expect(panel!.indexOf('class="detected-moves-actions"')).toBeLessThan(
      panel!.indexOf('class="detected-moves-editor"'),
    );
  });

  it('keeps a compact cube toolbar inside the cube column', () => {
    const cubeColumn = app.match(
      /<div class="cube-column">[\s\S]*?<section class="detected-moves-panel"/,
    )?.[0];

    expect(cubeColumn).toContain('class="control-actions cube-toolbar"');
    expect(cubeColumn!.indexOf('id="grip-status"')).toBeLessThan(
      cubeColumn!.indexOf('class="control-actions cube-toolbar"'),
    );
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
