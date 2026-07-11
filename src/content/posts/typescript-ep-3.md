---
title: "TypeScript 從 0 開始 Ep-3"
pubDate: 2025-02-17 11:25:25
description: "TypeScript Enum 列舉與 Tuple 元組完整教學：什麼時候用 enum、const enum 效能差別、tuple 如何固定陣列型別，附實際開發中的應用範例。"
author: "Peter"
tags: ["TypeScript", "前端", "型別", "資料結構"]
category: "TypeScript"
keywords: "TypeScript Enum 教學, TypeScript Tuple 教學, TypeScript 列舉是什麼, Enum vs Union Type, TypeScript 元組用法, TypeScript 資料結構, const enum 教學"
draft: false
---

## 本篇重點

在上一篇教學中，我們介紹了 TypeScript 中的函式、介面與型別別名，這些功能幫助我們更好的組織程式碼並提升型別安全性，接下來本我們繼續進一步探討 TypeScript 中的 **Enums（列舉）** 和 **Tuples（元組）**，它們能夠幫助你更精確地定義資料結構與型別。

<!-- more -->

---

## Enums（列舉）

Enums 是 TypeScript 提供的一種特殊型別，用來定義一組具名的常數，Enums 可以讓程式碼更具可讀性。

### 1. 基本 Enums

最簡單的 Enums 就是數字列舉（Numeric Enums），它會自動為每個成員分配一個從 0 開始的數字值。

```typescript
enum Direction {
  North, // 0
  East, // 1
  South, // 2
  West, // 3
}

const currentDirection: Direction = Direction.North;
console.log(currentDirection); // 0
```

你也可以手動指定列舉成員的值：

```typescript
enum Direction {
  North = 1,
  East = 2,
  South = 3,
  West = 4,
}

const currentDirection: Direction = Direction.North;
console.log(currentDirection); // 1
```

### 2. 字串列舉（String Enums）

除了數字列舉，也能夠使用字串列舉來給，每個成員指定一個字串值。

```typescript
enum Direction {
  North = "NORTH",
  East = "EAST",
  South = "SOUTH",
  West = "WEST",
}

const currentDirection: Direction = Direction.North;
console.log(currentDirection); // "NORTH"
```

### 3. 混合列舉（Heterogeneous Enums）

TypeScript 也支援混合列舉，即列舉成員可以同時包含數字和字串值，但這種用法並不常見，通常建議保持列舉成員的一致性。

```typescript
enum MixedEnum {
  Num = 1,
  Str = "TWO",
}

console.log(MixedEnum.Num); // 1
console.log(MixedEnum.Str); // "TWO"
```

### 4. 常數列舉（Const Enums）

常數列舉是一種特殊的列舉，它會在編譯時被完全移除，並且在執行時不會產生任何額外的程式碼，只需要在 `enum` 前加上關鍵字 `const` 這可以減少程式碼的體積，但會失去一些列舉的動態特性。

```typescript
const enum Direction {
  North = 1,
  East = 2,
  South = 3,
  West = 4,
}

const currentDirection: Direction = Direction.North;
console.log(currentDirection); // 1
```

### 5. Enums 的應用場景

Enums 適合用來定義一組固定的值，例如：

- 方向（上、下、左、右）
- 狀態（進行中、已完成、已取消）
- 角色（管理員、編輯者、訪客）

---

## Tuples（元組）

Tuples 是 TypeScript 中的另一種特殊型別，它允許你定義一個固定長度的陣列，並且每個元素的型別可以不同，適合用來處理需要嚴格型別檢查的資料結構。

### 1. 基本 Tuples

Tuples 的宣告方式與陣列類似，但需要明確指定每個元素的型別。

```typescript
let user: [string, number, boolean] = ["John", 25, true];

console.log(user[0]); // "John"
console.log(user[1]); // 25
console.log(user[2]); // true
```

### 2. 可選元素

從 TypeScript 3.0 開始，Tuples 支援可選元素。你可以使用 `?` 來標記某個元素是可選的。

```typescript
let user: [string, number?, boolean?] = ["John"];

console.log(user[0]); // "John"
console.log(user[1]); // undefined
console.log(user[2]); // undefined
```

### 3. 剩餘元素（Rest Elements）

也支援剩餘元素，你可以將多個元素打包成一個陣列。

```typescript
let user: [string, ...number[]] = ["John", 1, 2, 3, 4];

console.log(user[0]); // "John"
console.log(user[1]); // 1
console.log(user[2]); // 2
```

### 4. Tuples 的應用場景

Tuples 非常適合用來處理以下情境：

- 函式回傳多個值
- 定義固定長度的資料結構（例如座標、RGB 顏色值）
- 處理需要嚴格型別檢查的資料

```typescript
function getCoordinates(): [number, number] {
  return [10, 20];
}

const [x, y] = getCoordinates();
console.log(x, y); // 10, 20
```

---

## Enums 與 Tuples 的比較

| 特性     | Enums                    | Tuples                                   |
| -------- | ------------------------ | ---------------------------------------- |
| 定義方式 | 使用 `enum` 關鍵字       | 使用 `[type1, type2, ...]` 語法          |
| 主要用途 | 定義一組具名的常數       | 定義固定長度的陣列，每個元素型別可以不同 |
| 型別檢查 | 嚴格檢查列舉成員的值     | 嚴格檢查每個元素的型別與順序             |
| 應用場景 | 方向、狀態、角色等固定值 | 函式回傳多個值、座標、RGB 顏色值等       |
| 可選元素 | 不支援                   | 支援（從 TypeScript 3.0 開始）           |
| 剩餘元素 | 不支援                   | 支援                                     |

---

### **結論**

在本篇中，我們深入探討了 TypeScript 中的 Enums 與 Tuples，包括：

- Enums 的基本使用、字串列舉、混合列舉與常數列舉
- Tuples 的基本使用、可選元素與剩餘元素
- Enums 與 Tuples 的應用場景與比較

這些功能能夠幫助你更精確的定義資料結構與型別，並提升程式碼的可讀性與安全性。

---

## 延伸閱讀

- [TypeScript 官方文件 - Enums](https://www.typescriptlang.org/docs/handbook/enums.html)
- [TypeScript 官方文件 - Tuples](https://www.typescriptlang.org/docs/handbook/2/objects.html#tuple-types)
- [TypeScript 中的 Enums 與 Tuples 應用實例](https://www.typescriptlang.org/docs/handbook/advanced-types.html)

---

## 系列文章導覽

- 上一篇：[TypeScript 從 0 開始 Ep-2：函式、介面與型別別名](/posts/typescript-ep-2)
- 下一篇：[TypeScript 從 0 開始 Ep-4：泛型、型別守衛與模組系統](/posts/typescript-ep-4)

---
