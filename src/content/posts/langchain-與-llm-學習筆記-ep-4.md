---
title: "RAG 評估教學：RAGAS 四大指標實作｜LangChain 筆記 Ep-4"
pubDate: 2026-06-17 14:00:00
description: "RAG 評估教學：用 RAGAS + Ollama 量化你的 RAG 系統準確率。四個核心指標 Faithfulness、Answer Relevancy、Context Precision、Context Recall，附完整 Python 程式碼，不需要 OpenAI API。"
author: "Peter"
tags: ["LangChain & LLM"]
category: "LangChain & LLM"
keywords: "RAG 評估教學, RAGAS 教學, RAG 準確率評估, Faithfulness 是什麼, Context Precision 是什麼, LangChain RAG 評估, Ollama RAGAS, RAG 指標"
draft: false
---

## 本篇重點

[Ep-3](/posts/langchain-與-llm-學習筆記-ep-3) 結尾留了一個尷尬的問題：我們做了一堆優化（混合檢索、重排序、圖片轉述），但**怎麼知道到底有沒有變好？** 這篇就要回答這件事——用 **RAGAS** 這個專門評估 RAG 的框架，把「準不準」變成可以量化的數字，一樣全部跑在本地 Ollama 上。

<!-- more -->

---

## 為什麼一定要評估？

很多人做 RAG 是這樣調的：「我覺得加了重排序好像有比較準？」——**憑感覺**。問題是，當你手動丟三五個問題去測，看起來不錯就上線了，結果換一批問題就翻車。

評估的價值在於：**它讓你的優化決策有依據。** 你在 Ep-2 學了那麼多招，到底哪一招對「你的資料」有用？只有跑分數才知道。沒有評估，你就是在黑箱裡瞎調參數。

更麻煩的是，RAG 答錯有兩種完全不同的原因，要分開診斷：

- **檢索錯了**：根本沒撈到對的資料，那 LLM 再強也是巧婦難為無米之炊。
- **生成錯了**：資料明明撈對了，但 LLM 自己亂掰、沒照著資料回答。

所以好的評估，要能**分別量出「檢索品質」和「生成品質」**，這樣你才知道問題出在哪一段、該修哪裡。

---

## RAG 的四個核心指標

RAGAS 把評估拆成幾個指標，最常用的四個剛好對應上面那兩個層面：

| 指標 | 層面 | 它在問什麼 | 需要的資料 |
| :--- | :--- | :--- | :--- |
| **Context Precision** | 檢索 | 撈回來的東西，**有用的比例高嗎**？（有沒有混一堆雜訊） | 問題、檢索內容、標準答案 |
| **Context Recall** | 檢索 | **該撈的有沒有撈到**？（有沒有漏掉關鍵資料） | 問題、檢索內容、標準答案 |
| **Faithfulness** | 生成 | 回答的內容，**都有根據嗎**？（有沒有幻覺、亂掰） | 問題、檢索內容、回答 |
| **Answer Relevancy** | 生成 | 回答**有沒有切題**？（有沒有答非所問） | 問題、回答 |

用一個比喻來記：把 RAG 想成一個考生

- **Context Precision / Recall** 是在評「他翻書的功力」——有沒有翻到對的那幾頁、有沒有翻一堆沒用的。
- **Faithfulness** 是在評「他有沒有照書寫」——還是自己編了不在書上的東西（幻覺）。
- **Answer Relevancy** 是在評「他有沒有回答到題目」——還是寫了一堆離題的廢話。

> 注意：要算 **Context Recall** 跟 **Context Precision**，你需要先準備「標準答案（reference / ground truth）」，因為要有正確答案當基準，才能判斷檢索內容夠不夠。

---

## 一、用 uv 裝 RAGAS

延續 Ep-3 的專案，直接加裝 RAGAS：

```bash
uv add ragas
```

RAGAS 評估時，背後其實是用一個 LLM 當「**裁判**」去打分數（例如判斷某句回答有沒有被檢索資料支持）。預設它會用 OpenAI，但我們要省錢，所以一樣把裁判換成本地的 Ollama。

---

## 二、把裁判模型換成本地 Ollama

RAGAS 提供了 `LangchainLLMWrapper` 和 `LangchainEmbeddingsWrapper`，可以把任何 LangChain 的模型包起來給它用。我們把 Ep-3 用的那兩個 Ollama 模型包進去：

```python
from langchain_ollama import ChatOllama, OllamaEmbeddings
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper

# 當裁判的 LLM，建議用稍微強一點的模型，判斷才準
evaluator_llm = LangchainLLMWrapper(ChatOllama(model="llama3.1", temperature=0))
evaluator_embeddings = LangchainEmbeddingsWrapper(
    OllamaEmbeddings(model="nomic-embed-text")
)
```

> 提醒：裁判模型越強，評分越可信。本地小模型當裁判會有誤差，所以 RAGAS 的分數適合拿來「**比較不同版本的相對好壞**」（加 rerank 前 vs 後），而不是當成絕對的考試分數。

---

## 三、準備評估資料集

RAGAS 用 `EvaluationDataset` 來裝評估資料，每一筆是一個 `SingleTurnSample`，包含四個欄位：

- `user_input`：使用者的問題
- `retrieved_contexts`：你的 RAG 檢索到的內容（list）
- `response`：你的 RAG 生成的回答
- `reference`：標準答案（你自己準備的 ground truth）

實務上，`retrieved_contexts` 和 `response` 就是直接從你 Ep-3 的 RAG 系統跑出來的結果：

```python
from ragas import EvaluationDataset

# 通常會寫個迴圈，把每個測試問題丟進你的 RAG，蒐集結果
dataset = EvaluationDataset.from_list([
    {
        "user_input": "第三季的營收表現如何？",
        "retrieved_contexts": [
            "這是一張長條圖，Q3 營收約 160 百萬，為全年最高點……"
        ],
        "response": "第三季營收約 160 百萬，是全年最高的一季。",
        "reference": "第三季營收約 160 百萬，達到全年高點。",
    },
    # ... 多準備幾筆，至少 10~20 題比較有參考價值
])
```

> 小技巧：標準答案（reference）不用寫得跟回答一模一樣，**意思對就好**，因為 RAGAS 是用語意去比對，不是逐字比對。

---

## 四、跑評估

把資料集、指標、裁判模型湊齊，呼叫 `evaluate()` 就開跑：

```python
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)

result = evaluate(
    dataset=dataset,
    metrics=[context_precision, context_recall, faithfulness, answer_relevancy],
    llm=evaluator_llm,
    embeddings=evaluator_embeddings,
)

print(result)
# {'context_precision': 0.89, 'context_recall': 0.92,
#  'faithfulness': 0.85, 'answer_relevancy': 0.91}
```

每個指標都是 0~1，越接近 1 越好。拿到分數之後就能**對症下藥**：

- **Context Recall 低** → 檢索漏東西。回去調 Ep-2 的分割策略、或加上混合檢索把 Recall 拉高。
- **Context Precision 低** → 撈回太多雜訊。這正是 Ep-2 **重排序**（Reranking）最能救的地方。
- **Faithfulness 低** → LLM 在幻覺。檢查 prompt 是不是沒約束好、或檢索內容根本不夠它回答。
- **Answer Relevancy 低** → 答非所問。通常是 prompt 設計或生成模型的問題。

---

## 五、評估真正的用途：用數據做決策

評估最爽的地方，是讓你**理直氣壯地證明「某個優化有沒有效」**。

舉個 Ep-2 的實際例子：你想知道「加上重排序到底有沒有用」。做法就是——同一批測試問題，跑兩次評估：

| 版本 | Context Precision | Context Recall |
| :--- | :--- | :--- |
| 只有向量檢索 | 0.71 | 0.88 |
| 向量檢索 + 重排序 | **0.89** | 0.87 |

數字一攤開就清楚了：重排序把 Context Precision 從 0.71 拉到 0.89（雜訊變少了），Recall 幾乎沒掉。這就是**數據驅動的優化**，而不是「我覺得好像有比較好」。

> 這正是把 Ep-1 到 Ep-3 串起來的最後一塊拼圖：**先有評估基準，你做的每一個優化才知道是進步還是退步。**

---

## 踩雷筆記

- **本地模型跑評估很慢**：每一筆資料、每一個指標背後都要呼叫好幾次 LLM，題目一多就要等很久。建議先用 10 筆左右把流程跑通，再慢慢加量。
- **裁判太弱，分數會飄**：本地小模型當裁判，同一筆資料跑兩次可能分數不一樣。所以重點看**趨勢和相對比較**，別太糾結絕對數值。
- **RAGAS 版本演進快**：RAGAS 改版頻繁，`EvaluationDataset`、指標的 import 路徑偶爾會變動，遇到 import 錯誤時，去翻一下[官方文件](https://docs.ragas.io/)的最新寫法。
- **reference 要老實準備**：Context Recall / Precision 高度依賴標準答案的品質，標準答案隨便寫，分數就沒意義。

---

## 小結

這篇我們補上了 RAG 開發最容易被忽略、卻最重要的一環——**評估**。用 RAGAS 搭本地 Ollama，把「準不準」拆成檢索（Context Precision / Recall）和生成（Faithfulness / Answer Relevancy）兩個層面去量化，最後用數據來驅動 Ep-2 的優化決策。

到這裡，這個 LangChain 系列從**概念（Ep-0）→ RAG 架構（Ep-1）→ 進階理論（Ep-2）→ 多模態實作（Ep-3）→ 評估**（Ep-4）就走完一輪了。接下來可以往 Agent、LangGraph、或把這套 RAG 包成 API 服務的方向繼續深入。

---

## 本篇程式碼

RAGAS 評估腳本已整理完成，含範例資料集，一行指令跑評估：

👉 **[GitHub：langchain-rag-lab / ep4_evaluation](https://github.com/Peter-To-Better/langchain-rag-lab/tree/main/ep4_evaluation)**

```bash
git clone https://github.com/Peter-To-Better/langchain-rag-lab.git
cd langchain-rag-lab && uv sync
ollama pull llama3.1 && ollama pull nomic-embed-text
uv run python ep4_evaluation/evaluate.py
```

---

### 延伸閱讀

- [RAGAS 官方文件 — Evaluate a simple RAG system](https://docs.ragas.io/en/stable/getstarted/rag_eval/)
- [RAGAS — List of available metrics](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/)
- [Evaluating RAG Systems in 2025：RAGAS Deep Dive](https://cohorte.co/blog/evaluating-rag-systems-in-2025-ragas-deep-dive-giskard-showdown-and-the-future-of-context)
