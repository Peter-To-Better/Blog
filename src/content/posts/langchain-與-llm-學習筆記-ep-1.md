---
title: "LangChain 與 LLM 學習筆記-Ep-1"
pubDate: 2025-10-15 23:35:40
description: "RAG 教學：用 LangChain + Ollama 把「載入→分割→嵌入→索引→檢索→生成」8 個步驟串成可跑的 Python 程式，搭配 Chroma 向量資料庫，本地免費跑 llama3.1，附完整程式碼。"
author: "Peter"
tags: ["LangChain & LLM"]
category: "LangChain & LLM"
keywords: "RAG 教學, LangChain RAG, RAG 是什麼, 向量資料庫教學, Chroma 向量資料庫, Ollama RAG 教學, llama3.1 教學, nomic-embed-text, 嵌入模型教學, 檢索增強生成"
draft: false
---

# 本篇重點

了解 RAG 應用的技術架構

<!-- more -->

## 什麼是 RAG ?

RAG 全名是 **Retrieval-Augmented Generation（檢索增強生成）**
用一段話來簡單說明一下，它不只是讓 AI「猜答案」，而是**先查資料、再回答** 的技術。
用一個例子來解說：想像你是一位學生，要回答老師的問題

### 傳統 LLM（例如 GPT）

傳統的模型就像是 **記憶力超強、但不能上網查資料的學生**。
他只能根據「以前背過的內容」來回答問題，但如果他對內容不熟悉或是涉略的相關知識不足，有時會正經的胡說八道的回答（這就是 **幻覺問題**）。

### RAG 模型

而 RAG 就像是 **考試前可以先打開書查資料的學生**。
當被問到問題時，他會先：

1. 去圖書館找出跟問題相關的幾頁資料（Retrieval）
2. 再用自己的語言組合出答案（Generation）

結果是什麼？
答案會相對**準確**、**有根據**，而不是亂猜。

## 圖解 RAG 工作流程

![RAG Workflow](/images/RAG-work-flow.jpg)

RAG 的核心在於透過「檢索（Retrieval）」來提升生成內容的品質，而其中最關鍵的部分正是**如何進行檢索**。傳統搜尋引擎或資料庫通常採用「關鍵字檢索」的方式，依據文字匹配程度來計算相關性，並產生排序後的結果。而在 RAG 應用中，我們更常使用的是**向量語意檢索（Vector Semantic Search）**，這種方法會將文本與查詢轉換為向量表示，透過計算語意上的相似度來尋找最相關的資料片段，並依照相似度高低排序，最後輸出前 _k_ 個最相關的內容區塊（top_k），這樣的語意檢索能讓模型不只找到詞彙相似的資料，更能理解語意上的關聯，從而為生成提供更準確且有意義的參考依據。

整個流程可以拆成兩個大階段：[**階段一是「資料索引」**](#階段一資料索引離線建立知識庫)，屬於離線（offline）作業，目的是把知識庫預先處理好、存進向量資料庫；[**階段二是「查詢與生成」**](#階段二查詢與生成線上即時回應)，屬於線上（online）作業，是使用者每次提問時即時發生的流程。

---

## RAG 的技術分支

在進入八個步驟的細節之前，先看一下整個 RAG 技術的全貌——不同的問題催生了不同的變體，本篇實作的是最基礎的那一種：

| 種類 | 核心差異 | 適合情境 |
| :--- | :--- | :--- |
| **Naive RAG**（基礎版）| 切分 → 向量化 → 相似搜索 → 生成 | 入門學習、小型知識庫 ← **本篇** |
| **進階 RAG** | 混合檢索、語意分割、重排序、查詢改寫 | 提升撈到對的資料的精準度 → [Ep-2](/posts/langchain-與-llm-學習筆記-ep-2) |
| **Self-RAG** | LLM 自主決定要不要檢索、撈到的夠不夠好 | 效率優化，減少不必要的向量搜索 |
| **CAG**（Cache-Augmented）| 整份文件預載入 KV Cache，省去向量搜索步驟 | 固定小型知識庫（幾十頁），能塞進 context window |
| **Graph RAG** | 文件解析成知識圖譜，沿關係邊做多跳推理 | 需跨文件組合答案的複雜問題 |
| **多模態 RAG** | 圖片、表格、掃描檔也能被索引和查詢 | 含圖表的 PDF 財報、簡報 → [Ep-3](/posts/langchain-與-llm-學習筆記-ep-3) |
| **Agentic RAG** | LLM Agent 主動決定要不要查、查什麼、查幾輪，可串接多種工具（向量庫、網路搜索、SQL…）| 多步驟複雜任務、需動態組合多個知識來源 |

搞懂 Naive RAG 的八個步驟，後面所有進階變體才有地方可以「掛」。

---

## 階段一：資料索引（離線建立知識庫）

> [載入](#1-載入) → [分割](#2-分割) → [嵌入](#3-嵌入embedding) → [索引](#4-索引)。這一階段只需在資料更新時執行，產出的成果會被後續查詢重複使用。

> 以下每個步驟都附有對應的程式片段，方便你把概念和寫法對照起來看。現在不需要逐一貼上跑——文章最後有把八個步驟串起來的[完整實作程式碼](#實作把八個步驟串成一個可跑的-rag)，clone 下來一行指令就能跑。

### 1. 載入：

第一步就是把要讓模型檢索的文件載入進來，這些文件可以是**結構化的資料**（像是資料表、CSV）或是**非結構化的內容**（像 PDF、Word、網站文字），基本上結構化資料處理起來會比較有效率。

```python
import fitz  # uv add pymupdf
from langchain_core.documents import Document

doc = fitz.open("tax-guide.pdf")
pages = []
for i, page in enumerate(doc):
    text = page.get_text().strip()
    if text:  # 跳過空白頁與純圖片頁
        pages.append(Document(
            page_content=text,
            metadata={"source": "tax-guide.pdf", "page": i + 1},
        ))
# pages 現在是一個 list，每個元素代表 PDF 的一頁
```

---

### 2. 分割：

接下來就是要把文件「切一切」。還記得 [Ep-0](/posts/langchain-與-llm-學習筆記-ep-0) 提到的 **Context Window** 嗎？直接把整份文件塞給模型有兩個問題：

1. **放不下**：一份幾十頁的 PDF 動輒幾萬字，超過大部分模型的 context 上限
2. **就算放得下也不划算**：token 數越多費用越高，而且 LLM 對超長 context 中間段落的注意力會下降（Lost in the Middle）

所以我們要先**把文件分成比較小的區塊（chunk）**，讓後續只把最相關的幾塊傳進 context，既精準又省 token。

分割的規則有很多種，比如可以根據**段落、標題、句號**這些標記來切，確保每一塊都能保有完整的語意。

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,    # 每塊最多 500 字元
    chunk_overlap=80,  # 相鄰塊重疊 80 字元，避免語意在邊界斷掉
)
chunks = splitter.split_documents(pages)
# 一份幾十頁的 PDF 通常切成 100–300 塊
```

---

### 3. 嵌入（Embedding）：

當你把資料切成一塊一塊之後，模型還是看不懂這些文字，因為它不是人，這時就要進行「嵌入」這個動作，也就是把文字轉成**高維度的向量**，這些向量就像是資料在數學空間裡的座標點，讓模型能夠「用距離」去理解哪兩段文字在意思上比較接近。

負責做這件事的工具叫做**嵌入模型（Embedding Model）**，它會把每塊文字轉成幾百至幾千維的數字陣列（例如 `[0.12, -0.87, 0.34, ...]`），方便後續比對。常見的選擇有：

- **雲端付費**：OpenAI 的 `text-embedding-3-small`（$0.02 / 1M token）
- **本地免費**：`nomic-embed-text`（這個系列的選擇，不需要 API Key）

> 怎麼在這些選項之間做選擇？文章末尾的[「這個系列用什麼模型？為什麼？」](#這個系列用什麼模型為什麼)有完整的比較表。

```python
from langchain_ollama import OllamaEmbeddings

embeddings = OllamaEmbeddings(model="nomic-embed-text")

# 把一段文字轉成向量（步驟 4 會自動對所有 chunk 執行這件事）
vector = embeddings.embed_query("撫養父母的免稅額條件")
print(f"向量維度：{len(vector)}")  # → 768（nomic-embed-text 的輸出維度；其他模型不同，例如 text-embedding-3-small 預設輸出 1536）
# 輸出：[0.023, -0.841, 0.317, ...]  共 768 個數字
```

---

### 4. 索引：

最後就是要幫這些向量建立索引，也就是把它們丟進向量資料庫裡，像是 **Pinecone、FAISS、Weaviate、Chroma** 等等，有了索引之後，當使用者提問時，系統就能拿問題的向量去跟資料庫裡的那些知識塊比相似度（像用餘弦相似度算距離），然後找出最相關的前幾個結果（Top-k），然後這些被找出來的內容，後面就會交給語言模型去[組合成最終的回答（→ 步驟 8）](#8-生成)。

```python
from langchain_chroma import Chroma

vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory="./chroma_db",
)
# 向量存到磁碟，下次可以直接載入，不用重新嵌入
# 載入方式：Chroma(persist_directory="./chroma_db", embedding_function=embeddings)
```

#### 為什麼選 Chroma？各種向量資料庫的差異

Step 4 提到了幾個向量資料庫的名字，但沒說差在哪、為什麼用 Chroma。這裡補充說明。

| 資料庫 | 類型 | 上手難度 | 特點 |
| :--- | :--- | :---: | :--- |
| **Chroma** | 本地嵌入式 | 最低 | pip 裝完即用，自動持久化到本地磁碟，不需要任何服務 ← **本系列選用** |
| FAISS | 本地 library | 低 | Meta 出品，純記憶體，速度最快，但持久化要自己處理，沒有 metadata 過濾 |
| Weaviate | 自架 / 雲端 | 中 | 功能完整，支援混合檢索和 GraphQL API，生產環境友好，但本地跑通常要搭 Docker |
| Pinecone | 雲端 managed | 低（但要帳號）| 全託管免維運，但需要 API Key 和網路連線，不適合離線學習 |
| pgvector | PostgreSQL 擴充 | 中 | 在既有的 PostgreSQL 加向量搜尋，可以混 SQL 查詢，詳見下方說明 |

**Chroma 適合學習的原因**：不需要 Docker、不需要帳號、不需要任何背景服務。`Chroma.from_documents(...)` 一行建好索引，加上 `persist_directory` 就自動存到磁碟，下次重啟直接載入，不用重新嵌入。

**那為什麼不用 pgvector（PostgreSQL + 向量）？**

pgvector 是正當的選擇——尤其是你的系統本來就在用 PostgreSQL，裝一個擴充就有向量搜尋，還能和原有 SQL 查詢混用（例如先用 `WHERE` 過濾條件、再做向量比對），非常適合生產環境。

但對學習階段來說，光是「先裝好一個 PostgreSQL 服務」就會阻斷不少人。Chroma 的定位是：先讓你把 RAG 的概念跑通，不讓基礎設施卡在前面。

等你真的要把 RAG 系統上線、接進既有的資料庫架構時，切換只需要換幾行初始化程式碼——LangChain 的抽象層讓你不用動 retriever 以下的邏輯：

```python
# 原本（Chroma 本地）
from langchain_chroma import Chroma
vectorstore = Chroma.from_documents(chunks, embeddings, persist_directory="./chroma_db")

# 換成 pgvector（需要跑 PostgreSQL + pgvector 擴充）
# uv add langchain-postgres
from langchain_postgres import PGVector
vectorstore = PGVector.from_documents(chunks, embeddings, connection="postgresql+psycopg://...")

# 換成 Pinecone（需要 API Key）
# uv add langchain-pinecone
from langchain_pinecone import PineconeVectorStore
vectorstore = PineconeVectorStore.from_documents(chunks, embeddings, index_name="my-index")
```

retriever、LLM、prompt 那幾行完全不用動。

---

## 階段二：查詢與生成（線上即時回應）

> [檢索前處理](#5-檢索前處理) → [檢索](#6-檢索) → [檢索後處理](#7-檢索後處理) → [生成](#8-生成)。這一階段在使用者每次提問時即時執行。

### 5. 檢索前處理：

在正式檢索之前，我們通常會對使用者輸入的問題做一些**前處理（Pre-processing）**。
像是：

- 清理多餘符號或格式
- 做斷詞、去停用詞（stop words）
- 調整問句結構讓它更清楚
- 甚至可以用模型先改寫（rephrase）問題，讓檢索效果更好

這一步就有點像是「幫助模型更聽得懂人話」。
處理得好，檢索的準確度會差很多，尤其是在多語言或口語化輸入的情況下。

> **基礎版跳過這一步**：Ep-1 的實作直接拿原始問題做向量檢索。Ep-2 會實作**多重查詢（Multi-Query）**——讓 LLM 把一個問題從多個角度改寫，再分別檢索合併，大幅提升召回率。

---

### 6. 檢索：

當使用者輸入一個問題時，我們會先用**和[步驟 3](#3-嵌入embedding) 相同的嵌入模型**，把這個問題也轉成向量——兩邊用同一個模型才能在同一個向量空間裡比距離。接著去**向量資料庫裡找出語意最接近的內容區塊**，這個動作就是「檢索」，簡單說，就是讓問題的向量去對比向量資料庫的資料，找到那些跟它意思最像的知識塊，背後是用到**餘弦相似度（Cosine Similarity）**這種演算法，幫我們算出每個資料的相關程度，然後取出最相關的前幾個結果（Top-k），這些被挑出來的內容，就會被拿去給模型作為參考資料，[幫助它生成更準確的回答（→ 步驟 8）](#8-生成)。

```python
question = "撫養父母的免稅額條件是什麼？"
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
docs = retriever.invoke(question)

for doc in docs:
    print(f"─ 來源：第 {doc.metadata['page']} 頁")
    print(f"  {doc.page_content[:100]}...")
```

---

### 7. 檢索後處理：

再來是**檢索後處理（Post-processing）**。
這階段的目標是讓最終的生成結果更乾淨、更符合需求
常見的做法有：

- 將檢索到的內容進行去重、過濾無關段落
- 依照內容重要性重新排序
- 過濾掉重複或衝突的資訊
- 在輸出時加上來源引用（citation），提升可信度

有些應用甚至會在這一步做「答案驗證（Answer Validation）」或「事實檢查（Fact Checking）」，避免模型亂講。
整體來說，這一步是讓 RAG 系統更像一個專業助手，不只找資料、還會幫你整理出乾淨又可靠的結果。

> **基礎版跳過這一步**：直接把撈到的 chunk 丟給生成模型。Ep-2 的 **Cross-Encoder Reranking** 就是這一步的升級版——用更精準的模型重新給撈到的結果評分，讓最相關的排在最前面。

---

### 8. 生成：

有了檢索到的內容後，接下來就是**生成（Generation）**，這個步驟就是讓語言模型去根據剛剛找回來的資料，再加上使用者的問題，生成一個有條理又自然的回答，
你可以想成：模型就像一個很會整理資料的助理，會先讀完那幾段最相關的文件，然後用自己的語言把答案「重組」出來，這樣的好處是模型不是亂掰的，而是根據實際的內容來回答，**內容的可解釋性跟可靠度會有相對的提升**。

```python
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate

PROMPT = ChatPromptTemplate.from_template(
    "你是文件問答助理，只根據以下參考資料回答問題，"
    "不確定就直接說不知道，不要補充資料以外的內容。\n\n"
    "參考資料：\n{context}\n\n"
    "問題：{question}"
)

context = "\n\n".join(
    f"[第 {d.metadata['page']} 頁]\n{d.page_content}" for d in docs
)
llm = ChatOllama(model="llama3.1", temperature=0)
answer = llm.invoke(PROMPT.format(context=context, question=question))
print(answer.content)
```

---

## 本系列使用的模型

全程用本地 [Ollama](https://ollama.com/) 跑，不需要 API Key：嵌入用 **`nomic-embed-text`**（137M，CPU 可跑），生成用 **`llama3.1:8b`**（Q4 量化後約 5 GB）。

- 選模型的完整邏輯、MTEB / Chatbot Arena 怎麼看、本地 vs 付費 API 完整比較表 → [番外篇：這個系列用什麼模型？為什麼？](/posts/langchain-與-llm-學習筆記-番外-模型怎麼選)
- 不確定自己的電腦能不能跑，或想了解 Q4 量化是什麼 → [番外篇：我的電腦能跑哪些本地模型？](/posts/langchain-與-llm-學習筆記-番外-本地模型怎麼選)

---

## 實作：把八個步驟串成一個可跑的 RAG

完整程式碼在 👉 **[GitHub：langchain-rag-lab / ep1_basic_rag](https://github.com/Peter-To-Better/langchain-rag-lab/tree/main/ep1_basic_rag)**

---

### 示範文件

這個系列用 **[財政部 114 年度綜合所得稅結算申報書說明](https://download.tax.nat.gov.tw/irx/doc/114%E5%B9%B4%E5%BA%A6%E7%B6%9C%E5%90%88%E6%89%80%E5%BE%97%E7%A8%85%E7%B5%90%E7%AE%97%E7%94%B3%E5%A0%B1%E6%9B%B8%E8%AA%AA%E6%98%8E.pdf)** 當示範文件——財政部每年公開的報稅說明 PDF，每個需要申報的台灣居民都可能有問題要查。拿它來跑 RAG 最直觀：你問的問題是真實的，答案也立刻可以驗證對不對。

---

### 環境準備

```bash
git clone https://github.com/Peter-To-Better/langchain-rag-lab.git
cd langchain-rag-lab && uv sync

# 下載示範文件
curl -L "https://download.tax.nat.gov.tw/irx/doc/114%E5%B9%B4%E5%BA%A6%E7%B6%9C%E5%90%88%E6%89%80%E5%BE%97%E7%A8%85%E7%B5%90%E7%AE%97%E7%94%B3%E5%A0%B1%E6%9B%B8%E8%AA%AA%E6%98%8E.pdf" \
  -o tax-guide.pdf

# 下載 Ollama 模型（沒有就先裝 Ollama：https://ollama.com）
ollama pull llama3.1
ollama pull nomic-embed-text
```

---

### 完整程式碼

前面各步驟的邏輯，在 repo 裡包成函式、加上 CLI 參數（`--pdf` / `--question` / `--rebuild` / `--top-k`），就是這支可以直接執行的 `ep1_basic_rag/rag.py`：

```python
"""
Ep-1 基礎 RAG 完整管線
對應文章：https://peter-to-better.com/posts/langchain-與-llm-學習筆記-ep-1

最陽春的 RAG 示範：PDF 載入 → 分割 → 嵌入 → 索引 → 檢索 → 生成
完整對應 Ep-1 文章的八個步驟，不含任何進階技巧。

使用方式：
    # 第一次：建索引並提問
    uv run python ep1_basic_rag/rag.py --pdf tax-guide.pdf --question "撫養父母的免稅額條件是什麼？"

    # 之後：直接提問（索引已存在）
    uv run python ep1_basic_rag/rag.py --question "哪些人不需要辦理綜合所得稅申報？"

    # 換 PDF 時：強制重建索引
    uv run python ep1_basic_rag/rag.py --pdf new_doc.pdf --question "..." --rebuild

預備：
    ollama pull llama3.1          # 文字生成
    ollama pull nomic-embed-text  # 嵌入向量
"""

import argparse
import sys
from pathlib import Path

import fitz  # PyMuPDF
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

CHROMA_DIR = "./chroma_db_ep1"
EMBED_MODEL = "nomic-embed-text"
LLM_MODEL = "llama3.1"

PROMPT = ChatPromptTemplate.from_template(
    "你是一個文件問答助理，只能根據以下參考資料回答問題，"
    "不確定就直接說不知道，不要補充資料外的內容。\n\n"
    "參考資料：\n{context}\n\n"
    "問題：{question}"
)


def load_pdf(pdf_path: str) -> list[Document]:
    """步驟 1：載入 PDF，每頁轉成一份 Document。"""
    doc = fitz.open(pdf_path)
    pages = []
    for page_num, page in enumerate(doc):
        text = page.get_text().strip()
        if text:
            pages.append(Document(
                page_content=text,
                metadata={"source": Path(pdf_path).name, "page": page_num + 1},
            ))
    print(f"  載入完成：共 {len(pages)} 頁有效文字（跳過空白頁）")
    return pages


def build_index(pdf_path: str) -> Chroma:
    """步驟 1-4：載入 → 分割 → 嵌入 → 索引"""
    print(f"步驟 1｜載入 PDF：{pdf_path}")
    pages = load_pdf(pdf_path)

    print("步驟 2｜分割文字...")
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=80)
    chunks = splitter.split_documents(pages)
    print(f"  分割完成：{len(chunks)} 個 chunk（每塊約 500 字，overlap 80 字）")

    print(f"步驟 3+4｜嵌入向量並建立索引（{EMBED_MODEL}）...")
    embeddings = OllamaEmbeddings(model=EMBED_MODEL)
    vectorstore = Chroma.from_documents(
        chunks, embeddings, persist_directory=CHROMA_DIR
    )
    print(f"  ✓ 索引建立完成，已存至 {CHROMA_DIR}/")
    return vectorstore


def load_vectorstore() -> Chroma:
    embeddings = OllamaEmbeddings(model=EMBED_MODEL)
    return Chroma(persist_directory=CHROMA_DIR, embedding_function=embeddings)


def query_rag(question: str, vectorstore: Chroma, top_k: int = 4) -> str:
    """步驟 6+8：向量檢索 → 生成回答（步驟 5 前處理與步驟 7 後處理在這裡省略）"""
    print(f"步驟 6｜向量檢索（top-{top_k}）...")
    retriever = vectorstore.as_retriever(search_kwargs={"k": top_k})
    docs = retriever.invoke(question)
    pages_hit = ", ".join(sorted({str(d.metadata["page"]) for d in docs}))
    print(f"  撈到 {len(docs)} 個 chunk，來自第 {pages_hit} 頁")

    context = "\n\n".join(
        f"[第 {d.metadata['page']} 頁]\n{d.page_content}" for d in docs
    )

    print(f"步驟 8｜生成回答（{LLM_MODEL}）...")
    llm = ChatOllama(model=LLM_MODEL, temperature=0)
    return llm.invoke(PROMPT.format(context=context, question=question)).content


def main():
    parser = argparse.ArgumentParser(description="基礎 RAG 管線（Ep-1）")
    parser.add_argument("--pdf", help="PDF 檔案路徑")
    parser.add_argument("--question", required=True, help="查詢問題")
    parser.add_argument("--rebuild", action="store_true", help="強制重建索引")
    parser.add_argument("--top-k", type=int, default=4, help="撈回幾筆 chunk（預設 4）")
    args = parser.parse_args()

    need_build = args.rebuild or not Path(CHROMA_DIR).exists()

    if need_build:
        if not args.pdf:
            print("錯誤：第一次建索引需要提供 --pdf 參數")
            sys.exit(1)
        vectorstore = build_index(args.pdf)
    else:
        print(f"索引已存在，直接載入 {CHROMA_DIR}/")
        vectorstore = load_vectorstore()

    print(f"\n問題：{args.question}\n")
    answer = query_rag(args.question, vectorstore, top_k=args.top_k)
    print(f"\n回答：\n{answer}")


if __name__ == "__main__":
    main()
```

---

### 執行 & 預期輸出

```bash
# 直接執行（CLI 版本，支援 --question / --pdf / --rebuild / --top-k 參數）
uv run python ep1_basic_rag/rag.py \
  --pdf tax-guide.pdf \
  --question "撫養父母的免稅額條件是什麼？"
```

```
步驟 1｜載入 PDF：tax-guide.pdf
  載入完成：共 38 頁有效文字
步驟 2｜分割文字...
  分割完成：204 個 chunk（每塊約 500 字，overlap 80 字）
步驟 3+4｜嵌入向量並建立索引（nomic-embed-text）...
  ✓ 索引建立完成，已存至 chroma_db_ep1/

問題：撫養父母的免稅額條件是什麼？

步驟 6｜向量檢索（top-4）...
  撈到 4 個 chunk，來自第 9, 10, 11 頁
步驟 8｜生成回答（llama3.1）...

回答：
根據申報說明，撫養直系尊親屬（父母）的免稅額適用條件為：
年滿 60 歲，或無謀生能力者不受年齡限制。
每人免稅額為新台幣 92,000 元（114 年度適用金額）。
同一申報戶內，父母由一位子女申報即可，不得重複申報。
```

索引建好之後，換問題直接跑：

```bash
# 不需要重新載入 PDF，直接問
uv run python ep1_basic_rag/rag.py --question "哪些人不需要辦理綜合所得稅申報？"
uv run python ep1_basic_rag/rag.py --question "房屋租金支出可以申報扣除嗎？"
```

以下是實際執行截圖：

![第一次執行](/images/llm-ep1-terminal-run1.png)

執行後，`chroma_db_ep1/` 資料夾會自動建立，索引就持久化在裡面：

![執行後的專案結構](/images/llm-ep1-file-structure.png)

換一個問題再跑（不需要重新載入 PDF，直接從已存好的索引查詢）：

![換問題再跑](/images/llm-ep1-terminal-run2.png)

---

## RAG 解決不了什麼

知道邊界，才不會 debug 找錯方向：

- **複雜推理**：RAG 提供事實素材，但補不回 LLM 本身的推理弱點；數學邏輯、多步因果的錯誤靠更多資料救不了
- **知識庫以外的問題**：沒被索引的資訊，RAG 無法憑空生成
- **隱性知識**：專家直覺、難以文字化的實務經驗，沒辦法被向量化
- **整體性理解**：「這份文件的核心論點是什麼？」需要理解整體結構，切塊後的向量檢索效果有限
- **即時性**：知識庫沒更新，回答就會過時；RAG 不會主動感知外部變化
- **跨語言語意落差**：知識庫是英文、問題是中文時，嵌入的語意匹配精度會下降

---

## 小結與下一篇預告

到這裡，你已經掌握了 RAG 的完整骨架：**離線把知識庫索引好，線上即時檢索再生成**。

但實務上你很快會遇到兩個痛點：

1. **檢索不夠準** —— 明明資料庫裡有答案，卻撈不到對的 chunk，或撈到一堆不相關的雜訊。
2. **資料不只有純文字** —— 真實文件裡有表格、圖片、掃描檔、流程圖，純文字向量根本吃不下來。

下一篇 [Ep-2](/posts/langchain-與-llm-學習筆記-ep-2) 我們就會深入這兩個主題：用**混合檢索（Hybrid Search）、重排序（Reranking）、查詢改寫、上下文檢索（Contextual Retrieval）**把準確度往上拉，並實作能處理圖片與文件影像的**多模態 RAG**。
