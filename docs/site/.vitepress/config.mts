import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitepress';

const apiSidebarPath = fileURLToPath(new URL('../api/typedoc-sidebar.json', import.meta.url));
const apiSidebar = existsSync(apiSidebarPath)
  ? (JSON.parse(readFileSync(apiSidebarPath, 'utf8')) as unknown[])
  : [];

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
