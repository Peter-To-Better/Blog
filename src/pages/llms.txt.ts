import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getExcerpt } from '../utils/helpers';

/**
 * llms.txt — 給 AI 看的網站導覽（格式提案見 llmstxt.org）
 *
 * 從 frontmatter 自動產生，所以文章數、新文章、新分類都不會再對不上。
 * 唯一需要人工維護的是下面這張系列描述表——那句話是給人和 AI 判斷
 * 「這個系列在講什麼」用的，機器歸納不出來，也不該讓它歸納。
 *
 * 新增分類時不用改這裡也能運作（會自動歸到「其他文章」），
 * 但補一則描述會讓它被當成正式系列列出。
 */
const SERIES: Record<string, { name: string; summary: string }> = {
  'LangChain & LLM': {
    name: 'LangChain 與 LLM 學習筆記',
    summary: 'RAG 架構、進階檢索與重排序、多模態 RAG、RAGAS 評估、本地模型選擇，全程本地模型實測',
  },
  'Harness Engineering': {
    name: 'Harness Engineering 學習筆記',
    summary: 'AI Agent 的第三層工程：AGENTS.md、Claude Code Hooks、Sub-agent 與 Context Firewall、Spec-Driven Development',
  },
  'Docker & K8s': {
    name: 'Docker 與 K8s 學習筆記',
    summary: '從容器基礎、Dockerfile、Docker Hub 到 Docker Compose 跨容器通訊',
  },
  TypeScript: {
    name: 'TypeScript 從 0 開始',
    summary: '型別系統、Interface 與 Type Alias、泛型與型別守衛、Decorator 與 Utility Types',
  },
  重構筆記: {
    name: 'OpenSpec 重構老專案',
    summary: '用 AI 輔助重構遺留 PHP 專案：Sanctum 認證、交易核心競態防線、真實 bug 排查紀錄',
  },
  Vue: {
    name: 'Vue2 → Vue3 遷移',
    summary: 'Options API 到 Composition API 實戰：指令綁定、事件修飾符、生命週期',
  },
};

/** 這些分類是站務頁面，不列進文章清單 */
const EXCLUDED_CATEGORIES = new Set(['關於']);

const SITE_SUMMARY =
  '台灣軟體工程師 Peter 的技術筆記。主題涵蓋 LLM/RAG 實作、AI Agent 工程（Harness Engineering）、DevOps（Docker、K8s）、前端（TypeScript、Vue）與系統重構。全系列繁體中文，附完整程式碼與實測數據，包含失敗與踩坑過程。';

export const GET: APIRoute = async ({ site }) => {
  const base = site?.toString().replace(/\/$/, '') ?? '';
  const url = (path: string) => new URL(path, `${base}/`).toString();

  const posts = (await getCollection('posts', ({ data }) => !data.draft)).filter(
    (post) => !EXCLUDED_CATEGORIES.has(post.data.category),
  );

  const byCategory = new Map<string, typeof posts>();
  for (const post of posts) {
    const list = byCategory.get(post.data.category) ?? [];
    list.push(post);
    byCategory.set(post.data.category, list);
  }

  const line = (post: (typeof posts)[number]) => {
    const slug = post.id.replace(/\.md$/, '');
    const desc = post.data.description || getExcerpt(post.body, 100);
    return `- [${post.data.title}](${url(`/posts/${slug}/`)}): ${desc}`;
  };

  // 系列照 SERIES 的宣告順序輸出，讓最有價值的系列排在前面
  const seriesSections = Object.entries(SERIES)
    .filter(([category]) => byCategory.has(category))
    .map(([category, meta]) => {
      const list = [...byCategory.get(category)!].sort(
        (a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf(),
      );
      byCategory.delete(category);

      return [
        `## ${meta.name}`,
        '',
        `${meta.summary}（共 ${list.length} 篇，分類頁：${url(`/categories/${category}/`)}）`,
        '',
        ...list.map(line),
      ].join('\n');
    });

  // 剩下沒有系列描述的都歸這裡，才不會像以前那樣整篇消失
  const looseposts = [...byCategory.values()]
    .flat()
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const looseSection =
    looseposts.length > 0
      ? ['## 單篇文章', '', ...looseposts.map(line)].join('\n')
      : '';

  const content = [
    '# peter-to-better',
    '',
    `> ${SITE_SUMMARY}`,
    '',
    ...seriesSections,
    looseSection,
    [
      '## 關於',
      '',
      '- 作者: Peter Chen',
      `- 關於我: ${url('/posts/welcome/')}`,
      `- 作品集: ${url('/portfolio/')}`,
      `- 服務項目: ${url('/services/')}`,
      `- 網站: ${base}/`,
      `- RSS: ${url('/rss.xml')}`,
      '- 語言: 繁體中文',
      '- 授權: CC BY-NC-SA 4.0',
      '- 更新頻率: 持續更新',
    ].join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n');

  return new Response(`${content}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
