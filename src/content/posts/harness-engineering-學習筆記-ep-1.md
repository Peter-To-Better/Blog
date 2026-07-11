---
title: "Harness Engineering 學習筆記 Ep-1"
pubDate: 2026-05-09 14:30:00
description: "AGENTS.md 怎麼寫才有效？ETH Zurich 研究揭露「寫太多反而讓成功率下降」的殘酷數據，還有寫進去的工具被用 160 倍的規則。附一份 80 行實例，手把手帶你寫出精簡有效的 AGENTS.md。"
author: "Peter"
tags: ["Harness Engineering"]
category: "Harness Engineering"
keywords: "AGENTS.md, Harness Engineering, AI Agent, Claude Code, Codex, GitHub Copilot, Cursor, Context Engineering, AGENTS.md best practices, AGENTS.md 寫法"
draft: false
---

## 本篇重點

本篇將深入介紹 Harness Engineering 中最基礎也最容易被誤用的元件 — AGENTS.md，從這個格式的起源、被超過 60,000 個專案採用的標準寫法，到 ETH Zurich 研究揭露的「寫太多反而更糟」殘酷數據，最後手把手帶你寫出一份精簡有效的 AGENTS.md。

<!-- more -->

## 上集回顧

在 [Ep-0](/posts/harness-engineering-學習筆記-ep-0) 我們聊過 Harness Engineering 的核心公式 **Agent = Model + Harness**，也提到一份完整的 Coding Agent Harness 包含六大元件（System prompt、MCP、Skills、Sub-agents、Hooks、Back-pressure）。

這一集要把放大鏡對準其中最基礎、也最常被誤用的那個元件 — **AGENTS.md**。

## 什麼是 AGENTS.md？

AGENTS.md 是一個放在專案根目錄的 Markdown 檔案，用來告訴 AI Coding Agent「這個專案是什麼、要怎麼跑、有哪些規矩」。你可以把它想成「**寫給 Agent 看的 README**」。

它跟 README 的差別在於：

| 檔案       | 讀者     | 內容導向                                   |
| :--------- | :------- | :----------------------------------------- |
| README.md  | 人類     | 專案介紹、quick start、貢獻指南、Demo 連結 |
| AGENTS.md  | AI Agent | build / test 指令、檔案結構、嚴格的規則    |

為什麼需要分開？因為人類讀者看 README 是想「**判斷要不要用這個專案**」，而 Agent 看 AGENTS.md 是想「**馬上動手做事**」 — 兩者需要的資訊密度跟細節完全不同。把 lint 規則、commit message 格式、不能動哪些檔案塞進 README 會讓人類讀者超載，但對 Agent 來說卻是救命稻草。

## 誰在用 AGENTS.md？

這不是某家公司的私有規格，而是一個**開放標準**，目前支援的 Agent 包含：

- **OpenAI Codex**
- **Anthropic Claude Code**（也讀 `CLAUDE.md`）
- **Google Jules、Gemini CLI**
- **GitHub Copilot Coding Agent**
- **Cursor、Cline、Aider、Zed、Warp、VS Code、JetBrains Junie**
- **Cognition Devin、Windsurf、Factory、goose、opencode**……

統計到 2026 年，已經有超過 **60,000 個 GitHub 開源專案**根目錄擺著 `AGENTS.md`。它差不多就是 AI Agent 時代的 `.editorconfig`。

## 一個爆炸性的研究：寫太多反而更糟

講到這邊你可能覺得，那 AGENTS.md 越詳細越好對吧？

錯。**2026 年 2 月，ETH Zurich 發表了一份研究**，結果讓整個業界震驚。

研究團隊測了四個主流 Agent（Claude 3.5 Sonnet、Codex GPT-5.2、GPT-5.1 mini、Qwen Code），在 AGENTbench 上比較三種情境：

| 情境              | 任務成功率 | 推論成本 |
| :---------------- | :--------- | :------- |
| 沒有 AGENTS.md    | 基準       | 基準     |
| LLM 自動生成的    | **-3%**    | **+20%** |
| 人類手寫的        | **+4%**    | **+19%** |

注意這兩個關鍵數字：

1. **AI 幫你生成的 AGENTS.md，反而會讓任務成功率「下降」3%**，同時把 token 成本拉高 20%。
2. **人類手寫的 AGENTS.md 也只勉強提升 4%**，成本還是會增加。

也就是說 — 與其讓 Claude / Cursor 一鍵幫你 init 一份 AGENTS.md，**不如什麼都不要寫**。這份研究等於把過去一年大家「叫 AI 自動產出 AGENTS.md」的工作流直接打臉。

## 為什麼會這樣？

ETH Zurich 提出的解釋很直白：**自動生成的 AGENTS.md 大多是「目錄結構複述機」**。

Agent 自己 grep + ls 就能搞清楚的東西（哪個資料夾放什麼、用什麼語言），AGENTS.md 又抄了一遍，結果只是浪費 context window、誘導 Agent 多繞冤枉路。

那人類手寫為什麼比較有效？因為人類知道**哪些事情 Agent 用 grep 永遠找不到**，例如：

- 為什麼這個 service 必須用 `uv` 而不是 `pip`
- 為什麼測試一定要 `pnpm test --filter=api`，不能直接 `pnpm test`
- 哪些檔案是 generated 的，改了會被 CI 覆蓋
- 為什麼 commit 之前要先跑 `make typecheck`

這就是 Harness Engineering 在 Ep-0 講過的精神 — **AGENTS.md 不是寫給 Agent 看「這專案長怎樣」，而是寫「Agent 自己看不出來的隱性規則」**。

## 160x 規則：寫進去的工具會被用 160 倍

研究還有一個更實用的副產品數據：

> 被寫進 AGENTS.md 的指令／工具，被 Agent 實際呼叫的機率，是沒寫進去的 **160 倍**。

意思是 — 如果你的專案有一個自製 CLI `./scripts/seed-db.sh`，你不寫進 AGENTS.md，Agent 幾乎不會發現它的存在，會自己 hardcode SQL 來造資料。寫進去，馬上變成首選工具。

這也呼應了 Ep-0 的「機率性 vs 決定性」— **AGENTS.md 不能保證 100% 被遵守，但它把機率從 0.5% 拉到 80%，已經是工程上巨大的差異**。

## 一份好的 AGENTS.md 應該寫什麼？

根據 GitHub 官方分析 2500+ 個高品質 AGENTS.md 整理出的結論，一份好的 AGENTS.md 應該涵蓋這六大區塊（順序也有講究）：

1. **Commands（執行指令）— 放最前面**
   `pnpm dev`、`pnpm test --watch`、`pnpm typecheck` 這類每天都會用到的指令，連同參數一起列出。
2. **Testing（測試規範）**
   用什麼 framework、跑哪些 suite、覆蓋率門檻多少。
3. **Project Structure（檔案地圖）**
   只寫**非顯而易見**的部分（例如「`src/generated/` 不要動，是 codegen 產物」），不要把 `ls` 結果照抄一遍。
4. **Code Style（程式風格）**
   給**具體範例**而不是抽象描述。「我們用 camelCase」很弱，給一段對的程式碼跟一段錯的程式碼才有用。
5. **Git Workflow（協作流程）**
   commit 訊息格式、PR 標題規則、是否需要 squash。
6. **Boundaries（三條紅線）**
   - ✅ **DO**：可以做的事
   - 🟡 **ASK FIRST**：要先確認的事
   - 🛑 **NEVER**：絕對不能碰的事

最後一條 Boundaries 是 Harness Engineering 精神最濃的一段 — 它把規則寫得越具體越偏執越好。

## 該避免什麼？

對應上面六大區塊，這幾件事千萬不要做：

- 🚫 **複製 `ls` 結果**：Agent 自己會看，你抄一遍只是浪費 context。
- 🚫 **抄 linter 規則**：能用 `eslint` / `prettier` / `ruff` 自動檢查的事，就讓工具去檢查（Ep-0 的「決定性約束」原則）。
- 🚫 **寫成長篇大論**：HumanLayer 公開的 `CLAUDE.md` 控制在 **60 行以內**，業界一般建議 **150 行以下**，超過就要拆檔。
- 🚫 **讓 AI 自動生成**：ETH Zurich 數字已經說明一切。
- 🚫 **把 task-specific 指令塞進去**：「這次任務要把 button 改成紅色」是 prompt，不是 AGENTS.md。

## 範例：一份大型前後端系統的 AGENTS.md

來看一個更貼近實戰的情境 — 一個 **Nx Monorepo** 同時包了 NestJS GraphQL 後端與 Next.js 前端的大型系統。這種專案最容易踩到「跨 lib、跨工具、跨語言」的隱性規則，正是 AGENTS.md 發揮最大威力的場景：

```markdown
# AGENTS.md

> 寫給 AI coding agent 看的專案手冊。人類請看 README.md。
> 違反 HARD 規則會直接弄壞 CI 或 schema，請務必遵守。

## Nx Rules（HARD）

- 所有任務一律透過 Nx 執行：`nx run`、`nx run-many`、`nx affected`
- 禁止直接呼叫底層工具（不要直接跑 `tsc`、`webpack`、`next build`）
- 動工前先用 `nx_workspace` 看 repo graph，用 `nx_project_details` 看單一專案
- 設定問題請查 `nx_docs`，不要自己猜

## Commands

- `pnpm server` — 啟動 NestJS GraphQL 後端
- `pnpm client` — 啟動 Next.js 前端
- `pnpm gql` — 跑 GraphQL codegen（改完 `.graphql` 一定要重跑）
- `pnpm migration:generate --name=<Name>` — 從 entity 差異產出 migration
- `pnpm migration:run` / `pnpm migration:revert` — 跑 / 回退 migration

## Architecture（HARD）

- Backend：NestJS 11 + GraphQL（Apollo）+ TypeORM 0.3
- Frontend：Next.js 16 + React 19 + Chakra UI 3 + Apollo Client
- DB：PostgreSQL，**只用 TypeORM QueryBuilder**，不准包 helper 抽象
- 命名不得使用 `Manager`（過去因濫用導致職責混亂）

## Entity ↔ GraphQL（HARD）

- **`Relation<T>` 型別的屬性禁止加 `@Field` decorator**
- `Relation<T>` 是給 TypeORM 用的；GraphQL 關聯一律透過 **field resolver** 解析
- 違反這條會炸 schema 或 runtime error

## DTO（HARD）

- 所有 DTO 必須透過 barrel file（`index.ts`）export
- 禁止 deep import（❌ `@my-org/user/dto/create-user.dto`）

## Import Path Aliases（只列非顯而易見的）

source of truth 是 `tsconfig.base.json`，以下僅供快速查找：

​```text
@my-org/constants              → libs/constants/src/index.ts
@my-org/graphql/__generated__  → libs/graphql/.generated/__types__.ts
@my-org/models                 → libs/models/src/index.ts
@/components/*                 → apps/client/src/components/* （僅 client 可用）
​```

## Git Workflow（HARD）

- Branch 格式：`<type>/<scope>-<kebab-case-description>`
- 允許的 type：`feat`、`fix`、`refactor`、`chore`、`test`、`docs`
- 不准縮寫、不准 camelCase / PascalCase
- 違反 branch naming 會被 CI 擋下

## Conditional References（按需閱讀）

- 動 entity / GraphQL 關聯 → `docs/entity-graphql.md`
- 跑 migration → `docs/migrations.md`
- 寫前端（`apps/client/`）→ `docs/frontend.md`
- 改架構或新增 module → `docs/architecture.md`

## Boundaries

### ✅ DO

- 新增 lib 一律 `nx g @nx/js:lib`，不要手動建資料夾
- 改完 `.graphql` 立刻 `pnpm gql`，否則前端型別會錯
- entity 改完馬上 `pnpm migration:generate`

### 🟡 ASK FIRST

- 升級 Nx、NestJS、Next.js 任一主版本
- 動 `nx.json`、`tsconfig.base.json`、`codegen.yml`
- 新增第三方 GraphQL scalar

### 🛑 NEVER

- 不要直接編輯 `schema.gql`（generated 檔，會被覆蓋）
- 不要 commit `dist/`、`.generated/`、`node_modules`
- 不要在 entity 的 `Relation<T>` 屬性加 `@Field`（見上方 HARD 規則）
- 不要在 service / resolver 命名出現 `Manager`
```

整份大約 80 行，幾乎都是「**Agent 用 grep 跟 ls 看不出來**」的隱性規則 — `Relation<T>` 跟 `@Field` 的禁忌、Nx 必須透過 `nx run`、`schema.gql` 是 generated 不能改、命名禁止用 `Manager`。這些就是讓你的 Agent 從「會寫 code 但每次都踩雷」進化到「**順著專案慣例走**」的關鍵。

對照一下，**反例**會長這樣（請不要這樣寫）：

```markdown
## Project Structure

- apps/server/ 是後端
- apps/server/src/main.ts 是入口
- apps/server/src/app/ 是 module
- apps/server/src/app/user/ 是 user module
- libs/user/src/ 是 user lib
- libs/user/src/lib/ 是 user lib 內容
...（後面還有 50 行 ls 結果）
```

這就是 ETH Zurich 研究裡讓成功率 **-3%** 的典型寫法 — 全部都是 Agent 自己 `ls` 就知道的事，浪費 context window 還誤導決策。

## 結論

把這一集的觀念整理成三句話：

1. **AGENTS.md 不是 README** — 它是寫給 Agent 看的「隱性規則手冊」，不是專案介紹。
2. **少即是多** — ETH Zurich 證實過長或 AI 生成的 AGENTS.md 反而會讓成功率下降，控制在 60 ~ 150 行。
3. **160x 規則** — 你想讓 Agent 用什麼工具、走什麼流程，**就一定要寫進去**，不寫等於不存在。

下一篇會接著聊 Harness 裡威力最大、也最危險的元件 — **Hooks（生命週期鉤子）**，怎麼用 hook 把「拜託你 commit 前跑測試」變成「不跑就 commit 不了」的決定性約束。

## 延伸閱讀

- [AGENTS.md 官方網站](https://agents.md/)
- [How to write a great agents.md: Lessons from over 2,500 repositories - GitHub Blog](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)
- [Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents? - ETH Zurich (arXiv)](https://arxiv.org/abs/2602.11988)
- [Writing a Good AGENTS.md - Philipp Schmid](https://www.philschmid.de/writing-good-agents)
- [Custom instructions with AGENTS.md - OpenAI Codex](https://developers.openai.com/codex/guides/agents-md)
