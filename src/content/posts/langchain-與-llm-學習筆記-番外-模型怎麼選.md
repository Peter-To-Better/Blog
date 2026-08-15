---
title: "RAG 該選哪個模型？MTEB 與 Chatbot Arena 挑選法"
pubDate: 2026-07-07 00:00:00
description: "LangChain RAG 要選哪個模型？用 MTEB 排行榜挑嵌入模型、Chatbot Arena 挑生成模型，解釋為什麼選 nomic-embed-text 和 llama3.1:8b，附本地 vs 付費 API 完整對比表與一鍵切換程式碼。"
author: "Peter"
tags: ["LangChain & LLM"]
category: "LangChain & LLM"
keywords: "MTEB 排行榜 嵌入模型, Chatbot Arena 排行, nomic-embed-text 教學, llama3.1 vs qwen3, 嵌入模型比較, LangChain 模型選擇, Ollama 模型推薦, text-embedding-3-small 比較"
draft: false
---

## 本篇重點

說清楚這個系列為什麼選 `nomic-embed-text` 和 `llama3.1:8b`，以及怎麼用業界標準評估模型。

<!-- more -->

這篇是 [Ep-1：RAG 技術架構](/posts/langchain-與-llm-學習筆記-ep-1) 的番外補充。跑 RAG 需要兩種模型：**嵌入模型**（把文字轉向量）和**生成模型**（根據撈到的資料寫出回答）。這篇說明這個系列的選擇邏輯，以及業界怎麼評估這兩類模型。

---

## 為什麼全程用本地 Ollama？

說真的，身為台灣的開發者，在學習階段付錢買 API Key 根本不現實。跑個 RAG 實驗要先信用卡綁帳號、怕超量、怕被扣費，光這些心理負擔就夠打消學習動力了。

**所以這個系列的選擇很直接：全程用本地 [Ollama](https://ollama.com/) 跑，不需要任何 API Key，不花一毛錢。** 你可以放心地跑一百次、改一百次，帳單永遠是 $0。

不確定自己的硬體能不能跑？先看[番外篇：我的電腦能跑哪些本地模型？](/posts/langchain-與-llm-學習筆記-番外-本地模型怎麼選)

> **延伸閱讀**：這篇談的是「該選哪個模型比較準」（用 MTEB、Chatbot Arena 排行榜評估品質）；另一篇[番外篇：我的電腦能跑哪些本地模型？](/posts/langchain-與-llm-學習筆記-番外-本地模型怎麼選)談的是「你的硬體跑不跑得動」（量化格式與記憶體規格對照）。兩篇搭配著看：先確認硬體跑得動，再從跑得動的選項裡挑最準的。

---

## 嵌入模型：看 MTEB 排行榜

嵌入模型負責把文字轉成向量，直接影響「能不能撈到對的資料」。評估它的業界標準是 **[MTEB（Massive Text Embedding Benchmark）排行榜](https://huggingface.co/spaces/mteb/leaderboard)**，涵蓋 58 個任務，是目前最全面的嵌入模型比較基準。

這個系列選用 **`nomic-embed-text`**：

| 考量 | 說明 |
| :--- | :--- |
| MTEB 分數 | 約 62.4 分，在同量級開源模型裡表現穩定（[來源](https://arxiv.org/pdf/2402.01613)） |
| 資源需求極低 | 僅 137M 參數、274 MB，CPU 就能跑，不需要 GPU |
| Ollama 原生支援 | `ollama pull nomic-embed-text` 直接用，免設定 |
| 長文本支援 | 最大 8,192 token，比多數同類模型更長 |

### 嵌入模型完整對比：本地 vs 付費 API

學習階段一律用本地免費的就好。等哪天你要把 RAG 做成產品、上線服務真實用戶，再來考慮付費 API，那時候的需求（SLA、規模、多語言）跟現在完全不同。先把概念搞懂再說：

| 模型 | 類型 | MTEB 分數 | 費用 | 向量維度 | 特點 |
| :--- | :--- | :---: | :--- | :---: | :--- |
| **`nomic-embed-text`** | 本地（Ollama）| ~62.4 | 免費 | 768 | ← **本系列選用**，輕量 CPU 可跑 |
| `mxbai-embed-large` | 本地（Ollama）| ~64.7 | 免費 | 1024 | 本地裡準確度最高，需較多 RAM |
| `bge-m3` | 本地（Ollama）| ~63.0 | 免費 | 1024 | 中英日韓多語言，適合中文文件 |
| `text-embedding-3-small` | OpenAI API | ~62.3 | $0.02 / 1M tokens | 1536 | 雲端省事，維度可縮減至 512 |
| `text-embedding-3-large` | OpenAI API | ~64.6 | $0.13 / 1M tokens | 3072 | OpenAI 最高品質，維度可縮減 |
| `embed-v4` | Cohere API | ~65.2 | $0.01 / 1M tokens | 1024 | 付費 CP 值最高，多語言強 |

> 資料來源：[MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard)、[Embedding Model Specs 2026](https://pecollective.com/tools/text-embedding-models-compared/)

**切換到付費 API 只要換兩行，其餘不動：**

```python
# 原本（本地 Ollama）
from langchain_ollama import OllamaEmbeddings
embeddings = OllamaEmbeddings(model="nomic-embed-text")

# 換成 OpenAI（需要 OPENAI_API_KEY）
# uv add langchain-openai
from langchain_openai import OpenAIEmbeddings
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# 換成 Cohere（需要 COHERE_API_KEY）
# uv add langchain-cohere
from langchain_cohere import CohereEmbeddings
embeddings = CohereEmbeddings(model="embed-v4")
```

Chroma、Retriever、LLM 那幾行完全不用動，這就是 LangChain 抽象層的好處。

---

## 生成模型：看 Chatbot Arena

生成模型負責把撈到的參考資料跟使用者的問題整合起來，寫出最終回答。它決定的是 RAG 的「輸出品質」：能不能讀懂撈到的資料、有沒有老實照著資料回答（還是自己亂掰）、中文是否流暢。

怎麼比較哪個生成模型比較好？可以參考 **[Chatbot Arena（LMSYS）](https://lmarena.ai/)** 的 Elo 排行：這個排行榜讓真實使用者在不知道模型名字的情況下，盲測兩個模型的回答後投票選優，是目前最貼近「人類真實感受」的評比方式，比跑 benchmark 分數更實用。

這個系列用 **`llama3.1:8b`**：

| 考量 | 說明 |
| :--- | :--- |
| 硬體需求合理 | Q4 量化後約 5 GB，8 GB 記憶體的機器就能跑（[來源](https://insiderllm.com/guides/llama-3-guide-every-size/)） |
| 指令遵循能力強 | 能照著 RAG prompt 只根據參考資料回答，不亂補充 |
| 中文支援尚可 | 在開源 8B 模型裡中文相對穩定 |
| 社群教學資源最多 | 踩雷記錄豐富，遇到問題好找答案 |

> **本地也有更好的選擇：** `qwen3:8b`（同樣免費，約 5 GB）。根據 [Qwen3 Technical Report（arXiv 2505.09388）](https://arxiv.org/abs/2505.09388) 和第三方 [benchmark 比較](https://blog.galaxy.ai/compare/llama-3-1-8b-instruct-vs-qwen3-8b)，Qwen3-8B 在中文、多語言以及指令遵循能力上均優於 Llama 3.1 8B；如果你的中文場景較多，可以直接換用。只需把程式碼裡的 `llama3.1` 換成 `qwen3` 就好。

---

## 快速對照表

| 用途 | 本系列（本地免費）| 本地升級 | 付費 API |
| :--- | :--- | :--- | :--- |
| 嵌入向量 | `nomic-embed-text` | `mxbai-embed-large`、`bge-m3` | OpenAI `text-embedding-3-large`、Cohere `embed-v4` |
| 文字生成 | `llama3.1:8b` | `qwen3:8b`、`llama3.3:70b` | OpenAI `gpt-4o-mini`、Anthropic `claude-haiku-4-5` |
| 視覺轉述（Ep-3） | `qwen2.5vl:7b` | `qwen2.5vl:72b`（需 GPU）| OpenAI `gpt-4o`、Anthropic `claude-sonnet-4-6` |

---

## 確認完模型，回去動手

回到 [Ep-1 的完整實作](/posts/langchain-與-llm-學習筆記-ep-1#實作把八個步驟串成一個可跑的-rag)，`ollama pull` 兩個模型就能跑起來：

```bash
ollama pull llama3.1        # 生成模型（約 5 GB）
ollama pull nomic-embed-text # 嵌入模型（274 MB）
```
