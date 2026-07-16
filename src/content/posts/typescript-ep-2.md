---
title: "TypeScript Interface 與 Type Alias 差異教學｜TS 從 0 開始 Ep-2"
pubDate: 2025-02-16 09:34:52
description: "TypeScript 函式型別、Interface 介面與 Type Alias 型別別名完整教學，搞懂 interface vs type 的使用時機與差異，讓物件型別定義更清晰。"
author: "Peter"
tags: ["TypeScript", "前端", "型別", "Interface"]
category: "TypeScript"
keywords: "TypeScript 函式教學, TypeScript Interface 教學, TypeScript Type Alias 差別, interface vs type 差別, TypeScript 函式型別, TypeScript 物件型別, TypeScript 進階型別"
draft: false
---

## 本篇重點

在上一篇教學中，我們介紹了 TypeScript 的基礎變數宣告與型別系統，包括 `number`、`string`、`boolean`、`any`、`unknown`、`void` 和 `never` 等型別。本篇將進一步探討 TypeScript 中的 **函式（Functions）**、**介面（Interfaces）** 以及 **型別別名（Type Aliases）**，這些功能能夠幫助你更好地組織程式碼並提升型別安全性。

<!-- more -->

## 函式（Functions）

TypeScript 中的函式與 JavaScript 的函式非常相似，但多了型別註記的功能，我們可以為函式的參數和回傳值指定型別，來確保函式的輸入和輸出符合預期。

---

## 1. 函式的基本宣告

在 TypeScript 中，函式的宣告方式與 JavaScript 類似，但可以為參數和回傳值加上型別註記。

```typescript
function add(a: number, b: number): number {
  return a + b;
}

const result = add(5, 10); // result 的型別會被推論為 number
console.log(result); // 15
```

### 補充說明：

- **參數型別註記**：函式的每個參數都可以指定型別，這樣可以避免傳入錯誤型別的參數。
- **回傳值型別註記**：函式的回傳值也可以指定型別，這樣可以確保函式回傳的值符合預期。如果函式沒有回傳值，可以使用 `void` 型別。

---

## 2. 可選參數與預設值

在 TypeScript 中，函式的參數可以是可選的（Optional），也可以設定預設值。

### 2.1 可選參數

使用 `?` 來標記可選參數，表示該參數可以傳入也可以不傳入。

```typescript
function greet(name: string, age?: number): string {
  if (age) {
    return `Hello, ${name}! You are ${age} years old.`;
  } else {
    return `Hello, ${name}!`;
  }
}

console.log(greet("John")); // Hello, John!
console.log(greet("John", 25)); // Hello, John! You are 25 years old.
```

### 2.2 預設值

也可以為函式的參數設定預設值，這樣當參數沒有傳入時，會使用預設值。

```typescript
function greet(name: string, age: number = 18): string {
  return `Hello, ${name}! You are ${age} years old.`;
}

console.log(greet("John")); // Hello, John! You are 18 years old.
console.log(greet("John", 25)); // Hello, John! You are 25 years old.
```

---

## 3. 剩餘參數（Rest Parameters）

如果你希望函式可以接受任意數量的參數，可以使用剩餘參數（Rest Parameters）。剩餘參數會將所有傳入的參數打包成一個陣列。

```typescript
function sum(...numbers: number[]): number {
  return numbers.reduce((acc, curr) => acc + curr, 0);
}

console.log(sum(1, 2, 3)); // 6
console.log(sum(1, 2, 3, 4, 5)); // 15
```

---

## 4. 函式型別（Function Types）

在 TypeScript 中，函式本身也可以作為一種型別。你可以使用函式型別來定義變數或參數的型別。

```typescript
type MathOperation = (a: number, b: number) => number;

const add: MathOperation = (a, b) => a + b;
const subtract: MathOperation = (a, b) => a - b;

console.log(add(5, 10)); // 15
console.log(subtract(10, 5)); // 5
```

---

## 介面（Interfaces）與型別別名（Type Aliases）

TypeScript 提供了兩種方式來定義自訂型別：**介面（Interfaces）** 和 **型別別名（Type Aliases）**。這兩者非常相似，但在某些情境下有不同的使用方式。

---

## 1. 介面（Interfaces）

介面是 TypeScript 中用來定義物件結構的一種方式。它可以幫助你確保物件符合特定的結構，並且可以重複使用。

### 1.1 基本介面

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

const user: User = {
  id: 1,
  name: "John",
  email: "john@example.com",
  isActive: true,
};

console.log(user);
```

### 1.2 可選屬性與唯讀屬性

- **可選屬性**：使用 `?` 來標記可選屬性。
- **唯讀屬性**：使用 `readonly` 來標記唯讀屬性。

```typescript
interface User {
  readonly id: number; // 唯讀屬性
  name: string;
  email?: string; // 可選屬性
}

const user: User = { id: 1, name: "John" };
user.name = "Jane"; // 可以修改
user.id = 2; // 錯誤：無法修改唯讀屬性
```

### 1.3 介面的擴展

介面可以透過 `extends` 關鍵字來擴展其他介面。

```typescript
interface Person {
  name: string;
  age: number;
}

interface Employee extends Person {
  employeeId: number;
}

const employee: Employee = {
  name: "John",
  age: 25,
  employeeId: 12345,
};

console.log(employee);
```

---

## 2. 型別別名（Type Aliases）

型別別名是另一種定義自訂型別的方式，它使用 `type` 關鍵字來定義。型別別名不僅可以用來定義物件結構，還可以用來定義聯合型別、交叉型別等。

### 2.1 基本型別別名

```typescript
type User = {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
};

const user: User = {
  id: 1,
  name: "John",
  email: "john@example.com",
  isActive: true,
};

console.log(user);
```

### 2.2 聯合型別與交叉型別

- **聯合型別（Union Types）**：表示一個值可以是多種型別之一。
- **交叉型別（Intersection Types）**：表示一個值必須同時滿足多種型別。

```typescript
type ID = number | string; // 聯合型別
type Person = { name: string };
type Employee = Person & { employeeId: number }; // 交叉型別

const id1: ID = 1;
const id2: ID = "123";
const employee: Employee = { name: "John", employeeId: 12345 };
```

---

## 3. 介面 vs 型別別名

介面和型別別名非常相似，但它們有一些關鍵區別：

- **擴展性**：介面可以使用 `extends` 來擴展，而型別別名則使用交叉型別來實現類似功能。
- **重複宣告**：介面可以重複宣告，TypeScript 會自動合併這些宣告；而型別別名不能重複宣告。
- **使用情境**：介面通常用於定義物件的結構，而型別別名更適合用於定義複雜的型別，如聯合型別或交叉型別。

### 範例：介面合併

```typescript
interface User {
  name: string;
}

interface User {
  age: number;
}

const user: User = {
  name: "John",
  age: 25,
};
```

用一個表格來快速的看出差別
| 特性 | 介面（Interfaces） | 型別別名（Type Aliases） |
|----------|------------------|----------------------|
| 定義方式 | 使用 `interface` 關鍵字 | 使用 `type` 關鍵字 |
| 擴展性 | 使用 `extends` 擴展其他介面 | 使用交叉型別（`&`）實現類似功能 |
| 重複宣告 | 可以重複宣告，TypeScript 會自動合併 | 不能重複宣告 |
| 適用情境 | 適合定義物件的結構 | 適合定義複雜型別，如聯合型別、交叉型別等 |
| 範例 | `interface User { name: string; }` | `type User = { name: string; }` |
| 合併行為 | 同名介面會自動合併 | 同名型別別名會報錯 |
| 函式型別 | 可以用來定義函式型別 | 也可以用來定義函式型別 |
| 可選屬性 | 支援可選屬性（`?`） | 支援可選屬性（`?`） |
| 唯讀屬性 | 支援唯讀屬性（`readonly`） | 支援唯讀屬性（`readonly`） |

---

### **結論**

在本篇中，我們深入探討了 TypeScript 中的函式、介面與型別別名，包括：

- 函式的型別註記、可選參數、預設值、剩餘參數與函式型別
- 介面的基本使用、可選屬性、唯讀屬性、介面的擴展
- 型別別名的基本使用、聯合型別與交叉型別
- 介面與型別別名的比較

這些功能能夠幫助你更好地組織程式碼並提升型別安全性。

---

## 延伸閱讀

- [TypeScript 官方文件 - 函式](https://www.typescriptlang.org/docs/handbook/functions.html)
- [TypeScript 官方文件 - 介面](https://www.typescriptlang.org/docs/handbook/interfaces.html)
- [TypeScript 官方文件 - 型別別名](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-aliases)
- [TypeScript 中的介面 vs 型別別名](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#differences-between-type-aliases-and-interfaces)

---

## 系列文章導覽

- 上一篇：[TypeScript 從 0 開始 Ep-1：變數宣告與型別系統](/posts/typescript-ep-1)
- 下一篇：[TypeScript 從 0 開始 Ep-3：Enums 與 Tuples](/posts/typescript-ep-3)

---
