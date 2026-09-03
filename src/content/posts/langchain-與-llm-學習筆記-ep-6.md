---
title: "Graph RAG 實作：Neo4j 知識圖譜問答｜LangChain 筆記 Ep-6"
pubDate: 2026-08-16 11:00:00
description: "Graph RAG 實作教學：把疾管署年報 18 個疾病章節抽成知識圖譜存進 Neo4j，用本地模型把自然語言翻成 Cypher 查詢，並與向量 RAG 在同一批單跳與多跳問題上直接對打，附完整 Python 程式碼。"
author: "Peter"
tags: ["LangChain & LLM"]
category: "LangChain & LLM"
keywords: "Graph RAG 實作, Neo4j 教學, Text2Cypher, 知識圖譜建立, LangChain Neo4j, Cypher 生成, 多跳問答, 本地 LLM 知識圖譜"
draft: true
---

## 本篇重點

[Ep-5](/posts/langchain-與-llm-學習筆記-ep-5) 講完 Graph RAG 是什麼、為什麼紅、跟向量 RAG 差在哪。這篇動手做完整條管線：

**18 個疾病章節 → 抽成結構化事實 → 存進 Neo4j → 自然語言問題翻成 Cypher → 查詢 → 生成回答**

然後跟向量 RAG 在同一批問題上直接對打，題目刻意包含**Graph RAG 應該會輸的單跳題**。

<!-- more -->

---

## 一、抽取：不要全部交給 LLM

Graph RAG 跟向量 RAG 最大的差別在這一步。向量 RAG 把文字切一切丟去嵌入就好，Graph RAG 得先把文字**讀懂**，抽出實體與關係。

直覺會想「那就叫 LLM 抽啊」。我一開始也這樣做，結果很慘。

### LLM 抽取的兩種失敗

拿 4 個疾病章節測 `llama3.1`，要它抽出「每十萬人口發生率以 X 居冠」這種固定句型：

| 疾病 | LLM 抽取結果 |
| :--- | :--- |
| 麻疹 | 空的 |
| 登革熱 | 空的 |
| 結核病 | 空的 |
| 梅毒 | `弰市 63.54`、`钷国市 54.9`、`新市 52.52` |

**四個漏了三個，唯一抽到的那個把縣市名的字打錯。** 正確答案是臺東縣、桃園市、新北市，數字 63.54 / 54.90 / 52.52 全對，但字全錯。這是繁體中文專有名詞在結構化輸出下的字元層級崩壞。

而且更麻煩的是第一種失敗：**它不會報錯，欄位就是空的**。你不去核對根本不會發現。

### 同樣的句型，regex 是 16/18

政府報告的句型非常規律。同一件事用 regex 寫：

```python
# 「每十萬人口確定病例發生率以彰化縣1.05 居冠」
METRIC = r"每十萬人口[^。]{0,20}?(?:發生率|人數)"
COUNTY = r"([一-龥]{2,3}[縣市])"
RANK1 = re.compile(METRIC + r"[^。]{0,12}以\s*" + COUNTY + r"\s*([\d.]+)\s*人?\s*(?:居冠|為高|最高)")
```

跑完 18 章的覆蓋率：

```text
抽取覆蓋率（分母 18 章）：
  發生率排名  16/18
  境外來源國  10/18
  確定病例數  13/18
  性別分布    16/18
```

沒抓到的兩章我逐一核對過，是**真的沒有那個句型**：

- **新冠肺炎**：只列了各縣市病例數，沒有發生率排名句
- **腹瀉**：整章講的是門急診就診人次，不是確定病例發生率，章節類型根本不同

這就是 regex 相對於 LLM 最重要的優點，而且跟準確率無關：

> **regex 抓不到就是抓不到，你會知道。LLM 抓不到的時候，會編一個看起來很合理的答案給你。**

### 但 regex 也需要測試

我第一版的 regex 有兩個 bug，都是實測才發現的：

**Bug 1：漏掉一整章。** HIV 那章寫的是「每十萬人口新確診通報 HIV 感染**人數**」，不是「發生率」。只比對「發生率」就會靜默漏掉整章。

**Bug 2：排名被截斷。** 我原本找第二三名的方式是「從縣市名在全文第一次出現的位置往後搜 260 字」，但那通常是前面「地區別」段落的提及，窗口落在錯的地方，導致麻疹只抽到第一名。改成從第一名那個 match 結束的位置往後找才對：

```python
# 錯：從縣市名第一次出現的位置算
tail = text[text.find(ranking[0]["county"]):][:260]
# 對：從第一名的 match 結束位置算
tail = text[end:end + 260]
```

修完這兩個，排名關係從 15 條變成 **47 條**。

### 分工結論

| 資料類型 | 用什麼 | 為什麼 |
| :--- | :--- | :--- |
| 固定句型（發生率排名、病例數、性別） | **regex** | 準、快、免費，抓不到會明講 |
| 敘述性內容（疫情描述、防治成效） | LLM | regex 寫不出來 |

政府報告、法規、財報這類**模板化文件**，regex 能處理的比你想的多。全部交給 LLM 是浪費，而且不可靠。

---

## 二、建圖：schema 越小越好

抽完事實就可以載進 Neo4j 了。先跑起來：

```bash
docker run -d --name ep6-neo4j -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/graphrag123 neo4j:5
```

Schema 只有三種節點、兩種關係：

```text
(:Disease {name, total_cases, male_cases, female_cases})
(:County  {name})
(:Country {name})

(:Disease)-[:INCIDENCE   {year, rate, rank}]->(:County)
(:Disease)-[:IMPORTED_FROM {cases}]->(:Country)
```

**這是刻意做小的。** 後面要叫 LLM 生 Cypher，schema 越複雜它越容易亂接關係。實測 schema 給太多細節時，模型會硬湊出跟問題無關的 join。

載入結果：

```text
載入完成：18 種疾病、47 條發生率關係、30 條境外移入關係

節點統計：
  Country    16
  Disease    18
  County     16
```

### 一個載入後才發現的資料品質問題

第一次載完，查登革熱的境外來源國，跑出這個：

```text
感染地以印尼 96
其次為菲律賓 40
泰國 34
```

**國名前面黏了連接詞。** 我的 regex 是 `([一-龥A-Za-z]{2,6})\s*(\d+)\s*例`，把「感染地以」「其次為」一起吃進去了，於是圖裡出現了「感染地以印尼」這種節點，之後查詢就永遠對不上「印尼」。

這正是 Ep-5 提過的：**Graph RAG 的抽取誤差會往下傳播，而且結構化的答案看起來很可信，更難發現。** 修法很土但有效，把常見連接詞剝掉：

```python
PREFIXES = ("感染地以", "感染國家以", "其次為", "感染地為", "依序為", "以", "為", "及", "與", "和")
```

修完之後 Country 節點從 21 降到 16，連接詞黏字的問題解決了。

但 16 個裡面還藏著另一種雜訊，跟連接詞完全無關：麻疹章節境外移入來源被抽成「其中男性 16、女性 11、男性 20」，瘧疾章節則是「男性 6、女性 3」。這兩組其實是**性別統計**，不是境外移入來源，因為抓取境外移入的正則往後抓了 300 字，範圍蓋到隔壁不相關的「(一) 性別」段落，把男女病例數也當成國家與病例數配對抓了進來。這個坑我還沒補，圖裡目前是 10 個真正的國家加上 6 個性別雜訊，是誠實的現狀，不是理想狀態。

---

## 三、Text2Cypher：few-shot 不是優化，是必要條件

這是整條路線的核心，也是**風險最高的一步**。

### 沒有範例時，本地模型生的 Cypher 是 0/4

只給 schema、不給範例，叫 `llama3.1` 把四個問題翻成 Cypher，四題沒有一題能跑：

| 問題 | 生出來的東西 |
| :--- | :--- |
| 哪些疾病的冠軍縣市是高雄市 | 硬接一個跟題目無關的 `IMPORTED_FROM` join |
| 臺東縣在哪些疾病排名第一 | 結構對，但幻覺出 `year: 2022`（資料是民國 113） |
| 境外移入以印尼為主的疾病 | `{cases: cases}` 引用未定義變數，語法錯誤 |
| 哪些縣市同時是兩種以上疾病的前三名 | 用了 `GROUP BY` / `HAVING`，**那是 SQL，Cypher 沒有** |

最後一個特別值得注意。模型顯然把 Cypher 當成 SQL 在寫，因為它看過的 SQL 遠多於 Cypher。

### 加三個範例，變成 4/4

prompt 裡加上三個涵蓋不同查詢形態的範例：

```text
範例1（單一條件過濾）
問題：哪些疾病在彰化縣的發生率排名第一？
Cypher：MATCH (d:Disease)-[i:INCIDENCE]->(c:County {name:'彰化縣'}) WHERE i.rank = 1 RETURN d.name AS disease, i.rate AS rate

範例2（排序取第一）
問題：登革熱境外移入最多的國家是哪一國？
Cypher：MATCH (d:Disease {name:'登革熱'})-[r:IMPORTED_FROM]->(x:Country) RETURN x.name AS country, r.cases AS cases ORDER BY r.cases DESC LIMIT 1

範例3（聚合計數）
問題：哪個縣市是最多疾病的發生率前三名？
Cypher：MATCH (d:Disease)-[i:INCIDENCE]->(c:County) WHERE i.rank <= 3 WITH c.name AS county, count(DISTINCT d) AS n RETURN county, n ORDER BY n DESC LIMIT 5
```

同樣四題，`llama3.1` 全部語法正確，`qwen3:8b` 連語意都準：

```text
llama3.1-extract：4/4 通過靜態檢查
qwen3:8b        ：4/4 通過靜態檢查
```

不過靜態檢查有盲點。`llama3.1` 有一題生出 `[r:IMPORTED_FROM {cases: 100}]`，語法完全合法，但那個 `cases: 100` 是**憑空加的過濾條件**，查出來一定是空的。`qwen3:8b` 則寫得出 `WITH ... collect(DISTINCT d.name) AS diseases WHERE size(diseases) >= 2` 這種正確的聚合。

所以這篇的 Cypher 生成用 **`qwen3:8b`**，最後生成回答用 `llama3.1`。

---

## 四、又踩到同一個 prompt 坑

管線串起來第一次跑，出現這個：

```text
Cypher: MATCH (d:Disease)-[i:INCIDENCE]->(c:County {name:'臺東縣'}) WHERE i.rank = 1
        RETURN d.name AS disease, i.rate AS rate
查到 4 筆
回答：查不到。
```

**Cypher 完全正確、確實查到 4 筆、然後模型說查不到。**

原因是我那個生成回答的 prompt 寫了這句：

```text
只根據查詢結果回答，結果是空的就說查不到，不要自己補充。
```

這正是 [Ep-3 踩過、Ep-4 用對照實驗證實過](/posts/langchain-與-llm-學習筆記-ep-4)的坑：**prompt 裡只要出現指定的拒答話術，`llama3.1` 就傾向直接照抄那句收場，即使資料就在眼前。**

修法是把空結果的判斷交給程式碼，prompt 裡不要出現拒答句：

```python
def answer(question, rows, llm):
    if not rows:                      # 空結果由程式判斷，不要問模型
        return "查不到符合條件的資料。"
    return llm.invoke(ANSWER_PROMPT.format(...)).content
```

順帶一提，我原本把 Neo4j 回傳的 Python dict 直接丟給模型，也是不好的做法。改成排版過的文字行之後穩定很多。

---

## 五、向量 RAG vs Graph RAG

7 題直接對打：3 題單跳、4 題多跳，全部人工核對，不讓模型自評（[Ep-4 踩過的坑](/posts/langchain-與-llm-學習筆記-ep-4)）。

### 單跳題：原本以為向量 RAG 不會輸，結果只對 1 題

單跳題設計的用意是讓 Graph RAG 有輸的空間，畢竟抽取階段可能漏東西，向量 RAG 撈一段文字回答理論上該更穩。實測完全相反：

| 問題 | 標準答案 | 向量 RAG | Graph RAG |
| :--- | :--- | :--- | :--- |
| 麻疹發生率最高縣市 | 彰化縣 1.05 | 彰化縣和臺北市，數字寫成 0.08 和 0.07 | 彰化縣 |
| 結核病發生率最高縣市 | 屏東縣 46.84 | 沒有提到任何關於結核病的資訊 | 屏東縣 |
| 登革熱境外移入國家 | 印尼 96 例 | 印尼 | 印尼 |

結核病那章明明就在語料裡，向量 RAG 卻說查無資料，代表 `top_k=12` 撈到的 12 個 chunk 沒有一個蓋到那段。麻疹那題更值得注意，而且比表面上看到的嚴重：0.08 和 0.07 這兩個數字不是編出來的，回頭查 PDF，它們一字不差出現在**瘧疾**章節，原句是「每十萬人口確定病例發生率以彰化縣及臺北市 0.08 為高，高雄市 0.07 居次」。向量 RAG 把瘧疾章節的真實數字接到了麻疹的答案上，而且彰化縣剛好同時是麻疹第一名（1.05）跟瘧疾並列第一（0.08），這個巧合讓誤導更難被抓到。這正是 [Ep-5 第一節那個失敗實測](/posts/langchain-與-llm-學習筆記-ep-5)的同一種病：18 章結構雷同，向量檢索連單跳題都會撈錯章節。

Graph RAG 3 題全對，答案只有一個縣市名，沒有多餘的東西。

### 多跳題：Graph RAG 沒有一題全錯，但也沒有全對

| 問題 | 標準答案 | 向量 RAG | Graph RAG |
| :--- | :--- | :--- | :--- |
| 臺東縣哪些疾病第一 | 梅毒、流感、HIV、侵襲性肺炎鏈球菌，共 4 種 | 列出結核病死亡率、新冠併發重症、疫苗接種缺陷性麻疹 | 查到 4 筆，只講了梅毒一個 |
| 高雄市冠軍疾病 | 登革熱、類鼻疽，共 2 種 | 列出退伍軍人病、瘧疾、新冠併發重症 | 類鼻疽、登革熱，2/2 全對 |
| 進入前三名最多的縣市 | 臺東縣，共 7 種 | 沒有明確提到 | 講對臺東縣，但多列了屏東縣、花蓮縣 |
| 三種以上疾病前三名的縣市 | 臺東縣 7、新北市 6、花蓮縣及屏東縣各 4、基隆市／高雄市／臺南市／彰化縣／臺北市各 3，共 9 個縣市 | 列出基隆市、臺東縣、花蓮縣各自的三種疾病，文不對題 | 臺東縣、新北市、花蓮縣、屏東縣，前 4 名全對，漏了剛好等於 3 的 5 個縣市 |

向量 RAG 4 題全錯，錯法比單跳題更誇張。臺東縣那題的兩個數字其實都對得上真正的答案，只是接錯了疾病：2.37 是侵襲性肺炎鏈球菌感染症的發生率，被接到「新冠併發重症」身上；63.54 是梅毒的發生率，被接到一個查無此病的「疫苗接種缺陷性麻疹」身上。跟 Ep-5 那個 63.54 接錯疾病的失敗一模一樣，這次還更嚴重一階，直接編出一個不存在的疾病名字。

Graph RAG 這 4 題全部查對了正確的節點，錯的地方都發生在同一關：**Cypher 沒問題，回答卻沒有把查詢結果講完整或講精確。**

- 臺東縣那題，Cypher 是 `WHERE i.rank = 1`，查到 4 筆，4 筆都是正確答案，但生成回答的模型只挑了梅毒講，另外 3 個沒提。
- 「三種以上」那題，Cypher 寫的是 `WHERE diseaseCount > 3`，多打了一個等號的邊界。「三種以上」該翻成「大於等於 3」，`> 3` 等於「大於 3」，把剛好等於 3 的縣市全部排除在外。我直接查了圖，剛好等於 3 的縣市其實有 5 個（基隆市、高雄市、臺南市、彰化縣、臺北市），這個邊界寫錯讓答案少了 5 個縣市，不是表面看起來的漏一兩個。
- 「進入前三名最多」那題，Cypher 用 `ORDER BY n DESC LIMIT 5` 撈回前 5 名沒問題，回答卻列出臺東縣、屏東縣、花蓮縣。臺東縣（7）對，但花蓮縣、屏東縣其實並列第 3（都是 4 種），真正的第 2 名新北市（6 種）反而沒被列進去，顯示連「從查到的幾筆裡挑哪幾筆講」這一步都不穩定。

這是跑完整批對照才浮現的新坑，第三節沒踩到：**就算 Cypher 語法正確、也真的查到資料，「把查詢結果轉成一句人話」這一步，一樣會漏東西、會不精確。** 跟第四節的拒答話術坑不同，這次不是模型不敢講，是它敢講，但講得不完整。

---

## 踩雷筆記

- **`llama3.1` 抽繁中專有名詞會出現字元崩壞**：抽出來的縣市名變成「弰市」「钷国市」這種不存在的字。數字通常是對的，但名稱不能信。固定句型改用 regex。

- **regex 抓不到的時候，先確認是「沒有」還是「沒寫好」**：我一開始 15/18，以為那三章沒資料，實際查才發現瘧疾用的是「為高」不是「居冠」、HIV 用的是「人數」不是「發生率」。真正沒有的只有兩章。

- **抽取誤差會靜默進到圖裡**：國名前面黏著「感染地以」，載進 Neo4j 就變成一個新節點，查詢永遠對不上。建完圖一定要抽查幾筆再往下做。

- **修好一個雜訊，不代表雜訊消失**：連接詞黏字修完，Country 節點從 21 降到 16，我一開始以為乾淨了。實際點開節點清單，裡面還有「男性」「女性」這種性別統計，是抓取境外移入的正則往後抓太寬，把隔壁「性別」段落也一起吃了進來。數字對不代表內容對，每次都要真的點開清單看，不能只看筆數。

- **沒有 few-shot 的 Cypher 生成不能用**：本地模型會把 Cypher 當 SQL 寫，跑出 `GROUP BY` / `HAVING`。三個範例就能從 0/4 變 4/4。

- **靜態語法檢查抓不到語意錯誤**：`{cases: 100}` 這種憑空加的過濾條件語法完全合法，但查出來是空的。要真的跑過才算數。

- **prompt 裡不要寫拒答話術**：跟 Ep-3、Ep-4 同一個坑。查到 4 筆還說「查不到」，就是因為 prompt 裡有那句話。

---

## 小結

這篇把 Ep-5 的假設拿回來重驗一次：**Graph RAG 該贏的地方贏了，但贏的方式跟原本預期的不一樣。**

單跳題不是打平，向量 RAG 3 題只答對 1 題，錯的兩題一題查無資料、一題把數字接到錯的縣市。多跳題也不是「向量 RAG 答不出來、Graph RAG 全對」，Graph RAG 4 題全部查對了正確的實體，卻有 3 題在「把查詢結果轉成回答」這最後一步漏東西或不精確。

整條管線 4 個關卡，錯誤的性質完全不一樣：

1. **抽取**：LLM 抽繁中專有名詞會字元崩壞，改用 regex
2. **建圖**：抽取誤差會靜默進圖，國名前面黏著連接詞就變成一個新節點
3. **Text2Cypher**：沒有 few-shot 是 0/4，本地模型會把 Cypher 當 SQL 寫
4. **回答生成**：前三關都對，這一關還是會漏答、不精確，或照抄拒答話術

沒有一關可以跳過驗證，這也是為什麼這篇每一個數字都是真的跑出來的，錯誤全部留在文章裡，包括這篇最後一節才發現的新坑。呼應 [Ep-4 的核心教訓](/posts/langchain-與-llm-學習筆記-ep-4)：沒有評估機制，你不會知道哪一關壞了，只會看到最後的答案感覺還可以。

---

## 本篇程式碼

| 檔案 | 功能 |
| :--- | :--- |
| `extract_all.py` | 18 章 regex 抽取，產出結構化事實 |
| `build_graph.py` | 載進 Neo4j，建立 schema 與關係 |
| `query_graph.py` | 自然語言 → Cypher → 查詢 → 回答 |
| `compare.py` | 向量 RAG 與 Graph RAG 同題對打 |
| `why_vector_fails.py` | Ep-5 那個失敗實測 |

👉 **[GitHub：langchain-rag-lab / ep5_graph_rag](https://github.com/Peter-To-Better/langchain-rag-lab/tree/main/ep5_graph_rag)**

```bash
git clone https://github.com/Peter-To-Better/langchain-rag-lab.git
cd langchain-rag-lab && uv sync
ollama pull llama3.1 && ollama pull qwen3:8b && ollama pull nomic-embed-text
ollama create llama3.1-extract -f ep5_graph_rag/Modelfile.extract

docker run -d --name ep6-neo4j -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/graphrag123 neo4j:5

curl -L -o infection-report.pdf \
  "https://www.cdc.gov.tw/Uploads/infectionreport/5f6d88aa-760c-4f04-ba10-688c5479b2c1.pdf"

uv run python ep5_graph_rag/extract_all.py
uv run python ep5_graph_rag/build_graph.py
uv run python ep5_graph_rag/compare.py
```

---

## 系列導覽

- [Ep-0：LLM、LangChain、AI Agent 與 MCP 是什麼](/posts/langchain-與-llm-學習筆記-ep-0)：概念打底
- [Ep-1：RAG 入門，把八個步驟串成可跑的程式](/posts/langchain-與-llm-學習筆記-ep-1)：基本架構
- [Ep-2：進階檢索，混合檢索與 Reranking](/posts/langchain-與-llm-學習筆記-ep-2)：提升準確度
- [Ep-3：多模態 RAG，讓 LLM 讀懂含圖表 PDF](/posts/langchain-與-llm-學習筆記-ep-3)：處理圖片
- [Ep-4：用 RAGAS 驗證指標可不可信](/posts/langchain-與-llm-學習筆記-ep-4)：量化評估
- [Ep-5：Graph RAG 是什麼、為什麼爆紅](/posts/langchain-與-llm-學習筆記-ep-5)：概念與差異
- **Ep-6（本篇）**：Neo4j 知識圖譜實作

---

### 延伸閱讀

- [Neo4j Cypher 官方手冊](https://neo4j.com/docs/cypher-manual/current/)
- [microsoft/graphrag GitHub](https://github.com/microsoft/graphrag)
