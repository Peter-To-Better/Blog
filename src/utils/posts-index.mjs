/**
 * posts-index.mjs
 *
 * 在 astro.config.mjs（build 設定階段，還沒有 astro:content 可用）讀取
 * src/content/posts 的 frontmatter，供 sitemap 的 filter 與 serialize 使用。
 *
 * 產出兩樣東西：
 *   - excludedPaths：不該進 sitemap 的路徑（薄標籤頁）
 *   - lastmodFor(pathname)：該 URL 對應的最後更新時間，沒有就回 undefined
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '@astrojs/markdown-remark';

const POSTS_DIR = fileURLToPath(new URL('../content/posts', import.meta.url));

/** 標籤頁至少要有這麼多篇才值得被索引，與 src/pages/tags/[tag].astro 保持一致 */
export const MIN_POSTS_TO_INDEX = 3;

function loadPosts() {
  return readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const raw = readFileSync(path.join(POSTS_DIR, file), 'utf8');
      const { frontmatter } = parseFrontmatter(raw);
      return {
        slug: file.replace(/\.md$/, ''),
        tags: frontmatter.tags ?? [],
        category: frontmatter.category ?? 'uncategorized',
        draft: frontmatter.draft === true,
        // updatedDate 優先；沒有就退回 pubDate
        updated: new Date(frontmatter.updatedDate ?? frontmatter.pubDate),
      };
    })
    .filter((post) => !post.draft && !Number.isNaN(post.updated.valueOf()));
}

const posts = loadPosts();

/** 把 sitemap 給的 URL 還原成可比對的解碼路徑，並去掉尾斜線 */
function normalize(url) {
  const pathname = url.startsWith('http') ? new URL(url).pathname : url;
  return decodeURIComponent(pathname).replace(/\/$/, '') || '/';
}

function newest(list) {
  return list.reduce(
    (max, p) => (max === undefined || p.updated > max ? p.updated : max),
    undefined,
  );
}

const groupCount = (key) => {
  const map = new Map();
  for (const post of posts) {
    for (const value of key(post)) {
      map.set(value, [...(map.get(value) ?? []), post]);
    }
  }
  return map;
};

const byTag = groupCount((p) => p.tags);
const byCategory = groupCount((p) => [p.category]);
const bySlug = new Map(posts.map((p) => [`/posts/${p.slug}`, p]));
const siteNewest = newest(posts);

/** 文章數不足門檻的標籤，這些頁面已是 noindex，不該再進 sitemap */
const thinTagPaths = new Set(
  [...byTag.entries()]
    .filter(([, list]) => list.length < MIN_POSTS_TO_INDEX)
    .map(([tag]) => `/tags/${tag}`),
);

export function shouldExclude(url) {
  const p = normalize(url);
  // /page/1/ 與首頁內容相同（現在也不再生成，這裡是雙保險）
  if (p === '/page/1') return true;
  if (p.includes('/draft/')) return true;
  if (thinTagPaths.has(p)) return true;
  return false;
}

export function lastmodFor(url) {
  const p = normalize(url);

  const post = bySlug.get(p);
  if (post) return post.updated;

  if (p.startsWith('/tags/')) {
    const list = byTag.get(p.slice('/tags/'.length));
    if (list) return newest(list);
  }

  if (p.startsWith('/categories/')) {
    const list = byCategory.get(p.slice('/categories/'.length));
    if (list) return newest(list);
  }

  // 這些頁面的內容就是文章列表，站上最新一篇的時間即為其真實更新時間
  if (p === '/' || p === '/archives' || p === '/tags' || p.startsWith('/page/')) {
    return siteNewest;
  }

  // services / contact / portfolio 等靜態頁沒有可信的更新時間，寧可不給
  return undefined;
}

export const stats = {
  posts: posts.length,
  tags: byTag.size,
  thinTags: thinTagPaths.size,
};
