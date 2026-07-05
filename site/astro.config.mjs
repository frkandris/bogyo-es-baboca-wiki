// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Project pages: https://frkandris.github.io/bogyo-es-baboca-wiki
export default defineConfig({
  site: 'https://frkandris.github.io',
  base: '/bogyo-es-baboca-wiki',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
});
