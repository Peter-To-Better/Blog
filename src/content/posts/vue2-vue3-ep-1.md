---
title: "Vue 鍵盤事件與修飾符教學｜Vue2+Vue3 Ep-1"
pubDate: 2023-08-08 16:03:07
description: "Vue 鍵盤事件與修飾符完整教學：keyup.enter 偵測 Enter 鍵、.stop .prevent .once 事件修飾符用法，附 Vue2 與 Vue3 語法差異對照與實作範例。"
author: "Peter"
tags: ["Vue2 + Vue3", "Vue", "Vue3", "前端框架"]
category: "Vue"
keywords: "Vue 按鍵修飾符, Vue keyup enter, Vue 事件修飾符教學, Vue2 Vue3 事件, v-on 修飾符"
draft: false
---

## Vue 按鍵指令與修飾符補充

之前我們有講過 click 現在我們來補充一些鍵盤上的事件與修飾符這邊我們就介紹 keyup 結合 enter 修飾符的用法，更多修飾符請看[https://v2.vuejs.org/v2/guide/events#Event-Modifiers](https://v2.vuejs.org/v2/guide/events#Event-Modifiers)。

<!-- more -->

- 語法：@keyup 或 v-bind:keyup
- 配合修飾符：@keyup.enter
- 範例中的方法：
  1. ff() 方法在每次鍵盤的 keyup 事件發生時都會被觸發。它會在控制台中記錄目前輸入框中的文字。
  2. fu(e) 方法在鍵盤的 keyup 事件中，只有當按下"Enter"鍵時才會被觸發。在這個方法內，使用 e.key 來判斷觸發事件的鍵是否為"Enter"，如果是的話，它會在控制台中記錄輸入框中的文字。
     以下為範例：

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
      <input @keyup="ff" v-model="username" type="text" />
      <input @keyup.enter="fu" v-model="username" type="text" />
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          username: "",
        },
        methods: {
          ff() {
            console.log("keyup", this.username);
          },
          fu(e) {
            if (e.key === "Enter") {
              console.log("enter", this.username);
            }
          },
        },
      });
    </script>
  </body>
</html>
```

而修飾符在 v-model 也有這裡我們介紹比較常用的兩種一個是.trim 與.number 寫法與＠click 差不多也是在指令後接上修飾符

- 語法：v-model.number="" v-model.trim=""
- 範例說明：
  1. 在範例中.trim 可以將使用者輸入的空白去除在綁定到 username 內這樣無論使用者輸入多少空白都能被過濾掉，而.number 則是可以直接將使用者輸入的數字轉為數值但如果使用者輸入的是文字他並不會出現錯誤除非有額外的判斷處理
  2. 在 click 上可以使用修飾符這裡舉例.stop 與.prevent 在 js 裡會有冒泡事件就可以使用.stop 來阻止冒泡而.prevent 則是用來阻止該元素的預設行為像範例中的連結本來會跳轉但加上後可以阻止跳轉

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
    <style>
      .father {
        background: lightblue;
        width: 300px;
        height: 300px;
      }
      .son {
        background: lightcoral;
        width: 100px;
        height: 100px;
      }
    </style>
  </head>

  <body>
    <div id="app">
      <h3>v-model .trim .number</h3>
      <input v-model.trim="username" type="text" />
      <input v-model.number="age" type="text" />

      <div @click="fatherFn" class="father">
        <div @click.stop="sonFn" class="son"></div>
      </div>
      <a @click.prevent href="https://google.com">google</a>
      <!-- .prevent相當於js裡的e.preventDefault()可以阻止事件預設行為 -->
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          username: "",
          age: "",
        },
        methods: {
          fatherFn() {
            alert("father click");
          },
          sonFn(e) {
            // 相當於vue得click.stop可以阻止冒泡
            // e.stopPropagation();
            alert("son click");
          },
        },
      });
    </script>
  </body>
</html>
```

<hr>

## Vue 樣式綁定

寫網頁沒有樣式是不可能的事而 vue 提供了動態樣是可以綁定在元素上

- 語法：v-bind:class="陣列/物件"或縮寫:class="陣列/物件"
- 陣列： `<div class="box" :class="[ 樣式名稱1, 樣式名稱2, 樣式名稱3 ]"></div>`
- 物件： `<div class="box" :class="{ 樣式名稱1: 布林值, 樣式名稱2: 布林值 }"></div>`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
    <style>
      .box {
        width: 200px;
        height: 200px;
        border: 1px solid #000;
      }

      .pink {
        background-color: pink;
      }

      .big {
        width: 400px;
        height: 400px;
      }
    </style>
  </head>

  <body>
    <div id="app">
      <div class="box" :class="{ pink: true , big: true }"></div>
      <div class="box" :class="['pink','big']"></div>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
      });
    </script>
  </body>
</html>
```

執行結果：
![alt 執行解果](/images/v-bind-class.png)
綜合之前學的我們使用 click 來做一個點擊加上樣式的功能

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
    <style>
      a.active {
        background-color: red;
        color: #fff;
      }

      ul {
        display: flex;
        list-style: none;
      }

      li {
        padding: 4px;
        font-size: 18px;
      }

      a {
        display: inline-block;
        color: #000;
        text-decoration: none;
        padding: 4px;
      }
    </style>
  </head>

  <body>
    <div id="app">
      <ul>
        <li
          v-for="(list,index) in lists"
          :key="list.id"
          @click="activeIndex = index"
        >
          <a href="#!" :class="{active:index === activeIndex}"
            >{{ list.name }}</a
          >
        </li>
      </ul>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          activeIndex: 0,
          lists: [
            { id: 1, name: "apple" },
            { id: 2, name: "banan" },
            { id: 3, name: "coffee" },
          ],
        },
      });
    </script>
  </body>
</html>
```

執行結果：
![alt 執行解果](/images/click-switch.gif)

除了 class 的綁定 Vue 也提供了行內樣式的綁定用法，用法則是
`:style="{width: '400px',height: '400px' , backgroundColor:'blue'}"`
這裡我們直接看範例：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2/dist/vue.js"></script>
    <title>Document</title>
    <style>
      .circle-container {
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background-color: #f0f0f0;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
      }
      .circle {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background-color: #409eff;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 16px;
        font-weight: bold;
        transition: all 0.5s;
      }
    </style>
  </head>
  <body>
    <div id="app">
      <div class="circle-container">
        <div
          class="circle"
          :style="{ width: circleSize + 'px', height: circleSize + 'px' }"
        >
          {{ circleSize }}
        </div>
      </div>
      <button @click="changeSize(50)">Small</button>
      <button @click="changeSize(100)">Medium</button>
      <button @click="changeSize(150)">Large</button>
    </div>

    <script>
      const app = new Vue({
        el: "#app",
        data: {
          circleSize: 100,
        },
        methods: {
          changeSize(newSize) {
            this.circleSize = newSize;
          },
        },
      });
    </script>
  </body>
</html>
```

執行結果：
![alt 執行解果](/images/click-circle-example.gif)

<hr>

## v-model 與表單元素的應用

v-model 可以用來雙向綁定而在別單中他們作用的類型不太一樣

- 輸入框 input:text -> value
- 文字區塊 textarea -> value
- 可復選框 input:check -> checked
- 單選框 input:radio -> checked
- 下拉選單 select -> value

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
      <input type="text" v-model="username" /><br />
      <input type="checkbox" v-model="isSingle" /><br />
      <input type="radio" v-model="gender" name="gender" value="1" />男
      <input type="radio" v-model="gender" name="gender" value="2" />女
      <br />
      <select v-model="cityId">
        <option value="101">台北</option>
        <option value="102">新北</option>
        <option value="103">桃園</option>
        <option value="104">宜蘭</option>
      </select>

      <br />
      <textarea v-model="desc" cols="30" rows="10"></textarea>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          username: "",
          isSingle: false,
          gender: "1",
          cityId: "102",
          desc: "",
        },
        methods: {},
      });
    </script>
  </body>
</html>
```

<hr>

## 什麼是計算屬性 Computed

計算屬性是一些數據，基於其他數據計算出來的，假設你有一個包含商品價格和數量的物件，你想要計算總價，那麼總價就是一個計算屬性，因為它的值依賴於價格和數量，計算屬性會依賴數據的變化來自動更新，也就是說數據變更才會被重新計算，避免了不必要的重複計算也能提高效能
computed 的使用方法與 data 是一樣的可以使用插值語法直接使用但要注意的是每個計算屬性都需要使用 return 將結果回傳
以下是個計算總數的範例：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
    <style></style>
  </head>

  <body>
    <div id="app">
      <ul>
        <li v-for="(list,index) in lists" :key="list.id">{{list.num}}</li>
      </ul>
      total{{ total }}
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          lists: [
            { id: 1, num: 6 },
            { id: 2, num: 2 },
            { id: 3, num: 5 },
          ],
        },
        computed: {
          total() {
            return this.lists.reduce((a, b) => a + b.num, 0);
          },
        },
      });
    </script>
  </body>
</html>
```

執行結果：
![alt 執行解果](/images/computed-total.png)

<hr>

## Computed VS Methods

- Computed 會去監聽傳入的值有沒有被改變如果沒有就不會再重新執行，達到緩存的效果對於計算相關操作使用 Computed 會對效能提高不少

- Methods 則是沒有緩存效果只要被呼叫則會執行

## Computed 的完整寫法

計算屬性在一般寫法只能讀取，如果要修改的話一般寫法是無法完成的，需要寫出完整的語法如下：

```html
computed: { 計算屬性名稱: { get(){ return 運算邏輯 }, set(修改值){ return
修改邏輯 } } }
```

這裡我們直接看範例：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
    <style></style>
  </head>

  <body>
    <div id="app">
      姓:<input type="text" v-model="firstName" /> 名:<input
        type="text"
        v-model="lastName"
      />
      <span>{{ fullName }}</span>
      <button @click="changeName">改名</button>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          firstName: "伍",
          lastName: "百",
        },
        methods: {
          changeName() {
            this.fullName = "瘦瘦仁";
          },
        },
        computed: {
          // fullName() {
          //   return this.firstName + this.lastName
          // }
          fullName: {
            get() {
              return this.firstName + this.lastName;
            },
            set(value) {
              console.log(value);
              // console.log(value.slice(0,1))
              // console.log(value.slice(1))
              this.firstName = value.slice(0, 1);
              this.lastName = value.slice(1);
            },
          },
        },
      });
    </script>
  </body>
</html>
```

範例說明：這裡有使用雙向綁定當值被修改時 fullName 也會跟著更新

## Computed 成績計算器

接下來我們使用 Computed 製作一個成績計算器可以添加科目及成績並計算總分與平均

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
    <title>Document</title>
    <style>
      .red {
        color: red;
      }
    </style>
  </head>

  <body>
    <div id="app">
      <table>
        <thead>
          <tr>
            <td>編號</td>
            <td>科目</td>
            <td>成績</td>
            <td>操作</td>
          </tr>
        </thead>
        <input type="text" placeholder="請輸入科目" v-model.trim="subject" />
        <input type="text" placeholder="請輸入分數" v-model.number="score" />
        <button @click="add()">添加</button>
        <tbody v-if="lists.length > 0">
          <tr v-for="(list,index) in lists" :key="list.id">
            <td>{{index+1}}</td>
            <td>{{list.subject}}</td>
            <td :class="{red: list.score < 60}">{{list.score}}</td>
            <td><a @click.prevent="del(list.id)" href="#">刪除</a></td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="4">暫時無數據</td>
          </tr>
        </tbody>
        <tfoot>
          總分:{{ total }} 平均: {{average}}
        </tfoot>
      </table>
    </div>
    <script>
      const app = new Vue({
        el: "#app",
        data: {
          lists: [
            { id: 1, subject: "物理", score: 20 },
            { id: 2, subject: "化學", score: 80 },
            { id: 3, subject: "數學", score: 60 },
          ],
          subject: "",
          score: "",
        },
        methods: {
          del(id) {
            this.lists = this.lists.filter((item) => item.id !== id);
          },
          add() {
            if (!this.subject) {
              alert("請輸入科目");
              return;
            }
            if (typeof this.score !== "number") {
              alert("請輸入數值");
              return;
            }
            this.lists.push({
              id: +new Date(),
              subject: this.subject,
              score: this.score,
            });
            this.subject = "";
            this.score = "";
          },
        },
        computed: {
          total() {
            return this.lists.reduce((a, b) => a + b.score, 0);
          },
          average() {
            if (this.lists.length === 0) {
              return 0;
            }
            return (this.total / this.lists.length).toFixed(2);
          },
        },
      });
    </script>
  </body>
</html>
```

執行結果：
![alt 執行解果](/images/computed-calc.gif)

<hr>

## Watch 監視器

Watch 用於監視 Vue 的數據的變，當被監視的數據變化時，可以執行一些自定義的操作或異步操作。

以下是一個範例當數值被改變時結果會乘 2 在 Watch 內會有兩個參數一個是新的值一個是初始值。

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>

  <body>
    <div id="app">
      <p>輸入數字讓他變兩倍</p>
      <input v-model="baseNumber" type="number" />
      <p>結果：{{ doubledNumber }}</p>
    </div>
  </body>
  <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.js"></script>
  <script>
    new Vue({
      el: "#app",
      data: {
        baseNumber: 0,
        doubledNumber: 0,
      },
      watch: {
        baseNumber: function (newVal, oldVal) {
          this.doubledNumber = newVal * 2;
          console.log(`舊的值${oldVal}`);
          console.log(`新的值${newVal}`);
        },
      },
    });
  </script>
</html>
```

---

## 系列文章導覽

- 上一篇：[Vue2 + Vue3 Ep-0：Vue 基礎與常用指令](/posts/vue2-vue3-ep-0)
- 下一篇：[Vue2 + Vue3 Ep-2：Vue 生命週期](/posts/vue2-vue3-ep-2)
