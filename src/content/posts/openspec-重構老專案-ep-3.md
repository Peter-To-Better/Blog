---
title: "OpenSpec 重構老專案 Ep-3:Next.js 16 前端開工"
pubDate: 2026-06-12 23:00:00
description: "前端用 pnpm create next-app 開工。這篇拆解那行指令背後的 8 個 flag，完整解掉 ERR_PNPM_IGNORED_BUILDS（Ignored build scripts: sharp）的 approve-builds 陷阱、Node 版本怎麼對齊、首頁怎麼砍到 14 行驗證後端。"
author: "Peter"
tags: ["重構筆記", "OpenSpec", "Next.js", "React"]
category: "重構筆記"
keywords: "Next.js 16, pnpm create next-app, React 19, App Router, Turbopack, Tailwind v4, pnpm approve-builds, ERR_PNPM_IGNORED_BUILDS, Ignored build scripts sharp, Carbon-ESG"
draft: false
---

## 本篇重點

[Ep-2](/posts/openspec-重構老專案-ep-2/) 把後端 scaffold 推完了,Ep-3 換前端。一條 `pnpm create next-app` 指令,看似一鍵搞定,實際上**藏了五件事值得停下來想**:

1. 它背後跑的 8 個 flag,每一個都是設計決策
2. pnpm 11 之後預設**擋住所有 native build scripts**,所以 sharp / unrs-resolver 第一次 install 一定會出 `Aborting installation`,你要會解
3. `.nvmrc` 寫 20.19.0,我本機卻是 Node 24：怎麼降版?要不要降?
4. 預設 starter 給的首頁 65 行充滿 Vercel 廣告連結,要怎麼換成「能驗證後端通了」的最小版
5. `lib/api.ts` 的 axios 為什麼一字一句長那樣：那不是隨便寫,而是**對齊 Sanctum SPA 模式的契約**

Ep-2 結尾原本說 Ep-3 要講 Sanctum,但實際拆下去發現「Next.js scaffold + 前後端 cookie 對接」放一篇太擠。所以這篇先把前端站起來,**Sanctum SPA 完整對接(CSRF / cookie / Bootstrap middleware / 第一個 protected 路由)留 Ep-4 專場拆**。

<!-- more -->

## 為什麼選 Next.js 16,不選 Vite / Remix / TanStack Start

Carbon-ESG 這套 stack 選 Next.js 16 不是因為它最潮,而是這個專案的形狀剛好對得上 Next.js 的強項:

| 我們的需求 | Next.js 16 怎麼回應 |
|---|---|
| **多角色頁面(admin / seller / buyer / worker)分區 layout** | App Router 的 nested layout 用 route group `(admin)` / `(buyer)` 直接切 |
| **後端 Laravel 已當 API,前端是純 SPA + 少量 SSR(首頁、產品列表)** | App Router 預設 RSC,什麼時候 server / 什麼時候 client 自己選 |
| **React 19 的 server actions / use() / form actions** | Next.js 16 是第一個全鏈路支持 React 19 的版本 |
| **Tailwind v4 + 第三方元件庫(可能 shadcn/ui)** | App Router + Tailwind v4 官方模板 first-class |
| **本地 dev 跑要快(熱重整)** | Turbopack 在 16 已 stable,**比 webpack-based dev server 快一個量級** |

Vite + React Router 也能做,但要自己接 SSR / RSC / 部署到 edge / sitemap,**Next.js 是 batteries-included 版**,對重構這種「先把東西兜起來」階段 trade-off 划算。Remix 已經併入 React Router(v7),它跟 TanStack Start 都好,但生態跟 Vercel deploy 摩擦最小的還是 Next.js。

> 如果是純前端 SPA 沒 SSR 需求,Vite 是更輕的選擇。**重要的是看你的形狀,不是看誰最新**。

## 第一條指令:`pnpm create next-app`

[Carbon-ESG phase-0 task 3.1](https://github.com/hongyui/Carbon-ESG/blob/main/openspec/changes/phase-0-bootstrap-monorepo/tasks.md) 寫的是這條:

```bash
pnpm create next-app@latest frontend \
  --typescript \
  --eslint \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias="@/*" \
  --use-pnpm \
  --yes
```

每個 flag 都是一個設計決策的縮寫。逐條拆:

| Flag | 它在做什麼 | 為什麼這樣選 |
|---|---|---|
| `pnpm create next-app@latest` | 透過 pnpm 跑 create-next-app 最新版 | 對齊 backend 用 Composer、frontend 用 pnpm 的雙語套件管理。`@latest` 是因為我們鎖了 Next.js 16,要拉到對應版本的 scaffolder |
| `frontend` | 把專案放到 `frontend/` 子目錄 | 對齊 [monorepo 設計](/posts/openspec-重構老專案-ep-1/)：`/backend/` + `/frontend/` 雙子專案 |
| `--typescript` | 用 TypeScript 而不是 JS | 不解釋,2026 年沒有理由開新 React 專案不用 TS |
| `--eslint` | 內建 ESLint 設定 | 對 PR review 一致性是必要,而且 Next.js 自帶的 `eslint-config-next` 有 Core Web Vitals 規則 |
| `--tailwind` | 內建 Tailwind v4 + PostCSS 設定 | Carbon-ESG 不想自己刻 CSS 跟 design tokens,Tailwind v4 + shadcn/ui 是現在 React 生態最低摩擦 |
| `--app` | 用 App Router(不要 Pages Router) | App Router 是 Next.js 13+ 的當前默認;Pages Router 雖然仍支援但屬於 legacy |
| `--no-src-dir` | 不要建 `src/` 子目錄,直接把 `app/` `lib/` 放在 root | 個人偏好。`src/` 多一層 indirection,對全 TS 專案沒帶來什麼好處 |
| `--import-alias="@/*"` | 設定 `@/lib/api` 這種 alias 路徑 | 對齊 shadcn/ui 文件預設,以後抄範例不用每次改路徑 |
| `--use-pnpm` | 用 pnpm 跑 install,不要 npm | 對齊 [Ep-1 鎖死決策](/posts/openspec-重構老專案-ep-1/) 的「frontend 用 pnpm」 |
| `--yes` | 跳過所有互動式提問,全用 flag 預設值 | 給 CI / scripted scaffold 用。沒這個 flag 你會被問 7 次 yes/no |

## 第一個坑:`ERR_PNPM_IGNORED_BUILDS` Ignored build scripts：pnpm 11 擋住了 native build

第一次跑會看到這段:

```
+ next 16.2.9
+ react 19.2.4
...

[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: sharp@0.34.5, unrs-resolver@1.12.2

Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.

Aborting installation.
  pnpm install has failed.
```

這不是 Next.js 的問題,是 **pnpm 11 開始的新安全政策**:

> 任何 npm package 在 install 後可以掛 `postinstall` script(編譯 native binary、下載額外資源、跑 prebuild 等等)。**這也是供應鏈攻擊的常見入口**。pnpm 11 預設**全部不跑**,要你明確列出哪些 package 允許跑。

Next.js 16 預設依賴兩個會跑 build script 的 package:

| Package | 為什麼要 native build |
|---|---|
| `sharp` | image optimization 的核心,跑 libvips C++。沒編好的話 Next.js 會 fallback 到純 JS 版,效能差 5~10 倍 |
| `unrs-resolver` | Next.js 16 的新 module resolver(Rust 寫的),取代過去的 enhanced-resolve。也要編 Rust 出 `.node` |

兩個都要編,所以兩個都得列。最乾淨的解法是在 `frontend/package.json` 加上:

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["sharp", "unrs-resolver"]
  }
}
```

加完之後 `pnpm install` 不會再 abort,**但已經 install 過一次的話 native build 不會自動補跑**：要再手動觸發:

```bash
cd frontend
pnpm rebuild sharp unrs-resolver
```

之後任何 fresh clone 跑 `pnpm install --frozen-lockfile` 都會吃到這個白名單,build 自動執行。`onlyBuiltDependencies` 是現代 pnpm 專案標配,**值得跟 `engines.node` 一起寫死**。

> ⚠️ **不要圖快用 `pnpm config set ignore-scripts false`**,那是 global 開放所有 package 跑 script,把 pnpm 11 的供應鏈防線整個拆掉。`onlyBuiltDependencies` 是 per-project allowlist,精準很多。

## 第二個坑:`.nvmrc` 寫 20.19.0,但我本機是 Node 24

phase-0 task 4.2 在 repo root 放了:

```
20.19.0
```

但我跑 `node -v` 是:

```
v24.11.1
```

Next.js 16 官方支援的最高版本是 Node 22 LTS(撰文時),Node 24 還在 Current,Next.js 16 文件沒明確說有測試過。實際跑得起來,但**生產環境跟 CI 都不該追到 Node 24**。

兩個處理方向:

### 我 / 隊友是用 nvm

```bash
# 第一次:照 .nvmrc 裝 + 切過去
nvm install $(cat .nvmrc)
nvm use

# 之後每次進這個 repo
nvm use
```

shell 裡掛這個 hook,進到任何含 `.nvmrc` 的目錄就自動切版本:

```bash
# ~/.zshrc(或 .bashrc)
autoload -U add-zsh-hook
load-nvmrc() {
  if [[ -f .nvmrc ]]; then nvm use --silent; fi
}
add-zsh-hook chpwd load-nvmrc
load-nvmrc
```

### 我用 fnm / volta / asdf

`fnm` 跟 `volta` 都會讀 `.nvmrc`,行為一致。`asdf` 要 `.tool-versions`,把 `.nvmrc` 內容也複製一份過去:

```
nodejs 20.19.0
```

我自己用 nvm,所以 Ep-3 後續所有指令都假設 `nvm use` 已經跑過。

## 把預設首頁砍掉,換成 14 行 minimal

`pnpm create next-app` 給的 `app/page.tsx` 是 65 行,塞滿 Vercel templates 跟 docs 連結。對我們沒意義,而且**藏了一個讓 Ep-3 後續測試卡關的東西**:它預設用 `<Image src="/next.svg" />`,所以你看到「首頁能載入」**不代表後端 API 接得通**。

最小化目標:**首頁顯示我們連的 backend URL,讓「前端起得來 + 環境變數讀得到」兩件事一次驗證掉**。

```tsx
// frontend/app/page.tsx
export default function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 font-sans">
      <h1 className="text-4xl font-bold">Hello, Carbon-ESG</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Backend API:{' '}
        <code className="rounded bg-zinc-100 px-2 py-1 font-mono dark:bg-zinc-800">
          {apiUrl}
        </code>
      </p>
    </main>
  );
}
```

關鍵兩個選擇:

1. **沒寫 `'use client'`**：預設是 RSC(Server Component)。`process.env.NEXT_PUBLIC_API_URL` 在 build time / server 都讀得到,**不需要 client 端 hydration**。這是 App Router 寫法該有的肌肉記憶
2. **`process.env.NEXT_PUBLIC_API_URL ?? fallback`**：Next.js 規則:`NEXT_PUBLIC_` 開頭的環境變數會被 bundle 進 client。沒設就 fallback 到 localhost:8000,**避免本機沒 `.env.local` 也能跑**

要 surface 環境變數,前端對應的 `.env.example` 也要寫:

```bash
# frontend/.env.example
NEXT_PUBLIC_API_URL=http://localhost:8000
```

第一個 dev 用的人:`cp .env.example .env.local && pnpm dev`。

## `lib/api.ts`:不是隨便寫的 axios 設定

[Carbon-ESG phase-0 task 3.3](https://github.com/hongyui/Carbon-ESG/blob/main/openspec/changes/phase-0-bootstrap-monorepo/tasks.md) 要建一個 axios client,規格寫得很細:

> `withCredentials: true`, `withXSRFToken: true`, `xsrfCookieName: "XSRF-TOKEN"`, `xsrfHeaderName: "X-XSRF-TOKEN"`, plus an `ensureCsrfCookie()` helper

這四個值 + 一個 helper 不是 axios 預設,**每一個都是因為對接 Sanctum SPA 模式而出現**。先給你完整檔:

```ts
// frontend/lib/api.ts
import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

let csrfFetched = false;

export async function ensureCsrfCookie(): Promise<void> {
  if (csrfFetched) return;
  await api.get('/sanctum/csrf-cookie');
  csrfFetched = true;
}
```

每一行為什麼長這樣,**短版這篇先講**,**完整 Sanctum SPA 對接機制(CSRF token 怎麼走、bootstrap/app.php 的 statefulApi 怎麼設、Laravel cookie domain 怎麼跟 Next.js 對齊)留到 Ep-4**:

| 設定 | 為什麼 |
|---|---|
| `withCredentials: true` | 允許跨 origin 帶 cookie(預設是不帶)。Sanctum SPA 模式靠 session cookie 識身分,沒這個一切免談 |
| `withXSRFToken: true` | axios 自動把指定 cookie 內的值塞進 `X-XSRF-TOKEN` header。Laravel 的 `VerifyCsrfToken` middleware 預期這個 header |
| `xsrfCookieName: 'XSRF-TOKEN'` | Laravel `sanctum/csrf-cookie` 設的 cookie 名 |
| `xsrfHeaderName: 'X-XSRF-TOKEN'` | Laravel 預期的 CSRF header 名 |
| `ensureCsrfCookie()` | Sanctum SPA 流程的第一步:**在第一次 stateful request 前,先 GET `/sanctum/csrf-cookie` 拿到 XSRF 跟 session cookie**。第二次以後不用再拿,所以用 `csrfFetched` flag 防止重複 |

> ⚠️ `withCredentials: true` 只開了「我願意帶 cookie」,**Laravel 那邊也要對應允許**(`config/cors.php` 的 `supports_credentials: true`、`SANCTUM_STATEFUL_DOMAINS` 列你的前端 host)。這兩邊任何一邊缺,瀏覽器就吞 cookie,你會在 Network 看到 200 但拿不到登入態。Ep-4 會 demo 怎麼 debug 這條鏈。

## 收尾:Phase-0 前端的成績單

跑完上面所有東西後,你的 `frontend/` 應該長這樣:

```
frontend/
├── app/
│   ├── layout.tsx        # 預設保留
│   ├── globals.css       # Tailwind v4 預設 import
│   └── page.tsx          # ← 換成 14 行 minimal
├── lib/
│   └── api.ts            # ← 我們建的 axios client
├── public/               # 預設保留
├── .env.example          # ← 新增,NEXT_PUBLIC_API_URL
├── .gitignore            # 預設(已含 .next, node_modules, .env*.local)
├── eslint.config.mjs     # 預設
├── next.config.ts        # 預設
├── package.json          # ← 加了 engines.node + pnpm.onlyBuiltDependencies
├── pnpm-lock.yaml        # 跟著 lockfile 走
├── postcss.config.mjs    # Tailwind v4 預設
└── tsconfig.json         # 預設,含 `@/*` alias
```

驗收三條指令:

```bash
cd frontend
pnpm install --frozen-lockfile      # 應該 install 成功 + sharp/unrs-resolver native build
pnpm dev                             # http://localhost:3000
curl http://localhost:3000           # 應該看到含 "Hello, Carbon-ESG" 的 HTML
```

瀏覽器打開 `localhost:3000`,看到「**Hello, Carbon-ESG · Backend API: `http://localhost:8000`**」,前端 phase-0 就收工。

## 踩坑實錄:跑驗收三條指令真實發生了什麼

寫完上面那段「跑這三條就收工」的瞬間我就意識到：我自己**還沒實際打過那三條**。把 ep-3 草稿丟過去第一次走完,連鎖炸了五次:

```text
➜  frontend (main) cd frontend
cd: no such file or directory: frontend

➜  frontend (main) pnpm install --frozen-lockfile
Lockfile is up to date, resolution step is skipped
Already up to date
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: sharp@0.34.5, unrs-resolver@1.12.2
  ↑ exit 0,看起來 OK。實際上 sharp/unrs-resolver 的 native 檔根本沒編出來。

➜  frontend (main) pnpm dev
[ERROR] Command failed with exit code 1: pnpm install
    at runDepsStatusCheck (.../pnpm.mjs:212745:7)
  ↑ 我沒打 install,但 pnpm dev 偷偷在前面跑了一次。為什麼?

➜  frontend (main) curl http://localhost:3000
curl: (7) Failed to connect to localhost port 3000 after 0 ms
  ↑ dev 沒起來,curl 自然連不到。
```

五個問題壓在一起,每一個都值得拆:

### 1. `cd frontend` 失敗：你已經在 `frontend/` 裡了

你的 prompt 已經顯示 `frontend (main)`,再打一次 `cd frontend` 自然找不到 `frontend/frontend/`。永遠先 `pwd` 確認再動：**或者寫 blog 教學的人少給一句 `cd frontend`,我就是後者,認**。

### 2. `--frozen-lockfile` exit 0,但 build 沒跑：這是真正的陷阱

`onlyBuiltDependencies` 是我在 `package.json` 加上去之後,**lockfile 早就被前一次失敗的 install 凍住了**。`--frozen-lockfile` 的契約是:**驗證 lockfile 跟 `package.json` 解出來的 deps tree 一致,不重 resolve**。它根本不檢查 approval 規則變了沒。

所以你會看到 exit 0(lockfile 真的 valid)、warning(builds 沒跑)、`node_modules/sharp/build/Release/*.node` **不存在**。production build 會 fallback 到純 JS sharp,慢 5~10 倍：而你**在 dev mode 完全發現不了**,因為 dev 也 fallback,只是稍慢一點。

> 教訓:`--frozen-lockfile` 看到的是 lockfile 形狀對,不是 install 真的乾淨。要驗 native 編好沒,看 `node_modules/sharp/build/Release/` 有沒有 `.node`,**不要相信 exit code**。

### 3. `pnpm dev` 為什麼會偷跑 `pnpm install`?

堆棧 trace 的 **`runDepsStatusCheck`** 就是答案。pnpm 11 在跑任何 script (`dev` / `build` / `test`) **之前**會先做一個 cheap check:

> 「我看到的 `package.json` 跟手上的 lockfile / node_modules 一致嗎?不一致的話,我先幫你 `pnpm install` reconcile 再跑 script。」

立意良善：避免「`package.json` 改了忘記 install 就跑 dev → import 找不到」的尷尬。但它跑的 install 同樣會被 `onlyBuiltDependencies` 的 approval 機制擋住,於是:

```
[ERR_PNPM_IGNORED_BUILDS] → install exit 1 → dev 連帶 abort
```

### 4. `curl` connection refused 是徵兆,不是 root cause

step 3 abort 之後沒人在 listen 3000 port,curl 立刻收到「對方沒開 socket」的 TCP RST。`after 0 ms` 那個 **0 ms** 就是線索：真的 dev 在 boot 的話,curl 會等 `--connect-timeout` 而不是秒拒。

### 5. 為什麼 `pnpm install --force` 跟 `pnpm rebuild` 都救不了

我嘗試過 `--force` reinstall、嘗試過 `pnpm rebuild sharp unrs-resolver`、嘗試過 `pnpm install` non-frozen：全部都顯示 `Ignored build scripts`。**pnpm 11 把 build approval 拉到比 lockfile 還高階的層級**:就算 `package.json` 列了 `onlyBuiltDependencies`,**這個版本仍要求你親自過一次 `pnpm approve-builds` 互動式確認**才會把 approval 寫進 user-level 信任 store(`~/.pnpm-config.yaml` 之類),之後同一台機器才不再問。

也就是說：`package.json` 的 `onlyBuiltDependencies` 是「**我這個 repo 同意跑哪些 build**」,而 `pnpm approve-builds` 是「**我這個人類同意我這台機器跑那些 build**」,**兩件事**,缺一不可。

### 真正能解的指令

```bash
cd frontend
pnpm approve-builds          # 互動式 — 用上下鍵選 sharp + unrs-resolver、空白鍵打勾、Enter 確認
pnpm install                  # 這次 native build 真的會跑
ls node_modules/sharp/build/Release/*.node     # 應該看到 sharp-darwin-arm64.node 之類
pnpm dev                      # 這次起得來
curl -s http://localhost:3000 | head -c 200    # 看到 <main> 區塊 + Hello, Carbon-ESG
```

`pnpm approve-builds` 在 macOS / Linux 都用同一套 keyboard control,Windows PowerShell / Git Bash 也認。**這個指令一台機器跑一次就夠**,之後 fresh clone 同一個 repo 不用再跑(approval 是 user 信任,不是 repo 屬性)。

### 續集:`approve-builds` 自己也有兩個地雷

我寫完上一段「真正能解的指令」、實際照走的時候**又**炸了一次：`pnpm approve-builds` 的 prompt UX 藏了兩個容易誤觸的設計:

**地雷 ①:第一個 prompt 不勾就過 = 全部 decline**

```
✔ Choose which packages to build
  (Press <space> to select, <a> to toggle all, <i> to invert selection)
  · No items were selected

All packages were added to allowBuilds with value false.
```

它**第一句寫 `Press <space> to select`,但很多人下意識直接按 Enter**：結果 pnpm 把它解讀成「你看過名單了、什麼都不勾、那就是全部不准跑」,寫進 **user-level state**(macOS 路徑類似 `~/Library/pnpm/` 之下的 yaml)。**之後再跑 `pnpm approve-builds` 會回 `There are no packages awaiting approval`**：因為決議已下、pnpm 不再問。

正確操作:**`a` 切換全選 → `Enter` 進確認 → 然後再對下一個 `Do you approve? (y/N)` 打 `y`**(下面說)。

**地雷 ②:確認 prompt 預設是 `N`,直接 Enter = 拒絕**

```
✔ The next packages will now be built: sharp, unrs-resolver.
  Do you approve? (y/N) · false
```

`(y/N)` 大寫的 N 是 default：你直接 Enter 就**等於拒絕**,而且輸出最後一行寫 `· false` 就是當前選的值。**要明確打 `y` 再 Enter**。

兩個都踩中的話,你會看到的 net effect 就是 transcript 那樣:install 仍 IGNORED_BUILDS,但 approve-builds 反而說「沒東西好選」。

### 已經誤觸 decline,怎麼救回?

pnpm 11 把 user-level decline 寫進 state file,**不會因為砍 `node_modules` / `pnpm-lock.yaml` 而 reset**。三個解法,挑一個:

```bash
# 方案 A:用 cli 直接 toggle 那兩個 package(pnpm 11.1+ 支援)
pnpm approve-builds --interactive sharp unrs-resolver

# 方案 B:手動編輯 pnpm user state 砍掉 false 紀錄
# macOS 路徑(Linux 類似):
open ~/Library/pnpm 2>/dev/null || echo "找 pnpm state dir 看 yaml/json 把 sharp/unrs-resolver 的 allowBuilds: false 刪掉"

# 方案 C:直接放生 — dev mode 不需要 sharp 也能跑(下節解釋為什麼)
```

### 等等:為什麼我 decline 了 build,`pnpm dev` 還是 200?

這就是 **Next.js 16 + Turbopack** 的甜頭。Turbopack 自己處理 image transformation,**dev mode 完全不 require sharp**;sharp 只有在 `next build`(production)時才會被 require,而且**沒 native binary 會 fallback 到純 JS sharp,慢 5~10 倍但不會炸**。

所以你看到 `✓ Ready in 326ms` 跟 `GET / 200`,phase-0 dev 環境就**已經算是合格**。production build 那邊欠的人情,等 phase-1 進 deploy 章節再還(到時候 sharp native 一定要解,不然 Vercel / 自架 build server 跑出來的 image optimization 一塌糊塗)。

### Take-away 比想像中乾淨

如果你只關心「能不能跑」,**直接挑方案 C 放生**,phase-0 收工沒問題。`onlyBuiltDependencies` 跟 `pnpm approve-builds` 真正開始 bite 是在 production build,**而 phase-0 還沒到那一步**。

> 給隊友的 onboarding checklist 因此要寫成兩段:
> - **想完整跑 production build**:fresh clone 後第一件事,`pnpm approve-builds`,**用空白鍵勾選**、再對 `(y/N)` 打 **`y`**,兩個 prompt 都不能直接 Enter
> - **只想 dev mode 改東西**:跳過 approve-builds,`pnpm install && pnpm dev` 就夠了
>
> 這條 checklist 之後會塞進 Carbon-ESG 的 `frontend/README.md`,免得下個人重踩(下面「兌現承諾」章節給完整 README 範本)。

## 解讀 `pnpm dev` 起來的那段訊息

`approve-builds` 救完之後 `pnpm dev` 應該長這樣:

```text
$ next dev
▲ Next.js 16.2.9 (Turbopack)
- Local:         http://localhost:3000
- Network:       http://192.168.100.2:3000
✓ Ready in 326ms

 GET / 200 in 1889ms (next.js: 1725ms, application-code: 164ms)
```

四行看起來就是「server 起來了」,但**每個數字對應一段不同的工作**：拆開看,之後 debug 慢頁面、慢 SSR 時非常有用。

### `▲ Next.js 16.2.9 (Turbopack)`：bundler 是 Turbopack 不是 webpack

Next.js 13 / 14 跑 `next dev` 預設是 webpack,要明確 `next dev --turbo` 才用 Turbopack。**Next.js 16 反過來:dev 預設就是 Turbopack**,要關掉得 `next dev --no-turbo`(很少人會)。看到第一行有 `(Turbopack)` 才是預期：沒有的話檢查 `next.config.ts` 或 `package.json` scripts 是不是被改過。

### `✓ Ready in 326ms`：server cold start 完成,但**還沒 compile 任何 page**

「Ready」的意思是 **Next.js HTTP server + Turbopack bundler + RSC runtime 三者都載入完成,可以接 request 了**。326ms 是我這台 M-series Mac 的數字;Intel Mac 通常 800ms ~ 1.5s,Linux 約 500ms。**這時候你的 `app/page.tsx` 還沒被 compile**,第一個 request 進來才開始 build。

對比 Next.js 14 webpack dev server 同樣專案 cold start 通常 3 ~ 5 秒,Turbopack 5~10× 加速主要就是這一段：webpack 啟動就要 parse 全部 module graph,Turbopack 是 lazy。

### `GET / 200 in 1889ms (next.js: 1725ms, application-code: 164ms)`：第一次 request 的分工

這行是 Next.js 16 dev server 新加的細顆粒 timing,**第一次 GET 永遠比之後慢一個量級**,因為它包含三件事:

| 數字 | 在做什麼 |
|---|---|
| `1889ms` | 整個 request → response 端到端 |
| `next.js: 1725ms` | Turbopack 第一次 compile 這個 page 的 RSC bundle + Tailwind v4 PostCSS + RSC 渲染管線初始化。**只在首次 GET 出現這麼大** |
| `application-code: 164ms` | 純跑你寫的 `app/page.tsx` server component 邏輯(讀 `NEXT_PUBLIC_API_URL` env、渲染 JSX) |

**`1725ms` 是 build cost,`164ms` 才是你 code 真的執行時間**。debug 慢頁面時看 `application-code` 那欄才有意義,別被 1889ms 嚇到。

打開瀏覽器再 reload 一次,看到:

```text
 GET / 200 in 178ms (next.js: 24ms, application-code: 154ms)
```

`next.js` 從 1725ms 砍到 24ms：已 compile 的 bundle 直接複用,**這就是 Turbopack HMR 的甜頭**。`application-code` 仍是 154ms(SSR 真實成本,不會被 cache 掉)。

> phase-1 寫 protected 路由跑 Sanctum auth 時,`application-code` 通常會跳到 300~600ms：因為每個 request 都要 server-side 打 backend 拿 session。到時候這條 timing line 就是 debug latency 的第一線。

## 兌現承諾:`frontend/README.md` onboarding checklist 範本

上面兩次提到「會塞進 `frontend/README.md`」,這就是完整版本,你可以照抄到自己的 repo(我同時 commit 進 Carbon-ESG 的 `frontend/README.md` 兌現承諾):

````markdown
# Carbon-ESG Frontend

Next.js 16 + React 19 + Tailwind v4 + axios。Sanctum SPA 模式對接 [backend](../backend)。

## First-time setup(每台機器只跑一次)

```bash
# 1. Node 版本對齊 .nvmrc
nvm use                       # 期望 v20.19.0(或同 major)

# 2. pnpm 11 安全 gate
#    只想 dev mode 改東西可以跳過;production build 才會用到 sharp native binary
cd frontend
pnpm approve-builds
#   - 用 [space] 勾選 sharp + unrs-resolver、Enter 確認
#   - 對 (y/N) 打 "y"(大寫 N 是 default,直接 Enter 等於拒絕,踩過一次)
```

## 每次開發(三個 terminal)

```bash
# Terminal 1:docker stack(mysql / redis / mailpit)： 從 repo root
docker compose up -d --wait

# Terminal 2:backend
cd backend && php artisan serve     # http://localhost:8000

# Terminal 3:frontend(本資料夾)
cd frontend
pnpm install                         # 第一次 / pull 後跑;pnpm 11 之後通常自動 reconcile
pnpm dev                              # http://localhost:3000
```

打開 `http://localhost:3000` 應看到「**Hello, Carbon-ESG · Backend API: `http://localhost:8000`**」。

## 環境變數

`cp .env.example .env.local`,依需要改 `.env.local`。
**`.env.local`** 是 Next.js 讀的本機 override,跟 repo root 的 `.env`(docker-compose 用)是**兩份 env,別搞混**。

## 結構

- `app/` — Next.js 16 App Router(RSC 預設)
- `lib/api.ts` — Sanctum-aware axios client(`withCredentials` + `withXSRFToken` + `ensureCsrfCookie()`)
- `public/` — 靜態資源

## 文件

- 設計決策見 repo root [CLAUDE.md](../CLAUDE.md)
- 後端 / 前端 / docker / Node 版本的 spec 見 [`openspec/specs/bootstrap/spec.md`](../openspec/specs/bootstrap/spec.md)(phase-0 archive 後生效)
````

幾個值得停下來看的設計:

1. **First-time setup 跟「每次開發」切兩段**：跳過 `approve-builds` 的選擇權留給「只想 dev mode」的人,不強制解 sharp,讀者照走不被嚇跑
2. **「每次開發」明確標三個 terminal**：docker / backend / frontend 不能擠一個 shell,寫清楚省得讀者誤以為一條指令搞定
3. **`.env.local` ≠ `.env`**：Next.js 讀 `.env.local`、docker-compose 讀 root `.env`,**兩份 env 各管各的**(這個誤解 [Ep-2 的後記章節](#後記照-quickstart-跑一遍一次踩到四個訊號) 也提過,值得再 ping 一次)
4. **「文件」section 連回 `CLAUDE.md` / `specs/bootstrap/spec.md`**：README 只負責 onboarding 不負責設計決策,真相回到 OpenSpec specs

## 收尾不是 commit,是 `/opsx:archive`

如果你是跟著 [Ep-1 的 OpenSpec 紀律](/posts/openspec-重構老專案-ep-1/) 做的,**phase-0 跑到這裡還沒結束**：change 還在 `openspec/changes/phase-0-bootstrap-monorepo/` 待命中。OpenSpec 對「change 真的完成」的定義是:**delta spec 寫回 `openspec/specs/`,change 目錄移進 `archive/`**。這個動作叫 archive。

在 Claude Code 對話框打:

```
/opsx:archive
```

它會:

1. 跑一次 `openspec validate --all`,確認 change + 所有 specs 都 valid
2. 把 `openspec/changes/phase-0-bootstrap-monorepo/specs/bootstrap/spec.md`(delta)**合進** `openspec/specs/bootstrap/spec.md`(永久真相)
3. 把整個 `phase-0-bootstrap-monorepo/` 目錄移到 `openspec/changes/archive/<timestamp>-phase-0-bootstrap-monorepo/`
4. 給你一個 commit 草稿(`chore(openspec): archive phase-0-bootstrap-monorepo`)讓你 review 後送出

**為什麼這個動作不能省**:

- **下一個 change 才開得了**：同時間只能有一個 active change(同 [Ep-1 的規則](/posts/openspec-重構老專案-ep-1/)),phase-1-auth-sanctum 要動,phase-0 就得先 archive
- **新人 onboarding 讀 `openspec/specs/`**：phase-0 沒 archive,`specs/` 就是空的,新人讀不到「這個專案決定了什麼」
- **Phase-0 的 spec 變成可被 phase-1 引用的真相**：archive 之後 `specs/bootstrap/spec.md` 永久存在,phase-1 的 delta 寫 `## MODIFIED Requirements` 才知道在改什麼

### 實際跑下去長什麼樣

我自己照這條跑完一次,把 transcript 攤開給你對照：不一樣的話通常代表某個 artifact 沒完成,回頭看 `openspec status --change <name> --json` 找差距。

**Stage 1:確認 artifact + tasks 都 complete**

Claude Code 跑 `openspec status` 並 parse JSON:

```
isComplete: True
artifacts: [('proposal','done'), ('design','done'), ('specs','done'), ('tasks','done')]
incomplete-tasks: 0
delta-specs: ['.../changes/phase-0-bootstrap-monorepo/specs/bootstrap/spec.md']
```

任一個 `not done` 或 incomplete-tasks > 0,archive 會 warn 並 ask confirmation,不會直接擋。但你應該回去把缺的補上,不要硬 archive 一個半完成的 change。

**Stage 2:比對 delta vs main spec,問你要不要 sync**

phase-0 是 Carbon-ESG 第一個 change,`openspec/specs/` 是空的,所以 delta 100% 新增、零衝突。`/opsx:archive` 會跳出 AskUserQuestion 兩個選項:

| 選 | 動作 |
|---|---|
| **Sync now (recommended)** | 建立 `openspec/specs/bootstrap/spec.md`,寫進 4 個 requirements |
| Archive without syncing | 只搬 change 進 archive,main specs 保持空 |

幾乎所有場景都選 sync：沒 sync 等於 phase-0 的真相只活在 archive,新人讀 `openspec/specs/` 看到空目錄會懷疑這個 repo 沒在用 OpenSpec。

**Stage 3:sub-agent 跑 sync,寫進 main spec**

`/opsx:archive` 不自己 sync,它 spawn 另一個 agent 跑 `openspec-sync-specs` skill(skill 解耦的設計,後續 `phase-1-auth-sanctum` 有 `## MODIFIED Requirements` 的時候同一套 agent 也能處理)。回報:

```
Created openspec/specs/bootstrap/spec.md
  + Purpose section
  + 4 requirements (7 scenarios in total)
  Validation: openspec validate --all → 2 passed, 0 failed
```

**Stage 4:`mv` 整個 change 目錄進 archive/**

```bash
mv openspec/changes/phase-0-bootstrap-monorepo \
   openspec/changes/archive/2026-06-12-phase-0-bootstrap-monorepo
```

目錄名是 `YYYY-MM-DD-<change-name>`,**不是 timestamp**。同一天 archive 兩個同名 change 會撞名(罕見場景但提醒一下,通常 change name 已經夠 unique 不會撞)。

跑完 `openspec list` 應該顯示:

```
No active changes found.
```

`openspec validate --all` 從「驗 spec + 驗 change」變成只驗 spec:

```
✓ spec/bootstrap
Totals: 1 passed, 0 failed (1 items)
```

這就是 phase-0 從「進行中的 change」變成「永久真相」的瞬間。

### archive **不會幫你 commit**：git working tree 還在動

很多人以為 `/opsx:archive` 是 atomic 的「全做完」,但它**只動 working tree**,**不 commit**。`git status -s` 跑下去你會看到三類變化:

```
?? openspec/changes/archive/2026-06-12-phase-0-bootstrap-monorepo/   ← 整個 change 搬過來(untracked)
?? openspec/specs/bootstrap/spec.md                                   ← sync 新建的 main spec(untracked)
 D openspec/changes/phase-0-bootstrap-monorepo/<整段原本的資料夾>     ← 原 path 被 mv 走(missing)
```

`mv` 在 git 眼裡是「舊 path 消失 + 新 path 出現」兩件事。等你 `git add -A openspec/` 之後 git 才會偵測「這其實是 rename」並把 diff 摺成 `R`(rename)。

收尾的 commit:

```bash
git add -A openspec/
git status -s              # 確認只動 openspec/ 內容,沒有誤碰 backend/frontend
git commit -m "chore(openspec): archive phase-0-bootstrap-monorepo

Synced delta spec into openspec/specs/bootstrap/spec.md
(4 requirements, 7 scenarios). Moved change directory into
archive/2026-06-12-...
"
```

commit 出去之後 `git log --oneline | head` 應該長這樣:

```
<新 commit> chore(openspec): archive phase-0-bootstrap-monorepo
d123015     feat(frontend): scaffold Next.js 16 with axios client
d8127cc     refactor: swap mailhog for axllent/mailpit (arm64 native)
c2701b6     chore: add docker-compose, .nvmrc, .gitignore, .env.example
5280d14     feat(backend): scaffold Laravel 12 with Sanctum, CORS, Pest
214dd75     chore(openspec): mark phase-0 task 1.1 done
54f4a48     feat: add CLAUDE.md for project guidance and refactoring decisions
```

到這一刻,**phase-0 才真的歷史化**：repo 從此記住「這 4 個 bootstrap requirements 在這個 commit 之後就是真相」,任何後續 phase 想動它都要寫 `## MODIFIED Requirements` 通過 OpenSpec 流程。Ep-4 預設你已經跑過 archive + commit,直接從 phase-1 開始,不會回頭講這段。

## 下一篇 Ep-4 預告:Sanctum SPA 端到端對接

Ep-3 留了一個尚未驗證的承諾:**`lib/api.ts` 的 axios 已經對 Sanctum 比好手勢,但 Sanctum 那邊到底有沒有接住**。Ep-4 會把這個迴圈閉合:

1. Laravel 的 `bootstrap/app.php` 加 `statefulApi()` middleware 是什麼意思
2. `SANCTUM_STATEFUL_DOMAINS` / `SESSION_DOMAIN` / `config/cors.php` 三件事怎麼**同時**對齊,差一邊瀏覽器就吞 cookie
3. 在 backend 寫 `POST /api/login`、`GET /api/me`、`POST /api/logout` 三條最小可行 auth 路由
4. 在前端寫一個 `useSession()` hook + 一條 protected 路由,demo「沒登入 → 401 → ensureCsrfCookie → login → 認得」整段流程
5. 最後跑一次 **Network panel debugging clinic**：`Set-Cookie` 沒設好的 5 種症狀跟對應 fix

> Ep-4 會跟 Carbon-ESG 的 `phase-1-auth-sanctum` change 一起進。Phase-0 是「東西在那兒」,Phase-1 才是「東西會動」。

如果你看到這邊已經有自己手裡的 Laravel + Next.js 想試試 Sanctum,不用等我：順序就是上面 1 → 5,踩任何坑歡迎丟過來,我把 Ep-4 寫得更實用。
