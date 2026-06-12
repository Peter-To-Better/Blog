---
title: "Harness Engineering 學習筆記 Ep-7"
pubDate: 2026-05-16 19:30:00
description: "Ep-2 講了 Hooks 的觀念,Ep-6 引出了 MCP 的雛形,這一集把兩者真正落地進 template — 寫出兩個 PreToolUse hook 把 HARD 規則變成「動不了」的決定性約束,並用 .mcp.json 示範怎麼把外部工具(資料庫、GitHub)接進 sub-agent 的能力範圍。"
author: "Peter"
tags: ["Harness Engineering"]
category: "Harness Engineering"
keywords: "Claude Code Hooks, PreToolUse, .claude/settings.json, MCP, Model Context Protocol, .mcp.json, deterministic constraint, Harness Engineering, claude-harness-template"
draft: false
---

# 本篇重點

Ep-2 講了 Hooks 的觀念,Ep-6 引出了 MCP 的雛形,這一集把兩者真正落地進 template — 寫出兩個 **PreToolUse hook** 把 HARD 規則變成「動不了」的決定性約束,並用 `.mcp.json` 示範怎麼把外部工具(資料庫、GitHub)接進 sub-agent 的能力範圍。

<!-- more -->

## 上集回顧

到 Ep-6 為止,Harness 的元件全到齊了 — AGENTS.md、Sub-agents、Slash Commands、Skills。但回看 Ep-6 最後那張「**什麼情況用哪個**」決策表,Hook 那欄寫的是「強制、結構上不可能違反」。

問題是 — **template 裡的 Hook 還是空的**。AGENTS.md 寫了一堆 NEVER 規則(不准動 `schema.gql`、不准 `git push --force`、不准 `Manager` 命名...),但這些目前都靠 Agent 自律。

這一集要把那層自律換成**鋼閘**。

## 從「拜託」到「動不了」

回想 Ep-2 的核心數字:

> 純 prompt-based 的指令,Agent 大約只能達到 **70 ~ 90% 的合規率**。
> Hook 才是 **100%** — 因為它執行在 LLM 推理鏈外的系統層。

把這個原則對應回我們 AGENTS.md 的 HARD 規則,**最值得用 hook 鎖死的有兩條**:

1. **不准編輯 `schema.gql` / `libs/**/.generated/`** — 編輯了會在下次 `pnpm gql` 被覆蓋,silently lose 改動
2. **不准跑某些破壞性 bash** — `rm -rf /`、`DROP TABLE`、`git push --force`、`--no-verify`、`migration:revert` on main

剩下的 HARD 規則(`Relation<T>` 不加 `@Field`、`Manager` 命名禁忌)比較適合**寫進 CI** 而不是 hook,因為它們是程式碼結構問題,要 lint / typecheck 才看得出來 — 那是 Ep-8 的事。

## 動手:兩個 PreToolUse Hook

### Hook #1:`block-generated.js` — 鎖死 generated 檔

放在 `.claude/scripts/block-generated.js`。核心邏輯就一段:

```js
const BLOCKED_PATTERNS = [
  /\bschema\.gql$/,
  /\/\.generated\//,
  /\.generated\.(ts|js|json)$/,
];

// 讀 stdin 的 tool_input,看 file_path 有沒有命中
for (const pattern of BLOCKED_PATTERNS) {
  if (pattern.test(filePath)) {
    process.stderr.write(`🛑 BLOCKED: ${filePath} is generated...`);
    process.exit(2);   // ← Ep-2 講的「決定性開關」
  }
}
```

**Exit code 2** 是這整個系統的命脈 — Claude Code 看到 PreToolUse hook 回 2,**那個 Edit/Write 根本不會發生**,stderr 訊息會回灌進 Claude 的 context 告訴它為什麼被擋。

### Hook #2:`guard-bash.js` — 攔截破壞性指令

放在 `.claude/scripts/guard-bash.js`。把每條規則寫成 `{ pattern, reason }` 陣列,容易維護:

```js
const BLOCKED = [
  { pattern: /\brm\s+-rf\s+\//,
    reason: 'rm -rf with absolute root path' },
  { pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i,
    reason: 'use a reversible migration via migration-writer' },
  { pattern: /\bgit\s+push.*--force(?!-with-lease)/,
    reason: '--force without --force-with-lease can overwrite team work' },
  { pattern: /\bgit\s+(commit|push).*--no-verify/,
    reason: '--no-verify bypasses pre-commit hooks (your safety layer)' },
  { pattern: /\bpnpm\s+migration:revert\b.*\bmain\b/,
    reason: 'migration revert on main needs human approval' },
];
```

每條都附**為什麼**寫進 stderr,Agent 看到不只知道「被擋」,還知道**該怎麼換策略**(例如「DROP TABLE 被擋 → 改派 `migration-writer` 寫一個 reversible migration」)。

### 註冊到 `.claude/settings.json`

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command",
            "command": "node .claude/scripts/block-generated.js",
            "timeout": 10 }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command",
            "command": "node .claude/scripts/guard-bash.js",
            "timeout": 10 }
        ]
      }
    ]
  }
}
```

`matcher` 是 regex,匹配工具名稱;`timeout` 單位是秒(預設 60),這兩個檢查很輕量 10 秒夠用。

設定檔放在 `.claude/settings.json` 是 **commit 進 git 的團隊規則**;`.claude/settings.local.json` 才是個人覆寫(自動 gitignore)。

## MCP — 把外部工具接給 Agent

[Hook 是 Agent 內部的決定性層],**MCP(Model Context Protocol)是 Agent 跟外部世界的橋**。Anthropic 開放的標準,讓 Claude Code 用統一介面接資料庫、API、SaaS 服務,而不用每個都寫 plugin。

[官方定義](https://code.claude.com/docs/en/mcp):

> MCP servers give Claude Code access to your tools, databases, and APIs.
> ... ask Claude to "Find emails of 10 random users who used feature ENG-4521, based on our PostgreSQL database."

對我們這個 stack,最值得接的兩個 server:

| MCP server | 給誰用                                                            | 為什麼                                                      |
| :--------- | :---------------------------------------------------------------- | :---------------------------------------------------------- |
| **postgres** | `migration-writer`、`graphql-feature`、`code-reviewer`            | 看 live schema,避免 entity 改完跟 DB 真實狀態對不上          |
| **github**   | `code-reviewer`、`dep-auditor`                                    | 抓 PR diff / issue 上下文、查最新 advisory                  |

### `.mcp.json` 的位置與作用域

[Claude Code MCP 三層 scope](https://code.claude.com/docs/en/mcp#mcp-installation-scopes):

| Scope     | 放哪裡                       | 共用範圍                  |
| :-------- | :--------------------------- | :------------------------ |
| **project** | `.mcp.json`(repo root)     | 進版控,團隊共用          |
| **local**   | `~/.claude.json`           | 你個人 + 這個 project     |
| **user**    | `~/.claude.json`           | 你個人 + 所有 project     |

Template 用 project scope — 規格進版控,團隊一起吃同一份 MCP 設定:

```json
{
  "mcpServers": {
    "_postgres_example": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@bytebase/dbhub", "--dsn", "${DATABASE_URL}"]
    },
    "_github_example": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer ${GITHUB_PAT}" }
    }
  }
}
```

幾個關鍵設計決策:

1. **名字加 `_` 前綴** = 預設停用 — 讀者要主動拿掉底線才會啟動。避免 clone 進來不知情就跑外部 connection。
2. **`${DATABASE_URL}` env var 展開** — credentials 從不寫死進 JSON,團隊共用設定但各自帶自己的金鑰
3. **`stdio` vs `http`** 兩種 transport 都示範了 — postgres 是本機 npm package(stdio),GitHub 是遠端 SaaS(http)

### 第一次啟用會發生什麼

Claude Code 官方文件特別強調:

> For security reasons, Claude Code prompts for approval before using project-scoped servers from `.mcp.json` files.

第一次 clone template + 啟用某個 MCP server 時,Claude Code 會跳對話框問你「信任這個 server 嗎?」。Approve 之後才會真的連線。這是 **Anthropic 的供應鏈安全設計** — `.mcp.json` 進 git 不代表 server 自動啟動,人類同意才算數。

## Hook + MCP 怎麼跟前面元件串起來

到這集 template 一共有:

- **AGENTS.md** — 把規則寫下來
- **Sub-agents × 8** — 派分身做事
- **Slash Commands × 3** — 封裝重複工作流
- **Skills × 1** — 提供知識
- **Hooks × 2** — 強制紅線
- **MCP × 2 examples** — 接外部工具

它們不是並列,是**層次**:

```text
┌──────────────────────────────────────────────────────┐
│  你(human)                                          │
└──────────────────────────────────────────────────────┘
                       ↓ prompt / /command
┌──────────────────────────────────────────────────────┐
│  Main Claude(讀 AGENTS.md 知道整體規則)            │
└──────────────────────────────────────────────────────┘
        ↓ 派工(Agent tool)         ↓ 工具呼叫
┌─────────────────────┐    ┌─────────────────────────┐
│  Sub-agent          │    │  Tool(Edit/Write/Bash) │
│  (preload Skills)   │    │                         │
│  ↓ 透過 MCP 拿外部資料 │    │  ← Hook 攔截檢查        │
└─────────────────────┘    └─────────────────────────┘
                                       ↓
                        ✅ pass → 執行 / ❌ exit 2 → 擋下
```

Sub-agent / Skill / Slash Command 是「**能力**」— 讓 Claude 做更多事。
Hook 跟 MCP 是「**邊界**」— Hook 設下不能做的,MCP 拉進可以做的。

**有能力、有邊界,Harness 才是 Harness。**

## 結論

把這集濃縮成三句話:

1. **PreToolUse hook + exit code 2 = 結構上不可能的約束** — Ep-2 講過的「決定性」這集真的落地了。
2. **`.mcp.json` 是 Agent 接外部世界的標準介面** — Postgres、GitHub、Sentry...一條 JSON 進來,Agent 多一個工具。
3. **Hook 跟 MCP 是 Harness 的邊界元件** — 前者管「不准做」,後者管「能做」。Sub-agent / Skill / Command 是「怎麼做」。三層加起來才完整。

下一篇 **Ep-8 — CI 整合 + 公開釋出**:把 `.github/workflows/` 補上一份 pnpm-friendly 的 CI(取代 Ep-7 開頭刪掉的 Nx 預設版),把 hooks 的決定性約束延伸到 PR 層,然後正式把 template 標 v1.0.0 公開釋出 — **系列收尾**。

# 延伸閱讀

### Claude Code 官方

- [Hooks reference](https://code.claude.com/docs/en/hooks) — Ep-2 已用過,完整事件與 exit code 規格
- [MCP 完整文件](https://code.claude.com/docs/en/mcp) — 本篇 MCP 段落來源
- [MCP scopes](https://code.claude.com/docs/en/mcp#mcp-installation-scopes) — project / local / user 差別

### MCP server 生態

- [Anthropic Directory](https://claude.ai/directory) — 官方審核過的 MCP server 列表
- [Model Context Protocol 標準](https://modelcontextprotocol.io/introduction)
- [@bytebase/dbhub](https://www.npmjs.com/package/@bytebase/dbhub) — 本篇用的 Postgres MCP
- [GitHub MCP server](https://api.githubcopilot.com/mcp/) — 官方 GitHub MCP

### 本系列

- [Ep-2 — Hooks 觀念](/posts/harness-engineering-學習筆記-ep-2)
- [Ep-6 — Skills + 五元件決策表](/posts/harness-engineering-學習筆記-ep-6)
- [Peter-To-Better/claude-harness-template](https://github.com/Peter-To-Better/claude-harness-template) — 本系列產出的 template
