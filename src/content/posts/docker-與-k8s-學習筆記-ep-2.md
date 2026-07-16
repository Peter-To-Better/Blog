---
title: "Dockerfile 教學：Image 與 Container 差別｜Docker 與 K8s 筆記 Ep-2"
pubDate: 2025-02-24 22:47:34
description: "釐清 Docker Image 和 Container 的本質差異，並實作一個 Node.js 應用的 Dockerfile，學會 FROM、COPY、RUN、CMD 四個核心指令。"
author: "Peter"
tags: ["Docker & K8s", "Docker", "容器化", "Dockerfile"]
category: "Docker & K8s"
keywords: "Dockerfile 教學, Docker Image 是什麼, Docker Container 差別, Docker Image vs Container, Node.js Dockerfile 範例, docker build 指令, COPY RUN CMD 指令"
draft: false
---

## 本篇重點

了解映像（Image）與容器（Container）的差別，並且實作一個 NodeJs 應用撰寫專案專屬的 Dockerfile。

<!-- more -->

## 映像（Image）與容器（Container）的差別

在 Docker 中，**映像（Image）**和**容器（Container）**是兩個核心概念，理解它們的區別對於掌握 Docker 是非常重要的事，這裡我會舉一些例子讓大家更好懂。

### 什麼是映像（Image）？

- **映像**是一個唯讀的模板，包含了運行應用程式所需的所有內容：程式碼、運行環境、函式庫、環境變數和配置文件等。
- 映像本身是不可變的，一旦創建就無法更改，如果需要修改，通常會基於現有的映像創建一個新的映像。

### 什麼是容器（Container）？

- **容器**是映像的運行實體，當你啟動一個映像時，Docker 會根據該映像創建一個容器。
- 容器是可讀寫的，並且在運行時會有一個獨立的文件系統層，允許你在容器內進行修改。

---

## 映像與容器的生活化比喻

### 1. **食譜（Image） vs. 實際煮出來的菜（Container）**

- **映像（Image）** 就像是 **食譜**，它詳細記載了做一道菜需要的所有材料、步驟和調味方式，食譜本身是固定的，不會因為你煮了幾次而改變。
- **容器（Container）** 則是 **實際煮出來的菜**。你可以根據食譜煮出無數道菜，每一道菜都是獨立的，可以根據你的喜好調整鹹淡或加料，但這些調整不會影響到原始的食譜。

**例子**：  
你有一份「牛肉麵食譜」（Image），每次煮牛肉麵（Container）時，都可以根據這份食譜來做，今天煮的牛肉麵可能比較鹹，明天煮的比較清淡，但食譜本身不會改變。

---

## 用圖來解釋

![Dockerfile DockerImage DockerContainer](/images/Dockerfile-DockerImage-DockerContainer.png)

在圖中，我們可以看到 Dockerfile、Docker Image 和 Docker Container，Dockerfile 是一個純文字文件，裡面包含了一系列指令或步驟，這些指令會作用於一個基礎映像檔（Base Image），用於定義如何構建一個新的 Docker 映像檔。

## 實作：為 Node.js 應用撰寫 Dockerfile

我們來實作一個簡單的 Node.js 應用，並為它撰寫一個專屬的 Dockerfile。

### 步驟 1：創建 Node.js 應用

首先，創建一個簡單的 Node.js 應用。

1. 創建一個新目錄並進入：

   ```bash
   mkdir my-node-app
   cd my-node-app
   ```

2. 初始化一個新的 Node.js 專案：

   ```bash
   npm init -y
   ```

3. 安裝 Express 框架：

   ```bash
   npm install express
   ```

4. 創建 `index.js` 文件並添加以下內容：

   ```javascript
   const express = require("express");
   const app = express();
   const port = 3000;

   app.get("/", (req, res) => {
     res.send("Hello, Docker!");
   });

   app.listen(port, () => {
     console.log(`App listening at http://localhost:${port}`);
   });
   ```

5. 測試應用是否正常運行：

   ```bash
   node index.js
   ```

   打開瀏覽器，訪問 `http://localhost:3000`，你應該會看到 `Hello, Docker!`。

---

### 步驟 2：撰寫 Dockerfile

接下來，我們為這個 Node.js 應用撰寫一個 Dockerfile。

1. 在專案根目錄下創建一個名為 `Dockerfile` 的文件（沒有副檔名），並添加以下內容：

   ```dockerfile
   # 使用官方的 Node.js 映像作為基礎映像
   FROM node:16

   # 設置工作目錄
   WORKDIR /app

   # 複製 package.json 和 package-lock.json 這個動作是將這些所需的 package 複製到 ./ 也就是當前的工作目錄 /app
   COPY package*.json ./

   # 安裝依賴
   RUN npm install

   # 複製應用程式原始碼
   COPY . .

   # 暴露應用程式運行的端口
   EXPOSE 3000

   # 啟動應用程式
   CMD ["node", "index.js"]
   ```

2. 解釋 Dockerfile 的每一部分：

   - `FROM node:16`：指定基礎映像為 Node.js 16 版本。
   - `WORKDIR /app`：設置容器內的工作目錄為 `/app`。
   - `COPY package*.json ./`：將本地的 `package.json` 和 `package-lock.json` 複製到容器的工作目錄。
   - `RUN npm install`：在容器內安裝依賴。
   - `COPY . .`：將本地的所有文件複製到容器的工作目錄。
   - `EXPOSE 3000`：暴露容器的 3000 端口，讓外部可以訪問。
   - `CMD ["node", "index.js"]`：指定容器啟動時執行的命令。

---

### 步驟 3：構建 Docker 映像

1. 使用以下命令構建 Docker 映像：

   ```bash
   docker build -t my-node-app .
   ```

   - `-t my-node-app`：為映像指定一個名稱（tag）。
   - `.`：指定 Dockerfile 所在的路徑（當前目錄）。

2. 構建完成後，你可以使用以下命令查看本地的映像：

   ```bash
   docker images
   ```

   你應該會看到 `my-node-app` 映像。

---

### 步驟 4：運行容器

1. 使用以下命令啟動容器：

   ```bash
   docker run -p 3000:3000 my-node-app
   ```

   - `-p 3000:3000`：將本地的 3000 端口映射到容器的 3000 端口。

2. 打開瀏覽器，訪問 `http://localhost:3000`，你應該會看到 `Hello, Docker!`。

3. 停止容器：

   要正確停止容器，我們需要使用 Docker 提供的指令，而不是單純按下 `Ctrl + C`。

   - **方法 1：使用 `docker stop` 指令**  
     `docker stop` 會優雅地停止容器，讓容器內的應用程式有時間完成當前工作。執行以下指令：

     ```bash
     docker stop <container_id>
     ```

     其中 `<container_id>` 是容器的 ID，你可以透過 `docker ps` 指令查詢。

   - **方法 2：使用 `docker kill` 指令**  
     如果你需要立即停止容器，可以使用 `docker kill` 指令。這會強制停止容器，不會等待容器內的應用程式完成當前工作：

     ```bash
     docker kill <container_id>
     ```

4. 檢查容器狀態：

   停止容器後，你可以使用以下指令檢查容器狀態：

   ```bash
   docker ps -a
   ```

### 補充：刪除容器

如果你不再需要某個容器，可以使用以下指令將其刪除：

```bash
docker rm <container_id>
```

這樣做會徹底移除容器，釋放系統資源。

小提醒：當你的映像（Image）被創建後，如果修改程式碼內容並再次運行 `docker run -p 3000:3000 my-node-app`，結果將不會反映你當前的修改，因為映像是不可變的，但如果要應用修改，就在重新構建一個新的映像。

---

## **結論**

在本篇中，我們了解了映像與容器的區別，並實作了一個簡單的 Node.js 應用，撰寫了專屬的 Dockerfile，透過這個過程，大家應該對 Docker 的基本概念有了更深入的理解。

---

## 延伸閱讀

- [Docker 官方文件 - Dockerfile 參考](https://docs.docker.com/engine/reference/builder/)
- [Node.js 官方映像](https://hub.docker.com/_/node)

---

## 系列文章導覽

- 上一篇：[Docker 與 K8s 學習筆記 Ep-1：安裝 Docker 與基本指令](/posts/docker-與-k8s-學習筆記-ep-1)
- 下一篇：[Docker 與 K8s 學習筆記 Ep-3：Docker 指令速查與推上 Docker Hub](/posts/docker-與-k8s-學習筆記-ep-3)
