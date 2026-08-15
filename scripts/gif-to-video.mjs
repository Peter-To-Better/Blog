/**
 * gif-to-video.mjs
 *
 * 有些 GIF 轉 animated WebP 反而更大（幀數多、色彩雜訊高），
 * 或大到超過 sharp 的解碼上限。這種只能走影片格式，
 * H.264 對這類螢幕錄影通常能省 90% 以上。
 *
 * 會把 Markdown 裡的 ![alt](/images/x.gif) 換成 <video>，
 * 屬性照著 GIF 的行為給：自動播放、循環、靜音、行動裝置不強制全螢幕。
 *
 * 需要系統有 ffmpeg / ffprobe。
 *
 * 用法：
 *   node scripts/gif-to-video.mjs                 # 處理 public/images 下所有 gif
 *   node scripts/gif-to-video.mjs a.gif b.gif     # 只處理指定檔案
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGES_DIR = fileURLToPath(new URL('../public/images', import.meta.url));
const POSTS_DIR = fileURLToPath(new URL('../src/content/posts', import.meta.url));

const kb = (bytes) => `${(bytes / 1024).toFixed(0)}KB`;

function probeSize(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'csv=p=0',
    file,
  ]).toString().trim();
  const [width, height] = out.split(',').map(Number);
  return { width, height };
}

function toMp4(src, dest) {
  execFileSync('ffmpeg', [
    '-y',
    '-i', src,
    // H.264 需要偶數尺寸，GIF 常常是奇數
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos',
    '-c:v', 'libx264',
    '-crf', '26',
    '-preset', 'slow',
    '-pix_fmt', 'yuv420p',
    // moov atom 移到檔頭，邊下載邊播
    '-movflags', '+faststart',
    '-an',
    dest,
  ], { stdio: 'pipe' });
}

const args = process.argv.slice(2);
const gifs = args.length > 0
  ? args.map((f) => path.basename(f))
  : readdirSync(IMAGES_DIR).filter((f) => f.toLowerCase().endsWith('.gif'));

const converted = [];

for (const gif of gifs) {
  const src = path.join(IMAGES_DIR, gif);
  const name = path.basename(gif, path.extname(gif));
  const dest = path.join(IMAGES_DIR, `${name}.mp4`);

  try {
    const before = statSync(src).size;
    const { width, height } = probeSize(src);
    toMp4(src, dest);
    const after = statSync(dest).size;

    if (after >= before) {
      unlinkSync(dest);
      console.log(`  [跳過] ${gif}：MP4 沒比較小（${kb(after)} >= ${kb(before)}）`);
      continue;
    }

    unlinkSync(src);
    converted.push({ gif, mp4: `${name}.mp4`, width, height, before, after });
    console.log(`  ${gif} → ${name}.mp4  ${kb(before)} → ${kb(after)}  (-${((1 - after / before) * 100).toFixed(0)}%)`);
  } catch (err) {
    console.log(`  [失敗] ${gif}：${err.message.split('\n')[0]}`);
  }
}

// 把 Markdown 的圖片語法換成 <video>
let touched = 0;
for (const file of readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))) {
  const full = path.join(POSTS_DIR, file);
  const original = readFileSync(full, 'utf8');
  let next = original;

  for (const item of converted) {
    // ![任意 alt](/images/foo.gif)
    const pattern = new RegExp(
      `!\\[([^\\]]*)\\]\\(/images/${item.gif.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`,
      'g',
    );
    next = next.replace(
      pattern,
      (_match, alt) =>
        `<video src="/images/${item.mp4}" width="${item.width}" height="${item.height}" ` +
        `autoplay loop muted playsinline preload="metadata" aria-label="${alt}"></video>`,
    );
  }

  if (next !== original) {
    writeFileSync(full, next);
    touched += 1;
  }
}

const before = converted.reduce((s, r) => s + r.before, 0);
const after = converted.reduce((s, r) => s + r.after, 0);
console.log(`\n轉換 ${converted.length} 個 GIF：${kb(before)} → ${kb(after)}`);
console.log(`更新 ${touched} 個 Markdown 檔`);
