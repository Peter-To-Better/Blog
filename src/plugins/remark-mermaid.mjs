/**
 * remark-mermaid
 *
 * 把 ```mermaid 程式碼區塊在進入 Shiki 語法高亮之前，轉成原始的
 * <pre class="mermaid"> HTML 節點，這樣 Shiki 就不會去動它，
 * 後續再由 client 端的 mermaid.run() 渲染成圖。
 *
 * 不依賴 unist-util-visit，避免 pnpm 嚴格 node_modules 解析不到，
 * 直接手動走訪 mdast 樹。
 */

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function walk(node) {
  if (!node || !Array.isArray(node.children)) return;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (child.type === 'code' && child.lang === 'mermaid') {
      node.children[i] = {
        type: 'html',
        value: `<pre class="mermaid">${escapeHtml(child.value)}</pre>`,
      };
    } else {
      walk(child);
    }
  }
}

export default function remarkMermaid() {
  return (tree) => walk(tree);
}
