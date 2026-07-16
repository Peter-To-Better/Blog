---
title: "TypeScript 泛型與型別守衛教學｜TS 從 0 開始 Ep-4"
pubDate: 2025-02-18 20:59:32
description: "TypeScript 泛型（Generics）讓函式可重用不同型別、型別守衛（Type Guard）確保執行時安全，搭配 ES6 import/export 模組系統完整教學與範例。"
author: "Peter"
tags: ["TypeScript", "前端", "型別", "泛型"]
category: "TypeScript"
keywords: "TypeScript Generics 教學, TypeScript 泛型是什麼, Type Guard 教學, TypeScript typeof instanceof, TypeScript ES6 Modules, import export TypeScript, TypeScript 泛型函式"
draft: false
---

## 本篇重點

在上一篇教學中，我們介紹了 TypeScript 中的**Enums（列舉）** 和 **Tuples（元組）**，這些功能幫助，能夠幫助你更精確地定義資料結構與型別，接下來本我們繼續進一步探討 TypeScript 中的 Generics（泛型）、Type Guarding（型別守衛） 以及 ES6 Modules（模組系統）。

<!-- more -->

---

## Generics（泛型）

Generics 是 TypeScript 中的一種進階型別功能，它允許你撰寫可重複使用的程式碼，同時保持型別的安全性，泛型可以讓我們定義一個函式、介面或類別，能夠處理多種型別，而不需要針對每一種型別都寫一份獨立的程式碼。

### 1. 基本泛型函式

最簡單的泛型應用是在函式中，可以使用泛型來定義一個函式，讓它能夠接受任意型別的參數，並回傳相同型別的值。

```typescript
function identity<T>(arg: T): T {
  return arg;
}

let output1 = identity<string>("Hello");
console.log(output1); // "Hello"

let output2 = identity<number>(42);
console.log(output2); // 42
```

在這個範例中，`T` 是一個型別變數（Type Variable），它會在函式被呼叫時動態決定型別。

### 2. 泛型介面

泛型也可以應用在介面中，讓介面能夠處理多種型別的資料。

```typescript
interface KeyValuePair<K, V> {
  key: K;
  value: V;
}

let pair1: KeyValuePair<string, number> = { key: "age", value: 25 };
let pair2: KeyValuePair<number, boolean> = { key: 1, value: true };

console.log(pair1); // { key: "age", value: 25 }
console.log(pair2); // { key: 1, value: true }
```

### 3. 泛型類別

類別也可以使用泛型，讓類別的屬性和方法能夠處理多種型別。

```typescript
class Box<T> {
  private content: T;

  constructor(value: T) {
    this.content = value;
  }

  getValue(): T {
    return this.content;
  }
}

let box1 = new Box<string>("TypeScript");
console.log(box1.getValue()); // "TypeScript"

let box2 = new Box<number>(100);
console.log(box2.getValue()); // 100
```

### 4. 泛型約束（Generic Constraints）

如果希望泛型只能接受特定型別或符合某些條件的型別，可以使用泛型約束來限制型別。

```typescript
interface Lengthwise {
  length: number;
}

function logLength<T extends Lengthwise>(arg: T): void {
  console.log(arg.length);
}

logLength("Hello"); // 5
logLength([1, 2, 3]); // 3
logLength({ length: 10 }); // 10
```

在這個範例中，`T` 必須符合 `Lengthwise` 介面，也就是說必須具有 `length` 屬性才符合 `Lengthwise` 的定義規則。

---

## Type Guarding（型別守衛）

Type Guarding 是用來在執行時期檢查型別的一種機制，它能夠幫助我們更安全地處理不同型別的資料。

### 1. `typeof` 型別守衛

`typeof` 可以用來檢查基本型別（如 `string`、`number`、`boolean` 等）。

```typescript
function printValue(value: string | number) {
  if (typeof value === "string") {
    console.log(`String value: ${value}`);
  } else {
    console.log(`Number value: ${value}`);
  }
}

printValue("Hello"); // String value: Hello
printValue(42); // Number value: 42
```

### 2. `instanceof` 型別守衛

`instanceof` 可以用來檢查某個物件是否屬於某個類別。

```typescript
class Dog {
  bark() {
    console.log("Woof!");
  }
}

class Cat {
  meow() {
    console.log("Meow!");
  }
}

function handleAnimal(animal: Dog | Cat) {
  if (animal instanceof Dog) {
    animal.bark();
  } else {
    animal.meow();
  }
}

handleAnimal(new Dog()); // Woof!
handleAnimal(new Cat()); // Meow!
```

---

### 3. 自定義型別守衛

我們可以透過自訂函式來實現更精確的型別判斷。例如，判斷一個物件是 `Fish` 還是 `Bird`：

```typescript
interface Fish {
  swim(): void;
}

interface Bird {
  fly(): void;
}

function isFish(pet: Fish | Bird): pet is Fish {
  return typeof (pet as Fish).swim === "function";
}

function handlePet(pet: Fish | Bird) {
  if (isFish(pet)) {
    pet.swim(); // TypeScript 會推斷 pet 為 Fish
  } else {
    pet.fly(); // pet 一定是 Bird
  }
}
```

### **解釋說明**

#### **1. 型別守衛函式**

`isFish(pet: Fish | Bird): pet is Fish` 是一個型別守衛 (Type Guard)，它的作用是：

- 當回傳 `true` 時，TypeScript 會認定 `pet` 是 `Fish`
- 當回傳 `false` 時，`pet` 只能是 `Bird`

#### **2. 型別判斷邏輯**

```typescript
return typeof (pet as Fish).swim === "function";
```

- **如果 `pet` 具有 `swim` 方法**，它就是 `Fish`
- **如果 `pet` 沒有 `swim` 方法**，則它一定是 `Bird`

#### **3. 安全地使用型別**

```typescript
if (isFish(pet)) {
  pet.swim(); // 確保可以調用 swim()
} else {
  pet.fly(); // 確保可以調用 fly()
}
```

透過 `isFish(pet)`，TypeScript 能正確推斷 `pet` 的型別，使程式更安全。

---

## ES6 Modules（模組系統）

ES6 Modules 是 JavaScript 的模組化標準，TypeScript 完全支援 ES6 Modules，讓我們能夠將程式碼拆分為多個檔案，並透過匯入與匯出的方式來組織程式碼。

### 1. 匯出與匯入

使用 `export` 關鍵字來匯出變數、函式或類別，並使用 `import` 關鍵字來匯入，這樣可以方便的管理。

```typescript
// math.ts
export function add(a: number, b: number): number {
  return a + b;
}

export const PI = 3.14;

// main.ts
import { add, PI } from "./math";

console.log(add(1, 2)); // 3
console.log(PI); // 3.14
```

### 2. 預設匯出

每個模組可以有一個預設匯出（Default Export），使用 `export default` 語法。

```typescript
// logger.ts
export default function log(message: string): void {
  console.log(message);
}

// main.ts
import log from "./logger";

log("Hello, TypeScript!"); // Hello, TypeScript!
```

### 3. 重新匯出

我們可以在一個模組中重新匯出其他模組的內容。

```typescript
// utils.ts
export function multiply(a: number, b: number): number {
  return a * b;
}

// index.ts
export { multiply } from "./utils";

// main.ts
import { multiply } from "./index";

console.log(multiply(2, 3)); // 6
```

---

### **結論**

在本篇中，我們深入探討了 TypeScript 中的 **Generics（泛型）**、**Type Guarding（型別守衛）** 以及 **ES6 Modules（模組系統）**，包括：

- 泛型函式、泛型介面與泛型類別的定義與使用。
- 型別守衛的應用（`typeof`、`instanceof` 與自定義型別守衛）。
- ES6 Modules 的匯出、匯入與模組化組織。

這些功能能夠幫助你撰寫更具彈性、安全性與模組化的程式碼。

---

## 延伸閱讀

- [TypeScript 官方文件 - Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [TypeScript 官方文件 - Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript 官方文件 - Modules](https://www.typescriptlang.org/docs/handbook/modules.html)

---

## 系列文章導覽

- 上一篇：[TypeScript 從 0 開始 Ep-3：Enums 與 Tuples](/posts/typescript-ep-3)
- 下一篇：[TypeScript 從 0 開始 Ep-5：裝飾器、命名空間與 Utility Types](/posts/typescript-ep-5)

---
