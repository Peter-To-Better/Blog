import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkMermaid from './src/plugins/remark-mermaid.mjs';
import rehypeImageAttrs from './src/plugins/rehype-image-attrs.mjs';
import rehypeExternalLinks from './src/plugins/rehype-external-links.mjs';
import { shouldExclude, lastmodFor } from './src/utils/posts-index.mjs';

export default defineConfig({
  site: 'https://peter-to-better.com',
  integrations: [
    tailwind(),
    sitemap({
      filter: (page) => !shouldExclude(page),
      serialize: (item) => {
        const lastmod = lastmodFor(item.url);
        if (lastmod) item.lastmod = lastmod.toISOString();
        return item;
      },
    }),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMermaid],
      rehypePlugins: [rehypeImageAttrs, rehypeExternalLinks],
    }),
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
