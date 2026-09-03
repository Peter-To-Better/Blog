---
title: "Docker Compose 實戰＋Volume 資料持久化｜Docker 與 K8s 筆記 Ep-5"
pubDate: 2026-09-03 21:30:00
description: "docker-compose.yml 到底怎麼寫？重開容器資料就不見了怎麼辦？這篇把 Ep-4 用兩次 docker run 接網路的做法改寫成真正的 Compose，並用實測指令示範 volume 資料持久化、image 瘦身與 HEALTHCHECK。"
author: "Peter"
tags: ["Docker & K8s", "Docker", "Docker Compose", "容器化"]
category: "Docker & K8s"
keywords: "Docker Compose 教學, docker-compose.yml 範例, Docker Volume 教學, named volume 與 bind mount 差別, docker compose down -v 資料不見, Multi-stage build 教學, Docker image 瘦身, dockerignore 教學, Docker HEALTHCHECK 教學"
draft: false
---

## 本篇重點

[Ep-4](/posts/docker-與-k8s-學習筆記-ep-4) 標題掛的是「Docker Compose」，但內文其實只用 `docker network create` 加兩次 `docker run` 手動接網路，從頭到尾沒有出現過 `docker-compose.yml`。這篇把這筆帳補上，順便處理三個 Ep-0~4 一直沒講清楚、但實際部署一定會踩到的東西：

- 把 Ep-4 的 WordPress + MySQL 範例真的改寫成 `docker-compose.yml`
- Volume 到底是什麼：具名 volume 和 bind mount 差在哪，`docker compose down -v` 為什麼會把資料清掉
- Image 太肥怎麼辦：multi-stage build 和 `.dockerignore` 實測前後差幾倍
- HEALTHCHECK：讓 Docker 自己知道容器是不是活著，這個觀念會直接用在下一篇的 K8s probe 上

本篇所有指令輸出都是實際跑出來的結果，不是示意值。

<!-- more -->

## 1. 把 Ep-4 的手動接網路改寫成真正的 Compose

先回顧一下 Ep-4 是怎麼啟動 WordPress + MySQL 的：

```bash
docker network create wordpress-net

docker run -d --name mysql --network wordpress-net \
  -e MYSQL_ROOT_PASSWORD=secret -e MYSQL_DATABASE=wordpress \
  -v wp-data:/var/lib/mysql mysql:8.0

docker run -d --name wordpress --network wordpress-net -p 8080:80 \
  -e WORDPRESS_DB_HOST=mysql -e WORDPRESS_DB_USER=root \
  -e WORDPRESS_DB_PASSWORD=secret -e WORDPRESS_DB_NAME=wordpress \
  wordpress
```

三個指令、一堆重複的 `--network wordpress-net`，而且要記得先後順序（MySQL 沒起來，WordPress 會連線失敗）。用 Compose 把這些寫進一個 YAML：

```yaml
# docker-compose.yml
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_DATABASE: wordpress
    volumes:
      - wp-data:/var/lib/mysql

  wordpress:
    image: wordpress
    depends_on:
      - mysql
    ports:
      - "8080:80"
    environment:
      WORDPRESS_DB_HOST: mysql
      WORDPRESS_DB_USER: root
      WORDPRESS_DB_PASSWORD: secret
      WORDPRESS_DB_NAME: wordpress

volumes:
  wp-data:
```

跟手動下指令對照一下：

| Ep-4 手動做法                         | Compose 對應寫法                                       |
| :------------------------------------ | :----------------------------------------------------- |
| `docker network create wordpress-net` | 不用寫，Compose 會自動幫每個專案建一個預設網路         |
| 兩次 `--network wordpress-net`        | 同一個 `docker-compose.yml` 裡的服務預設就在同一個網路 |
| 手動控制先啟動 MySQL 再啟動 WordPress | `depends_on: [mysql]`                                  |
| `-v wp-data:/var/lib/mysql`           | `volumes:` 區塊                                        |

啟動：

```bash
docker compose up -d
```

確認兩個容器都起來了：

```bash
docker compose ps
```

實際跑出來的結果：

```
NAME                            IMAGE       COMMAND                  SERVICE     CREATED          STATUS          PORTS
wordpress-compose-mysql-1       mysql:8.0   "docker-entrypoint.s…"   mysql       23 seconds ago   Up 20 seconds   3306/tcp, 33060/tcp
wordpress-compose-wordpress-1   wordpress   "docker-entrypoint.s…"   wordpress   21 seconds ago   Up 20 seconds   0.0.0.0:8080->80/tcp, [::]:8080->80/tcp
```

打 `curl` 驗證 WordPress 真的活著（回應 302 是正常的，代表被導去安裝頁）：

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/
# 302
```

一行 `docker compose up -d` 取代三行手動指令，而且服務之間可以直接用**服務名稱**（`mysql`）互相連線，不用自己 `docker network create`。這就是 Ep-4 那句「用 docker-compose.yml 一行指令全部啟動」真正該長的樣子。

## 2. Volume 到底是什麼：具名 volume 和 bind mount 差在哪

Ep-3 提過一行 `-v /home/user/data:/app/data`，Ep-4 也直接用了 `-v wp-data:/var/lib/mysql`，但兩者其實是**不同東西**，這篇補上這個洞。

### 具名 volume（named volume）：交給 Docker 管

上面 `docker-compose.yml` 裡的 `wp-data` 就是具名 volume，語法是 `volume名稱:容器路徑`。Docker 會自己找地方存資料，你不用管實際路徑在哪：

```bash
docker volume create demo-vol
docker volume inspect demo-vol
```

```json
[
  {
    "CreatedAt": "2026-09-03T15:16:30+08:00",
    "Driver": "local",
    "Labels": null,
    "Mountpoint": "/var/lib/docker/volumes/demo-vol/_data",
    "Name": "demo-vol",
    "Options": null,
    "Scope": "local"
  }
]
```

`docker volume ls` 查得到它，`docker volume rm` 可以刪它，是 Docker 自己在管理的一塊空間。

### Bind mount：你自己指定主機路徑

語法是 `主機絕對路徑:容器路徑`，直接把電腦上一個真實資料夾借給容器用：

```bash
docker run --rm -v "$(pwd)":/data alpine sh -c "echo '這行是容器寫進主機的' > /data/from-container.txt"
cat from-container.txt
# 這行是容器寫進主機的
```

這個資料夾不會出現在 `docker volume ls` 裡，因為它本來就不是 Docker 管的東西，就是你電腦上的一個路徑。

|                             | 具名 volume                      | Bind mount                               |
| :-------------------------- | :------------------------------- | :--------------------------------------- |
| 資料存哪                    | Docker 自己管理的位置            | 你指定的主機路徑                         |
| `docker volume ls` 查得到嗎 | 查得到                           | 查不到                                   |
| 適合場景                    | 資料庫資料、不需要直接看檔案內容 | 開發時想直接編輯主機上的原始碼、掛設定檔 |

### 注意：`docker compose down -v` 會把資料真的刪掉

這是最容易讓人措手不及的地方，先在 MySQL 裡塞一筆測試資料：

```bash
docker compose exec mysql mysql -uroot -psecret \
  -e "CREATE TABLE wordpress.demo_marker (msg VARCHAR(50));
      INSERT INTO wordpress.demo_marker VALUES ('volume 還在這裡');"
```

`docker compose down`（不加 `-v`）只會刪容器，volume 不會動：

```bash
docker compose down
docker volume ls | grep wp-data
# local     wordpress-compose_wp-data   ← 還在
```

重新 `docker compose up -d` 之後查資料，還在：

```bash
docker compose exec mysql mysql -uroot -psecret -e "SELECT * FROM wordpress.demo_marker;"
# msg
# volume 還在這裡
```

但只要多加一個 `-v`，volume 會被一起刪掉：

```bash
docker compose down -v
docker volume ls | grep wp-data
# (找不到 wp-data，volume 已經被刪掉了)
```

`-v` 這個參數平常打指令很容易手滑多加，一旦加了、資料庫的資料就真的沒了，沒有二次確認。正式環境的資料庫容器，重開前務必想清楚有沒有多打這個 `-v`。

## 3. Image 太肥怎麼辦：multi-stage build

回頭看 Ep-2 寫的 Dockerfile：

```dockerfile
FROM node:16
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

實際 build 起來量一下大小：

```bash
docker build -t my-node-app:ep2 .
docker images my-node-app:ep2 --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}'
```

```
REPOSITORY:TAG    SIZE
my-node-app:ep2   863MB
```

一個只有幾行程式碼的 Express app，image 卻要 863MB。問題出在 `node:16` 這個基礎映像本身就很肥（包含完整的編譯工具鏈），而且 `node:16` 現在已經 EOL（停止維護），不該再拿來當 base image。

Multi-stage build 的做法是：用一個完整的映像來安裝套件，再把成果複製到一個乾淨、精簡的映像裡，編譯工具、npm cache 這些用不到的東西全部留在第一階段，不會進到最終的 image：

```dockerfile
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

- 第一階段 `builder` 用完整的 `node:20` 裝套件
- 第二階段換成 `node:20-alpine`（Alpine Linux 是一個以精簡著稱的發行版），只用 `COPY --from=builder` 把裝好的 `node_modules` 搬過來，不會把 `builder` 階段的任何東西一起帶進來

實測結果：

```bash
docker build -t my-node-app:multi .
docker images my-node-app --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}'
```

```
REPOSITORY:TAG      SIZE
my-node-app:multi   140MB
my-node-app:ep2     863MB
```

863MB 降到 140MB，差了 6 倍多。同一份程式碼，光是換基礎映像加上 multi-stage，image 大小就差這麼多，實務上代表 build 更快、推上 registry 更快、K8s 排程也更快把新版本拉下來。

## 4. `.dockerignore`：build context 也要瘦身

`docker build` 執行的第一步，是把整個目錄（build context）打包送進 Docker daemon，不管 Dockerfile 裡有沒有 `COPY` 到。本機資料夾裡如果有 `node_modules`、`.git` 這種東西，沒設 `.dockerignore` 的話全部都會被送過去：

```bash
# 沒有 .dockerignore
docker build -t my-node-app:multi . --no-cache
```

```
#4 transferring context: 2B done
#9 transferring context: 1.04MB 1.2s done
```

加上 `.dockerignore`：

```
node_modules
.git
Dockerfile*
```

再 build 一次：

```
#4 transferring context: 70B done
#9 transferring context: 168B done
```

1.04MB 降到 168B。專案小還感覺不明顯，但如果 `node_modules` 有幾百 MB，或是 `.git` 歷史很長，每次 build 都要重新打包傳輸這些用不到的檔案，會拖慢 build 速度。更重要的是安全性：沒有 `.dockerignore`，`.env`、私鑰這類檔案只要待在專案目錄裡，就有可能被不小心 `COPY . .` 打包進 image 裡，跟著 image 一起推上 Docker Hub。

## 5. HEALTHCHECK：讓 Docker 自己知道容器活著沒

容器的 `docker ps` STATUS 只會顯示 `Up`，代表**行程還在跑**，但不代表**應用程式真的能正常服務**。比如 Node.js process 卡在無窮迴圈、或是資料庫連線斷了但沒 crash，容器照樣顯示 `Up`。`HEALTHCHECK` 指令讓 Docker 定期打一個檢查點，自己判斷容器是不是真的健康：

```dockerfile
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O- http://localhost:3000/health || exit 1

CMD ["node", "index.js"]
```

`index.js` 裡加一個 `/health` 路由回應 200：

```javascript
app.get("/health", (req, res) => {
  res.status(200).send("ok");
});
```

`node:20-alpine` 沒有內建 `curl`，但有 `wget`，所以健康檢查用 `wget` 打。啟動容器，觀察狀態變化：

```bash
docker run -d --name my-node-app -p 3000:3000 my-node-app:latest
docker ps --filter name=my-node-app --format 'table {{.Names}}\t{{.Status}}'
```

剛啟動：

```
NAMES         STATUS
my-node-app   Up Less than a second (health: starting)
```

等 12 秒（超過 `--start-period=5s` 加一次檢查間隔）再查一次：

```
NAMES         STATUS
my-node-app   Up 12 seconds (healthy)
```

`docker ps` 直接看得到 `(healthy)`，也可以查更細的檢查記錄：

```bash
docker inspect --format='{{json .State.Health}}' my-node-app
```

```json
{
  "Status": "healthy",
  "FailingStreak": 0,
  "Log": [
    {
      "Start": "2026-09-03T15:19:08...",
      "End": "2026-09-03T15:19:08...",
      "ExitCode": 0,
      "Output": "ok"
    }
  ]
}
```

這個「定期檢查、判斷健康狀態」的觀念，下一篇進 K8s 基礎時會直接對應到 `livenessProbe` 和 `readinessProbe`：K8s 就是靠類似的機制，判斷一個 Pod 該不該被重啟、該不該被放進 Service 的流量名單。先在 Docker 這層搞懂 HEALTHCHECK，接 K8s probe 的時候就不會是全新的概念。

## 結論

1. Docker Compose 真的能做到「一行指令啟動多容器」，不用手動管網路和啟動順序
2. Volume 分具名 volume 和 bind mount 兩種，`docker compose down -v` 會把資料真的刪掉，這是正式環境最容易踩到的雷
3. Multi-stage build 加對的 base image，同一份程式碼 image 大小可以差到 6 倍以上
4. `.dockerignore` 影響 build context 大小，也是避免洩漏 `.env`、`.git` 的第一道防線
5. HEALTHCHECK 讓 Docker 自己判斷容器健不健康，是接下來 K8s probe 的鋪陳

下一篇開始正式進 Kubernetes：Pod、Deployment、Service 這些核心物件到底在解決什麼問題。

## 延伸閱讀

- [Docker Compose 官方文件](https://docs.docker.com/compose/)
- [Docker Volumes 官方文件](https://docs.docker.com/engine/storage/volumes/)
- [Multi-stage builds 官方文件](https://docs.docker.com/build/building/multi-stage/)
- [Dockerfile reference：HEALTHCHECK](https://docs.docker.com/reference/dockerfile/#healthcheck)

---

## 系列文章導覽

- 上一篇：[Docker 與 K8s 學習筆記 Ep-4：跨容器通訊與 Docker Compose](/posts/docker-與-k8s-學習筆記-ep-4)
