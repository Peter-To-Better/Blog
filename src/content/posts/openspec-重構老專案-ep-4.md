---
title: "OpenSpec 重構老專案 Ep-4:用 propose 設計 Sanctum 認證"
pubDate: 2026-06-13 00:00:00
description: "認證功能開工。這篇用 /opsx:propose 走一次設計，帶你看 4 個 artifact 各在做什麼、Sanctum SPA 為什麼贏過 token 模式，還把最容易踩坑的「四觸點對齊」釘進 spec 級 requirement。純設計 walkthrough，看完就懂為什麼先寫 spec。"
author: "Peter"
tags: ["重構筆記", "OpenSpec", "Laravel", "Sanctum", "Next.js"]
category: "重構筆記"
keywords: "Sanctum SPA, statefulApi, SANCTUM_STATEFUL_DOMAINS, SESSION_DOMAIN, useSession, Next.js 16 App Router, /opsx:propose, Carbon-ESG"
draft: false
---

## 本篇重點

[Ep-3](/posts/openspec-重構老專案-ep-3/) 結尾留下一個沒兌現的承諾:**「`lib/api.ts` 的 axios 已經對 Sanctum 比好手勢,但 Sanctum 那邊到底有沒有接住」**：這篇就是接住的開始。phase-0 archive 之後 active change 槽位空了,自然接的下一個 change 叫 `phase-1-auth-sanctum`。

但實作之前,我想先把**怎麼設計**這件事拆給你看：因為 Sanctum SPA 模式有一個惡名:**設四個地方但只改三個,瀏覽器就吞 cookie 給你看,Network panel 一片綠的 200 但下一條 request 還是 401**。這種失敗模式不能等實作完才解,要在 spec 階段就把它釘成 requirement,讓任何想改 auth 的人(包括三個月後忘記的自己)都看得到。

所以本篇主題:

1. `/opsx:propose phase-1-auth-sanctum` 背後 **4 個 artifact** 各在做什麼
2. **proposal**:scope 怎麼切：為什麼大量功能(email verify、role、admin policy)留給後續 phase
3. **design**:八個關鍵設計決策,逐條給「為什麼這樣選」
4. **specs**:**「三件套對齊」為什麼被寫進 spec 級別 requirement**,而不是只在 design 裡提一句
5. **tasks**:48 個 task 怎麼分 5 個 group,每組為什麼正好是一個 commit boundary

實作 transcript + Network panel debug clinic 留 **Ep-5**,等我把 `/opsx:apply` 跑完之後寫,有完整的「跑到一半中斷在哪 → 怎麼救」記錄。

<!-- more -->

## 從 ep-3 留的伏筆繼續

ep-3 寫完之後 [phase-0 archive 進 specs/](/posts/openspec-重構老專案-ep-3/),Carbon-ESG 的 OpenSpec 狀態變成:

```
openspec/specs/bootstrap/spec.md     ← phase-0 真相(目錄 / docker / Node / CLAUDE.md)
openspec/changes/archive/2026-06-12-phase-0-bootstrap-monorepo/
openspec/changes/                     ← 空,active change 槽位釋出
```

active change 槽位空著一秒都不對：沒新 change 開,就等於工作停滯。所以我打:

```bash
/opsx:propose phase-1-auth-sanctum?
```

(問號是我給 Claude Code 看的「確認一下對不對」修飾語,skill 會 strip 掉)。

## `/opsx:propose` 背後到底做了什麼

skill 跑完吐出來:

```text
- Creating change 'phase-1-auth-sanctum' with schema 'spec-driven'...
Created change 'phase-1-auth-sanctum' at openspec/changes/phase-1-auth-sanctum/
Schema: spec-driven

artifacts: [
  ('proposal', 'ready',   'proposal.md'),
  ('design',   'blocked', 'design.md'),
  ('specs',    'blocked', 'specs/**/*.md'),
  ('tasks',    'blocked', 'tasks.md'),
]
```

四個 artifact 一開始只有 `proposal` ready,其他 `blocked`(因為有依賴順序)。skill 依序解 block:

| 順序 | Artifact | 依賴 | 在回答什麼 |
|---|---|---|---|
| 1 | `proposal.md` | (none) | **這個 change 要做什麼 / 為什麼現在做** |
| 2 | `design.md` | proposal | **怎麼做：關鍵決策跟 trade-off** |
| 3 | `specs/<capability>/spec.md` | proposal | **完成後系統行為的契約**(`ADDED Requirements`) |
| 4 | `tasks.md` | proposal + design + specs | **逐步實作的 checklist,task group = commit 邊界** |

這四個 artifact 不是隨便分的：它們**對應四個不同問題**:**what & why** / **how & why-this-how** / **observable contract** / **executable steps**。寫到第三個的時候你已經在替三個月後的自己回答「我那時候到底為什麼這樣選」,而不是只在記錄「我做了什麼」。

## proposal.md:scope 怎麼切

phase-1 的 proposal 真正的功夫不在「列出要做什麼」,而在「**列出哪些不做、為什麼**」。這次有意排除四件事:

| 不做 | 為什麼 |
|---|---|
| **角色細分**(seller / buyer / worker / admin 權限差異) | phase-2 carbon-listings 進來時透過「有沒有對應 row」推導,本 phase 只負責「**這個 user 是誰**」 |
| **email verification** | 這是獨立功能,介面跟 `Auth::login()` 不衝突,可以單獨 phase 加 `MustVerifyEmail` interface + signed URL,不阻擋 phase-1 |
| **forgot password / 2FA / OAuth** | 同上,各自獨立 phase。本 phase 連寄信都不做：註冊完即 active |
| **production cross-domain 部署的 cookie 問題** | Safari ITP / Chrome 第三方 cookie 政策 + Sanctum SPA 在 cross-domain 部署的痛苦是另一個 phase 的事,本 phase scope 本機 `localhost:3000` ↔ `localhost:8000` |

**有意縮 scope 的設計動機**:OpenSpec 的單一 change 應該**可以一氣呵成 archive**,scope 大到「兩三週才做得完」的 change 通常會卡在「快做完了但有個邊角還缺」進不去 archive,然後阻擋下一個 change 開始。phase-1 收進可控的 5 group 就是這個原因。

> 反過來:**為什麼 register 自動 login**?Option A 是「register 只建 user,要求前端 redirect 到 login form 再登一次」,Option B 是「register 建完 user 直接 `Auth::login()` 同步 session」。選 B,因為 Carbon-ESG 是「先 sign up → 立刻能用」的 flow,要 user 註冊完馬上再登入是無謂摩擦。這個決策後面 design.md 還會展開。

## design.md:八個關鍵決策

design.md 不講「寫什麼程式碼」,只講**為什麼這樣選**。phase-1 的 design 有 8 個決策,我把它整理成你能秒懂的對照表:

### 決策 1:Sanctum **SPA 模式**而非 API token

| 比較項 | SPA(httpOnly cookie + CSRF) | API token(Bearer header) |
|---|---|---|
| XSS 防護 | ✅ httpOnly cookie 不會被 JS 讀到 | ❌ token 通常存 localStorage,XSS 拐走 |
| 跨域部署友善 | ❌ cross-domain 部署痛苦(Safari ITP) | ✅ token 不在乎 domain |
| 前端複雜度 | ✅ 瀏覽器自動帶 cookie,axios 自動帶 XSRF | ❌ 前端要管 token 過期 / refresh |
| 適用情境 | 同主機 SPA + 同團隊 backend | 給第三方 client / mobile app |

Carbon-ESG 前端是同主機 Next.js,**SPA 模式吃到大部分好處 + production cross-domain 的痛苦可以晚點解**(用 reverse proxy 把 `/api/*` 轉到 backend,domain 統一)。

### 決策 2:`statefulApi()` 寫在 `bootstrap/app.php`,不寫 controller 內

Laravel 11+ 把過去 `Kernel.php` 的角色換成 `bootstrap/app.php` 的 builder pattern:

```php
return Application::configure(basePath: dirname(__DIR__))
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();        // ← phase-1 task 1.1 加這行
    })
    ->create();
```

**全域掛在 `api` middleware group**,不是逐 endpoint 加。理由:auth endpoint 自己就需要 stateful(login 之前要 CSRF cookie),me / 之後 protected 路由也需要,**全 `api/*` 都 stateful 是最簡單一致的**。token guard 留給未來如果真要做 mobile app,屆時加另一個 prefix(`api/v1/mobile`)。

### 決策 3:**三件套對齊清單**(寫進 spec 級別 requirement)

這是本 phase 最重要的決策,後面 specs 章節獨立講。簡短版:

| 觸點 | 值 |
|---|---|
| `backend/.env.example` `SANCTUM_STATEFUL_DOMAINS` | `localhost:3000` |
| `backend/.env.example` `SESSION_DOMAIN` | `localhost` |
| `backend/config/cors.php` `paths` | 含 `api/*` + `sanctum/csrf-cookie` |
| `frontend/lib/api.ts` `withCredentials` + `withXSRFToken` | `true` 兩個都要 |

**少改任一個的症狀**:axios 打 `/api/login` 收到 419(CSRF mismatch)/ 200 但 `Set-Cookie` 沒被瀏覽器存 / login 成功但下一條 `/api/me` 還是 401。每一個都對應到不同那一格沒對齊：Ep-5 會做 Network panel debug clinic 把每個症狀對應 fix 攤開。

### 決策 4:`useSession()` 是 **RSC-friendly 的雙形態 hook**

Next.js 16 App Router 的痛點:**server component 沒有 `window`,不能用 React context;client component 沒有 `cookies()`,不能直接讀 session**。所以 `useSession` 不是單一 hook,是**雙形態**:

```
┌─────────────────────────────────────────────┐
│ Server side (RSC layout / page)              │
│   import { cookies } from 'next/headers'     │
│   const user = await getSessionFromCookies() │
│           ↓ pass as prop                     │
│   <SessionProvider initialUser={user}>       │
└─────────────────────────────────────────────┘
                  ↓ hydrate
┌─────────────────────────────────────────────┐
│ Client side (form / button)                  │
│   const { user, setUser } = useSession()     │
│        ↑ reads from context                  │
└─────────────────────────────────────────────┘
```

**`<SessionProvider>` 掛在 root `app/layout.tsx`**,server 先拿一次 session 以 `initialUser` 餵下去當 hydration seed：避免 client 側第一次渲染就閃白屏發 fetch。Next.js 16 沒給你這個 pattern,但只要寫對一次,後續所有 page 都吃得到。

### 決策 5:`ensureCsrfCookie()` 一次性 + 自動失效

phase-0 寫的 `csrfFetched: boolean` 模組變數會在「頁面 hard reload / 跨 tab 操作」自動 reset。**不需要在 logout 後手動 reset**：Laravel 在新 session 一旦建立會自動 rotate XSRF,axios 從 cookie 重讀就 OK。

### 決策 6:axios response interceptor 處理 **401 全域重導**

```ts
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
```

關鍵是 `typeof window !== 'undefined'`：**只在 client side 跑**,server side 由 RSC layout 自己用 `redirect()` 處理(更合 Next.js 慣例)。

Trade-off:未來如果有「user 可以選擇登入,但沒登也能看內容」的頁面(e.g. 公開首頁背景 fetch `/api/me` 拿名字),401 自動重導會把這個 anonymous 路徑也彈到 login。phase-1 沒這需求,以後加 opt-out flag(`{ skipAuthRedirect: true }`)就好。

### 決策 7:`register` **自動 login**(同一條 API call 完成)

實作上 `Auth::login($user)` 在 controller 內一行搞定:

```php
public function register(RegisterRequest $request) {
    $user = User::create($request->validated());
    Auth::login($user);                                // ← 同步建 session
    return response()->json(['user' => $user->only(['id','name','email'])], 201);
}
```

Trade-off:「API 是純 stateless 介面」的 mental model 在這破壞了：register 不只建 row 還改 session。但這就是 Sanctum SPA 模式的本質,我們已經接受 SPA 不是 stateless API。

### 決策 8:password 規則用 Laravel `Password::defaults()` + `confirmed`

```php
'password' => ['required', 'confirmed', Password::defaults()],
```

**本機 dev 用 `Password::min(8)` 即可,production / staging 啟用完整規則(mixedCase + numbers + symbols)**,避免 dev 體驗痛苦。`Password::defaults()` 在 `AppServiceProvider::boot()` 設定不同環境用不同規則,一處改全套生效。

## specs/auth/spec.md:三件套對齊為什麼是 **spec 級別 requirement**

設計階段我有兩個選擇:

- **Option A**:三件套對齊只寫在 `design.md` 的 decisions section,當作 implementation guidance
- **Option B**:三件套對齊**寫成 spec 級別 requirement**,包含明確 scenario

我選 B。這是 OpenSpec 紀律下一個非常重要的細節：來看為什麼。

phase-1 spec 內有十個 requirements,前九個都是 endpoint behavior(register 回什麼、login 拒絕什麼、me 在 401 場景的 response body 形狀...)很標準。**第十個** requirement 叫 **「Three-Way Configuration Alignment」**,長這樣:

```markdown
### Requirement: Three-Way Configuration Alignment

The repository's auth-relevant configuration MUST stay aligned across
**four touchpoints** so that the Sanctum SPA cookie flow works end-to-end.

| Touchpoint | Value (dev) | Purpose |
|---|---|---|
| `backend/.env.example` `SANCTUM_STATEFUL_DOMAINS` | `localhost:3000` | Sanctum 認哪些 origin stateful |
| `backend/.env.example` `SESSION_DOMAIN` | `localhost` | `Set-Cookie` Domain= 瀏覽器才認 |
| `backend/config/cors.php` `paths` | 含 `api/*` 跟 `sanctum/csrf-cookie` | CSRF 那條不在 `/api` 下 |
| `frontend/lib/api.ts` `withCredentials` + `withXSRFToken` | `true` | 瀏覽器發 cookie + axios 帶 XSRF |

#### Scenario: All four touchpoints aligned
- **WHEN** all four settings hold the values above
- **THEN** `GET /sanctum/csrf-cookie` followed by `POST /api/login` followed by
  `GET /api/me` all succeed, and the session round-trip works end-to-end

#### Scenario: `SESSION_DOMAIN` missing or wrong
- **WHEN** `SESSION_DOMAIN` is empty or set to a domain the browser cannot match
- **THEN** the browser drops the session cookie, `POST /api/login` returns 200
  but `GET /api/me` returns 401 — this failure mode MUST be documented in the
  change's debug guidance
```

為什麼這個是 spec 而不是 design?

**答案**:因為它是「**外部可觀察的系統契約**」,不是「實作怎麼選」。

`SESSION_DOMAIN` 漏改是個 **observable behavior**(瀏覽器吞 cookie、me 回 401)。如果未來有人(包括三個月後的自己)為了「省事」把這四個觸點重新組合：例如把 `SANCTUM_STATEFUL_DOMAINS` 改成 `*` 想偷懶通配：spec 會直接擋下來:**這違反了 Requirement,得寫 `## MODIFIED Requirements` 通過 OpenSpec 流程才能改**。

換句話說:**把「最容易踩坑的設定」釘進 spec,等於替未來的自己樹立一個結構性提醒**。OpenSpec 紀律最大的好處之一就是這個：不是「documentation」,而是「**契約**」。

## tasks.md:5 個 group 對應 5 個 commit boundary

48 個 task 分 5 個 group,**每個 group 完成才 commit 一次**(CLAUDE.md 的紀律)。為什麼是 5 不是 7、不是 3?

| Group | Task 數 | Scope | Commit 訊息(預定) |
|---|---|---|---|
| ① Backend Sanctum 接線 | 8 | bootstrap `statefulApi` + User `HasApiTokens` + `.env` 三件套 + smoke `curl` | `feat(backend): activate Sanctum SPA middleware and align session domain` |
| ② Backend Auth Endpoints + Pest | 14 | 4 endpoints + 2 FormRequests + 8 Pest tests | `feat(backend): add Sanctum SPA auth endpoints with Pest coverage` |
| ③ Frontend Session Foundation | 7 | `useSession` 雙形態 + axios interceptor + root layout SSR seed | `feat(frontend): add useSession hook with SSR seed and 401 interceptor` |
| ④ Frontend Auth UI | 7 | login / register page + protected layout guard + me demo + LogoutButton | `feat(frontend): add login/register/me pages and protected route guard` |
| ⑤ Verification | 12 | end-to-end hands-on + Pest 全跑 + `openspec validate --all` | (通常不 commit,如有 fix 才 `fix(...)`) |

**分 group 的邏輯**:每個 group 是「**最小可被獨立 review、可被獨立 revert 的單位**」。譬如 group ① 跟 group ② 都改 backend,但中間是不是要 commit 一次?**要**,因為 group ① 的「Sanctum middleware 接好了 + smoke curl 通了」即使**沒 endpoint** 也是個有意義的 milestone,本身就值得進歷史。如果 group ② 後來發現要回頭改設計,group ① 不用一起 revert。

reviewer 也輕鬆:group ① commit 進來只動 3 個檔(`bootstrap/app.php`、`User.php`、`.env.example`),review 五分鐘搞定;group ② commit 進來動 20+ 個檔(controllers + requests + 8 個 Pest 檔),但因為基底已經 land,可以全程聚焦「endpoint 行為對不對」一個維度。

## 下一篇 Ep-5 預告:apply + Network panel debug clinic

`/opsx:propose` 跑完之後 phase-1 的 48 個 task 全部 `- [ ]`,接下來該打:

```bash
/opsx:apply
```

實作會踩什麼坑,目前完全是 future tense。但根據 Sanctum SPA 模式的踩坑統計學,以下這幾條 99% 會出現:

1. **`SESSION_DOMAIN` 漏設**:`/api/login` 回 200 但下一條 `/api/me` 還是 401：瀏覽器吞了 Set-Cookie
2. **`stateful` 配 `localhost:3000` 還是 `127.0.0.1:3000`**:這兩個對瀏覽器是不同 origin,選錯會看到「我明明設了還是吞 cookie」
3. **CSRF token mismatch 419**:`sanctum/csrf-cookie` 沒拿到、或 axios 沒 mirror 進 header、或 `cors.php` 沒把這條 path 列進 `paths`
4. **Next.js RSC `cookies()` API 在 layout 內讀**:server 拿 cookies 之後 forward 給 backend 的 `/api/me` 寫法很微妙(要構造 `Cookie:` header,不能只 spread)
5. **`Auth::login()` 在 register 內漏 `regenerate()`**:session fixation 風險

每一條 Ep-5 都會給 Network panel 截圖 + 對應 fix,做成 debug clinic。**目標**:讀者照走撞到任何一條,能對著 Network panel 一秒辨識症狀。

---

> 如果你跟著系列走,phase-1 propose 完之後該做的不是繼續看 blog,是**打 `/opsx:apply` 把 task group ① 推完 commit 起來**。每個 group 之間天然有節奏停下來思考,Ep-5 寫完之前你已經實作到 group ③ 也不奇怪。
