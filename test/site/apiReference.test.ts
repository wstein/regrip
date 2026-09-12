import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('generated API reference integration', () => {
  const docs = read('docs.html');
  const fallback = read('docs/api-fallback.html');
  const typedoc = JSON.parse(read('typedoc.json')) as Record<string, unknown>;

  it('docs.html links to the generated reference at /docs/api/', () => {
    expect(docs).toMatch(/href="\.\/docs\/api\/(index\.html)?"/);
  });

  it('docs.html presents the reference as its own section, not a bare nav link', () => {
    expect(docs).toContain('class="api-callout"');
  });

  it('the pre-generation fallback uses the same dark palette as the lab', () => {
    expect(fallback).toMatch(/#090d18|#0d1325|#edf2ff/);
  });

  it('the fallback links back into the site', () => {
    expect(fallback).toContain('docs.html');
    expect(fallback).toMatch(/href="(\.\.\/\.\.\/|\/|\.\/)(index\.html)?"/);
  });

  it('typedoc themes the generated site and links back to the lab and docs', () => {
    expect(typedoc.customCss).toBe('./docs/api-theme.css');
    const links = typedoc.navigationLinks as Record<string, string> | undefined;
    expect(links).toBeDefined();
    expect(Object.values(links ?? {}).join(' ')).toMatch(/docs\.html/);
  });

  it('the typedoc theme override retunes the base colours without a webfont', () => {
    const theme = read('docs/api-theme.css');
    expect(theme).toMatch(/--color-background:/);
    expect(theme).toMatch(/--color-link:/);
    expect(theme).toMatch(/:root\[data-theme='light'\]/);
    expect(theme).toMatch(/\.tsd-theme-toggle/);
    expect(theme).not.toMatch(/@import|Archivo|Modernist/);
  });
});
