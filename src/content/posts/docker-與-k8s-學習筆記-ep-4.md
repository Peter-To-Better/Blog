---
title: "Docker 與 K8s 學習筆記 Ep-4"
pubDate: 2025-03-24 22:29:52
description: "在實際應用場景中，單一容器往往無法滿足所有需求，複雜的應用常需要多個容器來協同工作像是： - 一個 Web 應用容器需要與資料庫容器通訊 - 微服務架構中的多個服務需要互相調用 - 前端容器需要與後端 API 容器互動 本篇將詳細介紹 Docker 中實現跨容器通訊的幾種主要方式。"
author: "Peter"
tags: ["Docker & K8s"]
category: "Docker & K8s"
keywords: "Docker 多容器通訊, Docker Network 教學, Docker Compose 教學, docker-compose.yml 範例, Container 跨容器通訊, 微服務 Docker 教學, Docker bridge network"
draft: false
---

# 本篇重點

在實際應用場景中，單一容器往往無法滿足所有需求，複雜的應用常需要多個容器來協同工作像是：

- 一個 Web 應用容器需要與資料庫容器通訊
- 微服務架構中的多個服務需要互相調用
- 前端容器需要與後端 API 容器互動

本篇將詳細介紹 Docker 中實現跨容器通訊的幾種主要方式。

<!-- more -->

## 1. 容器間通訊的基本方式

### 1.1 通過 IP 地址直接通訊

每個 Docker 容器在創建時都會被分配一個內部 IP 地址，可以通過這個 IP 進行通訊。

**操作步驟：**

1. 創建第一個容器（例如 Nginx）：

   ```bash
   docker run -d --name nginx1 nginx
   ```

2. 查看容器的 IP 地址：

   ```bash
   docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nginx1
   ```

   輸出可能是：`172.17.0.2`

3. 創建第二個容器並連接測試：

   ```bash
   docker run -it --rm alpine wget 172.17.0.2
   ```

**缺點：**

- IP 地址是動態分配的，不可靠
- 容器重啟後 IP 可能改變

### 1.2 通過容器名稱通訊

Docker 內建的 DNS 服務可以讓容器通過名稱互相解析。

**操作步驟：**

1. 創建自定義網路：

   ```bash
   docker network create my-network
   ```

2. 將容器連接到同一網路：
   ```bash
   docker run -d --name web --network my-network nginx
   docker run -it --rm --network my-network alpine ping web
   ```

**優點：**

- 使用容器名稱而非 IP，更穩定
- 自動服務發現

## 2. Docker 網路模式詳解

Docker 提供多種網路模式，適合不同場景：

| 網路模式  | 描述                                                | 適用場景                     |
| --------- | --------------------------------------------------- | ---------------------------- |
| `bridge`  | 默認模式，容器通過虛擬網橋連接                      | 單機多容器通訊               |
| `host`    | 容器直接使用主機網路                                | 高性能需求，放棄網路隔離     |
| `none`    | 無網路配置                                          | 特殊安全需求                 |
| `overlay` | 多主機網路，用於 Swarm 集群                         | 跨主機容器通訊               |
| `macvlan` | 為容器分配 MAC 地址，使其在物理網路中顯示為物理設備 | 需要直接暴露到物理網路的服務 |

**查看現有網路：**

```bash
docker network ls
```

**可以將沒有使用的網路刪除：**

```bash
  docker network rm <網路名稱或ID>
```

## 3. 實戰範例：WordPress + MySQL

這裡示範一個完整的 WordPress 網站範例來實踐跨容器通訊。

### 3.1 創建自定義網路

```bash
docker network create wordpress-net
```

### 3.2 啟動 MySQL 容器

```bash
docker run -d \
  --name mysql \
  --network wordpress-net \
  -e MYSQL_ROOT_PASSWORD=secret \
  -e MYSQL_DATABASE=wordpress \
  -v wp-data:/var/lib/mysql \
  mysql:8.0
```

### 3.3 啟動 WordPress 容器

```bash
docker run -d \
  --name wordpress \
  --network wordpress-net \
  -p 8080:80 \
  -e WORDPRESS_DB_HOST=mysql \
  -e WORDPRESS_DB_USER=root \
  -e WORDPRESS_DB_PASSWORD=secret \
  -e WORDPRESS_DB_NAME=wordpress \
  wordpress
```

### 3.4 驗證

打開瀏覽器檢查應用有沒有被啟動 `http://localhost:8080`

## 5. 容器與主機通訊

有時容器需要訪問主機服務（如主機上運行的資料庫）：

**使用特殊 DNS 名稱：**

如果想要容器訪問本地電腦的服務，像是資料庫那可以將端點改為 `host.docker.internal` 就能從容器訪問本地電腦服務。

## 結論

掌握 Docker 跨容器通訊是構建複雜應用的基礎。關鍵要點：

1. 優先使用自定義網路而非默認 bridge 網路
2. 通過容器名稱而非 IP 進行通訊

## 延伸閱讀

- [Docker 官方網路文件](https://docs.docker.com/network/)
- [容器網路接口(CNI)規範](https://github.com/containernetworking/cni)
