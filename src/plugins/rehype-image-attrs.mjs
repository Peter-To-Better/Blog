/**
 * rehype-image-attrs
 *
 * Markdown 裡的圖片是 ![](/images/xxx.webp) 這種指向 public/ 的絕對路徑，
 * 不會經過 astro:assets，所以 Astro 不會幫忙補尺寸，瀏覽器在圖片載入前
 * 不知道要留多少空間 → CLS。
 *
 * 這個 plugin 在 build 時直接讀 public/ 底下的圖片檔頭取得真實尺寸，補上：
 *   - width / height：消除 CLS
 *   - decoding="async"
 *   - 第一張圖 eager + fetchpriority="high"（多半就是 LCP 元素）
 *     其餘 loading="lazy"，不要跟 LCP 搶頻寬
 *
 * 尺寸讀取有快取，同一張圖在多篇文章出現只會讀一次。
 * 讀不到尺寸就原樣放過，不讓建置失敗。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url));
const dimensionCache = new Map();

/**
 * 從檔頭解析尺寸。只支援站上實際使用的格式，
 * 避免為了一個 build-time 工具引入額外相依。
 */
function readDimensions(buffer) {
  // PNG: IHDR 固定在 offset 16
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  // GIF: 邏輯螢幕寬高在 offset 6，little-endian
  if (buffer.length > 10 && buffer.toString('ascii', 0, 3) === 'GIF') {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }

  // WebP: RIFF....WEBP，之後依 VP8 / VP8L / VP8X 三種 chunk 各有格式
  if (
    buffer.length > 30 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const chunk = buffer.toString('ascii', 12, 16);

    if (chunk === 'VP8 ') {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }

    if (chunk === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }

    // VP8X（animated WebP 走這條）：24-bit canvas 寬高各減 1 儲存
    if (chunk === 'VP8X') {
      return {
        width: (buffer.readUIntLE(24, 3) & 0xffffff) + 1,
        height: (buffer.readUIntLE(27, 3) & 0xffffff) + 1,
      };
    }
  }

  // JPEG: 掃 SOF marker
  if (buffer.length > 4 && buffer.readUInt16BE(0) === 0xffd8) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      // SOF0-SOF15，扣掉不是影格標頭的 DHT(c4) / JPG(c8) / DAC(cc)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }

  return null;
}

function lookup(src) {
  if (dimensionCache.has(src)) return dimensionCache.get(src);

  let result = null;
  try {
    // 只處理站內絕對路徑，外連圖片跳過
    const filePath = path.join(PUBLIC_DIR, decodeURIComponent(src));
    if (filePath.startsWith(PUBLIC_DIR)) {
      result = readDimensions(readFileSync(filePath));
    }
  } catch {
    result = null;
  }

  dimensionCache.set(src, result);
  return result;
}

function collectImages(node, found = []) {
  if (!node) return found;
  if (node.type === 'element' && node.tagName === 'img') found.push(node);
  for (const child of node.children ?? []) collectImages(child, found);
  return found;
}

export default function rehypeImageAttrs() {
  return (tree) => {
    const images = collectImages(tree).filter((img) => {
      const src = img.properties?.src;
      return typeof src === 'string' && src.startsWith('/');
    });

    images.forEach((img, index) => {
      const props = img.properties;
      const size = lookup(props.src);

      if (size?.width && size?.height) {
        props.width ??= size.width;
        props.height ??= size.height;
      }

      props.decoding ??= 'async';

      if (index === 0) {
        // 首圖通常是 LCP，讓它照常搶先載入
        props.loading ??= 'eager';
        props.fetchpriority ??= 'high';
      } else {
        props.loading ??= 'lazy';
      }
    });
  };
}
