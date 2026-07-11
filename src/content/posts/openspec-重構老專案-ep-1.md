---
title: "OpenSpec 重構老專案 Ep-1:init 與 profile 設定"
pubDate: 2026-06-11 22:00:00
description: "用 spec-driven development 工具 OpenSpec 重構跑了兩年的老專案。這篇拆解 openspec init 跟 config profile 兩個入門指令，帶你搞懂 Delivery 與 Workflows 兩個維度怎麼決定你有哪些指令。跟著裝一次就上手。"
author: "Peter"
tags: ["重構筆記", "OpenSpec"]
category: "重構筆記"
keywords: "OpenSpec, openspec init, openspec config profile, spec-driven development, brownfield refactor, Claude Code, Carbon-ESG"
draft: false
---

## 本篇重點

本篇將拆解當下最輕量的 spec-driven development 工具 OpenSpec 的兩個入門指令 — 從 `openspec init` 在你 repo 內安插的目錄、到 `openspec config profile` 為什麼把「**安裝在哪**」(Delivery)跟「**有哪些可用 workflow**」(Workflows)切成兩個獨立維度設定。看完你就能解讀為什麼 `/opsx:propose` 在 Claude Code 一打就出現，而你某個同事的 Cursor 卻沒有。

<!-- more -->

## 這個系列要做什麼

從這篇開始，我會把一個跑了兩年的 PHP 大學專題 [Carbon-ESG](https://github.com/hongyui/Carbon-ESG),整個重寫成 **Next.js 16 + Laravel 12 + Sanctum + MySQL 8** 的現代化全端架構。

但這次我不打算「**打開編輯器就開幹**」。

過去我重構過幾個專案，每次都遇到同一個問題:**做到一半忘記為什麼要這樣做**。三個月後新成員加入，翻 git log 找不到當初的決策。

這次我想試試 spec-driven development — 用 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 把**每一個重構決策都先寫下來，才動 code**。

系列預計 **5 集**,每集對應一個 OpenSpec 指令:

1. **本篇** — `openspec init` + `openspec config profile`(安裝、設定)
2. `/opsx:propose` — 提案與架構設計
3. `/opsx:explore` — 自由發想、調查問題、釐清需求
4. `/opsx:apply` — 依 `tasks.md` 實作程式碼
5. `/opsx:archive` — 完成後歸檔與整理規範

## 什麼是 OpenSpec?

OpenSpec 是一個 **npm 套件**(`@fission-ai/openspec`),核心理念是:**規格(spec)應該跟程式碼一起進 git,而不是躺在 Notion 或 Confluence 裡發霉**。

它跟你以前看過的「規格工具」差別在哪?

| 工具 | 哲學 | 適合 |
|---|---|---|
| **[GitHub Spec Kit](https://github.com/github/spec-kit)** | Phase gate,寫起來像在過關 | Greenfield、大型 waterfall |
| **[AWS Kiro](https://kiro.dev)** | 規格 + IDE 都包好，但綁 AWS | 全部 buy-in AWS 生態 |
| **OpenSpec** | 純 CLI + Markdown,**brownfield-first** | 重構既有系統、跨 AI 工具 |

我這次選 OpenSpec 的決定性理由是「**brownfield-first**」 — 它**就是**為了「**改既有系統**」設計的，不像 Spec Kit 預設你在 greenfield。Carbon-ESG 不是綠地，我需要工具承認這件事。

## 誰在用 OpenSpec?

OpenSpec 不綁特定 AI 工具，目前官方支援 **25+ 種 coding agent**,包含:

- **Anthropic Claude Code**
- **OpenAI Codex CLI**
- **Cursor、Cline、Aider**
- **GitHub Copilot Coding Agent**
- **Google Gemini CLI、Windsurf、JetBrains Junie**
- ……

這代表什麼?**同樣一份 `openspec/` 目錄，團隊裡 Claude 派、Cursor 派、Codex 派都能讀**。沒有 vendor lock-in。

## `openspec init` 做了什麼?

OK,理論講完。實際裝起來看看。

**第一步:全域裝 npm 套件**

```bash
npm install -g @fission-ai/openspec
```

**第二步:進你 repo 跑 init**

```bash
cd Carbon-ESG
openspec init
```

它會問你「**用哪個 AI 工具**」(我選 Claude Code),然後**在 repo 裡建兩個目錄**。

第一個是 `openspec/`,這是 OpenSpec 自己的工作區:

```
openspec/
├── config.yaml          # OpenSpec 自己的設定檔
├── specs/               # 系統現況的真相（空的，等之後 archive 累積）
└── changes/             # 進行中的變更（空的，等你開 change）
```

第二個是 `.claude/`(因為我選了 Claude Code),裡面塞滿 OpenSpec 對應的 slash command 跟 skill:

```
.claude/
├── commands/opsx/       # slash command 的 .md 描述
│   ├── propose.md
│   ├── explore.md
│   ├── apply.md
│   ├── archive.md
│   └── ……
└── skills/              # 對應的 SKILL.md
    ├── openspec-propose/
    ├── openspec-explore/
    └── ……
```

注意三件事:

1. **OpenSpec 不裝進你的 `node_modules`、也不修改 `package.json`**。它純粹是「**幾個 Markdown 檔丟進 repo**」。
2. 你的 Laravel、Next.js 怎麼裝,**跟 OpenSpec 完全無關**。
3. **跨 AI 工具**:同樣的 `openspec/` 目錄,Claude Code、Codex、Cursor 都能讀。

## 然後呢?第二個指令登場

`init` 跑完，你在 Claude Code 打 `/opsx:` 應該會跳出補全提示。但**你可能會疑惑**:

- 為什麼有的人是 **5 個指令**,有的人是 **11 個**?
- 為什麼 `/opsx:propose` 我有、但同事 Cursor 上是 `openspec-propose` 那種 skill 名?

這就要講到 `openspec config profile`。

## `openspec config profile` 的兩個維度

OpenSpec 把「**怎麼安裝**」這件事拆成**兩個獨立維度**:

```
┌─────────────────────────────────────────────────────────┐
│                  Profile Configuration                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   Delivery        (這些功能裝在「哪裡」)                  │
│     ├── commands  → slash command (/opsx:propose)        │
│     ├── skills    → Skill 形式 (auto-trigger keywords)   │
│     └── both      → 兩種都裝（推薦）                      │
│                                                          │
│   Workflows       (「有哪些」功能可用)                    │
│     ├── core      → 精簡 5 個 (propose/explore/apply/    │
│     │              sync/archive)                         │
│     └── custom    → 完整 11 個 (含 new/continue/ff/      │
│                    verify/onboard/bulk-archive)         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Delivery 跟 Workflows 是正交的**(獨立的)。你可以 `delivery=commands` 配 `workflows=core`,也可以 `delivery=both` 配 `workflows=custom`。組合一共 **6 種**。

### Delivery — 「**這些功能裝在哪裡**」

OpenSpec 的指令可以用**兩種型態**送進 AI 工具:

| 型態 | 你怎麼用 | 適合 |
|---|---|---|
| **`commands`**(slash command) | 打 `/opsx:propose` 顯式呼叫 | 你想**明確控制**何時觸發 |
| **`skills`**(自動觸發 skill) | Claude 偵測到關鍵字自動呼叫 | 你想**對話流暢**、不被指令打斷 |
| **`both`** | 兩種都裝 | 通常推薦,**彈性最高** |

我選 `both`。原因很簡單:**規劃時用 slash command(我要明確驅動)**;**問問題或卡關時靠 skill(讓 Claude 主動跳出來幫忙)**。

### Workflows — 「**有哪些功能可用**」

OpenSpec 提供兩個預設 profile:

- **`core`** — 最小可用集合,**5 個 workflow**:`propose`、`explore`、`apply`、`sync`、`archive`
- **`custom`**(完整) — **11 個 workflow**,加上 `new`、`continue`、`ff`、`verify`、`onboard`、`bulk-archive`

`core` 適合「**只是想試試看**」的人 — **一輪 change 流程跑得完**,不會有選擇困難。

`custom` 適合「**要做大型重構**」的人 — 多出來的 6 個 workflow 各有特定場景。

#### 11 個 workflow 速查表

| Skill | 用途 | 何時用 |
|---|---|---|
| `/opsx:explore` | 探索模式 — 思考用、不寫 code | 動工前想釐清需求 / 設計 |
| `/opsx:new` | 啟動新 change(逐步建 artifact) | 想一步步走完整流程 |
| `/opsx:propose` | 一次產生完整提案(proposal / design / spec / tasks) | 知道要做什麼，想快速生提案 |
| `/opsx:ff` | Fast-forward — 一次生出實作所需所有 artifact | 比 `propose` 更激進，直接到可實作狀態 |
| `/opsx:continue` | 繼續建立下一個 artifact | change 做到一半要接下去 |
| `/opsx:apply` | 依 `tasks.md` 逐項實作 | artifact 都齊了，開始寫 code |
| `/opsx:verify` | 驗證實作是否符合 change artifact | 寫完想確認對齊 |
| `/opsx:sync` | 把 delta spec 寫回 `specs/`(不 archive) | 想先把 spec 更新但 change 還沒結束 |
| `/opsx:archive` | 封存完成的 change,永久更新 `specs/` | 整個 change 收尾 |
| `/opsx:bulk-archive` | 一次封存多個 parallel change | 同時有多個 change 完成 |
| `/opsx:onboard` | 帶你走完一輪完整流程（教學用） | 新人 / 想複習流程 |

> 表格順序按「**一輪完整流程**」的時序排:從思考(`explore`) → 開 change(`new` / `propose` / `ff`) → 補 artifact(`continue`) → 實作(`apply`) → 驗證(`verify`) → 同步(`sync`) → 收尾(`archive` / `bulk-archive`),最後是教學專用的 `onboard`。

我重構 Carbon-ESG 預計分 **6 個 phase**(每 phase 一個 change),這張表裡至少 **8 個 workflow** 我都會用到 — 所以我選 **`custom`**(全 11 個)。

### 設定方法

設定指令很簡單:

```bash
openspec config profile
```

它會跳出**互動式選擇**,讓你選 Delivery 跟 Workflows。

或你直接給預設名稱:

```bash
openspec config profile custom
```

**重點來了** — 設完之後，要跑一次 `openspec update` 讓變動反映到 `.claude/`:

```bash
openspec update
```

**否則**你的 `.claude/commands/opsx/` 跟 `.claude/skills/` 還是舊的 5 個，新的 6 個 workflow 不會自動出現。我看過不少人卡在這裡 — 「**我明明改了 profile,為什麼還是只看到 5 個指令?**」答案就是少跑了一次 `update`。

我這邊跑完 `openspec config list` 是這樣:

```yaml
profile: custom
delivery: both
workflows:
  - propose
  - explore
  - new
  - continue
  - apply
  - ff
  - sync
  - archive
  - bulk-archive
  - verify
  - onboard
```

**11 個 workflow,Delivery 兩種都裝**。這就是「**為大型重構準備**」的設定。

## 為什麼從 init 跟 profile 開始講最重要?

我看過不少人裝完 OpenSpec、跑了 `/opsx:propose` 然後問「**為什麼我沒有 `/opsx:verify`?**」。

**99% 的原因**是他們的 profile 是 `core`,或自訂只開了一部分 — 但他們**以為自己沒裝對**。

**Delivery + Workflows 這兩個維度就是 OpenSpec 整個系統的「世界觀設定」** — 你裝完之後接下來幾個禮拜的工作流,**都被這兩個值決定**。

從這裡開始講，後續每一篇講 `/opsx:propose` / `/opsx:explore` / `/opsx:apply` / `/opsx:archive` 才不會有人卡在「**我這邊怎麼沒這個指令**」。

## 下集預告

Ep-2 講 `/opsx:propose` — **OpenSpec 的核心動作**。

我會從「**我要在 Carbon-ESG 開出 `phase-0-bootstrap-monorepo` 這個 change**」這個真實案例出發，展示:

- `propose` 跟 `new` 差在哪
- 為什麼第一個 change 不該做 feature
- `proposal.md` / `design.md` / `tasks.md` / delta spec 四種 artifact 各自的角色
- 為什麼 OpenSpec 規定 change 名稱**不能以數字開頭**(我踩到過這個坑)

明天見。

---

> **系列地圖**
>
> - **Ep-1:`openspec init` + `config profile`**(本篇)
> - Ep-2:`/opsx:propose` — 提案與架構設計
> - Ep-3:`/opsx:explore` — 自由發想 / 調查問題 / 釐清需求
> - Ep-4:`/opsx:apply` — 依 `tasks.md` 實作程式碼
> - Ep-5:`/opsx:archive` — 完成後歸檔與整理規範
