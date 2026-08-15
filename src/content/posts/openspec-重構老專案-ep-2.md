---
title: "OpenSpec 重構老專案 Ep-2:裝好 PHP 與 Composer"
pubDate: 2026-06-12 21:00:00
description: "動工 Laravel 前，先把 PHP 8 與 Composer 兩張入場券辦好。這篇用 Node.js 開發者秒懂的對照，帶你在 macOS / Linux / Windows 各自一行裝起來，還把 composer create-project 每個 token 拆給你看。照著裝完就能跑。"
author: "Peter"
tags: ["重構筆記", "OpenSpec", "PHP", "Laravel"]
category: "重構筆記"
keywords: "PHP, Composer, PHP 8, Laravel 12, brew install php, Laravel Herd, composer create-project, Carbon-ESG"
draft: false
---

## 本篇重點

[Ep-1](/posts/openspec-重構老專案-ep-1/) 我們把 OpenSpec 紀律架好了,接下來 phase-0 第一個會動到磁碟的 task 是:

```bash
composer create-project laravel/laravel backend "^12.0"
```

但這條指令要跑得起來,你得先有兩樣東西：**PHP** 跟 **Composer**。這篇就是專門用來把這兩張入場券辦好,順便講清楚:它們各自在做什麼、為什麼非要分成兩個、以及裝完之後那條指令裡每個 token 到底代表什麼意思。如果你之前只寫過 Node.js,看完應該能在腦海裡建立「PHP 之於 Laravel」≈「Node 之於 Next.js」的對照表。

<!-- more -->

## 為什麼要把這篇單獨切出來

照系列原本的節奏,Ep-2 應該直接進 Laravel 12 的 scaffold 過程。但我在跑 [Carbon-ESG](https://github.com/hongyui/Carbon-ESG) 的 phase-0 時想起一件事:

> 我大學接觸 PHP 是 2023 年,當時整個 dev 環境是 XAMPP 一鍵包。但 2026 年現在主流早就不是那樣了：Laravel 12 直接要求 PHP **8.2+**,XAMPP 預設的 PHP 版本常常落後一兩個 minor。

## 60 秒搞懂 PHP 是什麼

如果你會 Node.js,類比就一句話:

> **PHP 是另一個 server-side runtime,只是它的設計初衷是「直接嵌在 HTML 裡跑」,而不是像 Node 那樣「用 JS 寫獨立 server」**。

這個歷史包袱讓 PHP 長得跟 Node 不太一樣：但**現代 PHP**(8.x 系列)其實已經是一個語法乾淨、有強型別、有 attribute、有 enum、有 readonly property 的語言。Laravel 12 跑在 PHP 8.2+ 上,寫起來感受跟寫 TypeScript class 沒太大差距。

幾個你會在意的對照:

| 概念             | Node.js                                | PHP             |
| ---------------- | -------------------------------------- | --------------- |
| Runtime 來源     | V8(Chrome 那顆)                        | Zend Engine     |
| 入口檔           | `index.js`                             | `index.php`     |
| 套件管理         | npm / pnpm / yarn                      | **Composer**    |
| 套件清單         | `package.json`                         | `composer.json` |
| 鎖定檔           | `package-lock.json` / `pnpm-lock.yaml` | `composer.lock` |
| 套件存放         | `node_modules/`                        | `vendor/`       |
| 框架(我們會用的) | Next.js                                | **Laravel**     |

最後一行就是這個系列的核心:**Carbon-ESG 的後端用 Laravel 寫,所以你需要 PHP 來跑它**。

## Laravel 12 為什麼挑 PHP 8.2 當底線

Laravel 從 11 開始把 PHP 底線拉到 8.2,12 維持一樣。原因不複雜:

1. **8.2 的 readonly class 跟 DNF type** 讓框架內部 DTO 寫起來乾淨太多
2. **8.1 引入的 enum** 在 Eloquent cast 直接內建,我們之後存「審核狀態 / 訂單狀態」會大量用到
3. **JIT 在 8.x 才趨於穩定**,生產效能差距明顯

實務建議:**裝 8.3 或 8.4**(撰文時 8.4 是穩定主線、8.5 是 2026 上半年才出的新版)。我自己這台 macOS 因為 Homebrew 預設拉最新,所以拿到的是 8.5：跑 Laravel 12 沒問題,但如果你是上 production,我會建議跟著官方推薦版本走,不要追到 .x.0 剛出爐的版本。

> 小提醒:如果你看到任何教學叫你裝 PHP 7,**直接關掉**。7.x 系列在 2022 年底就全部 EOL,連 Laravel 10 都不收了。

## 裝 PHP

### macOS：Homebrew 一行

```bash
brew install php
```

裝完驗證:

```bash
php -v
# PHP 8.5.7 (cli) (built: Jun  2 2026 ...) (NTS)
# Copyright (c) The PHP Group
# Zend Engine v4.5.7, Copyright (c) Zend Technologies
#     with Zend OPcache v8.5.7, Copyright (c) Zend Technologies
```

如果你要鎖特定版本(例如想跟 production 對齊裝 8.3):

```bash
brew install php@8.3
brew link --overwrite --force php@8.3
```

### Ubuntu / Debian：ondrej PPA

Ubuntu 內建倉庫的 PHP 版本通常太舊,標準做法是加 **ondrej/php** PPA(他是 Debian 的 PHP 維護者,版本最新且可信):

```bash
sudo apt update
sudo apt install -y software-properties-common
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update
sudo apt install -y php8.3-cli php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-mysql
```

那串 extension 是 Laravel 的最低需求,少裝任何一個 `composer install` 就會抱怨。

### Windows：Laravel Herd

Windows 過去裝 PHP 是出名的痛：改 `php.ini`、設 `PATH`、開關 extension,每一步都能踩雷。2024 年起 Laravel 官方出了 **[Herd](https://herd.laravel.com)** ,一鍵裝好 PHP + Composer + Node + Nginx,而且 macOS / Windows 都支援,免費版就夠用:

直接到 `https://herd.laravel.com` 下載 Windows 版安裝即可,裝完 `php -v` 跟 `composer --version` 在任何終端機都能用。

> 如果你堅持手動裝,可以從 `windows.php.net/download` 抓 zip → 解壓到 `C:\php` → 加入系統 PATH → 把 `php.ini-development` 改名 `php.ini` 並打開常用 extension(`mbstring`、`openssl`、`pdo_mysql`、`curl`、`fileinfo`、`zip`)。但這條路會吃掉你一個下午,Herd 是真心推薦。

## 60 秒搞懂 Composer 是什麼

一句話:

> **Composer 之於 PHP,就是 npm/pnpm 之於 Node**。

它做的事:

1. 讀你寫的 `composer.json`,知道專案需要哪些套件
2. 解 dependency graph,算出版本相容性
3. 從 [Packagist](https://packagist.org)(PHP 的 npmjs)下載套件到 `vendor/`
4. 產生 `composer.lock` 鎖死版本,讓你跟同事跟 CI 裝到一模一樣的東西
5. 生成一個 PSR-4 **autoloader**,讓你寫 `use App\Services\Foo;` 不用手動 `require`

如果你寫過 `pnpm install` 或 `pnpm add`,Composer 的所有指令你都不用學,**只是換個名字**:

| 你想做的事           | pnpm            | Composer                   |
| -------------------- | --------------- | -------------------------- |
| 裝全部依賴           | `pnpm install`  | `composer install`         |
| 加一個套件           | `pnpm add x`    | `composer require x`       |
| 加一個 dev-only 套件 | `pnpm add -D x` | `composer require x --dev` |
| 移除                 | `pnpm remove x` | `composer remove x`        |
| 升級                 | `pnpm update x` | `composer update x`        |
| 跑 script            | `pnpm run test` | `composer test`            |

## 那為什麼不把 PHP 跟 Composer 綁成一包

這是 Node 出身的人常問的問題：Node 裝完就有 npm,為什麼 PHP 還要分開裝 Composer?

技術上的答案是:**Composer 本身就是一個用 PHP 寫的 CLI 工具**。它不是 PHP runtime 的一部分,而是社群在 2012 年(由 Nils Adermann 跟 Jordi Boggiano)獨立做出來的工具。換句話說：**Composer 是「跑在 PHP 上」的 application,跟你的 Laravel 專案地位是平的**,只是它剛好負責管理其他套件。

也因為這樣,你**必須先有 PHP** 才能跑 Composer,順序不能反。

## 裝 Composer

### macOS：Homebrew(最快)

```bash
brew install composer
```

### 通用方式(macOS / Linux / WSL)

照 [getcomposer.org](https://getcomposer.org/download/) 官方四行指令(他們會給帶 hash 驗證的最新版本),裝完移到 `PATH` 上:

```bash
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
```

### Windows

裝 Laravel Herd 就附了。或者單獨下載 [Composer-Setup.exe](https://getcomposer.org/Composer-Setup.exe) 跑安裝精靈。

### 驗證

```bash
composer --version
# Composer version 2.10.1 2026-06-04 10:25:59
# PHP version 8.5.7 (/opt/homebrew/Cellar/php/8.5.7/bin/php)
```

注意第二行：Composer 會告訴你它**正在用哪個 PHP 跑**。如果你有多個 PHP 版本共存,這行可以幫你 debug「為什麼某個 PHP-only feature 不認」。

## 拆解我們即將跑的第一條 Composer 指令

phase-0 task 2.1 寫的是:

```bash
composer create-project laravel/laravel backend "^12.0"
```

四個 token 一個一個拆:

| Token             | 在做什麼                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `composer`        | 呼叫 Composer CLI                                                                                                                                |
| `create-project`  | 一個特殊 subcommand:**從一個現成 package 開新專案**(`composer install` 是裝到既有專案,`create-project` 是 clone 出新專案)                        |
| `laravel/laravel` | Packagist 上的 package 名稱,前半是 vendor(`laravel`),後半是 package(`laravel`)。這個 package 本質是「Laravel 的官方 starter template」           |
| `backend`         | 要把專案放到當前目錄下哪個資料夾。我們選 `backend/` 是因為 [Carbon-ESG monorepo 設計](/posts/openspec-重構老專案-ep-1/) 把後端跟前端切兩個子專案 |
| `"^12.0"`         | Caret constraint：「12.x 任何 minor / patch,但不能升到 13」。寫死 major 是為了避免 starter 跟我們認知的版本不一致                               |

跑下去的瞬間,Composer 會做這幾件事:

1. 從 Packagist 抓 `laravel/laravel` 12.x 的最新 tag
2. 把它解壓到 `backend/`
3. 進到 `backend/` 跑 `composer install`(裝所有 dep 到 `backend/vendor/`)
4. 跑 `php artisan key:generate`(隨機產生 `APP_KEY`)
5. 跑 `php artisan migrate`(預設用 sqlite 建幾個系統表)

最後一步在我們的場景裡會被改掉：phase-0 task 2.5 會把 default DB 切回 mysql,sqlite 那個檔之後也會刪掉。但這是後話：下一節就把它拆開。

## 等等,為什麼 `create-project` 結尾會自己 migrate?

第一次跑這條指令的人多半會愣一下:

> 「我只下了一條 `composer create-project`,為什麼結尾跑出 `key:generate`、`touch sqlite`、`migrate` 一連串?我沒同意過建 sqlite 啊。」

答案是 **Composer Scripts**。任何 Composer package 都可以在自己的 `composer.json` 掛 lifecycle hook,而 Laravel starter 確實掛了兩個。打開 `backend/composer.json`,`"scripts"` 區塊有這兩條跟我們相關:

```json
"post-root-package-install": [
    "@php -r \"file_exists('.env') || copy('.env.example', '.env');\""
],
"post-create-project-cmd": [
    "@php artisan key:generate --ansi",
    "@php -r \"file_exists('database/database.sqlite') || touch('database/database.sqlite');\"",
    "@php artisan migrate --graceful --ansi"
]
```

| Hook                        | 何時觸發                                 | 做什麼                                                                                                                                                                                   |
| --------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `post-root-package-install` | starter 剛解壓到 `backend/` 後立刻       | 把 `.env.example` 複製成 `.env`                                                                                                                                                          |
| `post-create-project-cmd`   | `composer create-project` **全程結束**時 | 1. `key:generate` 把 `APP_KEY=base64:...` 寫進剛複製的 `.env`<br>2. `touch database/database.sqlite` 建一個空檔<br>3. `migrate --graceful` 建 users / cache / jobs / sessions 預設 table |

這套機制(Composer Scripts)是 **Composer 自己的**,不是 Laravel 專屬：任何 package 都能掛,只是 Laravel 用它做「新手開箱即用」。所以你看到的「自動 migrate」**不是 `create-project` 在做事,是 starter 在它自己的 `composer.json` 偷偷掛了 hook**。

### `--graceful` 是這顆 hook 的安全網

Laravel 11 給 `migrate` 加的 flag:**DB 連不上或不存在時不要拋錯,優雅 exit 0**。

所以即使你完全沒裝 MySQL,跑 `create-project` 也不會炸：它 fallback 走 sqlite。sqlite 不是 DB server,只是**一個檔案**(`database/database.sqlite`),`touch` 一下就能拿來跑 migration。這就是為什麼**你會看到 sqlite 突然冒出來,沒同意過卻自動建好**：預設 `DB_CONNECTION=sqlite` + `--graceful` 救場 + hook 自動 `touch`,三件事一起發生。

### 但 Carbon-ESG 用 MySQL,要怎麼把它切過去?

Laravel 預設 sqlite 對單機 demo 友善,但實務上會用 MySQL / PostgreSQL,原因:**並發寫入 / 連線池 / production parity / 真實的 schema 行為**(sqlite 對 `ALTER TABLE`、外鍵、JSON 欄位的支援都跟生產環境的 MySQL 不一樣,本地過了 CI 過了上 prod 才炸是經典翻車)。Carbon-ESG 鎖 MySQL 8([Ep-1 的決策表](/posts/openspec-重構老專案-ep-1/) 寫死)。

切過去五步,跟著做就行:

```bash
# 1. 砍掉 hook 留下的 sqlite 殘檔
#    Laravel 預設 .gitignore 已經擋掉它(不會進 repo),只是 disk 上多一個沒用的檔
rm backend/database/database.sqlite

# 2. 把 backend/config/database.php 預設連線從 sqlite 改 mysql
#    找這一行:'default' => env('DB_CONNECTION', 'sqlite'),
#    改成:    'default' => env('DB_CONNECTION', 'mysql'),

# 3. 起一個 MySQL — 三選一
#    a) Homebrew(macOS):
brew install mysql && brew services start mysql

#    b) Docker 一行(macOS / Linux / Windows + WSL2):
docker run -d --name mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=secret \
  -e MYSQL_DATABASE=carbon_esg \
  -e MYSQL_USER=carbon \
  -e MYSQL_PASSWORD=secret \
  mysql:8

#    c) docker-compose(推薦,完整版見本文末「附:Carbon-ESG 實際的 docker-compose.yml」):
docker compose up -d --wait mysql
```

第四步是改 `backend/.env`(注意是 `.env`,不是 `.env.example`：`.env` 是 hook 從 `.env.example` 複製來的本機副本,改它才會被讀到):

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=carbon_esg
DB_USERNAME=carbon       # 跟你 step 3 起 MySQL 用的帳號對齊
DB_PASSWORD=secret       # 同上
```

第五步,跑 migration:

```bash
cd backend && php artisan migrate
```

這次不會 `--graceful` 出局,而是真的在 MySQL 建出 `users` / `cache` / `jobs` / `sessions` 四張預設 table。**跑得到、跑得完,就是切換完成**。

> 如果 step 5 跑出 `SQLSTATE[HY000] [2002] Connection refused`,99% 是 step 3 的 MySQL 還沒起來,或 `.env` 的 host / port / 帳密跟你實際起的 MySQL 不一致。先 `docker ps` / `brew services list` 確認 MySQL 在跑,再回頭比對 `.env`。

## 附:Carbon-ESG 實際的 `docker-compose.yml` 跟 root `.env.example`

剛剛 step 3(c)推薦 `docker compose up -d mysql`,後面接的就是這份：Carbon-ESG repo 根目錄的 [`docker-compose.yml`](https://github.com/hongyui/Carbon-ESG/blob/main/docker-compose.yml) 跟對應的 [root `.env.example`](https://github.com/hongyui/Carbon-ESG/blob/main/.env.example)。直接抄就能跑。

### `docker-compose.yml`

```yaml
services:
  mysql:
    image: mysql:8
    restart: unless-stopped
    ports:
      - "${DB_PORT:-3306}:3306"
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:-rootsecret}
      MYSQL_DATABASE: ${DB_DATABASE:-carbon_esg}
      MYSQL_USER: ${DB_USERNAME:-carbon}
      MYSQL_PASSWORD: ${DB_PASSWORD:-secret}
    volumes:
      - mysql-data:/var/lib/mysql
    healthcheck:
      test:
        - CMD
        - mysqladmin
        - ping
        - -h
        - 127.0.0.1
        - -u
        - root
        - -p${DB_ROOT_PASSWORD:-rootsecret}
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  mailpit:
    image: axllent/mailpit
    restart: unless-stopped
    ports:
      - "${MAILPIT_SMTP_PORT:-1025}:1025"
      - "${MAILPIT_HTTP_PORT:-8025}:8025"

volumes:
  mysql-data:
  redis-data:
```

### 對應的 root `.env.example`

> ⚠️ 這份 `.env` 是給 **`docker-compose` 自己** 讀的,**不是** `backend/.env`。兩份 env 各管各的,別搞混：backend 拿什麼帳密連 mysql,跟 docker 起 mysql 時用什麼帳密建 user,要兩邊**值對齊**。

```dotenv
# ─── MySQL 8 ───
DB_PORT=3306
DB_ROOT_PASSWORD=rootsecret
DB_DATABASE=carbon_esg
DB_USERNAME=carbon
DB_PASSWORD=secret

# ─── Redis 7 ───
REDIS_PORT=6379

# ─── Mailpit(本機 mail 測試 — SMTP 進、HTTP UI 出)───
MAILPIT_SMTP_PORT=1025
MAILPIT_HTTP_PORT=8025
```

### 三個值得停一下的設計細節

1. **`${DB_PORT:-3306}` 雙層 fallback**:env 設了就覆寫,沒設就用 `:-` 後面的預設。讓本機跟 CI 可以挑不同 port,**不用改 compose 檔本身**。
2. **mysql `healthcheck` 用 `mysqladmin ping`,不是 `mysql -e 'SELECT 1'`**:後者要連得進 DB,啟動瞬間 socket 還沒開好會誤判 fail;ping 是 server-level signal,容器內 `mysqld` 一上線就能回應,**healthy 判斷會更早出現、更可靠**。
3. **`MYSQL_DATABASE` / `MYSQL_USER` / `MYSQL_PASSWORD` 三個一起帶**:mysql:8 image 的 entrypoint 在「**第一次** 啟動」會自動建好 DB 跟 user：所以 `docker compose up -d mysql` 之後,**你不用手動 `CREATE DATABASE` 也不用 `GRANT`**,直接讓 `backend/.env` 對齊這三個值就能 `php artisan migrate`。

### 配套指令(實際上會用到的就這幾條)

```bash
# 起 MySQL + Redis 在背景,等 healthcheck 全綠才回 prompt(--wait 是 Compose v2 提供)
docker compose up -d --wait mysql redis

# 想連 mailpit 一起起,本機收信測試
docker compose up -d --wait

# 看狀態(STATUS 欄會顯示 healthy / starting / unhealthy)
docker compose ps

# mysql 連不上時第一個該看的地方
docker compose logs -f mysql

# 全關掉(volume 留著,資料不丟)
docker compose stop

# 全關掉並砍 volume(資料**會**丟,本機重置用)
docker compose down -v
```

> 「第一次啟動才自動建 DB / user」是 mysql:8 image 真實的限制:如果你已經 `up` 過,後來才改 root `.env` 的 `DB_USERNAME` 或 `DB_PASSWORD`,**舊容器的 DB 跟 user 不會跟著改**。要嘛 `docker compose down -v` 砍 volume 重來、要嘛進 `docker compose exec mysql mysql -uroot -p` 手動改。這是 image 的 entrypoint 設計,不是 bug。

## 想跟著跑完整段 backend scaffold:11 條指令的對照表

很多教學會單獨教你 `composer create-project`,但 Laravel 12 + Sanctum SPA 模式真正能用,還有 10 步要跑。下面是 [Carbon-ESG phase-0 task group 2](https://github.com/hongyui/Carbon-ESG/blob/main/openspec/changes/phase-0-bootstrap-monorepo/tasks.md) 的完整對照表,**這就是我在自己機器上真的跑過、把 `backend/` 從不存在做到能起 server 的全部指令**。每條只給「在做什麼」一句話,「為什麼這樣選」會在 Ep-3 一個一個拆。

```bash
# ─── 在 repo 根目錄(Carbon-ESG/)跑 ───

# 2.1  從 Laravel 官方 starter 開出 backend/ 專案
composer create-project laravel/laravel backend "^12.0"

cd backend

# 2.2  認證套件 — 我們選 Sanctum SPA 模式,不選 Passport / JWT
composer require laravel/sanctum

# 2.3  把 Sanctum 的 config 跟 migration 從 vendor/ 攤到專案裡(這樣才能改、才能版控)
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"

# 2.4  Laravel 11 之後 API 路由不再預設開,要主動 install
php artisan install:api --without-migration-prompt

# 2.9  Pest 測試框架 — 比 PHPUnit 寫起來更像 Vitest
composer require pestphp/pest --dev --with-all-dependencies
./vendor/bin/pest --init
```

剩下的不是指令,是**改檔**:

| Task | 改哪個檔                                      | 改什麼(一句話)                                                                                                     |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 2.5  | `backend/config/database.php`                 | 把預設連線 fallback 從 `sqlite` 改 `mysql`                                                                         |
| 2.6  | `backend/config/cors.php`                     | `supports_credentials: true`,paths 加上 `sanctum/csrf-cookie`,allowed origin 讀 `FRONTEND_URL`                     |
| 2.7  | `backend/.env.example`                        | 寫齊 `APP_URL` / `FRONTEND_URL` / `SANCTUM_STATEFUL_DOMAINS=localhost:3000` / `DB_CONNECTION=mysql` 跟對應 DB 參數 |
| 2.8  | `backend/routes/web.php`                      | 清空(SPA 接管所有瀏覽器路由)                                                                                       |
| 2.8  | `backend/routes/api.php`                      | 加一條 `GET /api/health` 回 `{"status":"ok"}`                                                                      |
| 2.10 | `backend/database/seeders/DatabaseSeeder.php` | 把 `User::factory()->create(...)` 改成 `User::firstOrCreate(...)`(Model method,不是 Factory：**task 2.10 原本寫成 `factory()->createOrFirst()` 是 bug**,後記章節說明),讓 `db:seed` 可重跑 |

全跑完之後三條指令驗收:

```bash
php artisan route:list --path=api          # 看到 GET /api/health 就對了
php artisan serve                           # 起在 http://localhost:8000
curl http://localhost:8000/api/health       # 預期回 {"status":"ok"}
```

> 為什麼 Sanctum 一定要走 **SPA + httpOnly cookie**、為什麼把 sqlite 切回 mysql、為什麼 `routes/web.php` 要清空：這三個是這個 stack 裡少數沒得選的設計決策,Ep-3 會分章節各拆一段。

## ⚠️ 後記:照 quickstart 跑一遍,一次踩到四個訊號

ep-2 + ep-3 寫完之後,我自己跟著 [CLAUDE.md 本地開發 quickstart](https://github.com/hongyui/Carbon-ESG/blob/main/CLAUDE.md) 從頭走一次驗證,結果 transcript **一次給了四個訊號**：第一手記錄:

```text
➜  Carbon-ESG/backend (main) cd backend
cd: no such file or directory: backend                            ← 訊號 ①

➜  Carbon-ESG/backend (main) composer install
Nothing to install, update or remove
Generating optimized autoload files
...

➜  Carbon-ESG/backend (main) cp .env.example .env
➜  Carbon-ESG/backend (main) php artisan key:generate
   INFO  Application key set successfully.

➜  Carbon-ESG/backend (main) php artisan migrate --seed
   INFO  Nothing to migrate.                                      ← 訊號 ②

   INFO  Seeding database.

   BadMethodCallException
     Call to undefined method
     Database\Factories\UserFactory::createOrFirst()              ← 訊號 ③

➜  Carbon-ESG/backend (main) php artisan serve
   INFO  Server running on [http://127.0.0.1:8000].               ← 訊號 ④
```

四個訊號逐條看：**真正的 bug 只有 ③**,其他三個都是「看起來不對勁但其實預期」或「副作用」,值得各停下來看一秒。

### 訊號 ①:`cd backend` no such file：你已經在 `backend/` 裡了

跟 [Ep-3 的 `cd frontend` 失敗](/posts/openspec-重構老專案-ep-3/) 是同一個模式。CLAUDE.md 那段 quickstart 假設你從 repo root 開始,但我的 shell prompt 已經顯示 `Carbon-ESG/backend (main)`。修法是先 `pwd` 確認;CLAUDE.md 已補一行註腳「**以下從 repo root 跑;如果你已經在 backend/ 內,跳過 cd 那行**」。

### 訊號 ②:`migrate` 顯示 Nothing to migrate：不是坑,是預期

`composer create-project` 階段的 [post-create-project-cmd hook](#等等為什麼-create-project-結尾會自己-migrate) 已經跑過一次 `migrate --graceful`,加上 phase-0 開發過程中很可能在某次「測 docker mysql 連得通沒」時又跑過一次 `migrate`。`.env` 是同一份 mysql 連線設定,所以這時候再跑 `migrate`,Laravel 看到 schema 已經是最新狀態：Nothing to migrate 是**正確輸出**,不是壞掉。

> 反過來,如果你 `migrate` 顯示 Nothing **但 mysql 內查不到 table**,代表 backend 連的 DB 跟 docker mysql 不是同一個：檢查 `.env` 的 `DB_DATABASE` / `DB_HOST` / `DB_PORT` 三件套有沒有跟 docker mysql 對齊。常見問題是 `DB_HOST=mysql`(對 docker 內部 service name,適用 backend 也跑在 container 內)vs `DB_HOST=127.0.0.1`(backend 跑在 host 上,連 host 端口 forward)選錯。本系列 backend 跑在 host 上,所以是 `127.0.0.1`。

### 訊號 ③:seed 拋 `BadMethodCallException`：這個才是 bug

完整 stack trace:

```text
BadMethodCallException

  Call to undefined method Database\Factories\UserFactory::createOrFirst()

  at vendor/laravel/framework/src/Illuminate/Support/Traits/ForwardsCalls.php:67
   ...
  2  database/seeders/DatabaseSeeder.php:18
     Illuminate\Database\Eloquent\Factories\Factory::__call("createOrFirst")
```

原因很單純：**Laravel 的 `createOrFirst` 是 Model 上的方法,不是 Factory 上的**。task 2.10 原本寫的 `User::factory()->createOrFirst([...])` **不存在**:Factory 鏈那一端有 `create()` / `createMany()` / `createQuietly()`,**沒有 `createOrFirst()`**,所以 `Factory::__call()` 把這個未知 method 名 forward 到底層,最後 throw `BadMethodCallException`。

### 兩種「找不到就建,找得到就回現有」的正確寫法

| Method | 在哪裡 | 行為 |
|---|---|---|
| `Model::firstOrCreate($attrs, $values)` | Model 上(`User::firstOrCreate(...)`) | 先 `where $attrs` 查 → 有就 return,沒有就 `create($attrs + $values)`。讀寫之間**沒鎖**,並發 insert 可能撞 unique constraint |
| `Model::createOrFirst($attrs, $values)` | Model 上,Laravel 10+ | 先嘗試 `create($attrs + $values)`,撞 unique constraint 就改 `where $attrs` 取現有。**race-safe**,高並發場景推薦 |

兩個都在 Model,**Factory 沒有對等方法**。寫進 factory chain 上一定錯。

### 正確的 seeder

```php
// backend/database/seeders/DatabaseSeeder.php
public function run(): void
{
    User::firstOrCreate(
        ['email' => 'test@example.com'],
        [
            'name' => 'Test User',
            'password' => 'password',  // Laravel 11+ 的 password=>hashed cast 會自動 bcrypt
        ],
    );
}
```

Laravel 11+ User Model 預設 `casts()` 把 `password` 標成 `'hashed'`,**塞 plain string 進來會被自動 bcrypt**,不用 `Hash::make()`。

### 已踩到要怎麼救

`users` table 是空的(seed 在 transaction 內 throw,Laravel 預設會 rollback)。把 seeder 改好後直接重跑:

```bash
cd backend
php artisan db:seed
# 應看到 "Database seeding completed successfully."
php artisan tinker --execute="echo App\\Models\\User::count();"
# 1
```

### task 2.10 的精神還在,我寫錯的是介面

task 2.10 的目標「讓 `db:seed` 可重跑」(idempotency)沒問題：`firstOrCreate` 完全做到。**只是 method 該在 Model 上,不是 Factory chain 上**。Carbon-ESG repo 已經 hot-fix 進 seeder;phase-0 的 archived spec 沒提具體 method 名,所以 archived spec 仍 valid 不用回頭改。

### 訊號 ④:exception 後 `php artisan serve` 仍跑起來：不是補救,是 zsh 行為

很多人看到 transcript 第四行 `Server running on http://127.0.0.1:8000` 會以為「啊那 seed 應該也救回來了吧」： **不是**。zsh 用換行分隔指令(等同 `;`,不是 `&&`),**前面那行炸了不會擋下面那行**。serve 起得來只證明 **PHP runtime + Laravel application 載入沒問題**,跟 seeder 是不是炸了**完全無關**。

驗 seed 真的對不對,獨立跑兩條:

```bash
# 1. exit code 跟 INFO 訊息
php artisan db:seed
# 應看到 "INFO  Database seeding completed successfully."

# 2. DB 內 record 數
php artisan tinker --execute="echo App\\Models\\User::count();"
# 1
```

兩個都對才算 seed 真的過了。

> 如果你照 ep-2 寫的多行 quickstart 整段貼進 shell,**前面任何一個 artisan 指令炸了都不會擋後面**。要嚴格 fail-fast,改用 `&&` 串接,或在開頭加 `set -e`(bash / zsh 都支援)。實務上 quickstart 設計成「即使中間炸了也讓 server 起來方便 debug」反而更友善,所以本系列維持換行寫法：**但要記得 transcript 最後一行 success 不是整段成功的證明**。

## 收尾與下一篇預告

到這裡你應該手上有:

- `php -v` 看到 8.2 以上的版本
- `composer --version` 看到 2.x 的版本

兩個都齊了,你就有資格跑 phase-0 task 2.1。

下一篇 **Ep-3** 我會接著做 Carbon-ESG phase-0 的 task 2.2 ~ 2.11:把 Laravel Sanctum、CORS、Pest 一起接上去,並且在 Sanctum 的設定值那段順便講清楚「為什麼我們不選 token,而是 SPA 模式 + httpOnly cookie」： 這是這個 stack 裡少數沒得選的決策之一,值得單獨拆開講。
