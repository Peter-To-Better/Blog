---
title: "OpenSpec 重構老專案 Ep-5:交易核心與競態防線"
pubDate: 2026-06-14 00:00:00
description: "碳匯交易核心一天從 propose 跑到 archive。挑 4 個設計決策講透：角色用 row 存在性推導、state machine 雙保險、同時購買競態用 DB transaction + lockForUpdate + UNIQUE 三層防線擋住。想學 Laravel 併發防護就看這篇。"
author: "Peter"
tags: ["重構筆記", "OpenSpec", "Laravel", "Next.js", "State Machine"]
category: "重構筆記"
keywords: "OpenSpec, Laravel 12, state machine, lockForUpdate, race condition, role inference, Next.js 16 RSC, Sanctum SPA, Pest, Carbon-ESG"
draft: false
---

## 本篇重點

[Ep-4](/posts/openspec-重構老專案-ep-4/) 結尾 phase-1 還停在「design 寫完 ready to apply」,中間我把 `/opsx:apply` 跑完、archive 進 `openspec/specs/auth/`,active change 槽位再次空出來。然後今天直接接 **phase-2-carbon-listings** — 整個專案的**商業核心**:landowner 上架碳匯 → admin 審 → buyer 買 → 系統 mark sold。一天從 propose 跑到 archive,69 個 Pest passing,前端 8 個 surface 全部 tsc clean。

這篇我不流水帳,只挑**今天設計上最值得寫進筆記的四件事**:

1. **角色推導 vs role enum** — 為什麼 seller / buyer 不寫進 `users.role`、而是看 `carbon_listings` / `carbon_purchases` 有沒有對應 row 推導出來,且這個決策在 `/me` 加了什麼成本
2. **State machine 用 method + saving listener 雙保險** — 為什麼不靠 `if` 散在 controller 裡,也不只靠單一 `transitionTo()` 方法,而是兩道防線同時上
3. **同時購買的 race condition 用三層防線** — `DB::transaction` + `lockForUpdate` 是經典解,但為什麼還加一個 `UNIQUE(carbon_listing_id)` 約束當「萬一」
4. **`/me` 不開新端點直接 spread role flag** — 為什麼不另開 `/api/me/roles`,以及前端那個 `useSession()` 因此省掉的一次 round trip

最後一段寫 archive 的儀式:delta spec 怎麼 sync 回真相、為什麼 carbon-listings 是「全新 capability」而 auth 是「MODIFIED 既有 requirement」。

<!-- more -->

## 從 ep-4 收尾:phase-1 archived

Ep-4 寫到 phase-1 design 階段,後來 `/opsx:apply phase-1-auth-sanctum` 一路跑完 5 個 task group,然後 `/opsx:archive` 把 delta 同步進 `openspec/specs/auth/spec.md`,active change 槽位空出來。狀態變成:

```
openspec/specs/
├── auth/spec.md             ← phase-1 真相落地
└── bootstrap/spec.md        ← phase-0 真相

openspec/changes/
├── archive/
│   ├── 2026-06-12-phase-0-bootstrap-monorepo/
│   └── 2026-06-14-phase-1-auth-sanctum/
└── (空 — active 槽位釋出)
```

OpenSpec 紀律就是這樣推著走 — **槽位空,就等於下一個 change 該開了**。所以早上我直接打:

```bash
/opsx:propose phase-2-carbon-listings
```

scope 早就在腦袋裡:碳匯交易整合平台沒有「上架 / 買賣 / 審核」就什麼都不是,phase-1 只是把人擋進門,phase-2 才是真正讓門後有東西。

## proposal 在切什麼

phase-2 的 proposal 跟 phase-1 一樣,真正的功夫不在「列出要做什麼」,在「**列出哪些不做、為什麼**」。這次有意排除四件事:

| 不做 | 為什麼 |
|---|---|
| **Web3 結算** | 平台代發、`web3p/web3.php` 串智能合約是 phase-3 — 設計上「上架成功 → 過戶」要先在 off-chain DB 跑通,再決定鏈上 mirror 哪些 state |
| **圖片 / 證明文件上傳** | mimetype + size 驗證 + storage driver 抽象是獨立 phase。本 phase 用純文字描述 + 開價就足夠跑通整個 flow |
| **email 通知**(審核結果、購買收據) | mail driver / queue / template 是獨立 phase,本 phase 仰賴 UI 上看狀態,夠用 |
| **工人 job 流程**(`legacy/registJob.php` / `jobrecall.php`) | 那是「土地維護」的循環,phase-4 再切。本 phase 只到「碳匯交易」 |

縮 scope 的動機跟 phase-1 一樣:**一個 change 應該可以一氣呵成 archive**。phase-2 收進可控的 8 個 task group,合理估今天可以走完 — 結果真的是一天搞定。

## design 決策 1:角色推導 vs role enum

這是 phase-2 整本 design 裡**最 spec-level、影響面最廣**的一個決策。先看選項:

```
Option A:給 users.role 加 enum('admin','seller','buyer','worker','general')
Option B:role 只存 'admin' / 'general',seller / buyer 看「有沒有 row」推導出來
```

我選 B,理由整理進 design 是這樣:

| 比較項 | Option A enum | Option B 推導 |
|---|---|---|
| 角色語意 | 顯式 — schema 一眼看出有哪些角色 | 隱式 — 要看 model 上的 helper |
| 狀態同步 | ❌ 用戶第一次上架要記得 update `role` | ✅ 創 listing 就同步 — 不會忘 |
| 一人多角 | ❌ 同一個 user 可能既賣又買,enum 沒辦法表達 | ✅ 兩個檢查獨立,各自存在不互斥 |
| `/me` 成本 | ✅ 一個欄位讀完 | ❌ 兩個 EXISTS subquery |
| schema migration | ✅ 一個 enum column | ❌ 需要兩個 helper + 兩個檢查 |

選 B 的關鍵理由就是「一人多角」這欄。Carbon-ESG 的 user 自然會跨角色 — 一個賣家後來自己也買別人的碳匯,enum 表達不了「他既是 seller 又是 buyer」這件事。改成 row 推導以後,只要寫:

```php
public function isSeller(): bool
{
    return $this->carbonListings()->exists();
}

public function hasPurchased(): bool
{
    return $this->purchases()->exists();
}
```

Eloquent 把 `exists()` 編譯成 `SELECT EXISTS (SELECT 1 FROM ... LIMIT 1)`,**比 `count() > 0` 早早 short-circuit**,成本可以接受。

但這個選擇有個顯式的代價:**每次 `/api/me` 多兩個 EXISTS subquery**。設計時的 trade-off 表寫得很白:

> 估算:每次 /me 多 2× `EXISTS` 查詢,各 < 1ms(carbon_listings.user_id 有 index,carbon_purchases.buyer_id 有 index)。在「角色變更不會錯過」跟「每次 me 多 < 2ms」之間選後者。如果未來真的變成熱點,優化路徑是 login 時 `loadCount` 進 session、cache 5 分鐘 — 但**那不是現在的問題**。

這段「優化路徑寫進來但不現在做」是我從 Ep-3 開始養成的習慣。把**未來會被人問的問題寫進 design**,以後不用再吵一次。

## design 決策 2:state machine 的兩道防線

CarbonListing 有 5 個狀態:`pending / approved / rejected / recalled / sold`。允許的 transition:

```
pending → approved | rejected | recalled
approved → sold | recalled
rejected | recalled | sold → (終態,不能再 transition)
```

直覺第一版會寫成 controller 裡的 `if`:

```php
public function approve(CarbonListing $listing)
{
    if ($listing->status !== 'pending') {
        abort(422, 'Only pending listings can be approved');
    }
    $listing->status = 'approved';
    $listing->save();
}
```

這樣寫的問題不在這個 controller — 在於 6 個 endpoint 每個都要重抄一次「what is allowed」的判斷,**散在 6 個檔案**。哪天加第 6 種狀態,你要記得改 6 處。漏一處就是個邏輯空洞。

正確的姿勢:把 transition 規則寫進 model,**所有寫入路徑都過這個方法**:

```php
public const ALLOWED_TRANSITIONS = [
    self::STATUS_PENDING => [self::STATUS_APPROVED, self::STATUS_REJECTED, self::STATUS_RECALLED],
    self::STATUS_APPROVED => [self::STATUS_SOLD, self::STATUS_RECALLED],
    self::STATUS_REJECTED => [],
    self::STATUS_RECALLED => [],
    self::STATUS_SOLD => [],
];

public function transitionTo(string $newStatus, array $extras = []): void
{
    $allowed = self::ALLOWED_TRANSITIONS[$this->status] ?? [];
    if (! in_array($newStatus, $allowed, true)) {
        throw new InvalidStateTransition(
            "Cannot transition from {$this->status} to {$newStatus}"
        );
    }
    $this->status = $newStatus;
    // approve 時順手 stamp approver
    if ($newStatus === self::STATUS_APPROVED) {
        $this->approved_by = Auth::id();
        $this->approved_at = now();
    }
    // reject 時順手存原因
    if ($newStatus === self::STATUS_REJECTED && isset($extras['admin_note'])) {
        $this->admin_note = $extras['admin_note'];
    }
}
```

OK 看起來很乾淨。controller 改成:

```php
$listing->transitionTo('approved');
$listing->save();
```

但這樣其實還是有漏洞 — **如果有人在別的地方寫了**:

```php
$listing->status = 'sold';  // 繞過 transitionTo
$listing->save();
```

`transitionTo()` 是約定,**不是強制**。這就是為什麼我加了第二道防線:**`saving` boot listener**:

```php
protected static function booted(): void
{
    static::saving(function (CarbonListing $listing): void {
        if (! $listing->exists) {
            return;  // 新建 row 不檢查(沒有 original status 可比)
        }
        if (! $listing->isDirty('status')) {
            return;  // 沒改 status 不檢查
        }
        $original = $listing->getOriginal('status');
        $allowed = self::ALLOWED_TRANSITIONS[$original] ?? [];
        if (! in_array($listing->status, $allowed, true)) {
            throw new InvalidStateTransition(
                "Cannot transition from {$original} to {$listing->status}"
            );
        }
    });
}
```

兩道防線各有角色:

| 防線 | 觸發時機 | 抓什麼 |
|---|---|---|
| `transitionTo()` method | 主動呼叫時 | 還沒 dirty 寫的階段就擋,error message 在 method 名 stack trace 裡比較好讀 |
| `saving` listener | 任何 `save()` 路徑 | 包括 mass assignment、`update()`、tinker 手動改、其他開發者忘了 method 名亂寫 |

**method 是契約,listener 是 fallback**。`transitionTo()` 處理 happy path 並順手 stamp 附帶欄位;`saving` listener 只負責防呆。Pest 裡兩道都有獨立測試:

```php
it('saving listener blocks direct status assignment to an invalid transition', function () {
    $listing = CarbonListing::factory()->sold()->create();
    $listing->status = 'pending';

    expect(fn () => $listing->save())->toThrow(InvalidStateTransition::class);
});
```

跑起來綠的。

## design 決策 3:同時購買的競態用三層防線

這是 phase-2 整套設計最像 distributed systems 的環節。場景:

> 一筆 approved listing,兩個 buyer 在同一秒按下「購買」。**只能有一個成功**,另一個必須拿到一個語意明確的「太晚了」回應。

天真版本:

```php
public function purchase(CarbonListing $listing)
{
    if ($listing->status !== 'approved') abort(403);
    $listing->transitionTo('sold');
    $listing->save();
    CarbonPurchase::create([
        'carbon_listing_id' => $listing->id,
        'buyer_id' => Auth::id(),
        'price_twd' => $listing->price_twd,
    ]);
}
```

兩個 request 同時進來:兩個都讀到 `status = approved`、兩個都 transition 到 `sold`、兩個都 insert 一筆 purchase。**雙方都成功,但同一塊地賣了兩份** — 這是基本 race。

第一層:**`DB::transaction` 把兩個 write 包成原子**

```php
DB::transaction(function () use ($listing) {
    $listing->transitionTo('sold');
    $listing->save();
    CarbonPurchase::create([...]);
});
```

兩個 write atomic,但不解 race — 兩個 transaction 仍然各自讀到 `approved` 然後各自 commit。

第二層:**`lockForUpdate` 在 transaction 內加行鎖**

```php
DB::transaction(function () use ($id) {
    $listing = CarbonListing::lockForUpdate()->find($id);
    if ($listing->status !== 'approved') {
        throw new ListingNoLongerAvailable();
    }
    $listing->transitionTo('sold');
    $listing->save();
    CarbonPurchase::create([...]);
});
```

兩個 request 競爭 row lock,**第二個等到第一個 commit 才繼續**。第二個 reload 時 `status` 已經是 `sold`,觸發 `ListingNoLongerAvailable`。理論上這就夠了。

但我加了第三層:**`carbon_purchases.carbon_listing_id` 加 UNIQUE**

```php
Schema::create('carbon_purchases', function (Blueprint $table) {
    $table->id();
    $table->foreignId('carbon_listing_id')->unique()->constrained()->cascadeOnDelete();
    // ...
});
```

如果哪天 lock 被某個 ORM 升級 / `lockForUpdate()` 沒生效 / Laravel queue 沒包 transaction…**DB 層的 UNIQUE 約束絕對不會放兩筆 purchase 進來**。controller catch 一下:

```php
try {
    DB::transaction(/* ... */);
} catch (QueryException $e) {
    if ($e->getCode() === '23000') {  // SQLSTATE for unique violation
        return response()->json([
            'message' => '這筆碳匯已經被別人買走了',
        ], 409);
    }
    throw $e;
}
```

三層的角色分工很清楚:

| 層 | 失敗時 | 抓什麼 |
|---|---|---|
| `DB::transaction` | 任一 write 失敗 | 整個 rollback,不會有半買半過戶的悖論 |
| `lockForUpdate` | 兩個 request 競爭 | 序列化,第二個拿到的是已更新的 state |
| `UNIQUE` | lock 失效 / ORM bug / 異常 race | DB 層拒絕,409 給前端 |

是的有點 paranoid。但這是錢進來的入口,**多一層 schema-level 的保護成本是 0,出事的成本是無上限**。

Pest 裡專門有一個 `PurchaseRaceTest`:**手動先塞一筆 purchase row 進 DB(模擬另一個 request 先得手),再從 controller 進來** — 預期 409。跑起來確實 409。

## design 決策 4:`/me` 不開新端點直接 spread role flag

phase-1 的 `/api/me` 回應長這樣:

```json
{ "user": { "id": 1, "name": "...", "email": "..." } }
```

phase-2 需要前端知道「目前 user 是不是 admin / seller / buyer」來決定 nav 怎麼 render。直覺有兩個選項:

```
Option A:開 GET /api/me/roles,前端額外 fetch
Option B:把 role flag 直接 spread 進 /api/me 的 user object
```

選 B。改成:

```json
{
  "user": {
    "id": 1, "name": "...", "email": "...",
    "isAdmin": false, "isSeller": true, "hasPurchased": false
  }
}
```

理由很現實:

| 比較項 | Option A 獨立端點 | Option B spread |
|---|---|---|
| HTTP round trip | 兩次(me + roles) | 一次 |
| SSR 種資料 | 兩個 fetch 都要在 layout server-render 時跑 | 一個 fetch 就夠 |
| 前端狀態管理 | 兩個 source of truth 要對齊 | 一個 user object |
| 向後相容 | ✅ 舊 client 不影響 | ✅ 舊 client 只讀 id/name/email 也能跑 |
| 加新欄位的成本 | 開新端點 | spread 多一個 boolean |

B 是嚴格的優勢方案。實作就是 `AuthController::me()` 改成:

```php
public function me(Request $request): JsonResponse
{
    $user = $request->user();
    return response()->json([
        'user' => array_merge(
            $user->only(['id', 'name', 'email']),
            [
                'isAdmin' => $user->isAdmin(),
                'isSeller' => $user->isSeller(),
                'hasPurchased' => $user->hasPurchased(),
            ],
        ),
    ]);
}
```

前端 `useSession()` 拿到的 `user` 自動有 `isAdmin / isSeller / hasPurchased`,nav 直接條件渲染:

```tsx
{user.isAdmin && <Link href="/admin/review">後台審核</Link>}
```

設計上的小堅持:**`後台審核` 不只是 CSS 隱藏,而是條件渲染** — 非 admin 連 DOM 都沒這個 link,DevTools 翻不出來。

## specs delta:全新 capability vs MODIFIED requirement

phase-2 的 spec delta 分兩塊,寫法很不一樣:

```
openspec/changes/phase-2-carbon-listings/specs/
├── auth/spec.md                ← MODIFIED Requirements(只改一條既有的)
└── carbon-listings/spec.md     ← ADDED Requirements(全新 10 條)
```

`auth/spec.md` 的 delta 只有一塊 `## MODIFIED Requirements`,動的是 `Requirement: Current-Session Endpoint` 那條 — 把回應 schema 加上三個 role flag。**這是 backward-compatible extension**,所以 delta 寫的時候特別在 spec 文裡寫一句「Existing client code that reads only `user.id` / `user.name` / `user.email` continues to work unchanged」。

`carbon-listings/spec.md` 是 10 條 `## ADDED Requirements`,從「Carbon Listing Resource」一路到「Frontend Surfaces for Seller / Market / Admin」。為什麼分這麼細?因為 OpenSpec 的 spec 是要回答**未來那個忘記的自己**「這個系統當初為什麼長這樣」,而不是「我做了什麼」。每條 requirement 對應一個獨立的契約,有自己的 `#### Scenario` block — 寫一條 requirement 配 2 ~ 4 個 scenario,就把「正常路徑 / 異常路徑 / edge case」都釘下來了。

舉一條最後寫得最痛快的 — **`Concurrent purchase loses gracefully`**:

```markdown
#### Scenario: Concurrent purchase loses gracefully
- **GIVEN** two authenticated buyers POST `/api/carbon-listings/{id}/purchase` for the same approved listing within milliseconds
- **WHEN** both requests reach the controller
- **THEN** the first request's transaction commits (purchase row inserted, listing → sold). The second request's transaction fails on the `UNIQUE(carbon_listing_id)` constraint, and the API returns HTTP 409 Conflict with a message describing that the listing is no longer available
```

這條 scenario 就是上面三層防線的契約版本。Pest test 直接照這個 scenario 對著寫,**spec 跟 test 是同源**。

## apply:八個 task group 的節奏

`/opsx:apply phase-2-carbon-listings` 之後,8 個 task group 的拆法是這樣:

| Group | scope | commit |
|---|---|---|
| 1 | DB migrations(listings + purchases + users.role 補欄位) | `feat(backend): add carbon_listings + carbon_purchases migrations` |
| 2 | Models / Policy / Role helpers / `/me` 加 flag | `feat(backend): add CarbonListing model with state machine, policy, role helpers, /me role flags` |
| 3 | Seller endpoints + Pest | `feat(backend): add seller listing endpoints with Pest coverage` |
| 4 | Market + Purchase + Admin endpoints + Pest | `feat(backend): add market browse + purchase + admin review endpoints with Pest coverage` |
| 5 | 前端 session enrichment + AppHeader + EmptyState primitive | `feat(frontend): role-aware AppHeader + session role flags + EmptyState primitive` |
| 6 | Seller surfaces(new / list / detail / recall + StatusBadge) | `feat(frontend): add seller listing surfaces` |
| 7 | Market + Purchase history + Admin review surfaces | `feat(frontend): add market browse + purchase history + admin review surfaces` |
| 8 | 驗證(Pest 全跑、tsc、frozen-lockfile、openspec validate) | `chore(openspec): mark phase-2 verification group complete` |

**task group = commit boundary** 是 OpenSpec 紀律裡我覺得最 underrated 的一條:它強迫你把工作拆成「可以獨立驗證、獨立 revert」的單位。Group 3 出問題,前面 1、2 已經 commit 不會被影響;Group 7 寫一半發現 7.2 設計有問題,前 7.1 已經 commit,改的時候 mental load 少很多。

一個小細節:**Group 4 commit 之前一定要跑全套 Pest**,因為 Group 2、3 加的 model / policy 在 Group 4 的 purchase / admin endpoint 都被用到。Group 4 自己的測試綠不代表 Group 2、3 沒有 regression。所以 8.1 是「全套 Pest + 全 phase 範圍」,跑出來 69 passed (149 assertions)。

## 中間有兩個 trap 

**Trap 1:`Model::create()` 回傳的 listing `status` 是 `null`**

第一輪寫 Group 3 的時候,CreateTest 死在這:

```php
$response->assertJsonPath('listing.status', 'pending');
// 失敗:Expected 'pending', got null
```

DB row 是 `pending`(`status` 欄位 default `'pending'`),但 `CarbonListing::create([...])` 回傳的 **in-memory model** 沒填 default 值 — `null`。修法:

```php
class CarbonListing extends Model
{
    protected $attributes = [
        'status' => self::STATUS_PENDING,
    ];
    // ...
}
```

Eloquent 的 `$attributes` 是「new model instance 的預設值」,跟 DB 層的 `default` 是兩件事。寫的時候沒想到,被 Pest 抓出來,**這就是為什麼測試先行有用**。

**Trap 2:`saving` listener 不能在 create 時觸發**

第一版 listener 沒判 `$listing->exists`,結果新建 listing 的時候 `getOriginal('status')` 回 `null`,`null → pending` 不在 ALLOWED_TRANSITIONS 裡,直接 throw。所有 create 都死。

修法是 listener 的第一行:

```php
if (! $listing->exists) {
    return;
}
```

新建的 row 沒有 original status 可比較,本來就不該檢查。這條 guard 加進去之後一路綠燈。

## archive 儀式:把 delta 寫回 specs/

驗證綠了之後 `/opsx:archive phase-2-carbon-listings`,儀式:

1. **sync** `openspec/changes/phase-2-carbon-listings/specs/auth/spec.md` 的 `## MODIFIED` 那條 → 覆蓋 `openspec/specs/auth/spec.md` 對應的 requirement
2. **sync** `openspec/changes/phase-2-carbon-listings/specs/carbon-listings/spec.md` 的 `## ADDED` 整本 → 變成全新的 `openspec/specs/carbon-listings/spec.md`(因為 carbon-listings 之前沒有 spec)
3. **move** `openspec/changes/phase-2-carbon-listings/` → `openspec/changes/archive/2026-06-14-phase-2-carbon-listings/`
4. **commit** 上面三個動作為一個 chore

完成後:

```
openspec/specs/
├── auth/spec.md              ← Current-Session Endpoint 現在多三個 role flag
├── bootstrap/spec.md
└── carbon-listings/spec.md   ← 新落地的 10 條 requirement

openspec/changes/
├── archive/
│   ├── 2026-06-12-phase-0-bootstrap-monorepo/
│   ├── 2026-06-14-phase-1-auth-sanctum/
│   └── 2026-06-14-phase-2-carbon-listings/
└── (空 — phase-3 槽位釋出)
```

`openspec validate --all` 結果:

```
✓ spec/auth
✓ spec/bootstrap
✓ spec/carbon-listings
Totals: 3 passed, 0 failed
```

active change 槽位空了,**就等於 phase-3 該開了**。

## phase-3 預告

下一個 change 八九不離十就是 **phase-3-web3-settlement** — `web3p/web3.php` 串智能合約、平台代發、買賣行為在鏈上 mirror。設計題:

- **on-chain 跟 off-chain 哪個是真相**?listing 一定先 off-chain create、approve、purchase,鏈上只 mirror final state 還是 mirror 每一個 transition?
- **平台錢包代發的 nonce 管理**:同時兩筆 buy 過戶都要 sign tx,nonce 怎麼不打架(這次 race 是 DB,下次是鏈)
- **gas / 失敗 retry**:tx revert 的時候 off-chain 狀態怎麼回滾?

寫 Ep-6 的時候會有完整的 design walkthrough。中間如果踩到「Sanctum cookie 在 production cross-domain 還是炸」的 issue,會單獨寫一篇番外。

## 收尾

phase-2 一天從 propose 跑到 archive,印象最深的不是寫 code 那段(那段 Pest 推著走、tsc 推著走、跑得很順),是**早上花一小時把 design 那 10 個決策寫完那段**。把每個決策的 trade-off 寫進 design,後面寫 code 就只是執行 — **不用再吵一次該不該這樣選**。

> OpenSpec 在 spec 階段做的「先寫對為什麼」,在 apply 階段會把利息全部還給你。

下一篇 Ep-6 應該就是 phase-3-web3-settlement,等我 propose 完再開工。
