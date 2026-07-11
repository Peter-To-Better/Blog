---
title: "為什麼選 Nx？它到底幫你做了什麼｜Harness 番外"
pubDate: 2026-05-16 16:30:00
description: "為什麼要用 Nx？它跟 Turborepo、Lerna、pnpm workspace 差在哪，對 Claude Code 開發又有什麼好處？本篇一次講清楚 Nx 五大核心能力、Inferred Tasks，以及什麼時候「不該」用 Nx。"
author: "Peter"
tags: ["Harness Engineering"]
category: "Harness Engineering"
keywords: "Nx Monorepo, Nx 是什麼, Nx vs Turborepo, Nx Cloud, nx affected, Nx caching, Inferred Tasks, Harness Engineering, Claude Code"
draft: false
---

## 本篇重點

上一篇番外把 Nx workspace 從零搭起來,但很多人會問 — **為什麼要用 Nx**？它跟一般 monorepo 工具(Turborepo、Lerna、pnpm workspace)差在哪？對 Claude Code 開發又有什麼特別好處？本篇用 nx.dev 官方論述為基底,把 Nx 的核心能力與適用情境一次講清楚。

<!-- more -->

## 為什麼有這篇

[上一集番外](/posts/harness-engineering-學習筆記-番外-nx-scaffold)從 `create-nx-workspace` 跑下去開始,bootstrap 出整套 workspace。但這條指令背後到底發生了什麼？為什麼選 Nx 不選 Turborepo？為什麼 `claude-harness-template` 把它當基底？

如果你跟我一樣,第一次跑完看到自動生出 `.cursor/`、`.claude/`、`.codex/`、`.github/skills/`、CI 監視 sub-agent...會有一個直覺反應:**「這 Nx 到底是什麼鬼?」**

這篇就把這個直覺問題答清楚。

## 一句話:Nx 是什麼?

> Nx is **a build system for monorepos** that helps teams develop faster and keep CI fast as your codebase scales.
> — [Nx 官方文件](https://nx.dev/getting-started/intro)

關鍵字三個:**build system**、**monorepo**、**保持 CI 快**。

它**不是** package manager(那是 pnpm 的事)、**不是** test runner(那是 Jest 的事)、**不是** bundler(那是 Webpack/Vite/Turbopack 的事)。Nx 是**統籌這些工具的那一層大腦** — 知道哪些 task 要先跑、哪些可以平行、哪些可以 skip、哪些已經跑過可以從 cache 拿。

## Nx 解決哪些痛點?

官方文件直白列出四個 monorepo 共通痛點:

| 痛點                                          | 怎麼來的                              |
| :-------------------------------------------- | :------------------------------------ |
| **Slow builds/tests**                         | 多個 task 同時搶資源、沒人協調順序    |
| **Complex interdependent task pipelines**     | A 改了 B 要重 build、C 的測試要重跑   |
| **Flaky CI**                                  | 不同機器、不同順序、不同結果          |
| **Architectural erosion**                     | 依賴關係越來越亂,沒人管哪個 lib 可以引哪個 |

任何超過 3 個 app/lib 的專案都會遇到這四個。Nx 的核心價值就是**把這四件事自動化處理**。

## Nx 五大核心能力

### 1. Task running — 三條黃金指令

```bash
nx run @org/server:build          # 跑單一 task
nx run-many -t build              # 跑全部 project 的 build
nx affected -t test --base=main   # 只跑「main 之後動到的」project 的 test
```

[官方文件](https://nx.dev/features/run-tasks)強調 `run-many` 會 **「parallelize these tasks, ensuring they run in the correct order based on their dependencies and task pipeline configuration」** — 自動算依賴順序+平行化,不用你手寫 shell script 串。

**`nx affected` 是金牌指令** — 不是「跑全部」,是「**只跑你這次 PR 動到的**」。在 CI 上 100 個 project 的專案,改一個 utility lib 可能只影響 5 個 — `affected` 就只跑那 5 個的 lint/test/build,**CI 時間從 30 分鐘變 3 分鐘**。

### 2. Caching — 同樣的 input 不會跑兩次

[官方文件](https://nx.dev/features/cache-task-results) 用詞是「sophisticated and battle-tested computation caching system」。原理很簡單:

```text
1. 跑 task 前,先 hash 所有 input(源碼 + env vars + 設定檔)
2. 同樣的 hash 之前跑過 → 直接從 cache 撈回 terminal output + 產出檔案
3. Hash 不同 → 跑一次,把結果存 cache
```

兩層:

- **Local cache** — 預設,存你本機 `.nx/cache/`,你自己重複跑會 skip
- **Remote cache(Nx Cloud)** — 團隊共用,**A 同事 build 過的 cache,B 同事 pull 下來直接命中**,也適用於 CI

實戰效果:第二次 `nx run-many -t build` 通常是「**所有 task 全部 cache hit,瞬間結束**」,只有改過的那個 project 真的跑。

### 3. Task graph — 整個 repo 的依賴地圖

```bash
pnpm nx graph
```

跑這條會開瀏覽器,畫出整個 workspace 的**專案依賴圖**(誰 import 誰)跟**任務依賴圖**(build 之前要先做什麼)。

對 AI Agent 特別有用:Nx 內建的 `nx-workspace` skill(Nx 22+ 自動產出在 `.github/skills/`)就是用這張圖去回答「哪些 project 在這個 lib 之下」、「動了 X 會影響哪些 Y」這類問題,**不用 grep 慢慢找**。

### 4. Generators & Plugins — 把團隊規範硬編碼

```bash
pnpm nx g @nx/nest:application apps/server
pnpm nx g @nx/js:library libs/notification --importPath=@my-org/notification
```

每跑一條 generator,Nx 就**幫你生符合慣例的檔案結構** — barrel `index.ts`、`tsconfig.json` path alias、`eslint.config`、`jest.config`、`project.json`...

這對 Harness Engineering 是關鍵 — 回想 [Ep-1 AGENTS.md 那篇](/posts/harness-engineering-學習筆記-ep-1) 講過「**有寫進規範的工具被 Agent 使用率高 160 倍**」。Generator 把規範**從文件升級成可執行的程式碼**,Agent 跑一條指令就對齊,根本不用記。

template 裡 `.claude/agents/nx-lib-creator.md` 那個 sub-agent 就是專門做這件事 — 「需要新 lib?去呼叫 `nx g @nx/js:library`,不要手動 mkdir」。

### 5. Inferred Tasks — 設定的單一真相

這個是 Nx 22+ 最現代的能力,值得單獨拉出來講。

舊版 Nx 需要你在 `project.json` 裡手寫每個 task 的設定(executor、options、cache 規則...)。**現在不用了** — 你寫 `next.config.js` 跟 `package.json` 是怎樣,Nx 自動推斷出對應的 `dev`、`build`、`test` task。

[官方文件](https://nx.dev/concepts/inferred-tasks)的關鍵句:

> Nx plugins use the same configuration files to infer how Nx should run the task.

意思是 — **工具設定檔本身就是 task 設定的單一真相**。你不需要在 webpack.config.js 之外再維護一份 Nx 的 task 設定,Nx 直接讀 webpack.config 推。要覆蓋哪一條?加 `project.json`,**只寫覆蓋的那個 target,其他繼續用推斷的**(上一集番外的 client port 4500 就是這樣做的)。

優先序由低到高:

1. Plugin 推斷(預設)
2. `nx.json` 的 `targetDefaults`
3. 專案層 `project.json` / `package.json`

這設計的精神跟 Harness Engineering 完全一致 — **convention 是預設,override 是顯式行為**。

## 為什麼這對 Claude Code 開發特別重要

到 Nx 22.7,Anthropic 跟 Nx 團隊的合作直接展現在預設輸出裡。`create-nx-workspace` 跑下去就會看到:

```text
.claude/settings.json                    ← Nx Claude marketplace plugin 設定
.cursor/, .codex/, .gemini/, .opencode/  ← 多 agent 設定
.github/skills/nx-workspace/SKILL.md     ← AI agent 用來查 repo 結構
.github/skills/nx-generate/SKILL.md      ← AI agent 用來呼叫 generator
.github/skills/nx-import/SKILL.md        ← AI agent 用來導 ESLint/Jest/Next/Vite 等設定
.github/skills/monitor-ci/SKILL.md       ← AI agent 監看 CI 自我修復
.github/agents/ci-monitor-subagent.agent.md
AGENTS.md                                ← Nx 自管理的 agent 規則區塊
```

**Nx 22+ 已經實踐了一半 Harness Engineering** — `.github/skills/` 裡的四個 skill(`nx-workspace`、`nx-generate`、`nx-import`、`monitor-ci`)就是 Ep-6 之後我們要做的 skill 的官方版。我們等於站在巨人肩膀上,只需要**疊上自己 stack 專屬的規則跟 sub-agent**。

對應到我們的 template:

| Harness Engineering 元件     | Nx 已經提供                       | 我們補的                                  |
| :--------------------------- | :-------------------------------- | :---------------------------------------- |
| AGENTS.md                    | 自管理的 Nx 通用規則區塊          | Stack-specific HARD 規則(`Relation<T>` 等) |
| Skills                       | `nx-workspace`、`nx-generate` 等  | `dep-auditor`(Ep-6 計畫)等            |
| Sub-agents                   | `ci-monitor-subagent`             | `code-reviewer`、`migration-writer` 等 7 個 |
| 決定性約束(Hooks)           | (Nx 沒做)                       | Ep-7 我們自己做                          |
| 工作流(Slash Commands)     | (Nx 沒做)                       | `/spec`、`/plan`、`/implement` (Ep-5) |

簡單說:**Nx 處理工程基礎建設(monorepo / 快取 / CI),我們處理 AI agent 工程基礎建設(規則 / 委派 / 工作流)**,兩層疊起來就是一份完整的 Harness。

## 什麼時候**不該**用 Nx?

老實時間 — Nx 不是萬靈丹。以下情境用了反而麻煩:

- **單 app、未來不會長大** — 一個 Next.js side project,直接 `pnpm create next-app` 就好,Nx 是純粹的 overhead
- **團隊還沒接受 monorepo** — 如果同事還在堅持每個 service 一個 repo,先談文化再談工具
- **核心工具沒 Nx plugin** — 例如你用罕見的後端框架,沒對應的 `@nx/...`,自己寫 plugin 不划算
- **CI 機器不能裝 daemon** — Nx daemon 在某些受限環境會踩雷(雖然 `NX_DAEMON=false` 可以關)

判斷準則:**3 個以上會互相依賴的 project**,Nx 的 caching + affected 才開始顯著賺回 setup 成本。

## 結論

把這篇濃縮成三句話:

1. **Nx 是 monorepo 的大腦** — 統籌 task、cache、affected,讓你的 CI 從 30 分鐘變 3 分鐘
2. **Inferred Tasks 是現代 Nx 的精髓** — 不用維護兩份設定,工具 config 就是真相
3. **Nx 22+ 跟 AI Agent 是天然搭檔** — 已經內建多 agent 設定 + 4 個 skill,直接接著疊 stack-specific harness 就好

下一篇回到主線 — **Ep-6:Skills + Sub-agent vs Skill 對比**,把這篇提到的 `dep-auditor` 做出來,順便揭示 Claude Code 把 `.claude/commands/` 併入 `.claude/skills/` 之後的最新寫法。

## 延伸閱讀

### Nx 官方

- [Nx Getting Started — Intro](https://nx.dev/getting-started/intro) — 本篇定義引用來源
- [Run Tasks](https://nx.dev/features/run-tasks) — `nx run` / `run-many` / `affected` 完整說明
- [Cache Task Results](https://nx.dev/features/cache-task-results) — Caching 機制與 Nx Cloud
- [Inferred Tasks](https://nx.dev/concepts/inferred-tasks) — 推斷機制
- [Project Configuration Reference](https://nx.dev/reference/project-configuration) — `project.json` 完整 schema
- [Nx Cloud](https://nx.app/) — 遠端 cache + distributed CI

### Nx vs 同類比較

- [Monorepo Tools 比較](https://monorepo.tools/) — Nx / Turborepo / Lerna / Rush / Bazel 對照表

### 本系列

- [上一集番外:Nx Scaffold 建構紀錄](/posts/harness-engineering-學習筆記-番外-nx-scaffold)
- [Peter-To-Better/claude-harness-template](https://github.com/Peter-To-Better/claude-harness-template) — 本系列產出的 template
