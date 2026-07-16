---
title: "打造 Claude Code 開發模板：claude-harness-template｜Harness 筆記 Ep-3"
pubDate: 2026-05-12 22:00:00
description: "理論學完，開始動手打造 claude-harness-template 開源模板，專為 Nx + NestJS + GraphQL + Next.js 設計，clone 後直接用 Claude Code 開發。本集先講骨架、五條設計原則與後續五集 roadmap。"
author: "Peter"
tags: ["Harness Engineering"]
category: "Harness Engineering"
keywords: "claude-harness-template, Harness Engineering, AI Agent, Claude Code, AGENTS.md, Hooks, .claude/settings.json, Sub-agents, Slash Commands, MCP, AI 開發模板"
draft: false
---

## 本篇重點

前面三集我們把 Harness Engineering 的世界觀、AGENTS.md 與 Hooks 都學了一輪，理論到此告一段落。從這一集開始，我們要把學到的東西實體化 — 動手打造一份名為 **claude-harness-template** 的開源模板，**專為 Nx + NestJS + GraphQL + Next.js stack 設計**，讓你 clone 之後直接用 Claude Code 開發整個系統。本篇先做計畫介紹：要解決什麼問題、骨架長什麼樣、設計原則、以及接下來幾集的 roadmap。

<!-- more -->

## 前情提要

到 Ep-2 為止，我們建立了三塊基礎：

| 集數                                             | 主題                       | 核心收穫                                   |
| :----------------------------------------------- | :------------------------- | :----------------------------------------- |
| [Ep-0](/posts/harness-engineering-學習筆記-ep-0) | Harness Engineering 是什麼 | Agent = Model + Harness；機率性 vs 決定性  |
| [Ep-1](/posts/harness-engineering-學習筆記-ep-1) | AGENTS.md                  | 60 ~ 150 行的「隱性規則手冊」              |
| [Ep-2](/posts/harness-engineering-學習筆記-ep-2) | Hooks                      | Exit Code 2 把「應該」變成「不做就不能做」 |

這三集講的都是**觀念**。每個讀者腦袋裡都有一個沒問出口的問題：

> 「我懂了，**然後呢？**」

## 然後呢？— 從理論到實作的斷層

老實說，這也是我自己看完業界一堆 Harness Engineering 文章之後的感覺。

理論很漂亮，舉的例子很厲害（OpenAI 五個月 100 萬行、Hashline 6.7% → 68.3%），但每次想把這套搬進**自己的專案**，就會卡在同樣幾個現實問題：

- AGENTS.md 應該寫多細？該長什麼樣？
- `.claude/settings.json` 那一串 JSON 怎麼開始？有沒有可以直接 copy 的範本？
- Sub-agent 怎麼定義？Slash command 跟 hook 又怎麼分工？
- 這些檔案放在 git 哪裡？團隊怎麼共用？CI 怎麼跑？

每個問題單獨看都不難，但**全部加起來就會勸退一整個團隊**。

這個落差就是我們要填的 — 我們需要一份**可以直接 clone 進去用**的模板。

## 介紹：claude-harness-template

接下來幾集要做的東西，叫做 **claude-harness-template**（暫定名稱）。

它的定位很簡單：

> 一份**完整、可立即開始開發**的 Claude Code 起手包 — Nx + NestJS + GraphQL + TypeORM + Next.js + Chakra UI 的 workspace，加上一整套設計過的 harness。Clone 後跑 `pnpm install && pnpm dev` 就能讓 Claude Code 動手做 feature。

更精準地說，它要做這幾件事：

- ✅ 完整的 **Nx workspace scaffold** — `apps/server`（NestJS GraphQL）、`apps/client`（Next.js 16）、`libs/` 範例
- ✅ **經過設計**的 `AGENTS.md` — stack-specific HARD 規則，不是 AI 自動生成（符合 Ep-1 的 -3% 規避原則）
- ✅ 完整的 **sub-agents 套組** — `code-reviewer`、`migration-writer`、`test-writer`、`graphql-feature`、`frontend-feature`、`nx-lib-creator`、`spec-writer`
- ✅ **SDD slash commands** — `/spec`、`/plan`、`/implement` 串起整個開發流程
- ✅ **生產級的 `.claude/settings.json` hooks** — 符合 Ep-2 的 Exit Code 2 範式
- ✅ **CI 整合範例**（GitHub Actions）— hooks 不只在本地跑，PR 上也擋
- ✅ 每個檔案都附上「**為什麼這樣設計**」的說明，不是黑盒子

同樣重要的是，它**不做這些事**：

- ❌ 不是通用模板 — 專為這個 stack 設計，其他 stack 請 fork
- ❌ 不取代 Claude Code 官方文件（它是起手包，不是百科）
- ❌ 不打算解決所有人的所有問題（我們會非常用力地控制 scope）

換句話說 — **這個 template 本身，就是一次 Harness Engineering 的實踐**。

## 為什麼這個 template 本身就是 Harness Engineering？

回想 Ep-0 那個核心精神：

> 每次 Agent 出錯，問的不是「我下次怎麼提醒它」，而是「我怎麼讓這個錯誤從此在結構上不可能發生」。

把這句話的主詞從「Agent」換成「**團隊裡的工程師**」，就是這個 template 的存在意義：

- 不是寫一份 wiki 提醒大家「請記得設 PreToolUse hook 擋 `rm -rf`」
- 而是讓 `git clone` 進來那一刻，這個 hook **已經設好**了

這就是把 Harness Engineering 的精神，從「給 Agent 用」進一步**升級成「給開發團隊用」**。

## 預覽：模板骨架

直接看一下計畫中的目錄結構：

```text
claude-harness-template/
├── AGENTS.md                       # 寫給 Agent 看的主規則（< 150 行）
├── README.md                       # 寫給人類看的快速上手
├── package.json                    # pnpm + Nx workspace 設定
├── nx.json
├── tsconfig.base.json
├── codegen.yml                     # GraphQL codegen
├── docker-compose.yml              # 本機 PostgreSQL
│
├── apps/                           # Nx workspace 應用
│   ├── server/                     # NestJS 11 + GraphQL（Apollo）+ TypeORM
│   └── client/                     # Next.js 16 + React 19 + Apollo Client + Chakra UI
│
├── libs/                           # 共用函式庫
│   ├── models/                     # TypeORM entity + 範例 User entity
│   ├── graphql/                    # GraphQL codegen 設定 + generated types
│   └── user/                       # 示範 feature lib（resolver、DTO、service 完整套組）
│
├── specs/                          # SDD artifacts（每 feature 一個資料夾）
│   └── .gitkeep
│
├── .claude/
│   ├── settings.json               # 團隊共用的 hooks（Ep-7 主題）
│   │
│   ├── agents/                     # Sub-agent 定義（Ep-4 ~ Ep-5）
│   │   ├── code-reviewer.md
│   │   ├── migration-writer.md
│   │   ├── test-writer.md
│   │   ├── graphql-feature.md
│   │   ├── frontend-feature.md
│   │   ├── nx-lib-creator.md
│   │   └── spec-writer.md
│   │
│   ├── commands/                   # Slash commands（Ep-5 主題）
│   │   ├── spec.md
│   │   ├── plan.md
│   │   └── implement.md
│   │
│   ├── skills/                     # Skills（Ep-6 主題）
│   │
│   └── scripts/                    # Hook handlers（Ep-7 主題）
│
├── docs/                           # Conditional references
│   ├── architecture.md
│   ├── testing.md
│   └── migrations.md
│
├── .github/
│   └── workflows/
│       └── claude-harness-ci.yml   # CI 整合（Ep-8 主題）
│
└── .gitignore
```

注意幾個設計細節：

1. **`AGENTS.md` 放最外層** — 它是 Agent 第一個讀的檔案，跟 README 並列。
2. **`.claude/` 分四個子資料夾** — `agents/`、`commands/`、`skills/`、`scripts/` 各司其職，符合 Ep-2 的「每個元件做好一件事」原則。
3. **`apps/` + `libs/` 是 Nx workspace 的標準佈局** — clone 進來就能 `pnpm install && pnpm dev`，不需要再跑 `nx create-nx-workspace`。
4. **`specs/` 進版控** — SDD 產出的規格檔跟 code 一起版控，PR review 時看得到 spec 變更。
5. **`docs/` 走 conditional reference 模式** — `AGENTS.md` 不直接塞細節，需要時才指向 `docs/`。

## 設計原則（動工前先講清楚）

為了避免最後做出一份巨大難用的 template，先立下五條原則：

1. **Convention over configuration**
   能用慣例解決的事，不開設定。一個讀者只要照 README 跑 `git clone` + 改三個變數，就能上路。

2. **Opinionated, stack-coupled**
   專為 Nx + NestJS + GraphQL + TypeORM + Next.js 設計。對得上的人 `git clone` 立刻能用，對不上的人 fork 後改成自己的 stack。Ep-1 講過「真正有用的 AGENTS.md 必須有立場」— 整個 template 都套用同一條原則。

3. **Everything explained, nothing magical**
   每個 hook、每個 agent、每個 command，**註解一定要寫「為什麼存在」**。沒人看得懂的設定一律不收。

4. **Hard rules vs Soft rules 分離**
   違反會直接擋 commit 的（HARD），跟只是建議的（SOFT），用不同的標記與檔案存放。讀者一眼就知道哪些不能動。

5. **Always shippable**
   每一集寫完，main branch 上的 template 都必須是「能 clone、能用」的狀態。不允許「等下一集才有用」的半成品。

## Roadmap：接下來五集要做什麼

| 集數     | 主題                          | 對應 template 產出                                                            |
| :------- | :---------------------------- | :---------------------------------------------------------------------------- |
| **Ep-4** | Sub-agents                    | `.claude/agents/` 6 個 stack-specific agent + AGENTS.md                       |
| **Ep-5** | SDD × Slash Commands          | `.claude/commands/` 三個 + `spec-writer` agent + `specs/` 目錄                |
| **Ep-6** | Skills + Sub-agent vs Skill   | `.claude/skills/` + `dep-auditor` 作為 agent + skill 合用範例                 |
| **Ep-7** | Hooks + MCP 整合              | `.claude/settings.json` 完整版 + `scripts/` hook handler + MCP server 設定    |
| **Ep-8** | Nx scaffold + CI + 公開釋出   | `apps/` + `libs/` 完整 scaffold、`.github/workflows/`、GitHub repo            |

到了 Ep-8，**你會拿到一份能 `git clone https://github.com/Peter-To-Better/claude-harness-template` 然後 `pnpm install && pnpm dev` 直接開發的完整 starter**。

## 結論

把這集濃縮成三句話：

1. **理論到實作之間有一道斷層**，光懂概念寫不出可用的 harness。
2. **claude-harness-template 是把 Ep-0 ~ Ep-2 學到的觀念實體化**，本身就是一次 Harness Engineering 的實踐。
3. **我們會按 roadmap 每集交付一塊**，每一集寫完 main branch 都能直接用，沒有半成品。

下一篇 **Ep-4 — Sub-agents：用 Context Firewall 讓 Agent 越跑越聰明**，會深入介紹 sub-agent 的概念跟 context rot 的問題，並動手做出 template 的第一批 6 個 sub-agent — 涵蓋 code review、TypeORM migration、Jest 測試、GraphQL feature、Next.js feature、Nx lib 建立。

我們開工吧。

## 延伸閱讀

- [Claude Code Sub-agents 官方文件](https://docs.claude.com/en/docs/claude-code/sub-agents)
- [Skill Issue: Harness Engineering for Coding Agents - HumanLayer](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents)
- [How to write a great agents.md - GitHub Blog](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)
- [Harness Engineering: Leveraging Codex in an Agent-First World - OpenAI](https://openai.com/index/harness-engineering/)
