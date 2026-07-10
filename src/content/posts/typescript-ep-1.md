---
title: "TypeScript 從 0 開始 Ep-1"
pubDate: 2025-02-10 16:32:00
description: "TypeScript 型別系統入門：string、number、boolean、any、unknown、void、never 各有什麼用途、any 和 unknown 差在哪？附完整範例說明每種型別的使用時機。"
author: "Peter"
tags: ["TypeScript"]
category: "TypeScript"
keywords: "TypeScript 型別系統, TypeScript 變數宣告, TypeScript any unknown 差別, TypeScript void never 教學, TypeScript string number boolean, 靜態型別檢查教學, TypeScript 基礎型別"
draft: false
---

# 本篇重點

TypeScript 是 JavaScript 的超集（Superset），它為 JavaScript 添加了靜態型別檢查和其他現代程式設計功能。透過 TypeScript，開發者可以在編譯階段就發現潛在的錯誤，提升程式碼的品質、可維護性和可讀性。在本篇中，會介紹 TypeScript 中的變數宣告與型別系統，包括 `number`、`string`、`boolean`、`any`、`unknown`、`void` 和 `never` 等型別。

<!-- more -->

# 變數與型別

TypeScript 的核心特性之一就是「型別系統」，它允許開發者在宣告變數時明確指定型別，避免許多常見的錯誤。我們將逐步介紹如何宣告變數、陣列和物件，並解釋一些常見的型別用法。

---

## 1. 變數宣告

在 TypeScript 中，變數的宣告方式與 JavaScript 類似，但多了型別註記（Type Annotation）。型別註記可以幫助開發者在編譯階段就發現型別錯誤。

```typescript
let age: number = 25; // 宣告一個數字型別的變數
const name: string = "John"; // 宣告一個字串型別的常數
let isStudent: boolean = true; // 宣告一個布林值型別的變數
```

### 補充說明：

- `let` vs `const`：`let` 允許變數被重新賦值，而 `const` 則用於宣告不可變的常數。TypeScript 會根據你的使用情境建議使用 `let` 或 `const`，這樣可以減少不必要的錯誤。
- **型別推論（Type Inference）**：如果你在宣告變數時直接賦值，TypeScript 會自動推論變數的型別，因此你可以省略型別註記。例如：
  ```typescript
  let age = 25; // TypeScript 會自動推論 age 為 number 型別
  const name = "John"; // TypeScript 會自動推論 name 為 string 型別
  ```

---

## 2. 陣列宣告

在 TypeScript 中，陣列的型別宣告有兩種方式，分別是使用 `型別[]` 或 `Array<型別>`。這兩種方式的效果是相同的，可以依照個人喜好或團隊規範來選擇。

```typescript
let numbers: number[] = [1, 2, 3, 4, 5]; // 宣告一個數字型別的陣列
let fruits: Array<string> = ["apple", "banana", "cherry"]; // 宣告一個字串型別的陣列
```

### 補充說明：

- **多型別陣列**：如果你需要一個陣列包含多種型別的元素，可以使用聯合型別（Union Types）：

  ```typescript
  let mixedArray: (number | string)[] = [1, "apple", 2, "banana"];

  function processInput(input: string | number): void {
    if (typeof input === "string") {
      console.log(input.toUpperCase());
    } else {
      console.log(input.toFixed(2));
    }
  }
  processInput("Hello World"); // HELLO WORLD
  processInput(3.14159); // 3.14
  ```

---

## 3. 物件宣告

TypeScript 中的物件型別可以明確指定每個屬性的型別，並且可以透過 `?` 來標記可選屬性。

```typescript
const products: { name: string; price?: number }[] = [
  { name: "apple", price: 100 },
  { name: "banana", price: 200 },
  { name: "grape" }, // price 是可選屬性，因此可以省略
];
console.log(products);
```

### 補充說明：

- **可選屬性（Optional Properties）**：使用 `?` 來標記可選屬性，表示該屬性可以存在也可以不存在。
- **型別別名（Type Aliases）**：如果物件結構較為複雜，可以使用 `type` 來定義型別別名，讓程式碼更易讀，在後面的章節也會再提到：

  ```typescript
  type Product = {
    name: string;
    price?: number;
  };

  const products: Product[] = [
    { name: "apple", price: 100 },
    { name: "banana", price: 200 },
    { name: "grape" },
  ];
  ```

---

## 4. 其他常見型別

除了基本的 `number`、`string`、`boolean` 之外，TypeScript 還提供了其他常見的型別：

### 4.1. `any` 型別

`any` 型別表示變數可以是任何型別，這會讓 TypeScript 跳過型別檢查。雖然在某些情況下很方便，但過度使用 `any` 會失去 TypeScript 的型別安全優勢。

```typescript
let data: any = "Hello";
data = 123; // 不會報錯，因為 data 是 any 型別
```

### 4.2. `unknown` 型別

`unknown` 是 TypeScript 3.0 引入的型別，它比 `any` 更安全。`unknown` 型別的變數在使用前必須進行型別檢查或斷言。

```typescript
let userInput: unknown;
userInput = "Hello";
if (typeof userInput === "string") {
  console.log(userInput.toUpperCase()); // 需要先檢查型別
}
```

### 4.3. `void` 型別

`void` 通常用於函式的回傳值，表示該函式不會回傳任何值。

```typescript
function logMessage(message: string): void {
  console.log(message);
}
```

### 4.4. `never` 型別

`never` 表示永遠不會發生的值，通常用於函式拋出錯誤或無窮迴圈的情況。

```typescript
function throwError(message: string): never {
  throw new Error(message);
}
```

---

### **結論**

在本篇中，我們介紹了 TypeScript 的基礎變數宣告與型別系統，包括：

- 變數的宣告與型別註記
- 陣列的兩種宣告方式
- 物件的型別定義與可選屬性
- 其他常見型別如 `any`、`unknown`、`void` 和 `never`

TypeScript 的型別系統不僅能幫助你在開發階段發現錯誤，還能提升程式碼的可讀性和維護性。在接下來的教學中，我們將深入探討更多 TypeScript 的高級功能，如介面（Interfaces）、泛型（Generics）等。

---

# 延伸閱讀

- [TypeScript 官方文件](https://www.typescriptlang.org/docs/)
- [TypeScript 型別推論與註記](https://www.typescriptlang.org/docs/handbook/type-inference.html)
- [TypeScript 中的聯合型別與交叉型別](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html)
