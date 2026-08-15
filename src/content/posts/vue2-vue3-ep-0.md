---
title: "Vue 入門教學：指令、綁定與 Todo List 實作｜Vue2+Vue3 Ep-0"
pubDate: 2023-08-02 11:13:26
description: "Vue 入門教學：雙向數據綁定、v-if 條件渲染、v-for 列表渲染、v-on 事件綁定一次學會，最後從零實作一個 Todo List，Vue2 與 Vue3 語法對照。"
author: "Peter"
tags: ["Vue2 + Vue3", "Vue", "Vue3", "前端框架"]
category: "Vue"
keywords: "Vue2, Vue3, 前端框架, 雙向數據綁定, Vue基礎, 條件渲染, 事件綁定, 屬性綁定, 循環渲染, 雙向綁定, Todo List 範例"
draft: false
---

## 為何學習 Vue

Vue 是三大前端框架（Vue、React、Angular）中學習門檻較低的一個選擇。因此當時我選擇 Vue 為我的首要前端框架。Vue 是一套輕量級、支援雙向數據綁定的框架，同時具備組件化開發、虛擬 DOM 等特點。

<!-- more -->

在許多 Vue 專案上我們還是有機會看到 Vue2 的身影，所以在深入研究 Vue3 之前，我們先從 Vue2 開始學習。

## Vue2 基本架構

首先，我們需要前往 Vue2 的官方網站 [https://v2.vuejs.org/](https://v2.vuejs.org/) 找到 CDN 引用，然後在我們的工作環境中創建一個資料夾，並使用 VSCode 或您習慣的編輯器開啟。在該資料夾內，我們可以創建一個名為 `.html` 的文件。

以下是示例的 HTML 文件結構，用於引入 Vue2：

```html
<!DOCTYPE html>
<html lang="zh-Hant-tw">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>創建Vue</title>
  </head>
  <body>
    <div id="app"></div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {},
      });
    </script>
  </body>
</html>
```

以上程式碼就能讓我們開始使用 Vue2 了。

<hr>

## 簡單的 Vue2 範例

讓我們透過一個簡單的例子來了解 Vue2 的基本用法。
在 `data` 屬性中定義了兩個資料：`msg` 和 `count`。這些數據可以透過雙大括號 `{{ }}` 進行資料綁定這個方法叫做插值語法，並顯示在 HTML 中，在這個範例的結構中，有一個 `div` 標籤，其中的 `id` 屬性被設定為 `app`，這是通過 `el` 屬性所實現的，這個 `el` 屬性的作用是將 Vue 實例與 HTML 中指定的元素進行綁定，這樣 Vue 就會管理這個元素及其內部的數據和行為。

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
  </head>

  <body>
    <div id="app">
      {{ msg }}
      <p>{{ count }}</p>
    </div>
    <script>
      const app = new Vue({
        el: "#app", // 將 Vue 控制的範圍限制在 id 為 "app" 的區域這裡不一定要叫 app但需要與想被Vue控制範圍的id名稱一樣
        data: {
          msg: "hello vue 2",
          count: 666,
        },
      });
    </script>
  </body>
</html>
```

執行解果：
![alt 執行解果](/images/vue-start-example.webp)

<hr>

## 插值(模板語法 Template Syntax)語法裡也能有運算子

基本規則：

1. 在插值使用的資料必須是有在 data 內的不然會出錯
2. 插值是可以使用表達式(運算式)，但不支持陳述式例如：if for 等等
3. 不能在標籤屬性中使用 `{{ }}` 插值只能在標籤內部使用。

```html
<p title="{{使用者名稱}}">我是P標籤</p>
// 錯誤示範
```

在插值內可以放入 js 的函式也可以放入表達式以下是個範例：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
  </head>

  <body>
    <div id="app">
      <p>{{ name }}</p>
      <p>{{ name.toUpperCase() }}</p>
      <p>{{ name + ' hello' }}</p>
      <p>{{ age >= 18 ? '成年' : '未成年' }}</p>
      <p>{{ friend.name }}</p>
      <p>{{ friend.desc }}</p>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          name: "peter",
          age: 18,
          friend: {
            name: "nick",
            desc: "love vue",
          },
        },
      });
    </script>
  </body>
</html>
```

執行解果：
![alt 執行解果](/images/vue-template-syntax.webp)

<hr>

## Vue 中的常用指令

在 Vue 中，根據不同的用途，指令可以分為以下六大類：

- 內容渲染指令（v-html、v-text）
- 條件渲染指令（v-show、v-if、v-else、v-else-if）
- 事件綁定指令（v-on）
- 屬性綁定指令（v-bind）
- 循環渲染指令（v-for）
- 雙向綁定指令（v-model）

指令是 Vue 開發中最基礎、最常用的知識點。

1. 內容渲染指令 v-html、v-text

- v-html:可以在 data 內給入 html tag 在使用 v-html 綁定在元素上，這個方法類似於 js 的 innerHTML。
- v-text:可以在 data 內給入文字在使用 v-text 綁定在元素上，這個方法類似於 js 的 innerText。
- 以下是個範例:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
  </head>

  <body>
    <div id="app">
      <div v-text="txt"></div>
      <div v-html="p"></div>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          txt: "Hello Vue",
          p: `<p>大家好</p>`,
        },
      });
    </script>
  </body>
</html>
```

執行解果：
![alt 執行解果](/images/v-html-v-text.webp)

<hr>

2. 條件渲染指令 v-show、v-if、v-else、v-else-if

條件渲染指令用於控制 DOM 顯示或隱藏，有兩種寫法分別是：

- v-show:
  1. 作用：控制元素顯示或隱藏
  2. 語法：v-show="true 或 false"true 表示顯示，false 則是隱藏
  3. 原理：使用 css 來控制顯示隱藏 display:none 或 block，可以打開開發人員工具可以看到如果是 false 元素上會有個行內樣式 display:none;
  4. 使用場景：適合用來頻繁切換顯示或隱藏
- v-if
  1. 作用：控制元素顯示或隱藏或條件渲染
  2. 語法：v-if="true 或 false"true 表示顯示，false 則是隱藏
  3. 原理：靠條件判斷來決定是否建立元素或移除元素
  4. 使用場景：適合不頻繁切換顯示或隱藏
- 範例如下：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
  </head>

  <body>
    <div id="app">
      <div v-show="flag">v-show</div>
      <div v-if="flag">v-if</div>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          flag: true, //可以在這裡修改成false關查v-show有沒有被加上display:none與v-if元素有沒有存在
        },
      });
    </script>
  </body>
</html>
```

因為現在都是 true 所以都可以被看見
執行解果：
![alt 執行解果](/images/v-if-v-show.webp)
條件渲染指令 v-if、v-else、v-else-if
在 vue 中的 v-if 就相當於 JavaScript 的 if，v-else 就相當於 else 依此類推...所以我們直接看範例：

```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
  <title>Document</title>
</head>

<body>
  <div id="app">
    <p v-if="gender === 1">性別：男</p>
    <p v-else>性別：女</p>
    <hr>
    <p v-if="sorce >= 90">電腦一台</pㄒ>
    <p v-else-if="sorce >= 70">獎金1000</p>
    <p v-else-if="sorce >= 60">飲料一杯</p>
    <p v-else>什麼都沒有</p>
  </div>
  <script>
    const app = new Vue({
      el: '#app',
      data: {
        gender: 2, // 如果值是1則會顯示性別：男
        sorce: 90 // 可以修改值觀察v-else-if 與 v-else的變化
      },
    })
  </script>
</body>

</html>
```

執行解果：
![alt 執行解果](/images/v-if-v-else-if-v-else.webp)

<hr>

3. 事件綁定指令 v-on
   當需要在 DOM 註冊事件時就可以使用 v-on 指令這裡我們就只示範最常使用的 click 事件其他的可以到官網看看[https://v2.vuejs.org/v2/guide/events](https://v2.vuejs.org/v2/guide/events)
   寫法如下：

```html
<button v-on:事件名稱="直接將動作放在內例如：count++">按鈕</button>
<button v-on:事件名稱="處理函式">按鈕</button>
<button v-on:事件名稱="處理函式(參數)">按鈕</button>
v-on: 簡寫為 @
```

以下兩個範例都可以完成點擊事件 v-on 可以改為@在接上事件名稱：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
  </head>

  <body>
    <div id="app">
      <button @click="count--">-</button>
      <span>{{ count }}</span>
      <button @click="count++">+</button>
      <button v-on:click="count--">-</button>
      <span>{{ count }}</span>
      <button v-on:click="count++">+</button>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          count: 100,
        },
      });
    </script>
  </body>
</html>
```

執行解果：
![alt 執行解果](/images/v-on-click.webp)
通常事件會結合 Vue 裡的 methods 做使用以下是個範例用來切換顯示或隱藏的功能：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
  </head>

  <body>
    <div id="app">
      <button @click="toggle">切換顯示隱藏</button>
      <h1 v-show="isShow">ShouRen</h1>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          isShow: false,
        },
        methods: {
          toggle() {
            this.isShow = !this.isShow; //而在methods中如果要使用data就需要使用this關鍵字來使用data內的值
          },
        },
      });
    </script>
  </body>
</html>
```

- methods: 在 Vue 中，methods 就是一些方法，也就是一些你自己定義的程式碼，主要用來執行特定的任務或操作。
- this: 把 Vue 想像成一位家長，而每個方法內的「this」，就像是你在家長指導下的手。這個手可以觸摸和處理家裡的不同物品（資料和屬性），同時也能夠進行各種動作（執行方法），這樣你就可以透過這隻手，與家裡的各種事物進行互動。
  執行解果：
  ![alt 執行解果](/images/showhide.webp)
  這裡再示範一下傳參數的方法:
  ```html
  <!DOCTYPE html>
  <html lang="en"></html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
  </head>
  <body>
    <div id="app">
      <button @click="handleClick('Button clicked!')">點擊我</button>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        methods: {
          handleClick(msg) {
            console.log(msg);
          },
        },
      });
    </script>
  </body>
  </html>
  ```
  <hr>

4. 屬性綁定指令 v-bind

- 作用：用來動態綁定標籤上的屬性：src url title class href ...等等
- 語法：v-bind:屬性名稱
- 縮寫：v-bind 可以簡寫成 :
  範例：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
  </head>

  <body>
    <div id="app">
      <img v-bind:src="imgurl1" v-bind:title="msg" alt="" />
      <img :src="imgurl1" :alt="imgurl1" />
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          msg: "a picture",
          imgurl1: "https://picsum.photos/id/1/400/300",
        },
      });
    </script>
  </body>
</html>
```

左邊是用 v-bind 的寫法右邊是縮寫效果都是一樣的執行解果：
![alt 執行解果](/images/v-bind.webp)
綜合以上的內容我們來做一個可以點選上一張照片及上一張照片的工能吧！
步驟說明：

1. 在 data 內放入圖片和索引值：在 data 屬性中定義了一個索引值 index 及一個圖片 URL 的陣列 imgList。

2. 使用 v-bind 將圖片動態綁定：使用 v-bind 指令來將圖片的 src 屬性綁定到 imgList[index]，完成動態更換圖片。

3. 點擊上下按鈕切換圖片：使用了 v-show 指令來控制上一頁和下一頁按鈕的顯示和隱藏，根據索引值的範圍來決定按鈕的可見性。並使用 @click（簡寫為 v-on:click）來綁定點擊事件，透過 index 的增減來切換圖片。
   程式碼範例如下：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
  </head>

  <body>
    <div id="app">
      <img :src="imgList[index]" alt="" />
      <div>
        <button v-show="index > 0" @click="index--">上一頁</button>
        <button v-show="index < imgList.length -1" @click="index++">
          下一頁
        </button>
      </div>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          index: 0,
          imgList: [
            "https://picsum.photos/id/1/400/300",
            "https://picsum.photos/id/2/400/300",
            "https://picsum.photos/id/3/400/300",
            "https://picsum.photos/id/4/400/300",
            "https://picsum.photos/id/5/400/300",
          ],
        },
      });
    </script>
  </body>
</html>
```

執行解果：
![alt 執行解果](/images/click-nextexample.webp)

<hr>

5. 循環渲染指令 v-for
   在 Vue 中我們可以很容易的操作迴圈只需要使用 v-for 指令就成完成

- 語法：

```html
<div v-for="(value, key) in array">{{value}}</div>
```

- value 是迭代過程中每次迭代到 array 的值
- key 迭代過程中 array 的鍵
  範例如下

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
  </head>

  <body>
    <div id="app">
      <ul>
        <li v-for="(value,key) in lists">{{ value }}--{{key}}</li>
      </ul>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          lists: ["apple", "banana", "guava"],
        },
      });
    </script>
  </body>
</html>
```

執行解果：
![alt 執行解果](/images/v-for.webp)
使用 v-for 迭代相同元素時，需要一種方式來追蹤每個迭代項目，這就是 key 屬性的作用。
key 屬性是用來區分不同迭代項目的唯一性，key 可以優化渲染更有效地檢測元素的變化，以及進行 DOM 更新和重用，如果你不加上 key，又在迴圈中有新增或修改資料時可能會在更新 DOM 時出現錯誤，因為它無法確定哪些元素需要更新，所以我們要加上 key 來當作依據。(通常都會使用後端給回來的 primary key 由於本主題沒有探討後端所以我們在 list 內自己創建 id)
接下來我們可以結合 mtehods 與 v-for 來做一個列表渲染與刪除的功能吧！

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
  </head>

  <body>
    <div id="app">
      <ul>
        <li v-for="(list, index) in lists" :key="list.id">
          {{ list.name }}--{{ list.gender }} -- {{ list.id}}
          <button @click="remove(index)">刪除</button>
        </li>
      </ul>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          lists: [
            { id: 1, name: "john", gender: "boy" },
            { id: 2, name: "emily", gender: "girl" },
            { id: 3, name: "michael", gender: "boy" },
            { id: 4, name: "susan", gender: "girl" },
            { id: 5, name: "david", gender: "boy" },
          ],
        },
        methods: {
          remove(index) {
            // this.lists = this.lists.filter(item => item.id !== this.lists[index].id);
            // 如果條件成立（即元素的 id 與 item.id 不相等）filter函數將保留這個元素，否則它將被從結果中排除也就是true保留false移除沒有例外這裡都是false因為是item.id跟lists[index].id做比對
            // 假如今天click點擊第二項
            // 第一次比較：工作項目的 id 是 1，與要刪除的工作的 id 2 不相同，所以條件是 true，這個工作項目會被保留。
            // 第二次比較：工作項目的 id 是 2，與要刪除的工作的 id 2 相同，所以條件是 false，這個工作項目會被過濾掉（刪除）。
            // 第三次比較：工作項目的 id 是 3，與要刪除的工作的 id 2 不相同，所以條件是 true，這個工作項目會被保留。
            // 第四次比較：工作項目的 id 是 4，與要刪除的工作的 id 2 不相同，所以條件是 true，這個工作項目會被保留。
            // 第五次比較：工作項目的 id 是 5，與要刪除的工作的 id 2 不相同，所以條件是 true，這個工作項目會被保留。

            this.lists.splice(index, 1);
            // 用splice是最快的刪除方法splice(當前的索引,刪除幾個)
          },
        },
      });
    </script>
  </body>
</html>
```

<hr>

6. 雙向綁定指令 v-model
   v-model 可以做到資料的雙向綁定何謂雙向綁定舉個例子有個 input 輸入匡我想要輸入後的內容可以存回 data 我們就可以使用雙向綁定來完成
   以下範例：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
  </head>

  <body>
    <div id="app">
      帳號：<input type="text" v-model="username" /><br />
      密碼：<input type="text" v-model="password" /><br />
      <button @click="login">登入</button>
      <button @click="reset">重置</button>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          username: "",
          password: "",
        },
        methods: {
          login() {
            console.log(this.username, this.password); // 點擊登入後可以開啟console.log看看username跟password的值已經被變更了
          },
          reset() {
            this.username = "";
            this.password = "";
          },
        },
      });
    </script>
  </body>
</html>
```

<hr>

## 綜合範例練習 Todo List:

功能：

- 可以新增項目
- 可以刪除項目
- 可以修改項目
- 可以看到項目的總數
- 可以清空所有項目

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
  </head>

  <body>
    <div id="app">
      <div v-if="editMode">
        <input v-model="editName" @keyup.enter="saveEdit" />
        <button @click="saveEdit">保存</button>
      </div>
      <div v-else>
        <input @keyup.enter="add" type="text" v-model="todoName" />
        <button @click="add">添加</button>
      </div>
      <ul>
        <li v-for="(list, index) in lists" :key="list.id">
          {{ index + 1 }} -- {{ list.name }}
          <button @click="del(index)">删除</button>
          <button @click="edit(index)">編輯</button>
        </li>
      </ul>
      <div v-show="lists.length > 0">
        <p>所有任務 {{ lists.length }} 項</p>
        <button @click="clear()">清空所有</button>
      </div>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          todoName: "",
          editName: "",
          editIndex: null,
          editMode: false,
          lists: [
            { id: 1, name: "睡覺" },
            { id: 2, name: "吃飯" },
            { id: 3, name: "打遊戲" },
          ],
        },
        methods: {
          del(index) {
            this.lists.splice(index, 1);
          },
          add() {
            if (this.todoName.trim() === "") {
              alert("請輸入任務");
              return;
            }
            this.lists.unshift({
              id: +new Date(),
              name: this.todoName,
            });
            this.todoName = "";
          },
          clear() {
            this.lists = [];
          },
          edit(index) {
            this.editIndex = index;
            this.editMode = true;
            this.editName = this.lists[index].name;
          },
          saveEdit() {
            if (this.editName.trim() === "") {
              alert("請輸入任務名稱");
              return;
            }
            this.lists[this.editIndex].name = this.editName;
            this.editMode = false;
            this.editName = "";
          },
        },
      });
    </script>
  </body>
</html>
```

---

## 系列文章導覽

- 下一篇：[Vue2 + Vue3 Ep-1：按鍵修飾符、樣式綁定與 Computed](/posts/vue2-vue3-ep-1)
