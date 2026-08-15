---
title: "進階 RAG 教學：混合檢索與 Reranking 實測｜LangChain 筆記 Ep-2"
pubDate: 2026-06-17 12:00:00
description: "進階 RAG 實作教學：用勞動基準法示範語意分割、混合檢索（BM25 + 向量 + RRF）、Multi-Query、Cross-Encoder Reranking、Contextual Retrieval，每個技術都有完整可執行的 Python 程式碼，本地 Ollama 跑免付費。"
author: "Peter"
tags: ["LangChain & LLM"]
category: "LangChain & LLM"
keywords: "進階 RAG 教學, 混合檢索 BM25, RAG Reranking 教學, Multi-Query Retriever, Semantic Chunking, Contextual Retrieval, LangChain 進階 RAG, 勞動基準法 RAG, 本地 RAG 教學"
draft: false
---

## 本篇重點

[Ep-1](/posts/langchain-與-llm-學習筆記-ep-1) 我們用一份**報稅 PDF** 跑通了一支 `rag.py`，把 RAG 的八個步驟（[載入](/posts/langchain-與-llm-學習筆記-ep-1#1-載入) → [分割](/posts/langchain-與-llm-學習筆記-ep-1#2-分割) → [嵌入](/posts/langchain-與-llm-學習筆記-ep-1#3-嵌入embedding) → [索引](/posts/langchain-與-llm-學習筆記-ep-1#4-索引) → [檢索](/posts/langchain-與-llm-學習筆記-ep-1#6-檢索) → [生成](/posts/langchain-與-llm-學習筆記-ep-1#8-生成)）串成骨架。但「能跑」跟「準確」是兩回事——拿 Ep-1 那支去問細一點的問題，很容易撈錯段落。

這篇要深入**怎麼讓檢索更準**——從分割、混合檢索、查詢改寫、重排序到 Anthropic 的上下文檢索（Contextual Retrieval），而且**每個技術都有完整可執行的 Python 程式碼**，用同一份「勞動基準法」示範。

為什麼換文件？Ep-1 的報稅 PDF 只有 3 頁、44 個 chunk，語料太小——純向量 top-4 幾乎每題都撈對，進階技巧的差異根本看不出來。這篇換成 **86 條的勞動基準法**（12 章、約 320 行、99 段），語料夠大，baseline 會在某些題目「撈錯/撈不到」，進階管線才有機會扳回來。

而且這篇不是另起爐灶：**下面每一招，都是在補強 Ep-1 某一個步驟**——尤其是 Ep-1 的 `rag.py` 裡註明「直接略過」的[步驟 5 檢索前處理](/posts/langchain-與-llm-學習筆記-ep-1#5-檢索前處理)與[步驟 7 檢索後處理](/posts/langchain-與-llm-學習筆記-ep-1#7-檢索後處理)，這篇會把它們補起來。對照著看：

| Ep-1 步驟 | 當時的做法 / 弱點 | Ep-2 對應的進階招式 |
| :--- | :--- | :--- |
| [步驟 2 分割](/posts/langchain-與-llm-學習筆記-ep-1#2-分割) | 固定字數硬切，概念被劈開、chunk 失去上下文 | 語意分割、父子分割、上下文檢索 |
| [步驟 6 檢索](/posts/langchain-與-llm-學習筆記-ep-1#6-檢索) | 只有純向量 Top-k，對精確字詞弱 | 混合檢索（BM25 + 向量 + RRF） |
| [步驟 5 檢索前處理](/posts/langchain-與-llm-學習筆記-ep-1#5-檢索前處理) | Ep-1 直接略過 | 查詢改寫（Multi-Query / HyDE） |
| [步驟 7 檢索後處理](/posts/langchain-與-llm-學習筆記-ep-1#7-檢索後處理) | Ep-1 直接略過 | 重排序（Cross-Encoder Rerank） |

<!-- more -->

---

## 環境準備

本篇所有範例都用**本地 Ollama** 跑，不需要任何 API Key：

```bash
git clone https://github.com/Peter-To-Better/langchain-rag-lab.git
cd langchain-rag-lab && uv sync

# 下載模型
ollama pull llama3.1          # 文字生成
ollama pull nomic-embed-text  # 嵌入向量

# 勞動基準法已包含在 repo 裡（ep2_advanced_retrieval/labor-standards-act.txt）
```

---

## 示範文件：勞動基準法

這篇所有的程式碼、檢索結果、問答，都跑在**同一份文件**上——中華民國《勞動基準法》全文（`ep2_advanced_retrieval/labor-standards-act.txt`，已放進 repo）。後面你會看到的「第 14 條」「第 18 條」「段落 81」都是從這份切出來的，先介紹一下它是什麼：

- **內容**：規範工時、工資、休假、加班、契約終止、資遣與退休等勞動條件的母法，12 章、共 86 條。
- **為什麼適合示範 RAG**：條文自帶「第 X 條」編號，切割與對照都很直觀；問題真實又可驗證（資遣費、特別休假、競業禁止都是勞工實際會查的）；而且有大量精確字詞（「第 38 條」「預告期間」），正好用來示範 BM25 關鍵字檢索補純向量的不足。
- **來源**：法條全文取自[全國法規資料庫](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030001)（法務部），修正日期民國 113 年 07 月 31 日，屬政府公開資訊、可自由重製，拿來當教學語料沒有版權疑慮。

---

## 一、為什麼 RAG 檢索會「不準」？

在動手優化之前，先搞清楚問題出在哪。RAG 答錯，幾乎都不是 LLM 的錯，而是「**餵給它的資料就錯了**」。常見的失敗模式有三種：

- **撈不到（Recall 太低）**：答案明明在知識庫裡，但對的 chunk 沒被檢索出來。通常是分割切壞了、或語意向量抓不到關鍵字（例如法條號碼、專有名詞）。
- **撈太多雜訊（Precision 太低）**：Top-k 撈回來一堆「看起來相關、其實沒用」的片段，稀釋了真正的答案，LLM 反而被帶偏。
- **chunk 失去上下文**：一段話被切下來後，「它」、「該方案」、「上述條件」這些指代詞失去了原文脈絡，向量化之後語意整個跑掉。

> 一句話總結：**檢索品質 = 你的 RAG 上限。** 後面所有技巧，都是在攻擊上面這三個問題。

下面我把優化技巧依照 Ep-1 的「索引階段」與「查詢階段」分開講，這樣你會很清楚每招是動到流程的哪一段。

---

## 二、索引階段的優化：切得好，才檢索得好

### 1. 別再用固定長度硬切 —— 語意分割與父子分割

Ep-1 的[步驟 2 分割](/posts/langchain-與-llm-學習筆記-ep-1#2-分割)用最陽春的「固定字數 + overlap」，但它完全不看內容、字數到了就下刀——運氣不好時，一個完整概念（例如某條特別休假的認定條件）就會被攔腰劈成兩半，其中一半再也檢索不到。會不會真的切壞、多常切壞，取決於你的文件長什麼樣子——下面就直接跑給你看。

**語意分割（Semantic Chunking）**：不看字數，而是看「語意是否連續」。它會逐句計算向量相似度，當相鄰句子的語意距離突然變大（代表話題轉換），就在那裡切一刀。

```python
from langchain_experimental.text_splitter import SemanticChunker
from langchain_ollama import OllamaEmbeddings

embeddings = OllamaEmbeddings(model="nomic-embed-text")
splitter = SemanticChunker(
    embeddings,
    breakpoint_threshold_type="percentile",
    breakpoint_threshold_amount=85,  # 取語意距離前 15% 的跳躍點切割
)
docs = splitter.create_documents([long_text])
```

完整執行看看效果差異：

```bash
uv run python ep2_advanced_retrieval/01_semantic_chunking.py
```

執行結果：

![語意分割 vs 固定字數切割執行結果（勞動基準法，101 vs 98 塊，切點幾乎都落在「第 X 條」邊界）](/images/llm-ep2-semantic.webp)

有意思的是，在勞動基準法上兩者數量很接近（101 vs 98），切點也幾乎都落在「第 X 條」的邊界——**因為法條本身結構就很乾淨**。語意分割真正的優勢在「沒有明顯結構的長文」（例如會議記錄、訪談逐字稿）：那種內容用固定字數會硬切在句子中間，語意分割才會在話題轉換點下刀。結構化文件用它是「錦上添花」，非結構化文件用它才是「雪中送炭」。

> ⚠️ **中文的坑**：`SemanticChunker` 預設用英文標點（`. ? !`）斷句，直接丟中文會找不到句子邊界、整份被當成一句 → 只切出 **1 塊**。要傳中文斷句規則才正常：
>
> ```python
> splitter = SemanticChunker(
>     embeddings,
>     breakpoint_threshold_type="percentile",
>     breakpoint_threshold_amount=85,
>     sentence_split_regex=r"(?<=[。！？；\n])",  # 中文標點斷句
> )
> ```

**父子分割（Parent Document Retriever）**：這招很關鍵。核心矛盾是——**chunk 切小一點，檢索比較準；但 chunk 太小，餵給 LLM 的上下文又不夠。** 父子分割同時拿到兩者的好處：

- **檢索時**用「小 chunk」（子文件）去比對，命中率高、雜訊少。
- **餵給 LLM 時**回傳該 chunk 所屬的「大段落」（父文件），確保上下文完整。

```python
from langchain_classic.retrievers import ParentDocumentRetriever

retriever = ParentDocumentRetriever(
    vectorstore=vectorstore,        # 存小 chunk 的向量
    docstore=store,                 # 存大段落原文
    child_splitter=child_splitter,  # 切小（如 200 字）
    parent_splitter=parent_splitter # 切大（如 2000 字）
)
```

```bash
uv run python ep2_advanced_retrieval/02_parent_document_retriever.py
```

執行結果（節選）：

![父子文件檢索執行結果（161 個子 chunk 精準命中、還原成完整條文 vs 零散小 chunk）](/images/llm-ep2-parent-doc.webp)

**看差在哪**：檢索時用「小 chunk」比對，命中率高；但如果直接把小 chunk 餵給 LLM，會拿到像「**者**，主管機關得依事業規模…」這種**從半句開始、脈絡斷掉**的碎片。父子分割在命中後**還原成整條條文**（例如完整的第 14 條），LLM 才有完整依據。畫面中「161 個子 chunk」對應回少數幾個父段落，就是這個「小 chunk 精準命中、大段落補回上下文」的機制。

### 2. 上下文檢索（Contextual Retrieval）—— Anthropic 2024 的關鍵改進

這是近年討論度最高的一招。前面提到「chunk 被切下來會失去脈絡」，Anthropic 的解法簡單到有點暴力：

> **在每個 chunk 嵌入之前，先用一個便宜的 LLM 幫它生成一段 50–100 字的「上下文說明」，描述這個片段在整份文件裡的位置與意義，然後把這段說明黏在 chunk 前面再做嵌入。**

舉例，勞動基準法第 26 條的原始 chunk 是：

```
雇主不得預扣勞工工資作為違約金或賠償費用。
```

加上上下文後變成：

```
（本段出自勞動基準法第 三 章 工資，第 26 條，規範工資給付的保障——禁止預扣工資）
雇主不得預扣勞工工資作為違約金或賠償費用。
```

Anthropic 的實測數據很有說服力：

| 方法 | Top-20 檢索失敗率下降 |
| :--- | :--- |
| 純語意嵌入（baseline） | — |
| + 上下文嵌入 | **−35%** |
| + 上下文嵌入 + 上下文 BM25 | **−49%** |
| 再 + 重排序（Reranking） | **−67%** |

代價是建索引時要對每個 chunk 多跑一次 LLM，但搭配 prompt caching 成本可以壓很低，而且這是**離線一次性成本**，非常划算。

```bash
uv run python ep2_advanced_retrieval/06_contextual_retrieval.py
```

執行結果：

![上下文檢索執行結果（上）：為 99 個 chunk 生成上下文說明；「扣押工資」有/無上下文平手，「未成年大夜班」加上下文救回第 44 條](/images/llm-ep2-contextual.webp)

![上下文檢索執行結果（下）：「輪班制換班」無上下文本來有第 35 條，加了上下文反而掉成第 26 條](/images/llm-ep2-contextual-2.webp)

**誠實說**：在勞基法這三題上，上下文檢索**有輸有贏**。贏的是「未成年人可以上大夜班嗎？」——無上下文的 Top-3 除了第 46 條沾到邊，另外兩條飄到退休（53）與罰則（76）；加上上下文後，**第 44 條（童工工作限制）被撈了回來**，因為上下文說明把「童工」「保護未成年人」這些章節線索寫進了向量。輸的是「輪班制換班要休息多久」——無上下文本來還撈到第 35 條（輪班休息），加了上下文反而掉成第 26 條（工資）。這正好呼應上面 Anthropic 的數據：**單靠上下文嵌入只降 35% 失敗率**，真正的大幅提升（−67%）要疊加「上下文 BM25 + 重排序」一起用。所以上下文檢索是**組合技的一環，不是單獨的萬靈丹**——它的價值要到文末的[完整實測](#實測結果baseline-答不出來進階答對了)把混合檢索、重排序都串起來才看得出來。

> 還有一點：上下文說明是用本地 `llama3.1` 生成的，小模型寫出來的描述品質也會直接影響效果。換更強的模型來生成上下文，通常能再拉高一截。

---

## 三、查詢階段的優化：撈得廣，再排得準

### 1. 混合檢索（Hybrid Search）—— 語意 + 關鍵字，兩個都要

Ep-1 的[步驟 6 檢索](/posts/langchain-與-llm-學習筆記-ep-1#6-檢索)只用純向量，而純向量檢索有個致命弱點：**對「精確字詞」很弱**。當使用者搜尋「第 38 條」、「特別休假」這種精確詞時，語意相似度反而不可靠——這正是傳統關鍵字檢索（BM25）的強項。

混合檢索就是**同時跑兩種檢索再合併**：

- **稀疏檢索（Sparse / BM25）**：擅長精確字詞匹配。
- **稠密檢索（Dense / 向量）**：擅長語意理解、同義詞。

兩邊各自排序後，用 **RRF（Reciprocal Rank Fusion，倒數排名融合）** 合併分數，取得一份兼顧「字面」與「語意」的清單。

```python
from langchain_classic.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever

bm25 = BM25Retriever.from_documents(docs, preprocess_func=zh_tokenize)
bm25.k = 5
vector = vectorstore.as_retriever(search_kwargs={"k": 5})

# weights 控制兩者的權重，可依資料特性調整
hybrid = EnsembleRetriever(retrievers=[bm25, vector], weights=[0.4, 0.6])
```

```bash
uv run python ep2_advanced_retrieval/03_hybrid_search.py
```

腳本會跑三種查詢（精確字詞 / 語意理解 / 混合型），分別印出 BM25、向量、混合檢索各自的 Top-3，讓你直接看到差異。三題的結果如下：

![混合檢索執行結果（上）：「第 38 條特別休假」精確詞，BM25 精準命中第 38 條](/images/llm-ep2-hybrid-search.webp)

![混合檢索執行結果（下）：「開除員工」與「輪班制休息」兩題——輪班題 BM25 抓到第 34、35 條，純向量卻飄到第 18、84-1 條，RRF 混合覆蓋最廣](/images/llm-ep2-hybrid-search-2.webp)

（結果中 `差異：BM25 獨有 {...}｜向量獨有 {...}` 的 `{...}` 是段落編號，代表「只有這個檢索器撈到、另一個沒撈到」的段落。）

看「輪班制的休息時間規定」這題就懂為什麼要混合：**純向量理解得了「休息時間規定」的語意，卻把「輪班」這個精確詞當空氣**，Top-3 飄到第 18、84-1 條；BM25 靠關鍵字精準鎖定第 34、35 條（輪班相關）。這正是 Ep-1 [步驟 6](/posts/langchain-與-llm-學習筆記-ep-1#6-檢索) 純向量的盲點。RRF 把兩邊各自的排名融合，結果「混合覆蓋最廣」——精確詞交給 BM25、語意交給向量，互相補位。

### 2. 查詢轉換（Query Transformation）—— 別讓爛問題拖垮檢索

還記得 Ep-1 的[步驟 5 檢索前處理](/posts/langchain-與-llm-學習筆記-ep-1#5-檢索前處理)嗎？當時我們直接略過——這一節就是把它補上。使用者的提問常常很口語、很模糊，直接拿去檢索效果很差。幾種改寫策略：

- **Multi-Query（多重查詢）**：用 LLM 把一個問題改寫成多個角度的版本，分別檢索後合併去重，大幅提升 Recall。
- **HyDE（假設性文件嵌入）**：反直覺但很有效——先讓 LLM「**假裝**」生成一段答案，再用這段假答案去做向量檢索。因為「答案」在向量空間裡會比「問題」更靠近真正的答案文件。

```python
from langchain_classic.retrievers.multi_query import MultiQueryRetriever

retriever = MultiQueryRetriever.from_llm(
    retriever=vectorstore.as_retriever(),
    llm=llm,
)
```

```bash
uv run python ep2_advanced_retrieval/04_multi_query.py
```

執行結果：

![Multi-Query 執行結果（上）：LLM 把每個問題改寫成 3 個角度的版本，分別檢索再合併去重](/images/llm-ep2-multi-query.webp)

![Multi-Query 執行結果（下）：原始檢索只撈 5 段，Multi-Query 擴大到 21 段](/images/llm-ep2-multi-query-2.webp)

以「勞工什麼時候可以自行離職？」為例，LLM 先把它改寫成三個角度（「勞工離職的法定程序和時間限制是什麼？」「哪些情況下勞工有權利要求離職？」「離職前勞工需要完成哪些手續？」），分別檢索再合併去重——**撈回的段落從原始檢索的 5 段（`[23, 33, 43, 76, 77]`）暴增到 21 段**。這就是 Multi-Query 的核心價值：**擴大召回（Recall）**，讓「問法沒對上就漏掉答案」的機率大幅下降。

代價是網撒得越廣、雜訊也越多（21 段裡當然夾帶不少不相關的）——所以它後面通常要接**重排序**，把真正相關的挑回前面，正是下一節。

### 3. 重排序（Reranking）—— 檢索的「第二道把關」

同樣地，Ep-1 的[步驟 7 檢索後處理](/posts/langchain-與-llm-學習筆記-ep-1#7-檢索後處理)也是略過的——重排序就是最值得補上的後處理，也是 CP 值最高的精準度提升手段。前面的混合檢索負責「**廣撒網**」（撈回 20 筆候選，重 Recall），重排序則負責「**精挑細選**」（從 20 筆裡選出真正最相關的 5 筆，重 Precision）。

關鍵差別在於模型架構：

- **向量檢索用的是 Bi-Encoder**：問題與文件「分開」各自編碼成向量，快但粗略。
- **重排序用的是 Cross-Encoder**：把「問題 + 文件」**一起**丟進模型，直接判斷相關性分數，慢但精準。

所以策略是：用便宜快速的 Bi-Encoder 先粗篩一大批，再用昂貴精準的 Cross-Encoder 對這一小批做精排。

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("BAAI/bge-reranker-v2-m3")
pairs = [(query, doc.page_content) for doc in candidates]
scores = reranker.predict(pairs)
ranked = sorted(zip(scores, candidates), key=lambda x: x[0], reverse=True)
```

```bash
uv run python ep2_advanced_retrieval/05_reranking.py
```

執行結果：

![Cross-Encoder 重排序執行結果：查「雇主未依規定發給資遣費會怎樣？」，重排前純向量把不相關的第 72、1 條排在最前，重排後第 17 條（資遣費）衝上第 1、分數 0.512 斷崖式領先](/images/llm-ep2-reranking.webp)

**看重排前後的差**：查「雇主未依規定發給資遣費會怎樣？」，純向量粗撈的 15 筆候選裡，**第 1 名竟然是不相關的第 72 條（勞工檢查機構）、第 2 名是第 1 條（總則）**，最相關的第 17 條（資遣費給付標準）被壓在第 4 名。Cross-Encoder 重排後，第 17 條直接衝上第 1——而且分數本身就很會說話：**第 17 條 0.512、第 18 條 0.043、第三名以後全部掉到 0.006**，「真相關」和「沾邊」被切得乾乾淨淨，湊熱鬧的第 72、67 條則被踢出 Top-5。這就是 Bi-Encoder「快但粗略」、Cross-Encoder「慢但精準」的具體長相。

### 把這些組起來：一條進階檢索管線

實務上的高準確度 RAG，檢索段大概長這樣：

```mermaid
flowchart TD
    A["查詢改寫<br/>Multi-Query / HyDE"] --> B["混合檢索<br/>BM25 + 向量，RRF 合併<br/>撈回 ~20 筆候選"]
    B --> C["重排序<br/>Cross-Encoder Rerank<br/>精選 Top 5"]
    C --> D["父文件還原，補回完整上下文<br/>（可選）"]
    D --> E["餵給 LLM 生成"]
```

換句話說，這條管線就是把 Ep-1 的骨架，在[步驟 5 檢索前處理](/posts/langchain-與-llm-學習筆記-ep-1#5-檢索前處理)、[步驟 6 檢索](/posts/langchain-與-llm-學習筆記-ep-1#6-檢索)、[步驟 7 檢索後處理](/posts/langchain-與-llm-學習筆記-ep-1#7-檢索後處理)三個地方各塞一個增強模組。

不用一次全上。**投資報酬率排序我會建議：先做「重排序」與「混合檢索」（最有感），行有餘力再加「上下文檢索」與「查詢改寫」。**

完整管線跑一次看看：

```bash
uv run python ep2_advanced_retrieval/07_full_pipeline.py \
    --question "雇主什麼時候可以不發資遣費？" --baseline
```

### 實測結果：baseline 答不出來，進階答對了

同一個問題「雇主什麼時候可以不發資遣費？」、同一份勞動基準法（99 段、101 個 chunk）、同一個 `llama3.1`、同一段 prompt——**只差在檢索方式**：

![Ep-1 baseline vs Ep-2 進階實測：baseline 純向量答「不知道」，進階管線撈到第 18 條答對](/images/llm-ep2-baseline-vs-advanced.webp)

差別非常直接：

- **baseline 純向量直接答「不知道」**——它撈到的 4 段（33 / 50 / 76 / 81）沒有一段命中關鍵的第 18 條，LLM 拿不到依據只能放棄。這就是 Ep-1 略過[步驟 5 檢索前處理](/posts/langchain-與-llm-學習筆記-ep-1#5-檢索前處理)、[步驟 7 檢索後處理](/posts/langchain-與-llm-學習筆記-ep-1#7-檢索後處理)的代價：語料一大，純向量 top-4 就開始撈錯。
- **進階管線扳回來了**——多重查詢先把問題改寫成多個角度、混合檢索（BM25 抓得到「資遣費」這種精確詞）粗撈 102 段廣撒網，再靠 Cross-Encoder 重排序從裡面精挑出真正相關的第 18 條，最後答對。
- 兩邊撈到的段落**完全不重疊**（baseline `33/50/76/81` vs 進階 `21/23/25/34`），差異一目了然。

一句話：**同一份文件、同一個問題、同一個模型，只是把 Ep-1 缺的「前處理 + 後處理」補上，答案就從「不知道」變成「答對」。** 這就是為什麼 Ep-2 值得做。

---

## 小結

這篇我們把 [Ep-1](/posts/langchain-與-llm-學習筆記-ep-1) 那支跑得動的 RAG，從「能跑」推到「夠準」：

- **索引階段**：語意分割與父子分割保住 chunk 的語意完整性；上下文檢索幫每個 chunk 加上「它在整份文件裡的位置」。
- **查詢階段**：混合檢索撈得廣（語意 + 關鍵字），重排序排得準（Cross-Encoder 精排），查詢改寫補強模糊提問。

下一篇 [Ep-3](/posts/langchain-與-llm-學習筆記-ep-3) 我們要處理 Ep-1 和 Ep-2 都吃不下來的東西——**當文件裡有圖片、表格、掃描檔時，純文字向量的 RAG 該怎麼進化**。

> 對 LLM、LangChain、AI Agent 這些名詞還不太熟的話，可以回頭看系列開頭的 [Ep-0：LLM、LangChain、AI Agent 與 MCP 是什麼](/posts/langchain-與-llm-學習筆記-ep-0)。

---

## 本篇程式碼

本篇所有技術都有完整可執行的示範，用同一份勞動基準法：

| 腳本 | 技術 | 執行指令 |
| :--- | :--- | :--- |
| `00_baseline_vs_advanced.py` | Ep-1 vs Ep-2 對照 | `uv run python ep2_advanced_retrieval/00_baseline_vs_advanced.py --question "..."` |
| `01_semantic_chunking.py` | 語意分割 | `uv run python ep2_advanced_retrieval/01_semantic_chunking.py` |
| `02_parent_document_retriever.py` | 父子文件檢索 | `uv run python ep2_advanced_retrieval/02_parent_document_retriever.py` |
| `03_hybrid_search.py` | 混合檢索 | `uv run python ep2_advanced_retrieval/03_hybrid_search.py` |
| `04_multi_query.py` | 多重查詢改寫 | `uv run python ep2_advanced_retrieval/04_multi_query.py` |
| `05_reranking.py` | Cross-Encoder 重排序 | `uv run python ep2_advanced_retrieval/05_reranking.py` |
| `06_contextual_retrieval.py` | 上下文檢索 | `uv run python ep2_advanced_retrieval/06_contextual_retrieval.py` |
| `07_full_pipeline.py` | 完整進階管線 | `uv run python ep2_advanced_retrieval/07_full_pipeline.py --question "..." --baseline` |

👉 **[GitHub：langchain-rag-lab / ep2_advanced_retrieval](https://github.com/Peter-To-Better/langchain-rag-lab/tree/main/ep2_advanced_retrieval)**

---

### 延伸閱讀

- [Anthropic — Introducing Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [Optimizing RAG with Hybrid Search & Reranking — VectorHub](https://superlinked.com/vectorhub/articles/optimizing-rag-with-hybrid-search-reranking)
- [BAAI/bge-reranker-v2-m3 — HuggingFace](https://huggingface.co/BAAI/bge-reranker-v2-m3)
- [LangChain Retrieval 官方文件（含 Multi-Query）](https://docs.langchain.com/oss/python/langchain/retrieval)
