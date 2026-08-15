/**
 * indexnow.mjs
 *
 * 把網址推送到 IndexNow（Bing / Yandex / Seznam 共用同一個端點）。
 * Bing 的索引會餵給 Microsoft Copilot，所以這條管道對 AI 引用有實際價值。
 *
 * Google 不參與 IndexNow，它那邊只能靠 sitemap 跟 GSC。
 *
 * 用法：
 *   node scripts/indexnow.mjs                     # 推送 sitemap 裡的全部網址
 *   node scripts/indexnow.mjs /posts/foo/ /about/ # 只推指定路徑
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = 'peter-to-better.com';
const ENDPOINT = 'https://api.indexnow.org/IndexNow';
const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url));

/** key 檔就是 public/<key>.txt，檔名即金鑰 */
function findKey() {
  const file = readdirSync(PUBLIC_DIR).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  if (!file) throw new Error('找不到 IndexNow key 檔（public/<32位hex>.txt）');
  return path.basename(file, '.txt');
}

/** 沒指定路徑時，從 build 出來的 sitemap 撈全部網址 */
function urlsFromSitemap() {
  const files = readdirSync(DIST_DIR).filter((f) => /^sitemap-\d+\.xml$/.test(f));
  if (files.length === 0) {
    throw new Error('dist/ 裡找不到 sitemap，請先跑 pnpm build');
  }
  return files.flatMap((file) => {
    const xml = readFileSync(path.join(DIST_DIR, file), 'utf8');
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  });
}

const key = findKey();
const args = process.argv.slice(2);
const urlList =
  args.length > 0
    ? args.map((p) => new URL(p, `https://${HOST}`).toString())
    : urlsFromSitemap();

if (urlList.length === 0) {
  console.log('沒有可推送的網址');
  process.exit(0);
}

const response = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key,
    keyLocation: `https://${HOST}/${key}.txt`,
    urlList,
  }),
});

// IndexNow 成功時回 200 或 202，且 body 是空的
console.log(`送出 ${urlList.length} 筆 → HTTP ${response.status} ${response.statusText}`);
if (!response.ok) {
  console.error(await response.text());
  process.exit(1);
}
