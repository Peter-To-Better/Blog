# peter-to-better.com

Astro 部落格。文章放 `src/content/posts/*.md`，圖片放 `public/images/`。

發布流程、frontmatter 規則（title 長度、description 寫法、keywords 組數）
在 `.claude/skills/new-post/SKILL.md`，要發文時走那支 skill，不要在這裡重複一份。

---

## 配套程式碼 repo

**`~/langchain-rag-lab/`**（GitHub: [Peter-To-Better/langchain-rag-lab](https://github.com/Peter-To-Better/langchain-rag-lab)）
是「LangChain & LLM」系列所有文章的配套程式碼，一集一個資料夾：

| 資料夾 | 對應文章 |
| :--- | :--- |
| `ep1_basic_rag/` | Ep-1 RAG 入門（報稅 PDF） |
| `ep2_advanced_retrieval/` | Ep-2 進階檢索（勞動基準法） |
| `ep3_multimodal_rag/` | Ep-3 多模態 RAG（疾管署年報麻疹章節） |
| `ep4_evaluation/` | Ep-4 RAGAS 評估（六組設定對照） |

寫這個系列的文章時要注意：

- **文章裡的每個數字、每段輸出，都必須是那個 repo 真的跑出來的。** 不要寫預期值或示意值，做不到就不要寫那段。
- 文章引用程式碼一律連 GitHub（`blob/main/...`），而且**要先 push 才發文**，否則讀者點進去是 404（已經發生過一次）。
- 改完 repo 記得 commit + push，文章跟程式碼要對得起來。
- 環境坑（例如 `import ragas` 直接掛掉、Ollama context 爆掉會靜默卡住）要同時寫進 repo 的 README 和文章的「踩雷筆記」。

---

## 寫作規則

### 禁止使用破折號

**文章內文一律不准出現破折號。** 這是硬規則。

注意它有**兩種寫法**，只查其中一種會漏掉（本站就發生過：只查 `——` 結果漏掉 487 個 ` — `）：

| 寫法 | 字元 | 出現在 |
| :--- | :--- | :--- |
| `——` | 兩個 U+2014 | LangChain 系列 |
| ` — ` | 空格 + 單個 U+2014 + 空格 | Harness、OpenSpec 系列 |

**檢查指令要一次抓全部**，不要只 grep `——`：

```bash
# 列出所有破折號類字元（程式碼區塊內的不算違規，要自己判斷）
python3 -c "
import glob,unicodedata
for f in glob.glob('src/content/posts/*.md'):
    infence=False
    for i,l in enumerate(open(f,encoding='utf-8').read().split('\n'),1):
        if l.lstrip().startswith('\`\`\`'): infence = not infence
        if not infence and any(unicodedata.category(c)=='Pd' and c!='-' for c in l):
            print(f'{f}:{i}  {l.strip()[:90]}')
"
```

**程式碼區塊（``` 圍起來的）裡的破折號不用改**，那是範例輸出、目錄樹、shell 註解的原始內容，改了就失真。

破折號很好用，所以會被濫用。一段話裡塞兩三個，讀者的節奏會被切碎，而且它常常是在
掩蓋「這兩個句子的關係我沒想清楚」。改寫時**先問破折號在做什麼事**，再換成對的標點：

| 破折號原本在做什麼 | 改成 | 範例 |
| :--- | :--- | :--- |
| 後面是在解釋前面 | `：` | ~~它的形式很固定——給兩段文字~~ → 它的形式很固定：給兩段文字 |
| 後面是獨立的下一句 | `。` | ~~這不是巧合——這兩組的檢索內容本來就相同~~ → 這不是巧合。這兩組的檢索內容本來就相同 |
| 只是順接、語氣沒斷 | `，` | ~~而且關鍵在於——如果我沒做評估~~ → 而且關鍵在於，如果我沒做評估 |
| 補充說明，拿掉也通順 | `（）` | ~~寫「實際上是彰化縣」——等於承認一致——然後投 0~~ → 寫「實際上是彰化縣」（等於承認一致），然後投 0 |
| 條列項目的「標題：說明」 | `：` | ~~[Ep-1 RAG 入門](/posts/...)——基本架構~~ → [Ep-1 RAG 入門](/posts/...)：基本架構 |

**不要只是把 `——` 刪掉**，那會留下語意不通的句子。每一個都要判斷它原本在做什麼。

兩個例外，不要誤刪：

- **外部連結標題裡的單破折號**，例如 `[RAGAS — List of available metrics](...)`。那是對方頁面的真實標題，照抄才對。
- **數字範圍**用 `~`，例如 `1~5`、`80~120`。不要寫成 `1–5`（en dash），同一篇裡要一致。

### 其他

- 用「你」直接對讀者說話，不要用「我們」當主詞講抽象的事。
- 數字、指令、輸出一律用實際跑出來的，不要寫預期值或示意值。做不到就不要寫那段。
- 技術名詞第一次出現要解釋（例：NLI、Average Precision），不能只丟英文縮寫。
- 舉例要用本篇自己的語料，不要搬套件文件裡的範例（讀者不知道那是哪來的）。

---

## 外部連結

`src/plugins/rehype-external-links.mjs` 會在 build 時自動幫站外連結加上
`target="_blank"` 和 `rel="noopener"`，**不要在 Markdown 裡自己寫 HTML `<a>` 標籤**。

刻意不加 `noreferrer`：要讓被引用的專案在自己的分析後台看得到流量來自本站。

---

## 發文前檢查

```bash
grep -n '——' src/content/posts/<檔名>.md   # 必須沒有輸出
npm run build                                # 必須通過
```

外部連結逐一驗證非 404（引用 GitHub 檔案時特別容易中招，因為程式碼可能還沒 push）：

```bash
grep -ohE 'https?://[^)"< ]+' src/content/posts/<檔名>.md | sed 's/[),.]*$//' | sort -u |
  while read -r u; do echo "$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 20 "$u")  $u"; done
```
