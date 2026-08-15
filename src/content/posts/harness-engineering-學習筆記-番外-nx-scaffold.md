---
title: "Nx 前後端 Scaffold 建構紀錄｜Harness 番外"
pubDate: 2026-05-16 14:00:00
description: "Nx workspace 怎麼從零搭建？本篇是一份完整可重現的 9 步指令清單，從 create-nx-workspace、生 NestJS server 與 Next.js client、加 lib，到兩種不同的 port 設定模式，照著跑就能複製骨架。"
author: "Peter"
tags: ["Harness Engineering"]
category: "Harness Engineering"
keywords: "Nx Monorepo, NestJS, Next.js, create-nx-workspace, @nx/nest, @nx/next, pnpm-workspace, project.json, Nx port 設定, Harness Engineering"
draft: false
---

## 本篇重點

`claude-harness-template` 內的 Nx workspace 是怎麼從零搭建出來的？本篇是一份**完整可重現的指令清單**：從 `create-nx-workspace`、生 NestJS server / Next.js client、加 lib，到 NestJS 與 Next.js 兩種不同的 port 設定模式，照著跑就能複製出同樣的骨架。

<!-- more -->

## 為什麼有這篇

[Ep-3](/posts/harness-engineering-學習筆記-ep-3) 預告 template 是一份「Nx + NestJS + GraphQL + Next.js 完整 starter」。[Ep-4](/posts/harness-engineering-學習筆記-ep-4) 跟 [Ep-5](/posts/harness-engineering-學習筆記-ep-5) 把 harness 層(sub-agents、slash commands)做出來,但**底下的 Nx scaffold 是怎麼生的這件事一直沒有正式紀錄**。

這篇就是把那段拆開來講：你如果想 fork 改成自己的 stack(例如改成 GraphQL → tRPC、或加 React Native app),這份紀錄就是起點。

## 完整搭建流程

整個流程 9 步,大約 5 ~ 8 分鐘可以跑完(看你的 pnpm cache 狀況)。

### Step 1:Bootstrap Nx workspace

```bash
cd /tmp
pnpm dlx create-nx-workspace@latest harness-bootstrap \
  --preset=apps \
  --packageManager=pnpm \
  --nxCloud=skip \
  --interactive=false \
  --skipGit
```

幾個關鍵 flag(官方完整選項見 [create-nx-workspace CLI 文件](https://nx.dev/getting-started/intro)):

- `--preset=apps`：整合式 (integrated) monorepo,空骨架,等我們自己加 app
- `--packageManager=pnpm`(別名 `--pm`)： 明確指定,**預設是 npm**
- `--nxCloud=skip`(別名 `--ci`)： 跳過 Nx Cloud 註冊,其他選項包含 `github`、`gitlab`、`circleci`、`yes` 等
- `--interactive=false`：完全 headless,給 script 用
- `--skipGit`(別名 `-g`)： 不要自動 `git init`(我們的 template repo 已經有 git history)

> Nx 22.7+ 還新增 `--aiAgents` 旗標,可指定 `claude`、`codex`、`copilot`、`cursor`、`gemini`、`opencode` 任意組合;不指定預設**全部 6 個都生**(也是我們看到一堆 dotfile 的原因)。

跑完會在 `/tmp/harness-bootstrap/` 產出 workspace,內含:

- `nx.json`、`tsconfig.base.json`、`package.json`、`pnpm-workspace.yaml`
- `.claude/`、`.cursor/`、`.codex/`、`.gemini/`、`.opencode/`、`.agents/`(Nx 22+ 內建多 AI agent 設定)
- `.github/skills/`(Nx 內建 4 個 AI skill:`nx-workspace`、`nx-generate`、`nx-import`、`monitor-ci`)
- `AGENTS.md`、`CLAUDE.md`(內容相同,給 Claude Code 跟其他 agent 讀的規則)

> Nx 22.7 內建這麼多 AI agent 工具是這次最大的驚喜：等於 Nx 自己已經實踐了 Harness Engineering,我們只需要在它上面**疊 stack-specific 規則**。

### Step 2:搬進目標目錄 + 保留 git history

```bash
cp -a /tmp/harness-bootstrap/. ~/your-project/
cd ~/your-project
```

`cp -a` 的 `-a` 是 archive mode,保留檔案權限跟符號連結。trailing `/.` 是「複製內容而不是目錄本身」的關鍵。

### Step 3:安裝 NestJS 跟 Next.js 的 Nx plugin

```bash
pnpm add -D @nx/nest @nx/next
```

`create-nx-workspace --preset=apps` 預設只裝 `@nx/js`,要加 framework plugin 才能生對應的 app。這一步會花 1 ~ 2 分鐘(連同 NestJS、React、Next.js、Webpack 等一大串相依套件)。

裝完 `package.json` 的 `devDependencies` 會多出來:

- `@nx/nest`、`@nx/next`
- `@nx/eslint`、`@nx/eslint-plugin`、`@nx/jest`、`@nx/node`、`@nx/web`、`@nx/webpack`(被 framework plugin 帶進來)

### Step 4:處理 `pnpm-workspace.yaml`

預設只有 `packages/*`,我們改成包含 `apps/` 與 `libs/`,並把需要跑 install script 的套件加進 allowlist:

```yaml
packages:
  - 'apps/*'
  - 'libs/*'
  - 'packages/*'

# 適用於 pnpm 10.x(本 template 目前用 pnpm 10.22)
onlyBuiltDependencies:
  - '@parcel/watcher'
  - esbuild
  - less
  - nx
  - sharp
  - unrs-resolver
```

> **pnpm 10 vs 11 注意**:`onlyBuiltDependencies` 是 pnpm 10.x 的 build approval 設定。**pnpm 11 已經移除這個欄位**,改名 `allowBuilds` 並改用 map 格式([官方說明](https://pnpm.io/settings#allowbuilds)):
>
> ```yaml
> # 適用於 pnpm 11+
> allowBuilds:
>   nx: true
>   sharp: true
>   esbuild: true
> ```
>
> 如果你之後升 pnpm 11,記得換成 `allowBuilds`。沒列在 allowlist 的套件 install script 一律被 skip,`nx`、`sharp` 這些不在就會啞掉。

### Step 5:生 NestJS server

```bash
pnpm nx g @nx/nest:application apps/server \
  --no-interactive \
  --linter=eslint \
  --unitTestRunner=jest
```

這條會生兩個 project:

- `@org/server`：NestJS 主程式(`apps/server/src/main.ts`、`app.module.ts` 等)
- `@org/server-e2e`：e2e 測試 harness(`apps/server-e2e/`)

> ⚠️ `--linter` 與 `--unitTestRunner` **預設都是 `none`**,所以**必須顯式傳 `eslint` / `jest` 才會配出來**(用 `pnpm exec nx g @nx/nest:application --help` 可驗證)。`--e2eTestRunner` 預設是 `jest` 倒不用特別寫。完整選項見 [@nx/nest plugin 文件](https://nx.dev/nx-api/nest)。

### Step 6:生 Next.js client

```bash
pnpm nx g @nx/next:application apps/client \
  --no-interactive \
  --appDir=true \
  --style=css \
  --linter=eslint \
  --unitTestRunner=jest \
  --e2eTestRunner=none
```

關鍵 flag(完整選項見 [@nx/next plugin 文件](https://nx.dev/nx-api/next)):

- `--appDir=true`：用 App Router(其實**預設就是 true**,寫出來只是顯式提醒)
- `--style=css`：預設值,可改成 `scss`、`less`、`tailwind` 等
- `--linter=eslint`、`--unitTestRunner=jest`：跟 `@nx/nest` 一樣預設 `none`,必須顯式傳
- `--e2eTestRunner=none`：**預設是 `playwright`**,我們不需要前端 e2e 才覆寫成 none

> Nx 22.7 的 `@nx/next` 把 `next` 釘在 `~16.1.6`,**npm 上有 16.2 也不會幫你裝**。要升手動 `pnpm up next@16.2 eslint-config-next@16.2`,或等 `@nx/next` 下個 release。`@nx/next` 的 peer dep 寫 `next >=14.0.0 <17.0.0`,所以手動升不會撞 peer 約束。

### Step 7:生 3 個 shared lib

```bash
pnpm nx g @nx/js:library libs/models \
  --no-interactive --bundler=none --linter=eslint --unitTestRunner=jest \
  --importPath=@my-org/models

pnpm nx g @nx/js:library libs/graphql \
  --no-interactive --bundler=none --linter=eslint --unitTestRunner=jest \
  --importPath=@my-org/graphql

pnpm nx g @nx/js:library libs/user \
  --no-interactive --bundler=none --linter=eslint --unitTestRunner=jest \
  --importPath=@my-org/user
```

關鍵 flag(完整選項見 [@nx/js plugin 文件](https://nx.dev/nx-api/js)):

- `--bundler=none`：lib 是 source-only,不另外打包(由用它的 app 自己 bundle)。**預設是 `tsc`**;其他可選 `swc`、`rollup`、`vite`、`esbuild`
- `--importPath=@my-org/<name>`：顯式設 path alias。`tsconfig.base.json` 會自動更新

跑完三條,結構長這樣:

```text
apps/
├── client/
├── server/
└── server-e2e/
libs/
├── graphql/
├── models/
└── user/
```

每個 lib 都自帶 `src/index.ts` barrel file + `src/lib/<name>.ts` + `src/lib/<name>.spec.ts`,跟 Ep-1 AGENTS.md 規定的「DTO 一律 barrel export」原則天然對齊。

### Step 8:加 root `package.json` scripts

預設 `"scripts": {}` 是空的,我們加常用的捷徑:

```json
{
  "scripts": {
    "server": "nx serve @org/server",
    "server:build": "nx build @org/server",
    "server:test": "nx test @org/server",
    "client": "nx dev @org/client",
    "client:build": "nx build @org/client",
    "client:start": "nx start @org/client",
    "build": "nx run-many -t build",
    "test": "nx affected -t test --base=main",
    "lint": "nx affected -t lint --base=main",
    "typecheck": "nx affected -t typecheck --base=main",
    "graph": "nx graph",
    "nx": "nx"
  }
}
```

注意:

- Next.js 用 `dev`(不是 `serve`)： 對應 `next dev` CLI
- `nx affected` 預設 base 是 `main`,如果你 default branch 是 `master` 改一下
- 不放 `migration:run` 之類 GraphQL/TypeORM 相關：那些等接好相應 plugin 再加

### Step 9:設定 port

這是這篇最值得記下來的部分。**NestJS 與 Next.js 的 port 設定機制完全不同**:

| 框架     | Port 設定位置                          | 為什麼這樣做                              |
| :------- | :------------------------------------- | :---------------------------------------- |
| NestJS   | `apps/server/src/main.ts`              | NestJS 文件規範用 `app.listen(port)` 啟動,port 是 runtime 程式碼([first-steps 文件](https://docs.nestjs.com/first-steps)) |
| Next.js  | `apps/client/project.json` dev target  | `next dev` 是 CLI,port 是 CLI flag([`next` CLI 文件](https://nextjs.org/docs/app/api-reference/cli/next#next-dev-options)),放 nx target options 才能跨 invocation 一致 |

#### NestJS port(server,3000)

`apps/server/src/main.ts` 已經內建讀環境變數的寫法:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${port}/api`);
}
bootstrap();
```

要改 port 就改 `|| 3000` 那個數字,或啟動時設 `PORT=8080 pnpm server`。這個寫法直接抄自 [NestJS first-steps 官方範本](https://docs.nestjs.com/first-steps)。

#### Next.js port(client,4500)

`@nx/next` plugin 推斷的 `dev` target 預設用 `next dev`(Next.js [官方文件確認預設 port 3000](https://nextjs.org/docs/app/api-reference/cli/next#next-dev-options))。要覆蓋,在 `apps/client/project.json` 顯式定義 dev target:

```json
{
  "name": "@org/client",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/client/src",
  "projectType": "application",
  "tags": [],
  "targets": {
    "dev": {
      "command": "next dev --port=4500",
      "options": {
        "cwd": "apps/client"
      }
    }
  }
}
```

Project.json 的 targets 會**覆蓋** plugin 推斷出來的同名 target,**其他沒寫的 target(build、test、lint...)仍然自動繼承推斷**。優先序由低到高:plugin 推斷 → `nx.json` 的 `targetDefaults` → 專案 `project.json` / `package.json`,project 層級永遠贏(來自 [Nx 官方:Inferred Tasks](https://nx.dev/concepts/inferred-tasks))。

#### 為什麼不直接在 root script 加 `--port=4500`?

我一開始這樣做了：`package.json` 的 `client` 改成 `nx dev @org/client --port=4500`。看起來能用,但有問題:

| 場景                              | root script 方式  | project.json 方式 |
| :-------------------------------- | :---------------- | :---------------- |
| `pnpm client`                     | ✅ 吃 4500        | ✅ 吃 4500        |
| `pnpm exec nx dev @org/client`(直接) | ❌ 變回預設 3000 | ✅ 吃 4500        |
| IDE / CI / sub-agent 直接 invoke  | ❌ 不一致         | ✅ 一致           |

**Port 是 project 的屬性,不是某個 script 的屬性**：放 `project.json` 才是 Nx 正確姿勢。

### 驗證

兩條開起來看:

```bash
pnpm server   # → http://localhost:3000/api  (NestJS)
pnpm client   # → http://localhost:4500       (Next.js)
```

兩個可以**同時跑**,因為一個在 3000、一個在 4500,沒衝突。

## 結論

把這篇可重現的指令清單收進口袋,之後做事:

1. **想 fork 換 stack**(例如改 tRPC、Astro、Remix)： 從 Step 1 開始,Step 5 / 6 換成對應 framework 的 generator(`@nx/remix:app`、`@nx/astro:app` 等)
2. **想加新 app**(例如 mobile)： 只跑 Step 5 / 6 那條,生 `apps/mobile`
3. **想加新 lib**：只跑 Step 7,記得用 `--bundler=none` 跟 `--importPath`
4. **想改 port**：看是 NestJS(改 `main.ts`)還是 Next.js(改 `project.json`)

> 這份 scaffold 不是「一勞永逸的 template」,而是「**一份可被 Claude Code 用 SDD 流程持續擴張的起點**」： 接下來無論你想加 GraphQL、TypeORM、Apollo Client、Chakra UI、auth、CI...都用 `/spec → /plan → /implement` 一個個進來,由 harness 把關品質。

## 延伸閱讀

### Nx

- [Nx Monorepo 官方首頁](https://nx.dev/)
- [Nx Getting Started](https://nx.dev/getting-started/intro)：`create-nx-workspace` 入口
- [Inferred Tasks 機制](https://nx.dev/concepts/inferred-tasks)：project.json 怎麼覆蓋
- [Project Configuration Reference](https://nx.dev/reference/project-configuration)：`project.json` 完整 schema
- [@nx/js plugin](https://nx.dev/nx-api/js)：`library` generator 與 bundler 選項
- [@nx/nest plugin](https://nx.dev/nx-api/nest)：`application` generator
- [@nx/next plugin](https://nx.dev/nx-api/next)：Next.js application generator

### Framework

- [NestJS First Steps](https://docs.nestjs.com/first-steps)：`main.ts` / `app.listen()` bootstrap pattern
- [Next.js CLI Reference](https://nextjs.org/docs/app/api-reference/cli/next)：`next dev --port` 等所有指令選項

### pnpm

- [pnpm settings：allowBuilds(pnpm 11+)](https://pnpm.io/settings#allowbuilds)
- [pnpm settings：full reference](https://pnpm.io/settings)

### 本系列

- [Peter-To-Better/claude-harness-template](https://github.com/Peter-To-Better/claude-harness-template)：本篇產出的 template repo
