---
title: "Claude Code Hooks 教學：12 個生命週期事件｜Harness 筆記 Ep-2"
pubDate: 2026-05-12 10:30:00
description: "Claude Code Hooks 怎麼用？一次搞懂 12 個生命週期事件、PreToolUse 封鎖機制與 Exit Code 2 的決定性意義，把「拜託 Agent」變成「不做到就動不了」。附 5 個 NX Monorepo 生產級 hook 範例。"
author: "Peter"
tags: ["Harness Engineering"]
category: "Harness Engineering"
keywords: "Claude Code Hooks, PreToolUse, PostToolUse, Harness Engineering, AI Agent, Deterministic Constraint, .claude/settings.json, Hooks 教學, Claude Code 生命週期"
draft: false
---

## 本篇重點

本篇將深入介紹 Harness 中威力最大、也最危險的元件：Hooks（生命週期鉤子）。從 Anthropic 在 2026 年 1 月正式推出的 12 個生命週期事件、PreToolUse 的封鎖機制、Exit Code 2 的決定性意義，到一份能套用在大型 NX Monorepo 的生產級 hook 設定，徹底搞懂怎麼用 hook 把「拜託 Agent」變成「不做到就動不了」。

<!-- more -->

## 上集回顧

[Ep-0](/posts/harness-engineering-學習筆記-ep-0) 我們建立了 **Agent = Model + Harness** 的世界觀，提到「機率性合規 vs 決定性約束」是整個 Harness Engineering 的精髓；[Ep-1](/posts/harness-engineering-學習筆記-ep-1) 拆解了 AGENTS.md，發現它雖然有用，但**只能把規則遵守機率從 0.5% 拉到 80%**：仍然是機率性的。

那剩下那 20% 怎麼辦？這集要請出 Harness 工具箱裡最強的武器：**Hooks**。

## 為什麼需要 Hooks？一個讓人不安的數字

業界對 prompt 與 markdown 文件的研究有個共通的觀察：

> 純 prompt-based 的指令，Agent 大約只能達到 **70 ~ 90% 的合規率**。

聽起來很高對吧？但換個角度想：這代表你每 10 次請 Agent「commit 前一定要跑測試」，**就有 1 ~ 3 次它會直接跳過**。如果你的 PR 一天有 50 個變更，那一週就會有大約 100 次「應該跑但沒跑」的情況進到 main。

> 「'usually'（通常）跟 'always'（永遠）之間那道縫，就是 production system 出事的地方。」

Hooks 就是填補這道縫的工程手段。它不是叫 Agent「記得做」，而是直接讓「沒做就動不了」。

## 什麼是 Hook？

Hook 是 **在 Agent 生命週期的特定時間點自動執行的程式碼**。它執行在 LLM 推理鏈**之外**的系統層，所以結果是 100% 確定的：不會因為 context window 變長、prompt 被覆蓋、模型心情不好而失靈。

你可以把它想成你已經熟悉的兩個概念：

| 你已知的東西                | 對應到 AI 世界的角色        |
| :-------------------------- | :-------------------------- |
| Git 的 `pre-commit` hook    | PreToolUse hook             |
| GitHub Actions 的 CI 流程   | PostToolUse、Stop hook      |
| Husky / lint-staged         | PostToolUse hook            |
| Webpack 的 lifecycle plugin | Claude Code 的 12 個事件    |

差別在於：git hook 攔的是「人類」的 commit，AI hook 攔的是「Agent」的每一次行動。

## Claude Code 的 12 個生命週期事件

Anthropic 在 **2026 年 1 月** 正式把 Hooks 寫進 Claude Code 的官方 spec，目前一共定義了 12 個事件點：

| 事件                    | 觸發時機                       | 典型用途                       |
| :---------------------- | :----------------------------- | :----------------------------- |
| `SessionStart`          | 一個 session 剛開始            | 注入 git status、TODO、env     |
| `UserPromptSubmit`      | 使用者剛按下 Enter             | 對 prompt 做預處理或加 context |
| `PreToolUse`            | **工具呼叫前**                 | **唯一能 block 動作的 hook**   |
| `PermissionRequest`     | 跳出權限對話框時               | 自動 approve 安全指令          |
| `PostToolUse`           | 工具成功跑完之後               | 自動 format、lint、type check  |
| `PostToolUseFailure`    | 工具執行失敗                   | 錯誤回饋、自動 retry           |
| `SubagentStart`         | 派出子代理                     | 記錄、限制子代理權限           |
| `SubagentStop`          | 子代理回報結果                 | 合併結果、檢查輸出             |
| `Stop`                  | Claude 認為任務做完了          | **完成閘門**：強制 test 通過  |
| `PreCompact`            | context 即將被壓縮             | 備份 transcript                |
| `Setup`                 | `--init` 或 `--maintenance`    | 一次性初始化                   |
| `SessionEnd`            | session 結束                   | 記錄、清理、上傳 log           |

其中**威力最大**的兩個是 `PreToolUse`（事前封鎖）跟 `PostToolUse`（事後修正），九成的 production hook 都圍繞這兩個事件打造。

## 三種 Handler Type

Claude Code 的 hook 接受三種 handler，這是它跟 Cursor / Copilot 拉開差距的地方（後兩者目前只支援 command）：

1. **command**：跑一個 shell command，最常用。
2. **prompt**：餵一段 prompt 給輕量模型做語意判斷（例如「這個檔案改動有沒有牽涉到敏感邏輯？」）。
3. **agent**：派一個 sub-agent 做深度分析（例如「審視這個 PR 的安全性」）。

入門先學 command 就夠用，等開始想做 semantic gating 再升級到 prompt / agent。

## Exit Code 2：決定性的關鍵

整個 Hook 系統最重要的一行設定，是 **shell exit code**：

| Exit Code | 意義                                              |
| :-------: | :------------------------------------------------ |
| `0`       | 成功；stdout 內容會被當 JSON 處理                 |
| **`2`**   | **Block：工具呼叫被中止，stderr 內容回傳給 Claude** |
| 其他      | 錯誤狀態，但執行繼續                              |

**Exit code 2 是整個 Harness Engineering 的決定性開關**。

舉個例子：你寫一個 `PreToolUse` hook，攔截每次 `Bash` 工具呼叫，檢查指令裡有沒有 `rm -rf` 或 `DROP TABLE`。一旦看到，hook 直接 `exit 2`：此刻 Claude **連那條指令都還沒跑**，就被擋下來了。它不會「下次小心點」，而是**這次就根本沒辦法做**。這就是 Ep-0 講的「結構上不可能」。

## 五個生產級 Hook 範例（NX Monorepo 場景）

接著把它套用到上一集的 `nx-nestjs-and-nextjs-template` 專案，看 hook 怎麼把 AGENTS.md 裡的 HARD 規則升級成決定性約束。

設定檔放在 `.claude/settings.json`（專案層級，會被整個團隊共用）。

### 1. 改完 GraphQL schema 後自動跑 codegen

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "handler": {
          "type": "command",
          "command": "case \"$FILEPATH\" in *.graphql) pnpm gql ;; esac"
        }
      }
    ]
  }
}
```

對應 AGENTS.md 規則：「改完 `.graphql` 立刻 `pnpm gql`」。以前要靠 Agent 記得，現在它**根本沒機會忘記**。

### 2. 鎖死 generated 檔案

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "handler": {
          "type": "command",
          "command": "node .claude/scripts/block-generated.js"
        }
      }
    ]
  }
}
```

`block-generated.js` 裡判斷 `$FILEPATH` 是不是 `schema.gql` 或 `libs/graphql/.generated/*`，如果是就 `process.exit(2)` 並印錯誤到 stderr。Agent 再怎麼想直接改 schema 都改不動。

### 3. 寫完後台 code 自動跑 type check + lint

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "handler": {
          "type": "command",
          "command": "case \"$FILEPATH\" in apps/server/*) npx tsc --noEmit -p apps/server/tsconfig.app.json 2>&1 | head -20 ;; esac"
        }
      }
    ]
  }
}
```

只有 `apps/server/` 底下的檔案才會觸發。tsc 的錯誤訊息會回灌進 Claude 的 context，**它馬上就能看到自己寫的 type error，然後自我修正**。這就是 Ep-0 講的 back-pressure（回壓）。

### 4. 攔截危險的 Bash 指令

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "handler": {
          "type": "command",
          "command": "node .claude/scripts/guard-bash.js"
        }
      }
    ]
  }
}
```

`guard-bash.js` 對輸入的指令做正規式比對：看到 `rm -rf /`、`DROP TABLE`、`pnpm migration:revert` 在 main 分支執行……一律 `exit 2`。Agent 即使被 prompt injection 也無法執行。

### 5. 完成閘門：所有測試沒過不准結束

```json
{
  "hooks": {
    "Stop": [
      {
        "handler": {
          "type": "command",
          "command": "pnpm nx affected:test --base=main --parallel || exit 2"
        }
      }
    ]
  }
}
```

當 Claude 自以為「我做完了」要結束 session 時，`Stop` hook 跳出來跑 `nx affected:test`。沒過？`exit 2`，Claude 被迫繼續修。**這條 hook 一行，就解決「Agent 自稱完成但其實沒測過」這個業界頭號問題**。

## 設定檔放哪裡？

Claude Code hook 有三層 scope：

| 路徑                                   | 範圍                       | 適合放什麼                       |
| :------------------------------------- | :------------------------- | :------------------------------- |
| `.claude/settings.json`                | **專案層級，commit 進 git**| 團隊共用的 hard rule、安全規則   |
| `.claude/settings.local.json`          | **專案層級，不進 git**     | 個人偏好（例如自動 format）      |
| `~/.claude/settings.json`              | **全域**                   | 跨專案的個人習慣                 |

**重要**：團隊規則一定要放第一個，commit 進去，這樣每個工程師、每台 CI 機器都吃同一份 hook 設定。

## 什麼時候不該用 Hook？

Hook 很強，但它**不是萬靈丹**。以下情境用 hook 反而會傷自己：

- 🚫 **任務特定的指令**：「這次改完幫我跑 storybook」這種一次性的事，請寫進 prompt，不要塞 hook。
- 🚫 **執行時間太久的檢查**：hook 預設 timeout 是 **60 秒**，超過會被 kill。整套 e2e test 不適合，但 type check / lint 都還在範圍內。
- 🚫 **副作用大、難回復的操作**：hook 跑得很頻繁，如果你寫一個會 `git push` 的 hook，那就是災難。
- 🚫 **取代 AGENTS.md**：hook 是「沒做到就動不了」，但 AGENTS.md 是「告訴你為什麼這樣做」。兩者互補，不是替代。

## 結論

把這集濃縮成三句話：

1. **Hook 是 Harness Engineering 中唯一能達到 100% 合規的工具**：prompt 永遠是 70~90%。
2. **PreToolUse + Exit Code 2 是決定性約束的核心**：它讓「結構上不可能」這件事真的成立。
3. **`.claude/settings.json` 進版控**：hook 設定是團隊的 Harness，不是個人偏好。

下一篇我們會聊另一個威力同等強大、但思路完全不同的元件：**Sub-agents（子代理）**，怎麼用「context firewall」這個觀念，讓你的 Agent 在跑長任務時不會越跑越笨。

## 延伸閱讀

- [Hooks reference - Claude Code 官方文件](https://code.claude.com/docs/en/hooks)
- [Claude Code Hooks: The Deterministic Control Layer for AI Agents - Dotzlaw](https://www.dotzlaw.com/insights/claude-hooks/)
- [Claude Code Hooks: Complete Guide to All 12 Lifecycle Events - claudefa.st](https://claudefa.st/blog/tools/hooks/hooks-guide)
- [Claude Code Hooks: Production CI/CD Patterns - Pixelmojo](https://www.pixelmojo.io/blogs/claude-code-hooks-production-quality-ci-cd-patterns)
- [claude-code-hooks-mastery - GitHub](https://github.com/disler/claude-code-hooks-mastery)
