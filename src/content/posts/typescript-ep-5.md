---
title: "TypeScript 從 0 開始 Ep-5"
pubDate: 2025-02-19 11:34:49
description: "TypeScript 進階功能：Decorator 裝飾器語法與應用場景、Namespace 命名空間，以及 Partial、Required、Pick、Omit 等 Utility Types 實用教學。"
author: "Peter"
tags: ["TypeScript", "前端", "型別", "進階"]
category: "TypeScript"
keywords: "TypeScript Decorator 教學, TypeScript 裝飾器是什麼, TypeScript Namespace 教學, TypeScript Utility Types, Partial Required Pick Omit 教學, TypeScript 進階功能, TypeScript 裝飾器範例"
draft: false
---

## 本篇重點

在上一篇教學中，我們介紹了 TypeScript 中的 Generics（泛型）、Type Guarding（型別守衛） 以及 ES6 Modules（模組系統），，接下來本我們繼續進一步探討 TypeScript 中的 **Decorators（裝飾器）**、**Namespaces（命名空間）** 以及 **Utility Types（實用型別）**。

<!-- more -->

---

## Decorators（裝飾器）

裝飾器是 TypeScript 中的一種特殊語法，它允許我們在不修改原始程式碼的情況下，為類別、方法、屬性或參數添加額外的功能。

### 1. 類別裝飾器

類別裝飾器用於修改或擴展類別的行為，它是一個函式，接受類別的建構函式作為參數。

```typescript
function logClass(target: Function) {
  console.log(`Class ${target.name} is created.`);
}

@logClass
class MyClass {
  constructor() {
    console.log("MyClass instance created.");
  }
}

const instance = new MyClass();
// 輸出：
// Class MyClass is created.
// MyClass instance created.
```

### 2. 方法裝飾器

方法裝飾器用於修改或擴展類別中的方法，它接受三個參數：類別的原型、方法名稱以及方法的屬性描述。

```typescript
function logMethod(target: any, key: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    console.log(
      `Calling method ${key} with arguments: ${JSON.stringify(args)}`
    );
    const result = originalMethod.apply(this, args);
    console.log(`Method ${key} returned: ${result}`);
    return result;
  };

  return descriptor;
}

class Calculator {
  @logMethod
  add(a: number, b: number): number {
    return a + b;
  }
}

const calc = new Calculator();
calc.add(2, 3);
// 輸出：
// Calling method add with arguments: [2,3]
// Method add returned: 5
```

### 3. 屬性裝飾器

屬性裝飾器用於修改或擴展類別中的屬性，它接受兩個參數：類別的原型以及屬性的名稱。

```typescript
function logProperty(target: any, key: string) {
  let value = target[key];

  const getter = function () {
    console.log(`Getting value of property ${key}: ${value}`);
    return value;
  };

  const setter = function (newVal: any) {
    console.log(`Setting value of property ${key} to: ${newVal}`);
    value = newVal;
  };

  Object.defineProperty(target, key, {
    get: getter,
    set: setter,
    enumerable: true,
    configurable: true,
  });
}

class User {
  @logProperty
  name: string;

  constructor(name: string) {
    this.name = name;
  }
}

const user = new User("Alice");
user.name = "Bob";
console.log(user.name);
// 輸出：
// Setting value of property name to: Bob
// Getting value of property name: Bob
// Bob
```

---

## Namespaces（命名空間）

命名空間是 TypeScript 中用於組織程式碼的一種方式，它可以幫助我們避免全域變數的污染，並將相關的程式碼組織在一起，命名空間類似於模組，但它們的語法和用途有所不同。

### 1. 基本命名空間

使用 `namespace` 關鍵字來定義一個命名空間，並使用 `export` 關鍵字來匯出命名空間中的內容。

```typescript
namespace MyNamespace {
  export function greet(name: string): string {
    return `Hello, ${name}!`;
  }

  export const PI = 3.14;
}

console.log(MyNamespace.greet("Alice")); // Hello, Alice!
console.log(MyNamespace.PI); // 3.14
```

### 2. 嵌套命名空間

命名空間可以嵌套使用，以進一步組織程式碼。

```typescript
namespace OuterNamespace {
  export namespace InnerNamespace {
    export function greet(name: string): string {
      return `Hello, ${name}!`;
    }
  }
}

console.log(OuterNamespace.InnerNamespace.greet("Bob")); // Hello, Bob!
```

### 3. 命名空間與模組的區別

雖然命名空間和模組都可以用來組織程式碼，但它們的使用場景有所不同：

- **命名空間**：適合用於小型專案或需要避免全域變數污染的場景。
- **模組**：適合用於大型專案或需要與其他工具（如 Webpack、Rollup）整合的場景。

---

## Utility Types（實用型別）

TypeScript 提供了一些內建的實用型別，這些型別可以幫助我們更靈活地處理型別轉換與操作。

### 1. `Partial<T>`

`Partial<T>` 可以將型別 `T` 的所有屬性設為可選。

```typescript
interface User {
  name: string;
  age: number;
}

type PartialUser = Partial<User>;

const user: PartialUser = {
  name: "Alice",
};
```

### 2. `Required<T>`

`Required<T>` 可以將型別 `T` 的所有屬性設為必填。

```typescript
interface User {
  name?: string;
  age?: number;
}

type RequiredUser = Required<User>;

const user: RequiredUser = {
  name: "Alice",
  age: 25,
};
```

### 3. `Readonly<T>`

`Readonly<T>` 可以將型別 `T` 的所有屬性設為唯讀。

```typescript
interface User {
  name: string;
  age: number;
}

type ReadonlyUser = Readonly<User>;

const user: ReadonlyUser = {
  name: "Alice",
  age: 25,
};

user.name = "Bob"; // 錯誤：無法指派給唯讀屬性
```

### 4. `Pick<T, K>`

`Pick<T, K>` 可以從型別 `T` 中挑選出指定的屬性 `K`。

```typescript
interface User {
  name: string;
  age: number;
  email: string;
}

type UserNameAndAge = Pick<User, "name" | "age">;

const user: UserNameAndAge = {
  name: "Alice",
  age: 25,
};
```

### 5. `Omit<T, K>`

`Omit<T, K>` 可以從型別 `T` 中排除指定的屬性 `K`。

```typescript
interface User {
  name: string;
  age: number;
  email: string;
}

type UserWithoutEmail = Omit<User, "email">;

const user: UserWithoutEmail = {
  name: "Alice",
  age: 25,
};
```

---

### **結論**

在本篇中，我們深入探討了 TypeScript 中的 **Decorators（裝飾器）**、**Namespaces（命名空間）** 以及 **Utility Types（實用型別）**，包括：

- 裝飾器的基本用法與應用場景。
- 命名空間的定義與使用。
- 實用型別的介紹與範例。

---

## 延伸閱讀

- [TypeScript 官方文件 - Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)
- [TypeScript 官方文件 - Namespaces](https://www.typescriptlang.org/docs/handbook/namespaces.html)
- [TypeScript 官方文件 - Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)

---

## 系列文章導覽

- 上一篇：[TypeScript 從 0 開始 Ep-4：泛型、型別守衛與模組系統](/posts/typescript-ep-4)

---
