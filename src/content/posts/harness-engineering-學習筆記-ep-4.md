---
title: "Harness Engineering 學習筆記 Ep-4"
pubDate: 2026-05-12 23:15:00
description: "Ep-3 介紹完 claude-harness-template 計畫，這一集正式動工。本篇先講清楚 Sub-agent 與 Context Firewall 的核心觀念，然後直接導覽 template 裡 6 個專為 Nx + NestJS + GraphQL + Next.js 設計的 sub-agent，並提煉出四條跨 agent 共用的設計模式。"
author: "Peter"
tags: ["Harness Engineering"]
category: "Harness Engineering"
keywords: "Claude Code Sub-agents, Context Firewall, Context Rot, .claude/agents, Nx, NestJS, GraphQL, TypeORM, Next.js, Harness Engineering, claude-harness-template"
draft: false
---

# 本篇重點

Ep-3 介紹完 `claude-harness-template` 計畫，這一集正式動工。本篇先講清楚 Sub-agent 與 **Context Firewall** 的核心觀念，然後直接導覽 template 裡 **6 個專為 Nx + NestJS + GraphQL + Next.js 設計的 sub-agent**，並提煉出四條跨 agent 共用的設計模式。

<!-- more -->

## 上集回顧

[Ep-3](/posts/harness-engineering-學習筆記-ep-3) 我們做了三件事：宣告要打造 `claude-harness-template`、畫出骨架、訂下五條設計原則。這一集要交付：**第一批 sub-agent + 一份 stack 專屬的 AGENTS.md**。

## 什麼是 Sub-agent？

一句話定義：

> **Sub-agent 是一個有自己 context window、自己 system prompt、自己工具權限的「分身」**。主對話可以把某類重複出現的任務委派給它，它做完只把**結論**回傳，過程中產生的所有探索、log、檔案內容都不會污染主對話。

換句話說 — sub-agent 就是 AI 版的「派一個專員去處理」。

Claude Code 內建了三個 sub-agent：

| 內建 agent        | 模型    | 用途                       |
| :---------------- | :------ | :------------------------- |
| `Explore`         | Haiku   | 唯讀地搜尋、分析 codebase  |
| `Plan`            | inherit | Plan mode 下做研究         |
| `general-purpose` | inherit | 複雜多步驟、需要動手的任務 |

我們要做的，是**為自己的專案訂做專用 agent**。

## 為什麼需要 Sub-agent？兩個關鍵概念

### Context Rot — context 越長，模型越笨

業界已經有很多研究證實：**LLM 的能力會隨著 context window 拉長而衰退**。Chroma 的研究顯示在低語意關聯的長 context 下，模型表現會明顯下降。這個現象有個名字 — **Context Rot**（上下文腐爛）。

想像一下你開一個 session 做一個 feature：

1. 讀 10 個檔案理解架構（context +20k token）
2. 改 3 個檔案的程式碼（+5k）
3. 跑 `pnpm test`，輸出 800 行 log（+15k）
4. 抓到 type error，又讀了 5 個型別檔案（+10k）
5. 要做 code review……

到第 5 步，**主對話的 context 已經塞了 50k+ token 的雜訊**，其中 80% 是當下做決定根本用不到的東西。Claude 開始忘東忘西、重複犯之前已經被指正過的錯。

### Context Firewall — 把雜訊鎖在外面

Sub-agent 的解法很直接 — **派一個分身進去處理，只把結論帶回來**。

| 場景            | 沒用 sub-agent                         | 有 sub-agent                               |
| :-------------- | :------------------------------------- | :----------------------------------------- |
| Code review     | 主對話讀 5 個檔案 + 寫 review          | 派 `code-reviewer`，回傳「3 個問題」       |
| 寫 DB migration | 主對話 grep 過去 5 個 migration 找慣例 | 派 `migration-writer`，回傳 migration 路徑 |
| 寫測試          | 主對話讀 fixture、mock 設定            | 派 `test-writer`，回傳「8 個測試已加」     |

每一次委派，**主對話的 context 只多了一段精煉摘要**，雜訊全留在 sub-agent 用完即棄的 context window。

這就是 Harness Engineering 的**第一道防火牆** — 不是讓主對話變聰明，而是**不讓它變笨**。

## Sub-agent 檔案格式速覽

Claude Code 的 sub-agent 是放在 `.claude/agents/<name>.md` 的 Markdown 檔，由 YAML frontmatter + 本文組成：

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices. Use proactively after code changes.
tools: Read, Grep, Glob, Bash
model: sonnet
color: blue
---

You are a code reviewer. When invoked, analyze the code...
（本文 = 這個 sub-agent 的 system prompt）
```

關鍵欄位：

| 欄位          | 必要 | 說明                                                 |
| :------------ | :--: | :--------------------------------------------------- |
| `name`        |  ✅  | 小寫 + hyphen，例如 `code-reviewer`                  |
| `description` |  ✅  | **何時該派這個 agent** — Claude 用這段決定要不要委派 |
| `tools`       |      | 允許用的工具白名單（省略 = 繼承全部）                |
| `model`       |      | `sonnet` / `opus` / `haiku` / `inherit`              |
| `color`       |      | UI 顯示用的顏色                                      |

`description` 寫得好不好，決定 Claude 會不會**主動派**這個 agent — 比 system prompt 還重要。

## 怎麼實際叫出 Sub-agent？

寫了定義檔之後，很多人會卡在一個問題 — **「我到底怎麼讓它跑起來？要另外開一個 Terminal 嗎？」**

先破除最常見的誤會：

> ❌ 在同一個對話框繼續打字、丟一段新 prompt，**不是** sub-agent。
> 那只是主 agent 在**同一個 context** 裡繼續做事 — context 只會越來越長，正好是 Context Rot 的來源。

Sub-agent 的本質是 — **Claude 在背後幫你開一個獨立的 context window**，分身在裡面做事，做完只把**摘要**丟回主對話。你不需要、也不會去「手動再開一個東西」。

| 你可能以為的          | 實際的 Sub-agent                          |
| :-------------------- | :---------------------------------------- |
| 要另外開 Terminal     | 不用 — 同一個 session、同一個視窗          |
| 同一對話丟新 prompt   | 開**獨立 context**，分身做完回傳摘要       |
| context 越來越長      | 主對話 context 幾乎不變胖                  |

### 觸發的三種方式

前提：`.claude/agents/<name>.md` 定義檔要存在，且 Claude Code **session 啟動時會載入**它（直接編輯檔案要重啟 session 才生效；用 `/agents` 介面建立則即時生效）。

1. **Claude 自動委派** — 當你描述的任務匹配某個 sub-agent 的 `description`，主 Claude 會自己決定派它。這就是為什麼 `description` 要寫 "use proactively after code changes" 這種句子 — 它是在對主 Claude 喊「這種情況請派我」。

2. **你明確點名** — 直接說「用 `code-reviewer` 這個 sub-agent 檢查剛剛的改動」，Claude 就會呼叫 `Agent` 工具把它派出去。

3. **`/agents` 指令** — 打開管理介面，瀏覽 / 新建 / 編輯 sub-agent。

### UI 上會看到什麼

Sub-agent 跑起來時，Claude Code 介面會把它顯示成一個**巢狀的子任務**展開 — 你看得到它在跑、看得到它最後回傳的摘要，但它的中間過程（讀了哪些檔、跑了什麼指令）不會灌進你的主對話。

簡單講：**你要做的只有兩件事 — (1) 把定義檔放進 `.claude/agents/`，(2) 描述任務或直接點名**。剩下的開分身、隔離 context、回傳摘要，都是 Claude Code 自動處理。

## 拿到 template

```bash
git clone https://github.com/Peter-To-Better/claude-harness-template tmp-harness
cp -r tmp-harness/.claude  ./your-project/
cp    tmp-harness/AGENTS.md ./your-project/
rm -rf tmp-harness

# Restart Claude Code in your-project/
```

Clone 進去後會看到：

```text
claude-harness-template/
├── AGENTS.md                          ← stack 專屬規則，無 placeholder
├── README.md
├── .gitignore
└── .claude/
    └── agents/
        ├── code-reviewer.md           ← 6 個 sub-agent
        ├── migration-writer.md
        ├── test-writer.md
        ├── graphql-feature.md
        ├── frontend-feature.md
        └── nx-lib-creator.md
```

## 六個 Sub-agent 一覽

| Agent              | 工具         | 模型   | 何時被派                                           |
| :----------------- | :----------- | :----- | :------------------------------------------------- |
| `code-reviewer`    | Read-only    | sonnet | 任何非瑣碎的程式碼變更之後                         |
| `migration-writer` | Read + Write | sonnet | Entity 改了 → 需要 TypeORM migration               |
| `test-writer`      | Read + Write | sonnet | 新 feature 或 bug fix → Jest + NestJS 測試         |
| `graphql-feature`  | Read + Write | sonnet | 新 GraphQL query/mutation/subscription 端到端      |
| `frontend-feature` | Read + Write | sonnet | 新 Next.js page 或 Apollo + Chakra 功能            |
| `nx-lib-creator`   | Read + Write | sonnet | 需要新 lib → `nx g @nx/js:lib` + tsconfig + barrel |

每個 agent 的 system prompt 我不再貼進文章（完整內容請看 [Peter-To-Better/claude-harness-template](https://github.com/Peter-To-Better/claude-harness-template/tree/main/.claude/agents) repo）。下面我直接挑**每個 agent 最關鍵的一條設計決策**講：

### `code-reviewer` — 強制 HARD 規則檢查清單

不是泛泛 review，而是**在 prompt 裡直接列出 6 條 HARD 規則檢查項**：

- `@Field` 是否加在 `Relation<T>` 屬性？
- 有沒有 `Manager` 命名？
- 有沒有 DTO 深層 import？
- 有沒有直接呼叫 `tsc` / `webpack`？
- 有沒有編輯 `schema.gql` / `libs/**/.generated/`？
- Branch 名稱符合 `<type>/<scope>-<kebab>`？

這就是 **Ep-1 的 AGENTS.md 規則 + Ep-2 的 hook 精神** — 不靠 AI 自己記得，靠 prompt 把檢查項一條條列出來。

### `migration-writer` — 強迫讀「最近 2 ~ 3 個 migration」

Migration 是整個 repo 最危險的檔案，**對齊既有 convention 比寫對 SQL 更重要**。所以 prompt 第一條就是：

> "The most recent 2 ~ 3 files in `apps/server/src/migrations/` — **match their naming, structure, and style exactly**"

把 grep 任務直接寫進 prompt，agent **每次都被迫**先讀過去的 migration 才能動筆。這條跟 Ep-1 「160x 規則」是同一個道理 — 寫進去的工具被使用率高 160 倍，那把「讀既有檔」當工具寫進去就對了。

### `test-writer` — 寫出「不該測什麼」清單

所有 AI 寫測試最大的問題是「為了 coverage 寫廢測試」。這份 prompt 明確列出 5 條 **NOT** 規則：

- 不要測 framework code（NestJS routing、Apollo resolution、ORM 內部）
- 不要測 private internals — 它們會變
- 不要為了 coverage 寫無法用一句話描述「會壞在哪」的測試
- 不要用 `expect(x).toBeDefined()` 當 `expect(x).toBe(42)` 用
- 不要在 entity 層測 `Relation<T>` 解析 — 那是 field resolver 的事

**列「不該測什麼」比列「該測什麼」更重要** — 模型默認行為已經會包含正確的測試方向，但會錯誤地擴展到不該測的地方。明確堵死那條路。

### `graphql-feature` — 把跨檔依賴順序寫死

新 GraphQL feature 要碰 5 個檔案，順序錯一個就破 schema。prompt 直接把順序鎖死：

```text
1. Input DTO（barrel export）
2. Output type
3. Resolver method
4. Service method（if needed）
5. Field resolver（if return type has relations）
6. Run pnpm gql
7. Verify schema.gql diff
```

主對話只要說「加一個 archiveUser mutation」，agent 自動跑完整個 7 步驟。這是**用 sub-agent 取代 wiki** 的最佳案例。

### `frontend-feature` — 第一條檢查「GraphQL 操作是否已存在」

跟 backend 不同，前端 feature 第一個動作不是寫程式，而是**檢查依賴**：

> "Confirm the GraphQL operation exists in `libs/graphql/src/operations/`. If it does not exist, **stop and tell the main conversation to delegate to `graphql-feature` first.**"

這條規則的價值很大 — 它讓 sub-agent **學會說「我不該動手，請先派別人」**，避免並發委派時的順序錯亂。這是進階的 sub-agent 編排模式。

### `nx-lib-creator` — 全程禁止手動建檔

Nx workspace 最常見的問題是有人手動 `mkdir libs/foo` 然後忘記改 `tsconfig.base.json` 的 path alias，下次 clean install 就炸。這份 prompt 規則只有一條核心 HARD：

> "Use `nx g` generators — **never create the directory structure manually**"

把工具用對，就能避免 80% 的環境設定災難。

## 提煉：四條跨 agent 共用的設計模式

回頭看這 6 個 sub-agent，會發現它們共用同一套寫法：

### 1. 寫權限分流

`code-reviewer` 唯讀（避免「自我合理化」），其餘 5 個都有 `Write` 權限。**讀的角色不該動手，動手的角色不該自己 review**。

### 2. 強迫對齊既有 convention

每個會動手的 agent 第一段都有一條「**先讀最近 2 ~ 3 個同類檔案**」。這比給它一份規範文件更有效 — 文件會過時，現存的程式碼不會。

### 3. 反面清單

`test-writer`、`graphql-feature`、`frontend-feature` 都有 "What you do NOT do" 段落。**列出禁止行為比列出允許行為更能塑造行為**（行為心理學意義上的「消除誘因」）。

### 4. 標準化報告格式

每個 agent 的最後一段都是「How to report」，明確規定回傳格式（清單、commands、一句話 summary）。**輸出格式統一**，主對話才能無腦消化結果，不用每次都解析。

## 結論

把這集濃縮成三句話：

1. **Sub-agent 是 LLM Context Rot 目前最好的對策** — 不是讓主對話變聰明，而是不讓它變笨。
2. **有立場的 harness 比中立的 harness 有用** — Ep-1 講的「-3% 教訓」對 template 同樣成立。
3. **每個 sub-agent 都應該有四件事**：寫權限分流、強迫對齊既有 convention、反面清單、標準化報告格式。

下一篇 **Ep-5 — SDD：Spec-Driven Development × Slash Commands**，會加入「規格驅動開發」這個近期業界很紅的方法論，把 `/spec`、`/plan`、`/implement` 三個 slash command 串起整個從需求到實作的流程，並在 template 加上 `.claude/commands/` 目錄。

# 延伸閱讀

- [Claude Code Sub-agents 官方文件](https://code.claude.com/docs/en/sub-agents)
- [Context Window Visualization - Claude Code Docs](https://code.claude.com/docs/en/context-window)
- [Chroma Research: Context Rot](https://research.trychroma.com/context-rot)
- [Skill Issue: Harness Engineering for Coding Agents - HumanLayer](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents)
