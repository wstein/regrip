import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitepress';

type ApiSidebarItem = {
  text: string;
  link?: string;
  collapsed?: boolean;
  items?: ApiSidebarItem[];
};

const apiSidebarPath = fileURLToPath(new URL('../api/typedoc-sidebar.json', import.meta.url));
const rawApiSidebar = existsSync(apiSidebarPath)
  ? (JSON.parse(readFileSync(apiSidebarPath, 'utf8')) as ApiSidebarItem[])
  : [];

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const apiItemKind = (
  item: ApiSidebarItem,
): 'folder' | 'module' | 'type' | 'variable' | 'function' | null => {
  if (item.link?.includes('/type-aliases/')) return 'type';
  if (item.link?.includes('/variables/')) return 'variable';
  if (item.link?.includes('/functions/')) return 'function';
  if (item.link?.endsWith('.res/')) return 'module';
  if (!item.link && item.items?.some((child) => child.link?.endsWith('.res/'))) return 'folder';
  return null;
};

const decorateApiSidebar = (items: ApiSidebarItem[]): ApiSidebarItem[] =>
  items.map((item) => {
    const kind = apiItemKind(item);
    const icon = kind
      ? `<span class="api-sidebar-kind api-sidebar-kind--${kind}" aria-hidden="true">${
          kind === 'folder' ? '' : kind[0]!.toUpperCase()
        }</span>`
      : '';

    return {
      ...item,
      text: `${icon}<span>${escapeHtml(item.text)}</span>`,
      items: item.items ? decorateApiSidebar(item.items) : undefined,
    };
  });

const apiSidebar = decorateApiSidebar(rawApiSidebar);

export default defineConfig({
  title: 'Regrip Console',
  description: 'Smart-cube developer console documentation.',
  base: '/regrip/docs/',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Console', link: 'https://wstein.github.io/regrip/' },
      { text: 'Docs', link: '/' },
      { text: 'API', link: '/api/' },
      { text: 'GitHub', link: 'https://github.com/wstein/regrip' },
    ],
    sidebar: {
      '/': [
        { text: 'Documentation', items: [{ text: 'Overview', link: '/' }] },
        { text: 'Reference', items: [{ text: 'API', link: '/api/' }] },
      ],
      '/api/': [{ text: 'API', items: apiSidebar }],
    },
    search: { provider: 'local' },
    appearance: false,
  },
});
