---
title: "TypeScript 是什麼？與 JavaScript 差別＋Vite 建置｜TS 從 0 開始 Ep-0"
pubDate: 2025-02-10 16:32:00
description: "搞懂 TypeScript 和 JavaScript 的本質差別、為什麼前端工程師都在學 TS，並用 Vite 建立你的第一個 TypeScript 專案，附官方線上編輯器介紹。"
author: "Peter"
tags: ["TypeScript", "前端", "型別", "JavaScript"]
category: "TypeScript"
keywords: "TypeScript 是什麼, TypeScript 入門教學, JavaScript 和 TypeScript 差別, TypeScript 為什麼要學, Vite TypeScript 專案, TypeScript Playground, TypeScript 繁體中文教學"
draft: false
---

## 本篇重點

在這篇文章中，我們將介紹 JavaScript 和 TypeScript 的區別，為什麼你應該學習 TypeScript，並簡單解釋 TypeScript 的運作原理。如何使用 Vite 快速啟動一個 TypeScript 專案，並分享一個官方的 TypeScript 線上編輯平台。

<!-- more -->

## JavaScript vs TypeScript

**JavaScript** 是一個弱型別的語言，在開發中難免會遇到一些奇怪的 JavaScript 轉型特性，而導致在開發上出現一些奇怪的錯誤。以下是一些經典的型別問題範例：

1. 數字與字串相加：

```javascript
console.log(1 + "2"); // "12"
console.log("5" - 1); // 4
```

解釋:

1 + "2" 會被隱式轉型為字串相加，因此結果為 "12"。
"5" - 1 會轉型成數字，因此結果為 4。

2. NaN 的特性：

```javascript
console.log(NaN === NaN); // false
```

解釋:
NaN 是 JavaScript 中唯一一個不等於自身的值，使用 `Number.isNaN()` 檢查比較安全。

3. 雙等號與三等號的比較：

```javascript
console.log(0 == "0"); // true
console.log(0 === "0"); // false
```

解釋:

`==` 會進行型別轉換，所以 `0 == "0"` 為 true。
`===` 不會進行型別轉換，因此結果為 false。

3. typeof 過時行為：

```javascript
console.log(typeof null); // "object"
```

解釋:
這是 JavaScript 的歷史遺留問題，應該用 `value === null` 來判斷。

### 主要差異

| **比較項目** | **JavaScript**   | **TypeScript**     |
| ------------ | ---------------- | ------------------ |
| 型別         | 動態型別         | 靜態型別           |
| 學習起點     | 不需學習型別     | 需設定型別         |
| 錯誤檢測     | 在執行時錯誤曝露 | 在編譯時就提示錯誤 |
| 最終產出     | JavaScript       | JavaScript         |
| 型別安全     | 無型別檢查       | 嚴格型別檢查       |
| 副檔名       | .js 或 .jsx      | .ts .tsx           |

## 為什麼要學習 TypeScript

1. **提高開發效率：**

   - 在編譯時就能發現型別相關的錯誤
   - 減少執行時的意外錯誤
   - 更容易重構和維護程式碼

2. **提供好的編輯器支援：**

   - 智能提示更準確
   - 自動完成更智能
   - 重構工具更強大
   - 跳轉到定義功能更準確

3. **便於理解程式碼：**

   - 型別註解作為程式碼的文件
   - 更容易理解函數的輸入輸出
   - 更清晰的程式碼結構

4. **最終生成的輸出：**
   - 編譯後的 JavaScript 可在任何環境執行
   - 可以選擇編譯目標版本
   - 支援最新的 JavaScript 特性

## TypeScript 的運作原理

TypeScript 本身不能直接執行，它需要編譯成 JavaScript 才能在瀏覽器或任何 Node.js 環境中執行。過程如下：

1. **編譯階段：**

   - TypeScript 程式碼經過 TypeScript Compiler (tsc) 處理
   - 進行型別檢查
   - 移除型別相關的程式碼

2. **輸出階段：**

   - 產生純 JavaScript 程式碼
   - 可以選擇不同的 JavaScript 版本
   - 支援 Source Map 方便除錯

3. **執行階段：**
   - 在瀏覽器或 Node.js 環境中執行
   - 運作效能與原生 JavaScript 相同

## Vite 起 TypeScript 專案

以下範例是使用 vite 創建 react 搭配 ts 指令來源可以參考 [Vite 官方](https://vite.dev/guide/) ，不同的框架有對應的指令。

1. **初始化專案**

   ```bash
   pnpm create vite@latest my-typescript-project --template react-ts
   ```

2. **進入目錄**

   ```bash
   cd my-typescript-project
   ```

3. **安裝相依套件**

   ```bash
   pnpm install
   ```

4. **啟動專案**

   ```bash
   pnpm dev
   ```

### **TypeScript Configuration 檔案介紹與差異**

在 TypeScript 專案中，通常會有多個 `tsconfig` 檔案來針對不同環境（例如前端、後端或共用設定）進行設定。以下是 `tsconfig.app.json`、`tsconfig.node.json` 和 `tsconfig.json` 的詳細介紹與用途差異。

---

### **1. `tsconfig.json` (主設定檔)**

**作用**:

- 作為專案的根配置檔案，負責引用其他設定檔。
- 使用 `references` 將多個子專案設定檔連結起來，適合大型專案的 Monorepo 架構。

**範例與說明:**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

**重點設定:**

- `files`: 明確指定需要編譯的檔案，通常會為空，因為會交由子設定檔管理。
- `references`: 定義專案之間的引用，使 TypeScript 可以正確處理多專案建構。

**適用情境:**

- 用來管理多個子專案設定的入口點，提升編譯效能。

---

### **2. `tsconfig.app.json` (前端設定檔)**

**作用:**

- 為前端專案（例如 React 或 Next.js）提供專屬的 TypeScript 編譯設定。

**範例與說明:**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

**重點設定:**

- `target`: 設定編譯後的目標 JavaScript 語法版本為 `ES2020`。
- `lib`: 包含 `DOM` 和 `DOM.Iterable` 以支援前端瀏覽器環境。
- `jsx`: 設定為 `react-jsx`，以支援 React 相關語法。
- `moduleResolution`: 使用 `bundler` 模式，適合 Vite 等現代打包工具。
- `noEmit`: 禁止輸出編譯檔案，通常搭配 Bundler 使用。

**適用情境:**

- 前端專案使用的 TypeScript 設定檔，針對瀏覽器環境與 React 特性進行調整。

---

### **3. `tsconfig.node.json` (後端設定檔)**

**作用:**

- 為 Node.js 環境設計的 TypeScript 編譯設定。

**範例與說明:**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
```

**重點設定:**

- `target`: 設定為 `ES2022`，支援 Node.js 的最新特性。
- `lib`: 僅保留 `ES2023`，不需要前端環境的 DOM 相關型別。
- `module`: 設定為 `ESNext` 以支援現代模組語法。
- `moduleResolution`: 使用 `bundler` 模式，以相容現代 Node.js 打包工具。
- `noEmit`: 不輸出編譯結果，專注於型別檢查。
- `include`: 只包含後端設定檔 `vite.config.ts`。

**適用情境:**

- Node.js 專案使用的 TypeScript 設定檔，針對後端環境進行最佳化。

---

### **三者的主要差異與作用比較**

| **檔案名稱**         | **作用**                            | **環境** | **主要設定重點**  |
| -------------------- | ----------------------------------- | -------- | ----------------- |
| `tsconfig.json`      | 主設定檔，引用其他子設定檔          | 共用     | `references`      |
| `tsconfig.app.json`  | 前端設定檔，適用於 React 等前端專案 | 瀏覽器   | `jsx`, `lib: DOM` |
| `tsconfig.node.json` | 後端設定檔，適用於 Node.js 專案     | Node.js  | `lib: ES2023`     |

---

### **結論**

透過拆分多個 `tsconfig` 檔案，可以針對不同環境進行專屬設定，避免設定衝突並提升開發效率。這種架構特別適合大型專案和 Monorepo 結構，讓專案更具可維護性與彈性。

## 推薦的線上編輯器

想要在網路上不設置環境就開始寫 TypeScript，可以使用以下線上編輯器：

1. [TypeScript Playground](https://www.typescriptlang.org/play)

   - 官方線上編輯器
   - 支援即時編譯與錯誤提示
   - 可以選擇不同的 TypeScript 版本
   - 支援分享程式碼

2. [StackBlitz](https://stackblitz.com)
   - 提供完整的開發環境
   - 支援多種框架模板
   - 可以直接部署專案

---

## 系列文章導覽

- 下一篇：[TypeScript 從 0 開始 Ep-1：變數宣告與型別系統](/posts/typescript-ep-1)
