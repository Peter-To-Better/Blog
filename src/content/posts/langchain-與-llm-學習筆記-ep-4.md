---
title: "RAG 評估教學：RAGAS 指標可信度實測｜LangChain 筆記 Ep-4"
pubDate: 2026-06-17 14:00:00
description: "RAG 評估實作教學：用 RAGAS + 本地 Ollama 量化 RAG 準確率。六種設定實測對照，抓出 Ep-3 把功勞歸錯對象，並驗證四大指標在小語料上到底可不可信。含完整 Python 程式碼，不需要 OpenAI API。"
author: "Peter"
tags: ["LangChain & LLM"]
category: "LangChain & LLM"
keywords: "RAG 評估教學, RAGAS 教學, RAG 準確率評估, Faithfulness 是什麼, Context Precision 是什麼, LangChain RAG 評估, Ollama RAGAS, RAG 指標, RAGAS 本地模型"
draft: false
---

## 本篇重點

[Ep-3](/posts/langchain-與-llm-學習筆記-ep-3) 結尾我留了一個尷尬的問題：我們做了一堆優化，但**怎麼知道到底是哪一招有用？**

這篇就來回答它：用 **RAGAS** 把「準不準」變成可以量化的數字，一樣全部跑在本地 Ollama 上，不花一毛 API 錢。

然後實測跑完，第一個被抓出來的錯誤，是我自己上一篇的結論。

<!-- more -->

---

## 為什麼一定要評估？

很多人做 RAG 是這樣調的：「我覺得加了重排序好像有比較準？」說穿了就是**憑感覺**。

但憑感覺還不是最糟的。最糟的是這個，而且它看起來一點都不像錯誤：

> 你一次改了四個地方，系統從答錯變成答對了，於是你以為這四個改動都有用。

這就是我在 Ep-3 幹的事。那篇為了讓 RAG 答出「113 年麻疹確定病例發生率最高的縣市」，我連續改了：

1. 把 `llama3.2-vision` 換成 `qwen2.5vl:7b`（前者在新版 Ollama 直接載入失敗）
2. 把同頁文字接在圖片轉述前面一起嵌入
3. 換掉 prompt 裡「請明確說找不到」那句措辭
4. 把 `top_k` 從 4 調到 9

改完，答對了。收工，寫文章，下結論：

> 一個純文字 RAG（沒有這張地圖轉述）永遠答不出來的問題，這次是真的搞定了。

聽起來很合理對吧？**但這句話是錯的。**

而且關鍵在於，如果我沒有回頭做這篇的評估，我永遠不會發現它是錯的。這就是評估存在的理由：它不是拿來證明你的系統很棒，是拿來抓出**你以為對、其實錯的因果關係**。

---

## RAG 的四個核心指標

RAGAS 把評估拆成幾個指標，最常用的四個剛好對應兩個層面：

| 指標 | 層面 | 它在問什麼 | 需要的資料 |
| :--- | :--- | :--- | :--- |
| **Context Precision** | 檢索 | 撈回來的東西，**有用的比例高嗎**？（有沒有混一堆雜訊） | 問題、檢索內容、標準答案 |
| **Context Recall** | 檢索 | **該撈的有沒有撈到**？（有沒有漏掉關鍵資料） | 問題、檢索內容、標準答案 |
| **Faithfulness** | 生成 | 回答的內容，**都有根據嗎**？（有沒有幻覺、亂掰） | 問題、檢索內容、回答 |
| **Answer Relevancy** | 生成 | 回答**有沒有切題**？（有沒有答非所問） | 問題、回答 |

用一個比喻來記：把 RAG 想成一個考生

- **Context Precision / Recall** 是在評「他翻書的功力」：有沒有翻到對的那幾頁、有沒有翻一堆沒用的。
- **Faithfulness** 是在評「他有沒有照書寫」：還是自己編了不在書上的東西（幻覺）。
- **Answer Relevancy** 是在評「他有沒有回答到題目」：還是寫了一堆離題的廢話。

把檢索和生成分開量，才知道問題出在哪一段、該修哪裡。

> 這四個指標**不是每一個在你的語料上都可信**。這篇後面會實測驗證，其中一個在這份語料上幾乎等於雜訊。

---

## 一、實驗設計：一次只動一個變因

要知道「哪一招有用」，唯一的辦法是**一次只動一個變因**。所以這篇把 Ep-3 的系統拆成六種設定，跑同一批問題：

| 設定 | 索引內容 | `top_k` | prompt |
| :--- | :--- | :---: | :--- |
| `text_k4` | 只有文字（等同 Ep-1） | 4 | 預設 |
| `text_k9` | 只有文字 | 9 | 預設 |
| `caption_k4` | 文字 + 圖片轉述（不接上下文） | 4 | 預設 |
| `ctx_k4` | 文字 + 圖片轉述（接同頁文字） | 4 | 預設 |
| `ctx_k9` | 文字 + 圖片轉述（接同頁文字） | 9 | 預設 ← **Ep-3 最終版** |
| `ctx_k9_strict` | 同上 | 9 | 指定拒答話術 |

語料沿用 Ep-3 的**麻疹章節**（疾管署《傳染病統計暨監視年報－113年》其中 4 頁、3 張圖）。

### 測試集：標準答案一定要人工核對

八題的標準答案全部是**人工從 PDF 逐字核對**出來的，收在 [`testset.py`](https://github.com/Peter-To-Better/langchain-rag-lab/blob/main/ep4_evaluation/testset.py)。

這聽起來像廢話，但很多人會偷懶：拿模型自己跑出來的答案當標準答案。**那等於讓模型改自己的考卷**，評出來的分數再漂亮也沒有意義。

每一題還標了 `source`，記錄答案在文件的哪裡：

| `source` | 意思 | 題數 |
| :--- | :--- | :---: |
| `text` | 答案是頁面上的文字，純文字 RAG 就該答得出來 | 5 |
| `image` | 答案只存在於圖表裡，文字完全沒寫 | 1 |
| `both` | 文字和圖表都有 | 2 |

光是整理這張表，就先發現一件事：**八題裡只有一題是 `image` only。** 那份報告的月份長條圖（圖三），數據跟內文的「(三) 月份別」那段完全重複。也就是說，**多模態架構在這份語料上真正不可取代的場合，比 Ep-3 想像的少很多。**

---

## 二、評估資料集必須是「真的跑出來」的

所以流程拆成兩步：先收集實際輸出，再打分數。

```bash
# 步驟 1：六種設定各跑一次 8 題，收集真實的檢索內容與回答
uv run python ep4_evaluation/collect.py --pdf measles-chapter.pdf

# 步驟 2：用本地 Ollama 當裁判打分數
uv run python ep4_evaluation/evaluate.py --all
```

[`collect.py`](https://github.com/Peter-To-Better/langchain-rag-lab/blob/main/ep4_evaluation/collect.py) 每一題都記下四個欄位，正是 RAGAS 要的格式：

- `user_input`：使用者的問題
- `retrieved_contexts`：這次**真的**撈到的內容（list）
- `response`：這次**真的**生成的回答
- `reference`：你人工準備的標準答案

---

## 三、還沒跑 RAGAS，答對率就說話了

分數之前，先看最樸素的東西：**八題裡答對幾題**。

| 設定 | q1 縣市 | q2 哪年 | q3 性別 | q4 年齡 | q5 月份 | q6 移入國 | q7 群聚 | q8 總數 | 答對 |
|:--|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `text_k4` | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | 4/8 |
| `text_k9` | **✓** | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | 5/8 |
| `caption_k4` | ✗ | **✓** | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | 5/8 |
| `ctx_k4` | ✗ | **✓** | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | 5/8 |
| `ctx_k9` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | **7/8** |
| `ctx_k9_strict` | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | 5/8 |

好消息：**Ep-3 的最終設定（`ctx_k9`）確實是最好的，7/8。** 結論沒錯。

壞消息：**它變好的原因，跟 Ep-3 說的不一樣。**

### 發現一：Ep-3 把功勞歸錯了對象

看 **q1** 那一欄，也就是 Ep-3 的主線題「發生率最高的縣市」：

- `text_k9`（**完全沒有圖片**）：✓ 答出彰化縣
- `ctx_k4`（**有圖片轉述、有補上下文**）：✗ 答不出來

**決定 q1 勝負的是 `top_k`，不是圖片轉述。**

原因很單純：「每十萬人口確定病例發生率以彰化縣 1.05 居冠」這句話，本來就是第 0 頁的**純文字**，跟地圖圖片一點關係都沒有。把檢索內容抓出來看，那個 chunk 在 `top_k=9` 時排第 9 名，`k=4` 就是撈不到它。

那張地圖的轉述實際長怎樣？跑 `qwen2.5vl:7b` 出來是這樣：

```text
這是一張臺灣地區的地圖，地圖上標註了各個縣市和省轄市的位置。
地圖使用了不同的顏色來表示數據的分布情況，這些顏色代表了
每一個行政區的人口密度（以萬人口為單位）。
```

圖例明明寫的是「每十萬人口**麻疹發生率**」，**它讀成了「人口密度」。** 不只沒提到「麻疹」兩個字（這是 Ep-3 就發現的問題），還把整張圖的意義編成了另一件事。這段轉述對 q1 不只沒幫助，它是**錯的**。

### 發現二：多模態真正的價值在別的地方

那圖片轉述是不是就沒用？不是。看 **q2**（「104 至 113 年哪一年病例最多」）：

- `text_k4` / `text_k9`：✗ 都答不出來
- `caption_k4` / `ctx_k4` / `ctx_k9`：✓ 都答出「108 年，141 例」

注意 `text_k9` 的 `k=9` 對純文字索引來說等於**整份文件全給**。就算把所有文字都塞進去，它還是答不出來。因為歷年病例數這個資訊，**只存在於圖二那張長條圖裡**，章節文字一個字都沒寫。

這才是圖片轉述不可取代的證明。而 `qwen2.5vl:7b` 對長條圖的判讀是**完全正確**的，十個數據點一個不差：

```text
- 在發病年104時，病例數為29。
- 在發病年105時，病例數為14。
- 在發病年106時，病例數為6。
- 在發病年107時，病例數為40。
- 在發病年108時，病例數達到最高點，為141。
- 在發病年109和110時，病例數為0。
...
```

兩件事擺在一起，結論就清楚了：

> **視覺模型讀「有數字標籤的長條圖」很可靠；讀「要靠圖例對應色階的地圖」會亂編。**

這比 Ep-3 那句「圖片轉述有用」精確太多，而且可以指導決策：你的 PDF 如果主要是色階地圖，這套架構幫不了你多少。

### 發現三：一句 prompt 措辭可以廢掉整個系統

`ctx_k9` 和 `ctx_k9_strict` 這兩組，**索引一樣、`top_k` 一樣、檢索到的九份文件逐字相同**，只差在 prompt：

```text
# ctx_k9（Ep-1 起就在用的版本）
不確定就直接說不知道，不要補充資料以外的內容。

# ctx_k9_strict
如果資料中找不到答案，請明確說「根據目前的文件，我找不到相關資訊」。
```

結果 q1、q2 兩題直接從答對變成拒答：

```text
q1_rate_top_county
  預設 prompt : 根據參考資料，113 年麻疹確定病例發生率最高的縣市是彰化縣。
  strict     : 根據目前的文件，我找不到相關資訊。

q2_peak_year
  預設 prompt : 根據參考資料，108 年的麻疹確定病例數達到最高點，為 141 個。
  strict     : 根據目前的文件，我找不到相關資訊。
```

我特地驗過：q1 的九份檢索內容裡，第 9 筆就明明白白寫著「彰化縣 1.05 居冠」。**模型是看著答案說找不到的。**

「明確要求覆誦某句拒答話術」這個寫法，會讓 `llama3.1` 對中文指令過度保守，傾向直接套用那句話收場。Ep-3 已經踩過這個坑，但當時只是個軼事；現在它是變因單一、可重跑的對照實驗。

---

## 四、RAGAS 分數

把六種設定全部評一遍：

```bash
uv run python ep4_evaluation/evaluate.py --all
uv run python ep4_evaluation/report.py
```

| 設定 | Ctx Precision | Ctx Recall | Faithfulness | Answer Relevancy |
|:--|:-:|:-:|:-:|:-:|
| `text_k4` | 0.382 | 0.740 | 0.396 | 0.332 |
| `text_k9` | 0.415 | 0.850 | 0.405 | 0.513 |
| `caption_k4` | 0.434 | 0.743 | 0.271 | 0.404 |
| `ctx_k4` | 0.497 | 0.743 | 0.562 | 0.401 |
| **`ctx_k9`** | 0.477 | 0.845 | **0.687** | **0.525** |
| `ctx_k9_strict` | 0.477 | 0.845 | 0.420 | 0.430 |

> 192 格分數裡有 10 格（5.2%）因為本地裁判產不出合法的結構化輸出而失敗，已從平均中排除。這是本地小模型跑結構化輸出的常態，腳本要接得住，不然一格失敗整批就中斷。

先看好消息：**`ctx_k9` 在兩個生成指標上都是第一（0.687 / 0.525），跟人工判定的 7/8 對得上。** 評估確實選出了最好的那組設定。

再看最有說服力的一組對照，`ctx_k9` 跟 `ctx_k9_strict`：

| | Ctx Precision | Ctx Recall | Faithfulness | Answer Relevancy |
|:--|:-:|:-:|:-:|:-:|
| `ctx_k9` | 0.477 | 0.845 | 0.687 | 0.525 |
| `ctx_k9_strict` | 0.477 | 0.845 | 0.420 | 0.430 |

**兩個檢索指標的數字一模一樣，兩個生成指標掉下來。**

這不是巧合。這兩組的檢索內容本來就逐字相同，差別只在 prompt。指標**精準地把責任定位到生成階段**，而不是含糊地說「系統變差了」。這正是為什麼要把四個指標分成檢索 / 生成兩層：你不只知道退步了，你知道該去改哪一段。

---

## 五、最重要的一步：先驗證指標本身可不可信

到這裡都還是在用指標評 RAG。但有個更根本的問題常常被跳過：

> **這個指標，在「你的」語料上分得出好壞嗎？**

驗證方法很直接：把每一題的回答**人工判定**答對答錯（存在 [`graded.json`](https://github.com/Peter-To-Better/langchain-rag-lab/blob/main/ep4_evaluation/graded.json)），然後看每個指標在「答對那群」跟「答錯那群」的平均分差多少。差距越大，代表這個指標越能反映真實品質。

```bash
uv run python ep4_evaluation/report.py --correlate
```

```text
指標                          答對均分        答錯均分        差距          樣本
------------------------------------------------------------------------------
Ctx Precision              0.445       0.450    -0.005       31/17
Ctx Recall                 0.783       0.819    -0.036       25/14
Faithfulness               0.617       0.176     0.441       30/17
Answer Relevancy           0.579       0.171     0.408       31/17
```

結果很意外：**四個指標裡，有兩個在這份語料上完全分不出好壞。**

兩個**生成**指標分得很開：Faithfulness 差距 **0.441**、Answer Relevancy 差距 **0.408**。答對的那群明顯高於答錯的那群，拿來做決策是有意義的。

但兩個**檢索**指標的差距不只是零，是**負的**：Context Precision **−0.005**、Context Recall **−0.036**。意思是答錯的那群，檢索分數還比答對的那群高一點點。換句話說，它們跟真實品質之間**沒有任何關係**，比擲骰子好不到哪去。

最直白的例子是 `text_k9`：它的 Context Recall 是全場最高的 **0.850**（跟冠軍 `ctx_k9` 並列），但人工判定只有 5/8。它撈得很好，然後答錯。

原因其實不難理解：這份示範語料切完只有 6～9 份文件，`top_k` 一開到 9 就幾乎等於「全部給我」。**檢索指標直接飽和了**。每一組設定都撈到了該撈的東西，差異全部發生在「生成階段有沒有用上」。

這件事有個直接的後果：

> **在小語料上，拿 Context Recall 低來當「該去調分割策略、加混合檢索」的依據，是在對雜訊調參。**

而這正是評估最容易被誤用的地方：指標會給你一個數字，數字看起來很客觀，但它到底有沒有在量你以為的東西，要另外驗證。

### 但個別分數還是不能單獨看

Faithfulness 聚合起來是四個指標裡最可信的（差距 0.441），個別題目卻照樣會出包。看 q1 在 `ctx_k9` 這組拿到的四個分數：

```json
{
  "context_precision": 0.174,
  "context_recall": 1.0,
  "faithfulness": 0.0,
  "answer_relevancy": 0.913
}
```

這題的回答是「113 年麻疹確定病例發生率最高的縣市是彰化縣。」，而檢索內容裡逐字寫著「每十萬人口確定病例發生率以彰化縣 1.05 居冠」。**答案完全正確、完全有根據**，Answer Relevancy 也給了 0.913，但 Faithfulness 給 **0.00**。

同一個回答、同一批檢索內容，兩個生成指標一個接近滿分、一個掛零。所以本地裁判的正確用法是**看整批的平均、比較不同設定**，絕對不要盯著單一題目的分數下判斷。

（如果你要對單題下判斷，那就得換更強的裁判模型，這也是為什麼正式場景還是有人願意付錢用 GPT-4o-mini 當裁判。）

---

## 六、這些分數到底怎麼算出來的？拆開 RAGAS 原始碼

看到這裡，你手上應該累積了一堆問號：

- 一個**完全正確、答案逐字就在檢索內容裡**的回答，Faithfulness 為什麼是 **0.00**？
- `ctx_k9` 明明檢索到了正確答案，Context Precision 為什麼只有 **0.174**？
- 為什麼 `ctx_k9` 跟 `ctx_k9_strict` 的檢索分數會**一模一樣**？
- 為什麼兩個檢索指標會爛到差距是負的？

這些不是隨機的，每一個都能從程式碼裡找到解釋。而且不搞懂的話，你很容易誤讀分數：看到 `0.00` 以為模型在幻覺，跑去改 prompt，結果改錯地方。

所以這一節把 RAGAS 拆開來看。全部對照 [ragas v0.4.3 的原始碼](https://github.com/vibrantlabsai/ragas/tree/v0.4.3/src/ragas/metrics/collections)，也就是這篇實測用的版本。

> 只想知道結論的話，這一節可以跳過，直接看[小結](#小結)。但如果你打算把 RAGAS 用在自己的專案上，這裡才是真正決定你會不會誤用它的地方。

### 核心設計：LLM 不負責「打分數」

這是整套東西最重要、卻最少被講清楚的一件事。先講結論：

> **RAGAS 沒有任何一個指標會叫 LLM 輸出「0.87 分」這種連續分數。** 它只有兩種做法：要嘛叫 LLM 做**二元判斷**（0 或 1），再用 Python 算術聚合；要嘛叫它從**極小的離散等級**裡挑一個（`0/1/2`、`0/2/4`、`1–5`）。

這不是憑印象講的。我原本寫的是「RAGAS 從頭到尾不叫 LLM 打分數」，結果自己去翻 `collections/` 底下 25 個指標資料夾，發現**這句話講太滿了**。`DomainSpecificRubrics` 就是直接叫 LLM 給 1~5 分。

真正成立的說法是這個，可以自己驗證：

```bash
# 有沒有任何指標叫 LLM 輸出 float 分數？
grep -rhE "^\s+\w+\s*:\s*float\s*=\s*Field" */util.py
# → 一筆都沒有。所有數值輸出都是 int
```

所以精確地說，25 個指標分成兩個家族：

| 家族 | 做法 | 屬於這一族的指標 |
| :--- | :--- | :--- |
| **二元判斷 + 算術聚合** | LLM 只回 0/1，分數由 Python 算 | Faithfulness、Answer Relevancy、Context Precision、Context Recall、Factual Correctness、Noise Sensitivity 等 10 個 ← **本篇用的四個全在這裡** |
| **小範圍離散評級** | LLM 直接給等級，但選項極少 | Answer Accuracy（`0/2/4`）、Context Relevance（`0/1/2`）、Response Groundedness（`0/1/2`）、Domain/Instance Specific Rubrics（`1–5`）等 5 個 |

而且就算是第二族，RAGAS 也**不信任模型的數字**。看 [`answer_accuracy/metric.py`](https://github.com/vibrantlabsai/ragas/blob/v0.4.3/src/ragas/metrics/collections/answer_accuracy/metric.py) 拿到 rating 之後做什麼：

```python
if rating in [0, 2, 4]:
    return float(rating)
...
    continue  # Retry if invalid rating
```

**回傳值不在合法集合裡就重試。** 連只有三個選項都要防呆，這件事本身就說明了 RAGAS 作者對「叫 LLM 吐數字」有多不信任。能少用就少用。

為什麼要這樣設計？因為這兩件事對 LLM 的難度天差地別：

| 你問 LLM | 難度 | 問題 |
| :--- | :--- | :--- |
| 「這個回答的忠實度是幾分？」 | 難 | 沒有校準基準。同一份輸入問兩次給不同分，而且 0.7 跟 0.8 的界線是什麼？沒人說得出來 |
| 「這句話能不能從這段文字推出來？」 | 容易 | 這是 NLI（自然語言推論），有明確判準，是 LLM 的強項 |

#### 補充：NLI 是什麼？

**NLI（Natural Language Inference，自然語言推論）** 是 NLP 最經典的任務之一，早在 LLM 出現前就有大量研究和標準資料集（SNLI、MNLI）。

它的形式很固定：給兩段文字，判斷它們的關係：

- **前提（premise）**：已知為真的那段。例如「小明是台大資工系三年級學生」
- **假設（hypothesis）**：要判斷的那句話

然後分成三類：

| 關係 | 假設舉例 | 判定 |
| :--- | :--- | :--- |
| **蘊含** entailment | 「小明是大學生」 | 前提**支持**這句 |
| **矛盾** contradiction | 「小明念的是醫學系」 | 前提**否定**這句 |
| **中立** neutral | 「小明有打工」 | 前提**沒說**，無法判斷 |

重點在於：**這個任務有明確判準。** 不是「你覺得幾分」，而是「這段文字有沒有支持這句話」。兩個人分別來判，答案應該要一樣。這正是它比「打分數」可靠的原因。

對應到 RAGAS 的 Faithfulness：**前提**就是你檢索到的那幾份文件，**假設**就是從回答拆出來的每一句。

> ⚠️ 但 RAGAS 把三類壓成了兩類。它的 prompt 是「能推出來給 1，不能推出來給 0」，**矛盾和中立都被歸到 0**。後果是 Faithfulness **分不出「模型編造了跟文件相反的內容」和「模型多講了文件沒提到的事」**。前者是真幻覺，後者可能只是補充常識，但兩者同樣拿 0 分。

**本篇用的四個指標，全部屬於第一族**，也就是同一個三段式骨架：

```text
1. 分解 (decompose)  →  把長文本拆成可獨立驗證的原子單位   [LLM]
2. 判定 (classify)   →  對每個原子單位問一個 yes/no        [LLM]
3. 聚合 (aggregate)  →  把布林陣列算成 0~1 的分數           [純 Python]
```

**第 3 步完全沒有 LLM 參與。** 這就是「為什麼可以這樣測」的根本答案：把不可靠的主觀評分，換成一堆可靠的客觀判斷，加上確定性的算術。

> 下面四小節逐一拆解本篇用的這四個指標。想自己驗證的話，[延伸閱讀](#這篇引用的-ragas-原始碼)有每個檔案的原始碼連結，全部釘在 v0.4.3。

### Faithfulness：拆句 + NLI

[`faithfulness/metric.py`](https://github.com/vibrantlabsai/ragas/blob/v0.4.3/src/ragas/metrics/collections/faithfulness/metric.py) 的主流程只有三行：

```python
statements = await self._create_statements(user_input, response)   # LLM 呼叫 #1
context_str = "\n".join(retrieved_contexts)
verdicts = await self._create_verdicts(statements, context_str)    # LLM 呼叫 #2
score = sum(v.verdict for v in verdicts) / len(verdicts)           # 純除法
```

#### 第一步：把回答拆成「原子句」

拆句的 prompt（在 [`util.py`](https://github.com/vibrantlabsai/ragas/blob/v0.4.3/src/ragas/metrics/collections/faithfulness/util.py)）有個乍看奇怪的要求：

> Break down each sentence into one or more fully understandable statements. **Ensure that no pronouns are used in any statement.**

（不能使用任何代名詞。）

為什麼要特別禁止代名詞？因為拆出來的每一句，接下來都會**被單獨拿去跟檢索內容比對**，而比對的時候，原本的上下文已經不在了。

假設模型的回答是這樣：

```text
113 年麻疹共 32 例確定病例。它的發生率是每十萬人口 0.14。
```

如果照原樣拆成兩句，第二句「它的發生率是每十萬人口 0.14」單獨拿去驗證時，**裁判根本不知道「它」是誰**。是 113 年？是麻疹？還是別的東西？這句話無法判斷真假，只能亂猜。所以拆句時必須還原成：

```text
113 年麻疹確定病例共 32 例。
113 年麻疹的每十萬人口確定病例發生率是 0.14。
```

這樣每一句才是**自我完備**的，可以脫離原文獨立驗證。

實際跑一次看看。拿這篇 `ctx_k9` 那組 q1 的真實回答丟進拆句步驟：

```text
原始回答: 根據參考資料，113 年麻疹確定病例發生率最高的縣市是彰化縣。

拆出 2 個 statement:
  1. 麻疹確定病例發生率最高的縣市是彰化縣。
  2. 根據參考資料，113 年麻疹確定病例發生率最高的縣市是彰化縣。
```

**注意這裡拆得其實不太好**：第 2 句幾乎是原句照抄，第 1 句是漏掉年份的近似重複。本地小模型做分解本來就不精緻，而這個瑕疵會直接傳到下一步，因為後面的分母就是這裡拆出來的句數。

#### 第二步：對每一句做 NLI 判定

輸出結構有講究：

```python
class StatementFaithfulnessAnswer(BaseModel):
    statement: str   # 原句逐字複述
    reason: str      # 判斷理由  ← 排在 verdict 前面
    verdict: int     # 0 或 1
```

`reason` 排在 `verdict` 前面不是隨便排的。結構化輸出是照欄位順序生成的，先寫理由等於強迫模型做一次 chain-of-thought 再下判斷。

把上面那 2 個 statement、配上 q1 實際檢索到的 9 份文件丟進 NLI 步驟，結果是：

```text
verdict=0  麻疹確定病例發生率最高的縣市是彰化縣。
  理由: 根據文中描述，麻疹確定病例發生率最高的縣市實際上是彰化縣，但這與文中的其他數據不符。

verdict=0  根據參考資料，113 年麻疹確定病例發生率最高的縣市是彰化縣。
  理由: 文中提到，麻疹確定病例發生率最高的縣市實際上是彰化縣，但這與文中的其他數據不符。
```

**看清楚裁判的理由**：它自己白紙黑字寫「實際上是彰化縣」（等於承認這句話跟文件一致），然後投了 **0**，補一句語意不明的「但這與文中的其他數據不符」。這是**前後矛盾的判定**，`llama3.1` 這種規模的模型當 NLI 裁判就是會這樣。

回頭看[前面講的三類 NLI](#補充nli-是什麼)，這個誤判就更好理解了：裁判像是卡在「蘊含」和「矛盾」之間搖擺：它認得出文件支持這句話（蘊含），卻又覺得跟別處的數字對不上（矛盾）。而 RAGAS 只給它 0 和 1 兩個選項，逼它二選一，它選錯了邊。**如果保留三分類，這種猶豫至少會表現成「中立」，而不是直接被當成幻覺。**

#### 第三步：純除法

```python
score = sum(v.verdict for v in verdicts) / len(verdicts)   # 0 / 2 = 0.0
```

分母 2、分子 0，得到 **0.00**。

這就是這篇後面會看到的那個 0.00 的完整成因。而且請注意分母：這個回答只拆出 2 句，代表它的 Faithfulness **只可能是 0、0.5 或 1 這三個值之一**。

> 短回答的 Faithfulness 是**高度量化**的：分母越小，一次誤判造成的分數跳動越大。這不是 bug，是分母太小的數學後果。

### Answer Relevancy：反向生成 + 向量相似度

Faithfulness 是「拆開來一句句驗證」，你可能會以為四個指標都長這樣。**但這一個完全不同**，它的招式很跳，幾乎不靠 LLM 判斷，改用向量（[`answer_relevancy/metric.py`](https://github.com/vibrantlabsai/ragas/blob/v0.4.3/src/ragas/metrics/collections/answer_relevancy/metric.py)）：

```python
for _ in range(self.strictness):            # 預設 3 次
    result = await self.llm.agenerate(...)  # 給 response，反推「這是在回答什麼問題？」
    generated_questions.append(result.question)
    noncommittal_flags.append(result.noncommittal)

question_vec = embed(user_input)              # 原問題
gen_question_vec = embed(generated_questions) # 3 個反推出來的問題
cosine_sim = ...                              # 餘弦相似度

score = cosine_sim.mean() * int(not all_noncommittal)
```

邏輯很聰明：**如果你的回答真的在回答那個問題，那從回答反推回去，應該能推出很接近原問題的東西。** 推出來的問題離原問題越遠，代表越答非所問。

注意最後那個乘法，那是一道**硬閘門**：只要三次反推都判定回答是 noncommittal（「我不知道」「我不確定」這類），分數**直接歸零**，不管相似度多高。

**但這也是它最大的盲點**：Answer Relevancy 完全不看 `retrieved_contexts`，也不看 `reference`。它只知道你有沒有對準問題，**不知道你答得對不對**。

> Answer Relevancy 高 ≠ 答對。它抓得到「拒答」和「離題」，抓不到「胡說八道但很切題」。

### Context Precision：每個 chunk 問一次，再算 Average Precision

前面兩個都在評「生成」。接下來兩個轉去評「檢索」，而這一個是四個裡面**最貴**的：

```python
for context in retrieved_contexts:          # ← 每個 chunk 各問一次！
    result = await self.llm.agenerate(...)  # 「這塊對得出標準答案有幫助嗎？」0/1
    verdicts.append(result.verdict)

score = self._calculate_average_precision(verdicts)
```

聚合用的是 IR 領域的標準 **Average Precision**（[`context_precision/metric.py`](https://github.com/vibrantlabsai/ragas/blob/v0.4.3/src/ragas/metrics/collections/context_precision/metric.py)）：

```python
denominator = sum(verdict_list) + 1e-10
numerator = sum(
    [
        (sum(verdict_list[: i + 1]) / (i + 1)) * verdict_list[i]
        for i in range(len(verdict_list))
    ]
)
score = numerator / denominator
```

關鍵性質：**它對位置敏感**。同樣是「9 塊裡有 1 塊有用」，排第 1 名跟排第 9 名差了 9 倍：

```text
有用的排第 1     [1,0,0,0,0,0,0,0,0]   AP = 1.000
有用的排第 9     [0,0,0,0,0,0,0,0,1]   AP = 0.111
有用的排第 8、9  [0,0,0,0,0,0,0,1,1]   AP = 0.174
```

記住最後那個 **0.174**，這篇後面會再遇到它一次。

工程上還要注意：**這是唯一一個成本是 `O(chunks)` 的指標**。`top_k` 從 4 開到 9，光這個指標的呼叫次數就多一倍以上。

### Context Recall：最省的一個，但它拆的東西不一樣

前一個要對每個 chunk 各問一次，這一個只要 **1 次呼叫**就搞定（[`context_recall/metric.py`](https://github.com/vibrantlabsai/ragas/blob/v0.4.3/src/ragas/metrics/collections/context_recall/metric.py)）：

```python
context = "\n".join(retrieved_contexts)   # 全部合併成一段
result = await self.llm.agenerate(...)    # 一次搞定
score = sum(c.attributed for c in result.classifications) / len(result.classifications)
```

它的 prompt 是：

> Given a context and an answer, analyze **each statement in the answer** and classify if the statement can be attributed to the given context.

**注意這裡的 "answer" 指的是你的 `reference`（標準答案），不是模型的回答。** 它拆的是標準答案，然後問「標準答案裡的每一句，檢索到的內容有沒有涵蓋」。

這個設計本身沒問題，但它在小語料上會出事，這正是它在[第五節](#五最重要的一步先驗證指標本身可不可信)差距變成負數的原因。

### 成本模型：評估要跑多久，其實可以先算出來

我第一次跑 `--all` 的時候完全沒概念要等多久，就丟著去做別的事。後來發現這個數字是可以事前估的：把四個指標的呼叫次數加一加就好：

| 指標 | LLM 呼叫次數 | 備註 |
| :--- | :---: | :--- |
| Faithfulness | **2** | 拆句 1 次 + NLI 1 次 |
| Answer Relevancy | **3** | = `strictness`，另加 embedding |
| Context Precision | **N** | N = chunk 數 ← 唯一會隨 `top_k` 增長 |
| Context Recall | **1** | 全部 context 合併成一次 |

這篇實測的六種設定，攤開來是這樣：

```text
設定                chunks   每題呼叫    8題小計
text_k4                4        10        80
text_k9                6        12        96
caption_k4             4        10        80
ctx_k4                 4        10        80
ctx_k9                 9        15       120
ctx_k9_strict          9        15       120
------------------------------------------------
合計                                      576  次 LLM 呼叫
```

**576 次本地 `llama3.1` 呼叫，實際跑了約一小時。**

如果你是用付費 API 當裁判，這個數字就是你的帳單。八題就 576 次，真要做到二三十題的測試集，乘一乘會很有感。這也是為什麼「先用 `--metrics faithfulness` 把流程跑通再開全部」不是客套話。

### 小結：這套方法的前提與代價

講完四個指標，回頭看整套設計。它能成立，靠的是三個前提：

1. **判別比評分容易。** NLI 有明確判準不需校準；打分數需要校準，而 LLM 沒有。
2. **布林值取平均有明確語意。** 「8 個 statement 裡 6 個有根據」= 0.75，是可解釋的比例，不是模型的主觀感受。
3. **分解降低了單次判斷的難度。** 難題被拆成一堆簡單題。

而它的弱點，全部來自同一個設計：

| 弱點 | 機制上的原因 |
| :--- | :--- |
| 短回答分數跳動劇烈 | 分母 = statement 數，可能只有 1~2 |
| 誤差會前後傳播 | 第 1 步拆錯，第 2 步全錯，而且無從察覺 |
| 分不出「幻覺」與「補充」 | NLI 的三分類被壓成二元，矛盾和中立同樣拿 0 |
| 裁判能力決定天花板 | NLI 判斷不穩 → 分數不穩 |
| 切題 ≠ 正確 | Answer Relevancy 不看 context 也不看 reference |
| 小語料上檢索指標會飽和 | `top_k` 接近文件總數時，attributed 恆為真 |
| 成本不對稱 | Context Precision 是 `O(chunks)` |

**這張表不是理論推導，後面每一條都會在實測數據裡出現。**

---

### 回頭看那四個怪分數

機制拆完了，回頭看本節開頭那幾個問號，每一個都對得上：

- **`context_precision: 0.174`**：還記得上面那張 Average Precision 表嗎？`[0,0,0,0,0,0,0,1,1]` 算出來正好是 **0.174**。反推得出裁判認為九塊裡只有第 8、9 塊有用。而我另外查過檢索內容：「彰化縣 1.05 居冠」那段**正是排第 9 筆**。分數跟事實完全吻合。AP 對位置敏感，答案排最後就是會拿低分，即使它確實被撈到了。

- **`faithfulness: 0.0`**：[前面實際跑過](#faithfulness拆句--nli)：這個回答只拆得出 **2 個 statement**，可能的分數只有 {0, 0.5, 1}。而裁判在 NLI 那步兩句都投 0，理由卻自己寫著「實際上是彰化縣」。**前後矛盾的誤判，加上分母只有 2**，湊出這個 0.00。不是系統在幻覺。

- **`answer_relevancy: 0.913`**：它只看「問題」跟「回答」對不對得上，不看有沒有根據。回答直接命中問題，所以接近滿分。

- **`context_recall: 1.0`**：標準答案的每一句都能歸因到檢索內容，所以滿分。但這題在 `top_k=4` 的設定下是**答不出來的**。recall 滿分照樣答錯，這正是它分不出好壞的縮影。

**這就是為什麼要先讀懂機制再看分數。** 不知道 AP 對位置敏感，你會以為 0.174 代表「檢索很爛」；不知道 Faithfulness 的分母是 statement 數，你會以為 0.00 代表「模型在幻覺」。兩個結論都是錯的，而且都會讓你去改不該改的地方。

---

## 踩雷筆記

這篇的坑幾乎都在「把 RAGAS 跑起來」這件事上，而且官方文件都沒寫。

- **`import ragas` 直接 `ModuleNotFoundError`**：ragas 會無條件載入 `langchain_community.chat_models.vertexai`，但這個子模組在 `langchain-community >= 0.4` 已經被移走。我們全程用 Ollama、根本用不到 VertexAI，所以直接塞一個空模組讓 import 過關就好。

- **照官方的 DeprecationWarning 改，Ollama 會壞**：警告叫你從 `ragas.metrics` 改用 `ragas.metrics.collections`，但新版指標要的是 `InstructorBaseRagasLLM`，**不吃**舊版那個 `LangchainLLMWrapper(ChatOllama(...))`。Ollama 使用者要改走它的 OpenAI 相容端點：

  ```python
  from openai import AsyncOpenAI
  from ragas.llms import llm_factory

  client = AsyncOpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
  llm = llm_factory("llama3.1-judge", provider="openai", client=client)
  ```

- **評估「卡住不動」，而且不報錯**：這個最難查。RAGAS 的裁判 prompt 會把檢索到的**每一個 chunk** 整包塞進去，`top_k=9` 的中文語料大約 3,200 字元，加上 RAGAS 自己的指令與範例，會超過 `llama3.1` 在 Ollama 的預設 4096 context。症狀不是錯誤訊息，是整個停在那裡。解法是另外建一個放大 context 的裁判模型：

  ```bash
  ollama create llama3.1-judge -f ep4_evaluation/Modelfile.judge
  ```

  順帶一提，透過 OpenAI 相容端點傳 `extra_body={"options": {"num_ctx": 8192}}` **沒有用**，會被靜默忽略，用 `ollama ps` 看 `CONTEXT` 欄位還是 4096。

- **裁判偶爾會產不出合法輸出**：本地小模型跑結構化輸出會偶發 `IncompleteOutputException`。腳本要接住它、記成 `NA` 繼續跑，不然一格失敗整批評估就中斷。

- **本地模型跑評估很慢**：每一題每一個指標背後都要呼叫好幾次 LLM。建議先用 `--metrics faithfulness` 把流程跑通，再開全部指標。

- **reference 要老實準備**：Context Recall / Precision 高度依賴標準答案的品質。更不能拿模型自己的輸出當標準答案。

---

## 小結

這篇補上了 RAG 開發最容易被忽略、卻最重要的一環：**評估**。但實際跑完，最大的收穫不是那幾個分數，而是評估幫我抓到三件憑感覺絕對看不出來的事：

1. **Ep-3 把功勞歸錯了對象。** 那篇認為是圖片轉述救回了「發生率最高的縣市」這題，實測顯示真正有用的是 `top_k`，一個完全沒有圖片的純文字 RAG 也答得出來。而那張地圖的轉述不只沒幫上忙，還把「每十萬人口發生率」讀成了「人口密度」。

2. **多模態真正的價值在別的題目上。** 「哪一年病例最多」這題，資訊只存在於長條圖裡，純文字給到整份文件全塞進去還是答不出來，有圖片轉述的三組全部答對。同一個架構，在色階地圖上失效、在長條圖上可靠，這個區別比「多模態 RAG 有用」有價值得多。

3. **四個指標裡有兩個在這份語料上是雜訊。** 檢索指標因為語料太小而飽和，分不出答對答錯（差距 −0.005 和 −0.036）。如果沒有先拿人工判定驗證一遍，我會拿著一個看起來很客觀的數字，去調一個根本不是問題的地方。

所以如果這篇只能留下一句話，我會選這句：

> **評估不是拿來證明你的系統很好，是拿來抓出你以為對、其實錯的因果關係。**

而在信任任何指標之前，先花時間人工判定幾十題，確認那個指標在**你的**語料上分得開好壞。這一步比跑分數本身更重要。

到這裡，這個 LangChain 系列就走完一輪了：

- [Ep-0：LLM、LangChain、AI Agent 與 MCP 是什麼](/posts/langchain-與-llm-學習筆記-ep-0)：概念打底
- [Ep-1：RAG 入門，把八個步驟串成可跑的程式](/posts/langchain-與-llm-學習筆記-ep-1)：基本架構
- [Ep-2：進階檢索，混合檢索與 Reranking](/posts/langchain-與-llm-學習筆記-ep-2)：提升準確度
- [Ep-3：多模態 RAG，讓 LLM 讀懂含圖表 PDF](/posts/langchain-與-llm-學習筆記-ep-3)：處理圖片
- **Ep-4（本篇）**：用評估驗證前面每一步到底有沒有效

接下來可以往 Agent、LangGraph、或把這套 RAG 包成 API 服務的方向繼續深入。

---

## 本篇程式碼

| 檔案 | 功能 | 執行指令 |
| :--- | :--- | :--- |
| `testset.py` | 8 題測試集 + 人工核對的標準答案 | `uv run python ep4_evaluation/testset.py` |
| `collect.py` | 六種設定各跑一次，收集真實輸出 | `uv run python ep4_evaluation/collect.py --pdf measles-chapter.pdf` |
| `evaluate.py` | 用本地 Ollama 當裁判打分數 | `uv run python ep4_evaluation/evaluate.py --all` |
| `report.py` | 整理對照表、驗證指標可不可信 | `uv run python ep4_evaluation/report.py --correlate` |
| `Modelfile.judge` | 放大 context 的裁判模型定義 | `ollama create llama3.1-judge -f ...` |

👉 **[GitHub：langchain-rag-lab / ep4_evaluation](https://github.com/Peter-To-Better/langchain-rag-lab/tree/main/ep4_evaluation)**

```bash
git clone https://github.com/Peter-To-Better/langchain-rag-lab.git
cd langchain-rag-lab && uv sync
ollama pull llama3.1 && ollama pull nomic-embed-text && ollama pull qwen2.5vl:7b
ollama create llama3.1-judge -f ep4_evaluation/Modelfile.judge

# 準備麻疹章節 PDF（指令見 Ep-3）
uv run python ep4_evaluation/collect.py --pdf measles-chapter.pdf
uv run python ep4_evaluation/evaluate.py --all
uv run python ep4_evaluation/report.py --correlate
```

---

### 延伸閱讀

- [RAGAS 官方文件 — Evaluate a simple RAG system](https://docs.ragas.io/en/stable/getstarted/rag_eval/)
- [RAGAS — List of available metrics](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/)
- [Ollama — OpenAI compatibility](https://docs.ollama.com/openai)

#### 這篇引用的 RAGAS 原始碼

第六節的拆解全部對照 **ragas v0.4.3**（本篇實測用的版本）。想自己讀的話，每個指標的資料夾裡都是 `metric.py`（計分邏輯）+ `util.py`（prompt 與輸出結構）兩支：

| 指標 | `metric.py`（計分邏輯） | `util.py`（prompt 與結構） |
| :--- | :--- | :--- |
| Faithfulness | [metric.py](https://github.com/vibrantlabsai/ragas/blob/v0.4.3/src/ragas/metrics/collections/faithfulness/metric.py) | [util.py](https://github.com/vibrantlabsai/ragas/blob/v0.4.3/src/ragas/metrics/collections/faithfulness/util.py) |
| Answer Relevancy | [metric.py](https://github.com/vibrantlabsai/ragas/blob/v0.4.3/src/ragas/metrics/collections/answer_relevancy/metric.py) | [util.py](https://github.com/vibrantlabsai/ragas/blob/v0.4.3/src/ragas/metrics/collections/answer_relevancy/util.py) |
| Context Precision | [metric.py](https://github.com/vibrantlabsai/ragas/blob/v0.4.3/src/ragas/metrics/collections/context_precision/metric.py) | [util.py](https://github.com/vibrantlabsai/ragas/blob/v0.4.3/src/ragas/metrics/collections/context_precision/util.py) |
| Context Recall | [metric.py](https://github.com/vibrantlabsai/ragas/blob/v0.4.3/src/ragas/metrics/collections/context_recall/metric.py) | [util.py](https://github.com/vibrantlabsai/ragas/blob/v0.4.3/src/ragas/metrics/collections/context_recall/util.py) |

- 全部指標的進入點：[`src/ragas/metrics/collections/`](https://github.com/vibrantlabsai/ragas/tree/v0.4.3/src/ragas/metrics/collections)

> ⚠️ 兩件事要注意。第一，**repo 已經搬家**：套件 metadata 上的 Code URL 現在是 `github.com/vibrantlabsai/ragas`，不是很多舊文章寫的 `explodinggradients/ragas`。第二，上面連結都**釘在 `v0.4.3` 這個 tag** 而不是 `main`。RAGAS 改版很快，指標的計分邏輯跟 prompt 都可能變，釘 tag 你才看得到跟這篇對得上的那版程式碼。你自己讀的時候，記得先確認 `uv pip show ragas` 的版本再挑對應的 tag。
