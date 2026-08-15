---
title: "Harness Engineering 是什麼？AI Agent 的第三層工程｜Harness 筆記 Ep-0"
pubDate: 2026-05-09 10:00:00
description: "Harness Engineering 是什麼？從 Mitchell Hashimoto 的起源到核心公式 Agent = Model + Harness，一次搞懂 Prompt、Context、Harness 三層工程差在哪，以及它為何九十天橫掃 AI 產業。附騎馬比喻。"
author: "Peter"
tags: ["Harness Engineering"]
category: "Harness Engineering"
keywords: "Harness Engineering, AI Agent, Mitchell Hashimoto, Prompt Engineering, Context Engineering, AGENTS.md, AI 工程, Codex, Claude Code"
draft: false
---

## 本篇重點

本篇將介紹 2026 年最熱門的 AI 工程概念：Harness Engineering，從 Mitchell Hashimoto 提出的起源、核心公式 Agent = Model + Harness，到 Prompt、Context、Harness 三層工程的差異，帶你理解為什麼這個詞會在短短九十天內成為整個 AI 產業的共同語言。

<!-- more -->

## 什麼是 Harness Engineering？

如果你最近常用 Claude Code、Codex 或 Cursor 這類 AI Agent 來協助開發，可能會發現一件事：**同樣的模型，在不同人手上產出的品質落差很大**。有人能讓它連續跑五個小時還產出可上線的程式碼，有人卻覺得它連簡單的 PR 都改不好。

差異不在模型，而在「**Harness（馬具）**」。

Harness Engineering 直白翻譯是「馬具工程」，指的是設計 AI Agent 運作所處的**整個環境**：包含工具、驗證邏輯、架構限制、回饋機制，目標是讓 Agent 能在無人監督下可靠地執行數小時。等等，先別急！馬具是什麼？跟 AI 又有什麼關係？接下來我會用幾個例子來幫你建立直覺。

## 這個詞是怎麼來的？

Harness Engineering 這個詞，來自 HashiCorp 共同創辦人、Terraform 之父 **Mitchell Hashimoto** 在 **2026 年 2 月 5 日** 發表的一篇部落格文章。

他描述了自己在使用 AI Agent 時養成的一個習慣：

> 每當 Agent 犯了一個錯，他不是去重寫 prompt 提醒它「下次不要這樣」，而是把修復方法**永久寫進 Agent 的環境裡**，讓這個錯誤從此在結構上就不可能發生。

他把這個過程稱為 **engineering the harness（打造馬具）**。

短短六天後（2 月 11 日），OpenAI 工程師 Ryan Lopopolo 發表了官方文章 [Harness Engineering: Leveraging Codex in an Agent-First World](https://openai.com/index/harness-engineering/)，公開他們內部團隊用 Codex 在五個月內產出 **100 萬行 production code、1500 個 PR** 的經驗，整套方法論也叫 Harness Engineering。

接著 Anthropic、Google、Microsoft 相繼跟進。九十天內，整個 AI 產業就在這個詞之上建立了一整套共同語言。

## 核心公式：Agent = Model + Harness

Mitchell 給整個領域留下一條非常簡單的公式：

```text
Agent = Model + Harness
```

意思是：一個 AI Agent **不只是底層的語言模型**，還包含模型外面所有的系統、約束、回饋迴路。

這個公式有多重要？看一個被廣泛引用的實驗：**Hashline 改寫**：

- 同一個模型、同一份權重
- 只把工具回傳的「行號雜湊（line hash）」格式改一改
- 模型在某個 benchmark 上的成績從 **6.7% 飆升到 68.3%**

模型完全沒換，只動了 Harness，效能就翻了 10 倍。這也是為什麼大家會說：**Harness 才是產品，不是模型**。

## Prompt、Context、Harness 工程有什麼差別？

這三個詞常被混用，但其實是**三個不同層次**的工程。最有名的比喻是**騎馬**：

| 層次                | 對應到騎馬                   | 解決什麼問題         |
| :------------------ | :--------------------------- | :------------------- |
| Prompt Engineering  | 命令「向右轉」               | 這一次要說什麼？     |
| Context Engineering | 地圖、路標、看得到的地形     | 這一刻它能看到什麼？ |
| Harness Engineering | 韁繩、馬鞍、圍欄、整條路本身 | 整個環境怎麼設計？   |

換句話說：

- **Prompt Engineering** 優化的是**單次輸出**：你怎麼把這一句話講好。
- **Context Engineering** 管理的是**模型能看到的資訊**：哪些檔案、哪些對話歷史、哪些工具回傳要塞進 context window。
- **Harness Engineering** 打造的是**整個世界**：Agent 用什麼工具、能做什麼、不能做什麼、出錯時誰來糾正。

層次越往下，影響力越大，但工程量也越大。

## 最關鍵的思維轉換：機率性 vs 決定性

這個觀念是 Harness Engineering 整個學派的精髓，務必記下來。

舉個例子，假設你不希望 Agent 寫出不符合團隊規範的程式碼，你有兩種做法：

### 做法 A：寫進 prompt

> 「請務必遵守團隊的 coding 標準，例如使用 2 空白縮排、變數命名要用 camelCase……」

這是**機率性合規（probabilistic compliance）**：模型「可能會」遵守，但有一定機率會忘記、忽略、或被其他指令蓋過。

### 做法 B：接一個 linter，PR 違規時直接 fail

這是**決定性約束（deterministic constraint）**：不管模型多想偷懶，只要違規，CI 就紅燈，PR 進不去 main，Agent 必須回頭改到 lint pass 為止。

| 做法             | 性質       | 失敗率       | 信賴度 |
| :--------------- | :--------- | :----------- | :----- |
| 寫進 prompt      | 機率性合規 | 隨機出錯     | 低     |
| 接 linter / hook | 決定性約束 | 結構上不可能 | 高     |

**Harness Engineering 就是有系統地把「拜託你做到」改寫成「不做到就動不了」的工程學**。每次 Agent 出錯，問的不是「我下次怎麼提醒它」，而是「我怎麼讓這個錯誤從此在結構上不可能發生」。

## 一個 Harness 裡面有什麼？

了解概念之後，來看一個真實的 Coding Agent Harness 通常包含哪些元件：

1. **System prompt 與 AGENTS.md**：給 Agent 的「員工守則」，每次都會被注入到 system message。
2. **MCP Servers / Tools**：擴充 Agent 的能力，讓它能讀檔、跑 bash、查資料庫、呼叫 API。
3. **Skills（技能模組）**：可重複使用的知識區塊，採用 progressive disclosure，需要時才載入。
4. **Sub-agents（子代理）**：把任務切成獨立的 session，避免主 context 被中間過程汙染（俗稱 context rot）。
5. **Hooks（生命週期鉤子）**：在特定時間點自動執行的腳本，例如「commit 之前一定先跑 test」。
6. **Back-pressure（回壓機制）**：測試、type check、lint：當 Agent 寫錯時，這些訊號會逼它自我修正。

這些東西組合起來，就是讓 Agent 從「玩具 demo」進化成「能可靠交付」的關鍵。

## 一個生活化比喻：賽馬與賽道

如果上面講的還是太抽象，這邊用一個生活化的比喻收尾。

想像你今天要辦一場賽馬比賽：

- 你**對騎師喊話**「跑快一點！」 → 這是 **Prompt Engineering**
- 你**給騎師地圖、告訴他賽道哪裡有彎、對手在哪** → 這是 **Context Engineering**
- 你**鋪好整條賽道、設好欄杆、準備好獸醫、設定計時器和終點線** → 這就是 **Harness Engineering**

最厲害的賽馬隊不會把希望全押在「騎師當天狀態好不好」，而是把整個賽道、馬具、後勤系統做到位：**讓平庸的騎師也能跑出穩定的成績**。

放回 AI 世界，這就是為什麼業界會說：

> 你可以買到跟別人一樣強的模型，但你買不到跟別人一樣的 Harness。

## 結論

Harness Engineering 是 2026 年 AI 工程的新顯學，它的核心精神可以用三句話總結：

1. **Agent = Model + Harness**：模型只是其中一半，環境決定另一半。
2. **每個錯誤都是一次工程機會**：不是重寫 prompt，而是改造環境讓錯誤再也發生不了。
3. **用決定性約束取代機率性合規**：能用 hook、test、type check 解決的事，就不要靠口頭叮嚀。

下一篇會深入聊 **AGENTS.md 應該怎麼寫**、為什麼人類手寫的 AGENTS.md 總是比 LLM 自動生成的好用，以及一份精簡 AGENTS.md 的實作範例。

## 延伸閱讀

- [Harness Engineering: Leveraging Codex in an Agent-First World - OpenAI](https://openai.com/index/harness-engineering/)
- [Skill Issue: Harness Engineering for Coding Agents - HumanLayer](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents)
- [What Is an Agent Harness? - Firecrawl](https://www.firecrawl.dev/blog/what-is-an-agent-harness)
- [Beyond Prompts and Context: Harness Engineering for AI Agents - MadPlay](https://madplay.github.io/en/post/harness-engineering)
- [The AI Agent Harness Lexicon - Haverin](https://haverin.substack.com/p/what-if-pandora-had-found-a-harness)
