---
title: "Claude Code Skill 與 Sub-agent 差在哪？｜Harness 筆記 Ep-6"
pubDate: 2026-05-16 18:00:00
description: "Claude Code Skill 與 Sub-agent 到底差在哪？一次搞懂 progressive disclosure、為什麼 slash commands 併進了 skills，並動手做一個 dep-auditor 示範「Sub-agent + Skill 合用」的經典模式。附五元件決策表。"
author: "Peter"
tags: ["Harness Engineering"]
category: "Harness Engineering"
keywords: "Claude Code Skills, SKILL.md, Sub-agent vs Skill, progressive disclosure, dep-auditor, CVE, pnpm audit, Harness Engineering, claude-harness-template"
draft: false
---

## 本篇重點

Ep-4 做了 sub-agents、Ep-5 做了 slash commands，這一集補上 Harness 的最後一塊拼圖 — **Skills**。本篇釐清 Sub-agent 與 Skill 到底差在哪、為什麼 Claude Code 把 slash commands 併進了 skills，並動手做一個 `dep-auditor` 來示範「**Sub-agent + Skill 合用**」的經典模式。

<!-- more -->

## 上集回顧

[Ep-5](/posts/harness-engineering-學習筆記-ep-5) 在 template 加了 `/spec`、`/plan`、`/implement` 三個 slash command,串起 SDD 工作流。文末提了一句**伏筆** — Claude Code 已經把「自訂 commands」併入「skills」。這一集就來把這件事講清楚。

## 什麼是 Skill？

Claude Code 官方對 Skill 的定義:

> Skills extend what Claude can do. Create a `SKILL.md` file with instructions, and Claude adds it to its toolkit.
> — [Claude Code Skills 文件](https://code.claude.com/docs/en/skills)

Skill 是放在 `.claude/skills/<name>/SKILL.md` 的一份 Markdown,由 YAML frontmatter + 本文組成。它有兩種典型用途:

| 類型                 | 內容                                     | 例子                          |
| :------------------- | :--------------------------------------- | :---------------------------- |
| **Reference content**| 知識 — 慣例、pattern、判讀準則           | API 設計規範、CVSS 判讀手冊   |
| **Task content**     | 動作 — 一步步的操作流程                  | `/deploy`、`/commit`          |

關鍵特性是 **progressive disclosure(漸進式揭露)**:Skill 的「描述」一直在 context 裡讓 Claude 知道它存在,但**完整內容只在被呼叫時才載入**。長篇參考資料平常幾乎不佔 token,需要時才展開。

## 重磅消息:Slash Commands 已併入 Skills

Ep-5 用的 `.claude/commands/*.md`,官方文件現在白紙黑字寫:

> **Custom commands have been merged into skills.** A file at `.claude/commands/deploy.md` and a skill at `.claude/skills/deploy/SKILL.md` both create `/deploy` and work the same way.

也就是說:

- 你 Ep-5 寫的 `.claude/commands/spec.md` **完全照常運作**,不用改
- 但**新的東西建議寫成 skill** — skill 多了 supporting files、`paths:` 條件啟動、`context: fork` 等能力
- 同名衝突時 **skill 優先於 command**

簡單講 — command 是 skill 的「精簡版」,skill 是 command 的「完全體」。我們 template 現有的 3 個 command 先留著(它們還能用),新增的 `dep-auditor` 相關知識就用 skill 寫。

## Sub-agent vs Skill — 到底差在哪？

這是這集最重要的一張表。兩個常被混為一談,但定位完全不同:

| 維度         | Sub-agent                                | Skill                                  |
| :----------- | :--------------------------------------- | :------------------------------------- |
| **本質**     | 有獨立 context 的「分身工作人員」        | 按需載入的「參考手冊」                 |
| **Context**  | 開**新的** context window,只回傳摘要     | 載入**當前** context,讓 context 變長  |
| **觸發**     | 主對話用 `Agent` 工具明確派工            | Progressive disclosure — 任務匹配自動載入,或 `/skill-name` 手動 |
| **目的**     | **做事**(寫測試、跑 migration、做 review) | **知識**(規範、pattern、判讀準則)   |
| **檔案位置** | `.claude/agents/<name>.md`               | `.claude/skills/<name>/SKILL.md`        |
| **解決的問題** | Context Rot — 把雜訊鎖在分身的 context | 重複貼上同一段指令 / CLAUDE.md 太肥    |

一句話比喻:

- **Sub-agent = 派一個專員去隔壁辦公室處理,他回來只交報告** — 主對話 context 不會變胖
- **Skill = 給目前這個人遞一本參考書翻開** — 主對話 context 會變胖,但他有了該知識

它們是**互補**,不是二選一。

## 兩者怎麼合用？

最強的用法是把它們**串起來**。Claude Code 的 sub-agent frontmatter 有一個 `skills:` 欄位:

```markdown
---
name: dep-auditor
skills:
  - cve-triage
---
```

這行的意思是 — **派出這個 sub-agent 時,把 `cve-triage` skill 的完整內容預載進它的 context**。

翻成白話:**派一個專員去隔壁辦公室,而且他桌上已經擺好一本參考手冊**。專員(sub-agent)負責跑、負責產出;手冊(skill)負責提供判斷準則。兩個角色分離 — 之後手冊內容要更新,改 skill 就好,不用動 agent。

## 動手:做一個 dep-auditor

來把這個模式做出來。情境:**檢查專案套件有沒有嚴重 CVE,需不需要升級**。

這是「做事」(要跑 `pnpm audit`、解析 lockfile、產報告),所以主體是 **sub-agent**;但「怎麼判讀每條 advisory」是「知識」,抽成 **skill**。

### Part 1:`cve-triage` skill — 判讀知識

放在 `.claude/skills/cve-triage/SKILL.md`,內容是純參考知識(Reference content):

- **CVSS 嚴重度分級** — Critical 9.0-10、High 7.0-8.9、Moderate 4.0-6.9、Low 0.1-3.9,各對應什麼預設處置
- **GHSA vs CVE** — pnpm 11 起 `pnpm audit` 回報的是 GHSA ID 不是 CVE([pnpm 官方文件](https://pnpm.io/cli/audit))
- **Direct vs Transitive 依賴** — 直接依賴改版號就好;間接依賴要嘛等上游、要嘛用 `pnpm.overrides` 強壓
- **Reachability** — 漏洞只有在「漏洞程式碼路徑真的會被呼叫」時才算數,dev-only 依賴的 Critical 真實風險常常比 production 的 Moderate 低
- **決策矩陣** — upgrade / override / accept 怎麼選
- **常見 false positive** — dev 工具鏈、不可達路徑、已被 disputed 的 CVE

這份 skill **不做任何事**,它只是一本「拿到掃描結果之後怎麼想」的手冊。

### Part 2:`dep-auditor` sub-agent — 動手的人

放在 `.claude/agents/dep-auditor.md`,重點 frontmatter:

```markdown
---
name: dep-auditor
description: Audits project dependencies for known CVEs, triages
  severity, produces an actionable upgrade report.
tools: Read, Grep, Glob, Bash
skills:
  - cve-triage          ← 關鍵:預載 triage 知識
model: sonnet
color: red
---
```

它的工作流程:

1. 跑 `pnpm audit --json` 跟 `pnpm audit --prod --json`
2. 交叉比對 `pnpm-lock.yaml` — 每個套件是 direct 還是 transitive
3. **用預載的 `cve-triage` skill 判讀** — 嚴重度、可達性、處置建議
4. 套用 skill 的 false-positive 清單,不浮報
5. 回傳一份分級報告(Critical/High → Moderate → Low → Ignored)

刻意的限制:**dep-auditor 不會自己跑 `pnpm audit --fix`** — 升級決策(尤其是 major bump 可能弄壞 build)留給主對話跟人類。這是 Ep-4 講過的「reviewer 不該自己動手」原則延伸。

### 為什麼這樣分?

如果把 CVE 判讀知識直接寫進 `dep-auditor` 的 system prompt 行不行?可以,但:

- **知識會被綁死在一個 agent** — 哪天 `code-reviewer` 也想引用 CVSS 判讀,得複製一份
- **更新困難** — CVSS 改版、新的 false-positive pattern,要翻 agent prompt 找
- **skill 可以被任何人引用** — 主對話直接 `/cve-triage` 也能叫出來看

**把「知識」跟「執行」分離,是 Harness Engineering 在元件設計層級的體現** — 跟 Ep-1 把規則寫進 AGENTS.md、Ep-2 把檢查寫進 hook 同一個精神。

## 什麼時候用 Skill、什麼時候用 Sub-agent？

一個簡單的判斷流程:

```text
這件事主要是「做」還是「知道」？
├─ 做(會產生 log/檔案雜訊、要跑工具)   → Sub-agent
├─ 知道(慣例、判讀準則、領域知識)       → Skill
└─ 兩者都要                              → Sub-agent + skills: 預載
```

再補一條:**如果是「重複貼的同一段操作指令」**(例如每次都要 Claude「跑測試→看結果→修」),那就是 skill 的 Task content,可以做成 `/skill-name` 手動觸發。

## 五個元件,到底什麼情況用哪個？

到這一集為止,Harness 的元件**全部到齊了**。但這也帶來一個新問題 — 「我想讓 Claude 做對某件事」,到底該寫進哪裡?五個都沾得上邊,感覺哪個都行。

先把五個元件一句話定位:

| 元件              | 一句話定位                          | 哪一集 |
| :---------------- | :---------------------------------- | :----- |
| **AGENTS.md**     | 一直在線的專案規則手冊              | Ep-1   |
| **Hook**          | 決定性約束 — 不做到就動不了          | Ep-2   |
| **Sub-agent**     | 獨立 context 的分身工作人員          | Ep-4   |
| **Slash Command** | 把重複 prompt 變成一行指令           | Ep-5   |
| **Skill**         | 按需載入的領域知識                  | Ep-6   |

它們**看起來**都能「讓 Claude 做對事」,但其實各自解決完全不同的問題。選的時候問自己三個問題:

1. 這是「**知識**」、「**執行**」、還是「**強制**」?
2. 要「**一直生效**」還是「**需要時才出現**」?
3. 要「**機率性**」(Agent 可能照做)還是「**決定性**」(不照做就動不了)?

### 最容易選錯的四個情境

| 你想做的事                              | 常見誤用                  | 正解              | 為什麼誤用會失敗                                  |
| :-------------------------------------- | :------------------------ | :---------------- | :------------------------------------------------ |
| 強制「commit 前一定跑測試」             | 寫進 `AGENTS.md`          | **Hook**          | AGENTS.md 是機率性提醒,Agent 有 1~3 成機率忽略;hook `exit 2` 才是決定性 |
| 給 Agent 一份 TypeORM migration 判讀知識| 整段塞進 `AGENTS.md`      | **Skill**         | AGENTS.md 會被撐肥(踩 Ep-1 的 -3% 陷阱);skill 平常不佔 token,需要才載入 |
| Code review 不想污染主對話 context      | 寫成 `Skill`              | **Sub-agent**     | Skill 是載入**當前** context,review 那一大堆檔案反而讓主對話更肥;sub-agent 才有獨立 context |
| 每次都要 Claude 跑同一串 setup 步驟     | 做成 `Sub-agent`          | **Slash Command** | 這是「手動觸發的固定工作流」,不是「委派出去的任務」;殺雞用牛刀還多一層 context 隔閡 |

### 一句話判斷法

```text
要「強制、結構上不可能違反」      → Hook
要 Agent「永遠知道」的專案規則    → AGENTS.md
要「按需載入」的領域知識          → Skill
要把重複 prompt 變「一行指令」    → Slash Command
要把任務「委派出去、不髒主對話」  → Sub-agent
```

**它們不是替代品,是分工**。一個成熟的 Harness 五個都會用到 — AGENTS.md 立規則、Hook 設紅線、Skill 供知識、Sub-agent 分擔執行、Slash Command 封裝流程。Ep-0 講的「Agent = Model + Harness」,這五個加起來就是那個 Harness。

## 本集 template 進度

`claude-harness-template` 現在長這樣:

```text
.claude/
├── agents/        ← 8 個 sub-agent(新增 dep-auditor)
│   └── dep-auditor.md
├── commands/      ← 3 個 slash command(Ep-5)
└── skills/        ← 新增
    └── cve-triage/
        └── SKILL.md
```

AGENTS.md 升到 v0.5.0,sub-agent 表多一列 `dep-auditor`,並新增「Skills」段落。

## 結論

把這集濃縮成三句話:

1. **Skill 是知識、Sub-agent 是執行** — 一個讓 context 變胖換來能力,一個開分身 context 換來乾淨。
2. **Slash commands 已併入 skills** — 舊的 `.claude/commands/` 照常用,新東西寫 skill 拿進階能力。
3. **`skills:` 欄位讓兩者合體** — 派一個專員,順手把參考手冊塞進他的公事包。

下一篇 **Ep-7 — Hooks 整合 × MCP**,會把 Ep-2 講過的 hook 觀念真正落地進 `.claude/settings.json`,並加上 MCP server 設定 — 讓 template 的「決定性約束」那一層補完。

## 延伸閱讀

- [Claude Code Skills 官方文件](https://code.claude.com/docs/en/skills)
- [Claude Code Sub-agents 官方文件](https://code.claude.com/docs/en/sub-agents)
- [pnpm audit 官方文件](https://pnpm.io/cli/audit)
- [OSV.dev — Open Source Vulnerabilities 資料庫](https://osv.dev/)
- [Peter-To-Better/claude-harness-template](https://github.com/Peter-To-Better/claude-harness-template) — 本系列產出的 template
