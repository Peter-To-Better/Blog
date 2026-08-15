/**
 * rehype-external-links
 *
 * 文章裡引用官方文件、GitHub 原始碼的外部連結，如果在同一個分頁開啟，
 * 讀者點下去就離開文章了，回來還要重找閱讀位置。這個 plugin 在 build 時
 * 幫「站外」連結補上 target="_blank"，讓它另開分頁。
 *
 * 三個刻意的決定：
 *
 * 1. 只處理站外連結。站內連結（/posts/... 這種系列文互連、錨點 #xxx）
 *    維持原分頁開啟——27 篇系列文如果每篇都另開分頁，讀者會累積一堆分頁。
 *
 * 2. 加 rel="noopener"，但「不」加 noreferrer。
 *    noopener 是為了防 reverse tabnabbing：被開啟的頁面可以透過
 *    window.opener 竄改原本那個分頁。現代瀏覽器對 target="_blank" 已經
 *    隱含這個行為，但顯式寫上去比較保險（也擋掉舊瀏覽器）。
 *    noreferrer 則會把 referrer 拿掉，對方的分析後台就看不到流量來自
 *    本站——我們希望被引用的專案知道流量來源，所以不加。
 *
 * 3. 補 aria 提示。WCAG 3.2.5（Change on Request）要求「開新視窗」
 *    應該是使用者預期得到的，所以在無障礙標籤上註明會另開分頁。
 *
 * 已經手動寫了 target 的連結一律尊重原設定，不覆蓋。
 */

const SITE_HOST = 'peter-to-better.com';

/** 走訪整棵樹，收集所有 <a> 元素。 */
function collectLinks(tree, out = []) {
  if (tree.type === 'element' && tree.tagName === 'a') out.push(tree);
  for (const child of tree.children ?? []) collectLinks(child, out);
  return out;
}

/** 取出節點底下的純文字，用來組無障礙標籤。 */
function textOf(node) {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}

/**
 * 判斷是不是站外連結。
 * 站內：/posts/xxx、#anchor、相對路徑，以及指向本站網域的絕對網址。
 * mailto: / tel: 這類非 http(s) 的 scheme 也不算站外，不需要另開分頁。
 */
function isExternal(href) {
  if (typeof href !== 'string') return false;
  if (!/^https?:\/\//i.test(href)) return false;

  try {
    const { hostname } = new URL(href);
    return hostname !== SITE_HOST && !hostname.endsWith(`.${SITE_HOST}`);
  } catch {
    // 解析不了的網址就原樣放過，不讓建置失敗
    return false;
  }
}

export default function rehypeExternalLinks() {
  return (tree) => {
    for (const node of collectLinks(tree)) {
      const props = (node.properties ??= {});

      if (!isExternal(props.href)) continue;
      if (props.target) continue; // 尊重手寫的設定

      props.target = '_blank';

      // rel 可能已經有值（例如 nofollow），合併而不是覆蓋
      const rel = new Set(
        Array.isArray(props.rel)
          ? props.rel
          : typeof props.rel === 'string'
            ? props.rel.split(/\s+/).filter(Boolean)
            : []
      );
      rel.add('noopener');
      props.rel = [...rel];

      // WCAG 3.2.5：讓螢幕閱讀器使用者知道會另開分頁。
      // aria-label 會蓋掉連結文字的朗讀，所以要把原文字一起帶上，
      // 不能只放「另開新分頁」幾個字。
      if (!props['aria-label']) {
        const label = textOf(node).trim();
        if (label) props['aria-label'] = `${label}（另開新分頁）`;
      }

      // 給 CSS 掛勾，可以用 [data-external]::after 加一個 ↗ 視覺提示
      props['data-external'] = 'true';
    }
  };
}
