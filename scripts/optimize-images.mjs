/**
 * optimize-images.mjs
 *
 * 把 public/images（含子目錄）裡的 PNG / JPG / GIF 縮到合理尺寸並轉成 WebP，
 * 同步更新 src/content/posts 的 Markdown 與 src/pages 的 .astro 圖片引用。
 *
 * 為什麼要限制寬度：文章內容區是 max-w-3xl（768px），
 * 就算算到 2x DPR 也只需要約 1536px。原始截圖動輒 3000px 寬，
 * 多出來的像素使用者永遠看不到，卻要整包下載。
 *
 * 規則：
 *   - GIF 轉成 animated WebP（Markdown 語法不用改，還是 ![]()）
 *     轉不動或反而更大的，交給 scripts/gif-to-video.mjs 走 H.264
 *   - 轉出來如果沒有比原檔小，就放棄該檔（避免反效果）
 *   - 轉換成功才刪除原檔
 *   - 已存在同名 .webp 的一律跳過，不覆寫
 *
 * 用法：
 *   node scripts/optimize-images.mjs --dry   # 只看報告不動檔案
 *   node scripts/optimize-images.mjs         # 實際執行
 */

import { readdir, readFile, writeFile, stat, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public/images');
const CONTENT_DIRS = [path.join(ROOT, 'src/content/posts'), path.join(ROOT, 'src/pages')];
const DRY_RUN = process.argv.includes('--dry');

/** 內容區 768px，留 2x DPR 的餘裕再多給一點 */
const MAX_WIDTH = 1600;

const STATIC_EXT = new Set(['.png', '.jpg', '.jpeg']);
const ANIMATED_EXT = new Set(['.gif']);

const kb = (bytes) => `${(bytes / 1024).toFixed(0)}KB`;

/** 遞迴列出 images 底下所有可處理的圖，回傳相對 IMAGES_DIR 的路徑 */
async function listImages(dir = IMAGES_DIR, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listImages(path.join(dir, entry.name), rel)));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (STATIC_EXT.has(ext) || ANIMATED_EXT.has(ext)) files.push(rel);
    }
  }

  return files;
}

async function convert(rel) {
  const ext = path.extname(rel).toLowerCase();
  const src = path.join(IMAGES_DIR, rel);
  const relWebp = `${rel.slice(0, -ext.length)}.webp`;
  const target = path.join(IMAGES_DIR, relWebp);

  if (existsSync(target)) {
    return { rel, status: 'skip', reason: '已存在同名 .webp' };
  }

  const before = (await stat(src)).size;
  const animated = ANIMATED_EXT.has(ext);

  let pipeline = sharp(src, { animated });
  const meta = await pipeline.metadata();

  // 動畫的高度是所有幀疊起來的總和，用 pageHeight 才是單幀高度，
  // 這裡只需要判斷寬度，所以兩者共用同一條件即可
  const needsResize = meta.width > MAX_WIDTH;
  if (needsResize) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }

  const buffer = await pipeline
    .webp(animated ? { quality: 70, effort: 6 } : { quality: 82, effort: 6 })
    .toBuffer();

  if (buffer.length >= before) {
    return { rel, status: 'skip', reason: `WebP 沒比較小（${kb(buffer.length)} >= ${kb(before)}）` };
  }

  if (!DRY_RUN) {
    await writeFile(target, buffer);
    await unlink(src);
  }

  return {
    rel,
    relWebp,
    status: 'ok',
    before,
    after: buffer.length,
    fromWidth: meta.width,
    toWidth: needsResize ? MAX_WIDTH : meta.width,
  };
}

/** 把 Markdown 與 .astro 裡的 /images/... 引用換成新副檔名 */
async function rewriteReferences(renames) {
  let touched = 0;

  for (const dir of CONTENT_DIRS) {
    const stack = [dir];

    while (stack.length > 0) {
      const current = stack.pop();
      const entries = await readdir(current, { withFileTypes: true });

      for (const entry of entries) {
        const full = path.join(current, entry.name);

        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (!/\.(md|astro)$/.test(entry.name)) continue;

        const original = await readFile(full, 'utf8');
        let next = original;

        for (const [from, to] of renames) {
          // 只換 /images/ 底下的引用，避免誤傷同名字串
          next = next.split(`/images/${from}`).join(`/images/${to}`);
        }

        if (next !== original) {
          if (!DRY_RUN) await writeFile(full, next);
          touched += 1;
        }
      }
    }
  }

  return touched;
}

const entries = await listImages();

const results = [];
for (const rel of entries) {
  try {
    results.push(await convert(rel));
  } catch (err) {
    results.push({ rel, status: 'error', reason: err.message });
  }
}

const converted = results.filter((r) => r.status === 'ok');
const skipped = results.filter((r) => r.status !== 'ok');

const before = converted.reduce((sum, r) => sum + r.before, 0);
const after = converted.reduce((sum, r) => sum + r.after, 0);

for (const r of converted) {
  const saved = ((1 - r.after / r.before) * 100).toFixed(0);
  const resized = r.fromWidth === r.toWidth ? '' : `  ${r.fromWidth}px → ${r.toWidth}px`;
  console.log(`  ${r.rel} → ${r.relWebp}  ${kb(r.before)} → ${kb(r.after)}  (-${saved}%)${resized}`);
}
for (const r of skipped) {
  console.log(`  [跳過] ${r.rel}：${r.reason}`);
}

const touched = await rewriteReferences(converted.map((r) => [r.rel, r.relWebp]));

console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}轉換 ${converted.length} 張，跳過 ${skipped.length} 張`);
console.log(`總大小 ${kb(before)} → ${kb(after)}（省下 ${kb(before - after)}，-${((1 - after / before) * 100).toFixed(0)}%）`);
console.log(`更新 ${touched} 個內容檔的圖片引用`);
