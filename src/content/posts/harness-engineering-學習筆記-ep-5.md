---
title: "Harness Engineering 學習筆記 Ep-5"
pubDate: 2026-05-13 10:00:00
description: "Agent 寫的程式碼一直「飄」離初衷？本集導入 2026 最熱門的 Spec-Driven Development（SDD），把 /spec、/plan、/implement 三個 slash command 加進 template，讓每個 feature 都有可被 review、可進版控的契約。"
author: "Peter"
tags: ["Harness Engineering"]
category: "Harness Engineering"
keywords: "Spec-Driven Development, SDD, Claude Code Slash Commands, .claude/commands, GitHub Spec-Kit, Kiro, EARS notation, Harness Engineering, claude-harness-template"
draft: false
---

## 本篇重點

Sub-agent 解決了 Context Firewall，但還有一個更大的問題沒處理 — **Agent 寫的程式碼，跟你腦袋裡想要的東西一直「飄」**。本集導入 2026 最熱門的方法論 **Spec-Driven Development（SDD）**，把 `/spec`、`/plan`、`/implement` 三個 slash command 加進 `claude-harness-template`，從此每個 feature 都有一份可被 review、可進版控的「契約」。

<!-- more -->

## 上集回顧

[Ep-4](/posts/harness-engineering-學習筆記-ep-4) 我們在 template 裡放進 6 個 sub-agent，用 Context Firewall 把雜訊鎖在外面。今天要解決另一個問題 — **就算 sub-agent 各自做得很好，整個 feature 還是常常做歪**。

## Vibe Coding 失敗的故事

你應該有過這個經驗：

1. 跟 Claude 說「幫我加個 archive user 功能」
2. Claude 開始動手，寫了 entity、resolver、frontend
3. 過程中你發現「等等這應該 soft delete 不是 hard delete」
4. Claude 改了，但前面幾個檔案已經帶著錯誤假設往下寫
5. 寫到一半你又意識到「archive 之後通知還要不要發?」
6. Claude 又改一輪，但這次 migration 已經跑下去了
7. **三小時後你看著 50 個檔案的 diff，發現有 30 個改動其實偏離初衷**

業界給這個現象一個名字 — **Vibe Coding**：靠氛圍、靠當下感覺、靠不斷修正 prompt 來做開發。它的核心問題不是 Claude 笨，而是**沒有一份「我們現在到底要做什麼」的契約**。

## 什麼是 SDD？

**Spec-Driven Development（SDD）**是 2025 年下半年到 2026 年快速崛起的方法論。它對 Vibe Coding 的解法很直接：

> 把一份**結構化規格（spec）**當成真相來源，程式碼是**從 spec 生出的產物**，不是反過來。

業界已經出現多套 SDD 工具：

| 工具                  | 特色                                                     |
| :-------------------- | :------------------------------------------------------- |
| **GitHub Spec-Kit**   | Python CLI，93k stars，支援 30+ agent 包含 Claude Code   |
| **AWS Kiro**          | Agentic IDE，內建 SDD 三段流程                           |
| **OpenSpec / BMAD**   | 開源框架，主打企業使用                                   |
| **Tessl**             | 把 spec 編進 CI，每次 PR 都重新驗證                      |

它們長相不同，但**核心流程都是三段式**：

```text
1. Specify  ── 寫下 WHAT 與驗收條件
2. Plan     ── 翻譯成架構決策 + 任務清單
3. Implement ── Agent 嚴格照清單跑
```

我們的 template 就是把這條流程套進 Claude Code，做成三個 slash command。

## SDD × Harness Engineering 為什麼是天然搭檔？

回頭看 Ep-0 那個核心精神：

> 每次出錯，問的不是「下次怎麼提醒」，而是「**怎麼讓這個錯誤從此在結構上不可能發生**」。

SDD 就是把這個精神用在「**需求理解**」這一層：

- 不是寫 wiki 提醒大家「請先想清楚再下 prompt」
- 而是讓 `/spec` 強制產出一份可被 review 的契約 — 沒這份契約，`/plan` 跑不動

換句話說 — **Harness Engineering 把規則機械化，SDD 把需求文件化，兩者合起來就是「整個開發流程都從非機率性的東西出發」**。

## Claude Code 的 Slash Command 速覽

在動手之前，先快速看一下 Claude Code 怎麼定義 slash command：

```markdown
---
description: Write a structured spec for a new feature
argument-hint: <feature-name>
allowed-tools: Read, Write, Edit, Glob
---

You are starting the Specify phase for: $ARGUMENTS
...
```

放在 `.claude/commands/<name>.md`，frontmatter 控制行為，本文就是 prompt。`$ARGUMENTS` 會被替換成使用者輸入。

### 一個重要的進展：commands 已併入 skills

Anthropic 在最近的更新把**自訂 commands 與 skills 合併**了:

> A file at `.claude/commands/deploy.md` and a skill at `.claude/skills/deploy/SKILL.md` both create `/deploy` and work the same way.

意思是 `.claude/commands/*.md` 還是完全有效，但 `.claude/skills/<name>/SKILL.md` 是新的推薦寫法 — 多了 supporting files、`paths:` 條件啟動、subagent context fork 等進階能力。本集為了專注 SDD，先用 commands 寫法；下集 Ep-6 講 Skills 時會把幾個 command 升級成 skills，順便揭示兩者的差別。

## 動手：加進 template

[Peter-To-Better/claude-harness-template](https://github.com/Peter-To-Better/claude-harness-template) 在這集多了 4 個檔案 + 1 個目錄：

```text
.claude/
├── commands/                ← 新增
│   ├── spec.md
│   ├── plan.md
│   └── implement.md
└── agents/
    └── spec-writer.md       ← 新增

specs/                       ← 新增,進版控
└── .gitkeep
```

下面把每個 command 最關鍵的設計講清楚（完整檔案到 [repo](https://github.com/Peter-To-Better/claude-harness-template/tree/main/.claude/commands) 看）。

### `/spec <feature-name>` — 寫契約

第一個 command 做兩件事：建立 `specs/<slug>/` 目錄、**把實際寫 spec 的工作委派給 `spec-writer` sub-agent**。

為什麼要委派？Ep-4 的 Context Firewall 一樣的道理 — 寫 spec 過程會 grep 一堆既有 module 找參考、會跟使用者來回討論細節、會問澄清問題，這些雜訊不該污染主對話。

`spec-writer` 產出的 `spec.md` 強制包含五個區塊：

| 區塊             | 目的                                                  |
| :--------------- | :---------------------------------------------------- |
| **Why**          | 問題敘述。為什麼現在要做？不做會怎樣？                |
| **What**         | User stories，**用 EARS 語法**寫驗收條件              |
| **Acceptance**   | 可測試的勾選清單                                      |
| **Out of scope** | 明確列出**不做什麼** — 強迫做硬決策                    |
| **Open questions** | 需要人類拍板的事，**否則 `/plan` 不准跑**            |

**EARS 語法**（Easy Approach to Requirements Syntax）是這份 spec 的關鍵：

- `WHEN <trigger> THE SYSTEM SHALL <response>` — 正常流程
- `WHILE <state> THE SYSTEM SHALL <response>` — 狀態驅動
- `IF <error> THEN THE SYSTEM SHALL <response>` — 錯誤路徑

EARS 把模糊的「我希望 archive 後 user 看不到」變成 **明確、可測試**的句子。這也是 Kiro IDE 採用的標準格式。

### `/plan <slug>` — 翻譯成架構決策

`/plan` 讀 `spec.md`，產出兩個檔案：

- `plan.md` — 架構決策、HARD 規則合規檢查、風險、測試策略
- `tasks.md` — **拆解成可勾選的任務清單**

`plan.md` 裡面最值得注意的是「**HARD rule compliance**」這個段落，強制 plan 必須**逐條交代**它怎麼遵守 AGENTS.md：

```markdown
## HARD rule compliance

- Relation<T> + @Field — 確認 archive 用 field resolver,不在 entity 加 @Field
- Manager naming — 確認 service 命名為 `UserArchiveService` 而非 `UserManager`
- DTO barrel — 新 DTO 放 libs/user/src/dto/index.ts re-export
- ...
```

這就是 Ep-2 hook 精神的「軟版本」 — hook 是在 commit 階段檢查，這裡是在**設計階段就強制檢查**。

`tasks.md` 則是把 plan 拆成 4 個 phase、N 個 task，每個 task 規定：

- 完成時間 <30 分鐘
- 有單一可驗證的產出
- 標明會動到哪個檔案

這份 checklist 就是 `/implement` 的「binding contract」。

### `/implement <slug>` — 嚴格照清單跑

`/implement` 最關鍵的兩條 HARD 規則：

1. **Walk `tasks.md` top to bottom. Do not skip ahead.**
2. **Check the box immediately when a task is done** (`- [ ]` → `- [x]`)

意思是 Claude 必須**逐項完成、逐項勾選**。`tasks.md` 變成可追蹤的工作日誌 — 中途斷線、隔天接手，下個 session 看一眼就知道做到哪。

`/implement` 還做了一件聰明事：**按任務類型自動派 sub-agent**：

| 任務類型              | 派去                |
| :-------------------- | :------------------ |
| Migration             | `migration-writer`  |
| GraphQL resolver/DTO  | `graphql-feature`   |
| Next.js page          | `frontend-feature`  |
| 新 Nx lib             | `nx-lib-creator`    |
| 測試                  | `test-writer`       |
| 最終 review           | `code-reviewer`     |

主對話只是個「**項目經理**」，真正動手的都是專員。完美貼合 Ep-4 的 Context Firewall 設計。

## 完整流程範例：archive-user 從頭走一次

```text
# Day 1
> /spec archive-user
[spec-writer 派出 → 讀 AGENTS.md、grep 既有 user 模組]
[寫出 specs/archive-user/spec.md]
[列出 3 個 open questions：soft vs hard delete?
                         archive 後存儲是否計入 quota?
                         archive 後 message 怎麼處理?]
                         
# Day 2 (回答完 open questions)
> /plan archive-user
[plan-writer 讀 spec.md + AGENTS.md]
[寫出 specs/archive-user/plan.md（架構決策 + HARD 規則合規）]
[寫出 specs/archive-user/tasks.md（4 phase 共 12 task）]

# Day 3
> /implement archive-user
[T1 ✓] Created entity column archivedAt in apps/server/.../user.entity.ts
[T2 ✓] Generated migration 1736943200123-AddUserArchivedAt.ts
[T3 ✓] Added DTO libs/user/src/dto/archive-user.input.ts + barrel
[T4 ✓] Added resolver method archiveUser in user.resolver.ts
...
[T11 ✓] pnpm nx affected:test --base=main → 14 passed
[T12 ✓] code-reviewer: no blocking issues
[Commit suggested: feat(user): add archive flow]
[Branch suggested: feat/user-archive-flow]
```

從 prompt 模糊不清，變成**三個確定性檔案串起整個 lifecycle** — 每一步都可以被 review、被 git 追蹤、被 CI 驗證。

## 結論

把這集濃縮成三句話：

1. **SDD 把「需求理解」從機率性變決定性** — Harness Engineering 的精神往上游延伸了一層。
2. **Slash command 是把重複 prompt 工程化的最低成本工具** — 寫一次,團隊重複用,進版控。
3. **`/spec → /plan → /implement` 不是 ceremony,是契約** — 每個階段的產出都是可 review、可 diff、可回顧的真實檔案。

下一篇 **Ep-6 — Skills：Sub-agent vs Skill 完整對比 + dep-auditor 實作**，會把這集用的 commands 升級成 skills 的 SKILL.md 寫法，並且做出一個會跑 CVE 檢查的 `dep-auditor` 範例 — 同時當 Sub-agent + Skill **合用**的活案例。

## 延伸閱讀

- [GitHub Spec-Kit — Toolkit for Spec-Driven Development](https://github.com/github/spec-kit)
- [GitHub Blog: Spec-driven development with AI](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)
- [Martin Fowler — Understanding Spec-Driven Development: Kiro, spec-kit, and Tessl](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
- [Claude Code Slash Commands / Skills 官方文件](https://code.claude.com/docs/en/slash-commands)
- [EARS Notation - Easy Approach to Requirements Syntax](https://alistairmavin.com/ears/)
- [Peter-To-Better/claude-harness-template](https://github.com/Peter-To-Better/claude-harness-template) — 本系列產出的 template
