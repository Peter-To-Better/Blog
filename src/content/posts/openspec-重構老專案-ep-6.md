---
title: "OpenSpec 重構老專案 Ep-6:揪出潛伏一年的 Sanctum bug"
pubDate: 2026-06-17 00:00:00
description: "第四個角色 worker 接進來，卻踩到 phase-1 就埋下的潛伏 bug：server-side fetch 沒帶 Referer，Sanctum 不認 SPA session，SSR 認證鏈靜默斷掉。這篇完整記錄排查路徑，還講 saved listener 與 multipart 上傳的安全紅線。"
author: "Peter"
tags: ["重構筆記", "OpenSpec", "Laravel", "Next.js", "Sanctum", "Multipart"]
category: "重構筆記"
keywords: "OpenSpec, Laravel 12, saved listener, multipart FormRequest, Sanctum stateful, SANCTUM_STATEFUL_DOMAINS, Referer header, RSC cookie forwarding, Carbon-ESG"
draft: false
---

## 本篇重點

[Ep-5](/posts/openspec-重構老專案-ep-5/) 收尾 phase-2-carbon-listings archive、active change 槽位空出來。phase-3 接手的是 Carbon-ESG **第四個行為角色 worker** — 工人申請、認領「需要維護的土地」、提交前後照片、admin 審核回報。一天從 propose 跑到 verify(archive 還沒按,等明天看 UI 沒問題再按),backend 133 Pest 全綠、frontend tsc clean、curl 模擬完整 SPA flow 19 步 + 13 個 protected route 全綠。

照例不流水帳,只挑**這次最值得寫進筆記的四件事**:

1. **`saved` 跟 `saving` 是兩個 listener,職責分工** — phase-2 只用 `saving` 做 transition 驗證;phase-3 開始 `CarbonListing` 多掛一個 `saved`,負責「pending→sold 同時 `needs_workers=true` 就自動建一筆 WorkerJob」。為什麼是 `saved` 不是 `saving`、`WorkerJobReport.saved` 又怎麼回頭跟 parent `WorkerJob` 講話
2. **`WorkerJob.rejected` 狀態在 apply 中途被砍** — 一開始 spec 寫了 5 個狀態,實作到 Pest 才意識到「rejected 是 report 的屬性,從來不是 job 的屬性」。`/opsx:apply` 半路修 spec 的儀式
3. **multipart 上傳的 FormRequest 紅線** — `image|mimes:jpg,jpeg,png|max:5120`,**驗證在 controller body 之前**。為什麼 `mimes` 不只是看副檔名、`.php` 改名 `.jpg` 為什麼也擋得下、檔名怎麼徹底避開 user input
4. **抓到一個 phase-1 就埋下的 latent bug** — Next.js server-side `fetch()` 只帶 `Cookie + Accept`,沒帶 `Referer`。Sanctum 的 `EnsureFrontendRequestsAreStateful` middleware 看的是 `Referer/Origin`,沒有 → 不認 stateful → session cookie 被忽略 → 401 → `(protected)/layout` 把人踢回 `/login`

第四點我想額外多花筆墨 — 那是這次最像 distributed-debugging 的一段:**「為什麼直接 curl backend 是 200,但瀏覽器明明帶了一樣的 cookie 卻被踢回 login」**,整個排查路徑很值得記下來。

<!-- more -->

## 從 ep-5 收尾:phase-2 archived,槽位空出來

Ep-5 寫到 archive 那段,phase-2-carbon-listings 整本 spec 落地進 `openspec/specs/carbon-listings/spec.md`、auth spec 的 `Current-Session Endpoint` 加進三個 role flag。我隔了一天醒來,active change 槽位是空的:

```
openspec/specs/
├── auth/spec.md              ← 三個 role flag 已落地
├── bootstrap/spec.md
└── carbon-listings/spec.md   ← 10 條 ADDED requirement 已落地

openspec/changes/
├── archive/
│   ├── 2026-06-12-phase-0-bootstrap-monorepo/
│   ├── 2026-06-14-phase-1-auth-sanctum/
│   └── 2026-06-14-phase-2-carbon-listings/
└── (空 — phase-3 該開了)
```

OpenSpec 紀律就是這樣推著走 — **槽位空,就等於下一個 change 該開了**。

跟 ep-5 預告稍微不一樣:我本來打算 phase-3 直接做 web3 結算,但實際打開 CLAUDE.md 看四個角色那一段,意識到 **worker(工人)整地 + 回報這條 loop** 才是 phase-2 真正缺的下一塊。Web3 結算是「把已經跑通的 DB 流程 mirror 上鏈」,但 worker loop 是「現在 DB 根本還沒有這個流程」。先補 DB 端的完整性再上鏈才合理 — 不然 phase-4 上鏈時還要回頭 patch worker 那條鏈。順序顛倒。

於是改打:

```bash
/opsx:propose phase-3-jobs
```

scope 大概是:`legacy/registJob.php` 那個塞滿 modal 跟 PDO bind 的舊頁面用 OpenSpec 重新長出來 — worker 申請 → admin 核准 → 工人變 `isWorker=true` → 在 `/worker/jobs` 看到「賣家標記需要維護、買家已購買」的土地 → 認領 → 整地 → 上傳前後照片 → admin 核准回報。

## proposal 在切什麼

跟前兩個 phase 一樣,proposal 的功夫在「**明確列出哪些不做**」。phase-3 有意排除這四件事:

| 不做 | 為什麼 |
|---|---|
| **Web3 on-chain 結算** | phase-3 的「admin 核准回報」目前只寫 DB。phase-4 才把同一個 transitionTo 包進 contract call,phase-3 故意把 `transitionTo()` + `DB::transaction()` 的 shape 設計成 phase-4 能直接 graft 上去的 strict superset |
| **S3 / 私有 disk / signed URL** | 第一次有 multipart 上傳,本地 disk + `php artisan storage:link` 夠用。檔名用 `Str::random(40)` 不可猜,**有意接受「URL 拿到就能看圖」這個殘留風險**,bucket 移植留給後面 |
| **email 通知 + 工人 rating** | 同 phase-2 的邏輯。沒有 mail driver / queue / template,phase-3 仍仰賴 UI 看狀態 |
| **多個 worker 同時做一塊地 / job 超時自動取消** | `WorkerJob.worker_id` 單值。沒有 squad work、沒有 SLA。Worker 認領後消失就讓 job 卡著 — v2 問題 |

縮 scope 的動機跟前幾次一樣:**一個 change 要可以一氣呵成 archive**。8 個 task group、估今天可以走完。實際上 backend 6 group 從早跑到下午、frontend 2 group 跑到晚上,中間還拆出一個 Sanctum bug,**這次延伸到第二天才完整 verify**(後面那段 war story 就是兇手)。

`proposal.md` 寫完 `openspec validate phase-3-jobs` 直接綠,進 design。

## design 決策 1:`saved` 跟 `saving` 是兩個 listener,職責分工

phase-2 的 `CarbonListing` 已經掛了一個 `saving` listener,負責「擋掉繞過 `transitionTo()` 的非法 transition」(Ep-5 的 design 決策 2)。phase-3 要做的事情 **不能再塞進同一個 listener 裡** — 需求是:

> 當 listing 從 `approved` transition 到 `sold`,而且 `needs_workers === true`,要 atomically 在 `worker_jobs` 開一筆 `status=open` 的工作機會,跟 `carbon_purchases` 的 insert 包在同一個 `DB::transaction()` 裡。

直覺第一版會直接在 `PurchaseController` 裡寫:

```php
DB::transaction(function () use ($listing) {
    $listing->transitionTo('sold');
    $listing->save();
    CarbonPurchase::create([...]);
    if ($listing->needs_workers) {
        WorkerJob::create([
            'carbon_listing_id' => $listing->id,
            'status' => 'open',
        ]);
    }
});
```

這樣寫的問題跟 ep-5 那個 transition `if` 散在 controller 裡是一樣的 — **未來任何把 listing 變 sold 的路徑都要記得這段**。`/api/admin/manual-mark-sold` 哪天要開出來?要記得抄。Tinker 修資料把某個 listing 強塞成 sold?WorkerJob 不會建,事後爛尾。

正確姿勢:**把副作用也寫進 model 的 lifecycle hook**。但這次不能用 `saving`,要用 `saved`。原因是 FK ordering:

```
saving 觸發點:UPDATE/INSERT SQL 還沒送出去,$listing->id 在 INSERT 的場景還是 null
saved 觸發點:SQL 已經 commit,$listing->id 已經拿到、可以拿去當 child 的 FK
```

side effect 是建一筆 `worker_jobs(carbon_listing_id = $listing->id)`,需要 parent 先 commit、才有 id 可以 reference。所以決策是:**`saving` 留給 validation,`saved` 留給 side effect**。

```php
protected static function booted(): void
{
    // 第一個 listener:擋非法 transition(phase-2 既有)
    static::saving(function (CarbonListing $listing): void {
        if (! $listing->exists || ! $listing->isDirty('status')) return;
        $original = (string) $listing->getOriginal('status');
        self::assertValidTransition($original, $listing->status);
    });

    // 第二個 listener:sold + needs_workers 的副作用(phase-3 新增)
    static::saved(function (CarbonListing $listing): void {
        if (! $listing->wasChanged('status')) return;
        if ($listing->status !== self::STATUS_SOLD) return;
        if (! $listing->needs_workers) return;

        WorkerJob::create([
            'carbon_listing_id' => $listing->id,
            'status' => WorkerJob::STATUS_OPEN,
        ]);
    });
}
```

兩個 listener 各管各的,讀起來很乾淨。但這引出第二個問題:**這個 side effect 要被 `PurchaseController` 的 transaction 包起來,不能自己跑出 transaction 邊界**。

幸好 Eloquent 的 `saved` 是 **同步觸發** — 它在 `DB::transaction(function () { ... })` 裡面被觸發的時候,`WorkerJob::create()` 走的也是同一個 connection、同一個 transaction。如果 `WorkerJob` insert 出事(例如有人手動先塞了一筆 stale row 進 `worker_jobs`,撞 `UNIQUE(carbon_listing_id)`),`QueryException` 會 bubble up,**整個 transaction 連同 carbon_purchases 跟 listing.status 一起 rollback**。

Pest 直接打這個 scenario:

```php
it('rolls back the purchase if WorkerJob auto-create fails on UNIQUE collision', function () {
    $buyer = User::factory()->create();
    $listing = CarbonListing::factory()->approved()->create(['needs_workers' => true]);

    // 先手動塞一筆 stale 的 WorkerJob 撞 UNIQUE
    WorkerJob::create(['carbon_listing_id' => $listing->id, 'status' => 'open']);

    $response = $this->actingAs($buyer)
        ->postJson("/api/carbon-listings/{$listing->id}/purchase");

    // 期待:整個 purchase transaction 被 rollback,listing 還是 approved
    expect($listing->fresh()->status)->toBe('approved');
    expect(CarbonPurchase::where('carbon_listing_id', $listing->id)->exists())->toBeFalse();
    $response->assertStatus(409);
});
```

跑起來綠的。

### `WorkerJobReport.saved` 也用同樣的 trick,只是方向相反

phase-3 還有一個地方用到「listener 從 child 通知 parent」的 pattern。場景:

> admin 退件一筆 `WorkerJobReport`,parent `WorkerJob` 要從 `reported` 退回 `claimed`,讓**同一個 worker** 可以重新交一份回報。worker_id 必須保留(不能變成新 open 給別人搶)。

`saved` listener 寫在 `WorkerJobReport` 上,**回頭跟 parent 講話**:

```php
static::saved(function (WorkerJobReport $report): void {
    if (! $report->wasChanged('status')) return;
    if ($report->status !== self::STATUS_REJECTED) return;

    $job = $report->workerJob;
    if ($job?->status === WorkerJob::STATUS_REPORTED) {
        $job->transitionTo(WorkerJob::STATUS_CLAIMED);
        $job->save();
    }
});
```

`AdminJobReportReviewController::reject()` 因此寫起來特別乾淨:

```php
public function reject(RejectRequest $request, WorkerJobReport $workerJobReport): JsonResponse
{
    Gate::authorize('reject', $workerJobReport);
    DB::transaction(function () use ($request, $workerJobReport) {
        // 只寫 report 自己,parent job 由 listener 自動 bounce
        $workerJobReport->transitionTo(
            WorkerJobReport::STATUS_REJECTED,
            ['review_reason' => $request->validated('reason')],
        );
        $workerJobReport->save();
    });
    return response()->json(['report' => $workerJobReport->fresh()]);
}
```

controller 只管自己這條 resource,跨 resource 的 state coupling 由 model lifecycle 託管。**這條規則我從 phase-3 開始正式寫進 design 當原則**:

> Cross-table 副作用一律由 lifecycle hook 託管,controller 只負責它自己這條 resource 的 write。

兩道 listener、雙向通知,中間靠 `DB::transaction()` 撐起原子性。phase-2 那條 `saving` 還在原地,phase-3 又疊上來兩條 `saved`,model 從「驗證者」變成「驗證 + 副作用觸發 + 跨 resource 通訊」三件事的 hub。

## design 決策 2:`WorkerJob.rejected` 在 apply 中途被砍

這是 phase-3 唯一一次 spec 在 `/opsx:apply` 階段被回頭改的決策,值得寫進筆記。

propose 階段我寫 `WorkerJob` 的 status enum,直覺塞了 5 個:

```
open → claimed → reported → approved | rejected
                                          ↓
                                      claimed (resubmit)
```

`spec.md` 寫:

> The `status` column MUST take one of exactly five string values: `open`, `claimed`, `reported`, `approved`, `rejected`. ... `rejected` is NOT terminal — a rejected report flips the parent job back to `claimed` ...

寫的時候沒覺得有問題,實作下去寫到 `transitionTo()` 的 ALLOWED_TRANSITIONS map 才開始覺得怪:

```php
private const ALLOWED_TRANSITIONS = [
    self::STATUS_OPEN => [self::STATUS_CLAIMED],
    self::STATUS_CLAIMED => [self::STATUS_REPORTED],
    self::STATUS_REPORTED => [self::STATUS_APPROVED, self::STATUS_REJECTED],
    self::STATUS_APPROVED => [],
    self::STATUS_REJECTED => [self::STATUS_CLAIMED],  // ←???
];
```

問題出在我寫 `WorkerJobReport.saved` listener 的時候 — 它應該把 job 從 `reported` 怎麼樣?**到底是 `reported → rejected → claimed`,還是 `reported → claimed` 直接過?**

仔細想了一下發現:**從來沒有任何 controller / endpoint 會把 job 變 rejected**。admin 退的是 `WorkerJobReport`(report 的屬性),不是 job。job 的「失敗狀態」根本是個影子概念 — 沒人會用到、沒人會看到。

繞了一圈我意識到:**rejection 是 report 的屬性,不是 job 的屬性**。job 的生命週期是「開放 → 認領 → 回報 → 核准」,沒有「失敗」這個 terminal。失敗是 report 那層的概念。

決策:**砍掉 `WorkerJob.rejected`**,簡化 state graph 成 4 個:

```
open → claimed → reported → approved
              ↑              ↓
              └─────────────┘
                (rejection bounce 直接從 reported 回 claimed)
```

OpenSpec 的好處在這時候很明顯:**spec 不是聖經,apply 階段發現實作邏輯逼出 spec 錯誤,就回頭改 spec**。儀式很短:

1. 在 `openspec/changes/phase-3-jobs/specs/jobs/spec.md` 修那段 requirement 文字
2. 改 model 跟 ALLOWED_TRANSITIONS
3. 改 Pest test
4. 在 commit message 寫清楚為什麼

commit 訊息我寫:

> Implementation revealed WorkerJob.rejected status was redundant — rejection is always a property of the report, never the job, so the status was dropped and the rejection-bounce path is now reported → claimed. Spec updated in the same commit.

`/opsx:apply` 的官方流程允許這種半路改 spec 的事:

> Allows artifact updates: If implementation reveals design issues, suggest updating artifacts - not phase-locked, work fluidly

這條 guardrail 我之前讀過,但這次是第一次真的用到。**結論是:design 寫得再仔細,model 一旦碰 keyboard 就會自己長出意見,讓 spec 跟著修就對了**。

## design 決策 3:multipart 上傳的 FormRequest 紅線

phase-3 是新 stack 第一次有 file upload 的 surface。對照 legacy 那段 `registerjobsave.php`:

```php
// legacy/registerjobsave.php(凍結保留,僅供查語意)
$ext = strtolower(pathinfo($_FILES["images"]["name"][0], PATHINFO_EXTENSION));
$frontImageName = md5(uniqid()) . "_front." . $ext;
$frontTarget = "images/" . $frontImageName;
$frontTmpName = $_FILES["images"]["tmp_name"][0];
if (!move_uploaded_file($frontTmpName, $frontTarget)) {
    throw new Exception('前照片上傳失敗');
}
```

這段把 `CLAUDE.md` 安全紅線第 4 條的所有警告全部踩過去 — 沒驗 mimetype、沒驗 size、檔名直接從 user input 來、目錄存在性手動判斷。最危險的是**沒有任何 validation 就 `move_uploaded_file`** — 一個 PHP webshell 改名 `.jpg` 就直接寫進 web root。

新 stack 的紅線寫進 `SubmitReportRequest`:

```php
class SubmitReportRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'datetime_start' => ['required', 'date'],
            'datetime_end' => ['required', 'date', 'after:datetime_start'],
            'content' => ['required', 'string', 'max:2000'],
            'before_image' => ['required', 'image', 'mimes:jpg,jpeg,png', 'max:5120'],
            'after_image' => ['required', 'image', 'mimes:jpg,jpeg,png', 'max:5120'],
        ];
    }
}
```

關鍵設計是:**`FormRequest` 在 controller body 跑之前就跑完**。Laravel 在 controller method 被呼叫之前已經 resolve `SubmitReportRequest` — 這意味著:

| 階段 | controller body 是否已執行 | 檔案是否已寫進 disk |
|---|---|---|
| validation 失敗 | ❌ | ❌ |
| validation 通過 | ✅ | controller 自己決定 |

所以 oversized file / non-image / `.php` 改名 `.jpg`,**全部在「還沒進 controller」就被 422 擋下來**。不會有 controller 寫了一半的爛尾狀態、不會有 storage/app/public/ 裡有半個垃圾檔。

`mimes` 跟 `image` 兩個 rule **不是只看副檔名**。`image` rule 內部跑 `getimagesize()`、`mimes` 跑 `finfo` 讀檔案 magic bytes,所以一個 PHP 檔改名 `.jpg` 仍然會被認出來。Pest 直接打這個 scenario:

```php
it('rejects non-image upload with 422', function () {
    [$worker, $job] = makeClaimedJob();

    $response = $this->actingAs($worker)
        ->post("/api/worker-jobs/{$job->id}/report", [
            // ... 其他欄位
            'before_image' => UploadedFile::fake()->create('evil.php', 100, 'application/x-php'),
            'after_image' => UploadedFile::fake()->image('after.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(422)->assertJsonValidationErrors(['before_image']);
});
```

跑起來綠的。422 + 字段級錯誤訊息「before image 必須是這些檔案類型:jpg, jpeg, png」,完全沒進過 disk。

通過 validation 後,controller 用 framework helper 寫檔:

```php
$beforePath = $request->file('before_image')->store('job-reports', 'public');
$afterPath = $request->file('after_image')->store('job-reports', 'public');
```

`->store()` 自己生 40 字隨機 hash 當檔名,**檔名完全跟 user input 無關**。產出長這樣:

```
storage/app/public/job-reports/teJ4dt3gPyGp9zoTs8ZXRtpFVN0nqoBZVKR3eAwZ.jpg
                              ↑──────────── Str::random(40) ──────────────↑
```

`php artisan storage:link` 把 `storage/app/public/` 軟連結到 `public/storage/`,前端就可以從 `/storage/job-reports/<hash>.jpg` 直接取圖。

這套寫起來的鬆耦合度,**前面 controller 完全不需要知道「副檔名是什麼、檔名怎麼生、路徑前綴是什麼」** — 全部由 `FormRequest` + `Storage` driver 處理掉。對照 legacy 那段把 `pathinfo()`、`md5(uniqid())`、`move_uploaded_file()` 全部塞在 controller body 裡的版本,差距很明顯。

唯一接受的殘留風險:`/storage/job-reports/<hash>.jpg` 是 **public readable**。任何拿到 URL 的人都能看圖。**有意接受**,因為 hash 40 字、不可猜,前端在 admin queue / job detail 之外不會渲染這條 URL,而且 phase-4 上 S3 時會一併換 signed URL + private disk。寫進 design 的 "Risks / Trade-offs" 那段:

> Hardening to signed URLs comes with the S3 phase.

## bug 戰記:Sanctum 的 `Referer` header — phase-1 種下的雷,phase-3 自己踩

這段是 phase-3 最有 distributed-systems 味道的排查路徑,寫詳細一點。

### 症狀

`/opsx:apply` 8 個 task group 全部跑完、Pest 133 綠、tsc clean、`openspec validate phase-3-jobs` 過。我跑 backend curl e2e 19 個 step 全綠 — backend 完全沒問題。然後切回 UI 想自己點一次完整流程,輸入帳號密碼按登入,**被踢回 `/login`**。重試、重啟、清 cookie、無痕視窗都一樣。

第一直覺:CSRF / Sanctum config 哪裡沒對齊。grep `.env`:

```
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
SANCTUM_STATEFUL_DOMAINS=localhost:3000
SESSION_DRIVER=database
SESSION_DOMAIN=localhost
```

對齊正常。

### 拆症狀:backend 自己沒事

第一步 isolate:從 curl 直接打 `/api/me` 帶 fresh login 的 cookie。**結論是 backend 自己沒問題**。

```bash
# 模擬完整 SPA flow:csrf → login → me
JAR=/tmp/worker.jar
curl -c $JAR http://localhost:8000/sanctum/csrf-cookie -o /dev/null
XSRF=$(grep XSRF-TOKEN $JAR | awk '{print $7}' | python3 -c "...")
curl -c $JAR -b $JAR -H "X-XSRF-TOKEN: $XSRF" -H "Referer: http://localhost:3000" \
    -X POST http://localhost:8000/api/login -d '{"email":"worker@test.com","password":"password"}'
# Login 200 ✓

curl -b $JAR -H "Accept: application/json" -H "Referer: http://localhost:3000" \
    http://localhost:8000/api/me
# {"user":{"id":4,"name":"Worker",...,"isWorker":true}} 200 ✓
```

所以 phase-3 backend 完全 OK,session driver / cookie / Sanctum 都活著。問題在「**從 Next.js 走進 backend** 那個方向斷掉」。

### 第二步:複製 Next.js 實際走的那條路

Next.js 的 `(protected)/layout.tsx` 用兩個 server-side helper:

```ts
// frontend/lib/session/server.ts
export async function getSessionFromCookies(): Promise<User | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  if (!cookieHeader) return null;

  const response = await fetch(`${API_URL}/api/me`, {
    headers: {
      Cookie: cookieHeader,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!response.ok) return null;

  const data: { user: User } = await response.json();
  return data.user;
}
```

把這條的 header 抄成 curl 試一次:

```bash
# Next.js server.ts 實際送出的 header 是 Cookie + Accept(就這兩個!沒 Referer 沒 Origin)
curl -b $JAR -H "Accept: application/json" http://localhost:8000/api/me
# {"message":"Unauthenticated."}  401 ❌
```

**抓到了**。同樣的 cookie,差別只在沒帶 `Referer`,Laravel 直接回 401。Next.js 那邊收到 401 → `getSessionFromCookies` return null → `(protected)/layout` 看到 `if (!user) redirect('/login')` → 踢回登入頁。

### 為什麼 Referer 是關鍵?

Sanctum 在 `api` 路由前面塞了一個 `EnsureFrontendRequestsAreStateful` middleware。**它看的不是 cookie**,而是 request 的 `Referer` 或 `Origin` header,跟 `SANCTUM_STATEFUL_DOMAINS` 比對:

```php
// 簡化版,實際在 vendor/laravel/sanctum/src/Http/Middleware/EnsureFrontendRequestsAreStateful.php
$referer = $request->headers->get('referer');
$origin = $request->headers->get('origin');

if (in_host_list($referer ?? $origin, config('sanctum.stateful'))) {
    // ✓ 視為 SPA stateful 請求,套上 web middleware 群(session、CSRF、cookies)
} else {
    // 視為 stateless API,只認 token bearer。沒 token → 401
}
```

問題在 **server-side fetch (RSC) 預設不會帶 Referer**。瀏覽器發 fetch 會自動帶,因為 page 本身有 location;Next.js 在 Node 端發 fetch 沒有「我從哪個頁面來」這個概念,所以 Referer 是空的。

整個診斷鏈一旦看到 Referer 這條,故事就完整了:

```
Browser → Next.js server-side fetch → Laravel
   ↑                                       ↑
   有 Referer(瀏覽器自動帶)              沒 Referer(server fetch 沒這概念)
                                            ↓
                                       Sanctum 不認 SPA
                                            ↓
                                       Session cookie 被忽略
                                            ↓
                                       401 → redirect /login
```

### 修法

三個 server-side helper 都要補:

```ts
// frontend/lib/session/server.ts
const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';

const response = await fetch(`${API_URL}/api/me`, {
  headers: {
    Cookie: cookieHeader,
    Accept: 'application/json',
    // Sanctum's EnsureFrontendRequestsAreStateful middleware needs
    // Referer (or Origin) to match SANCTUM_STATEFUL_DOMAINS — otherwise
    // a server-to-server fetch carrying valid session cookies still
    // gets treated as a stateless API call and returns 401.
    Referer: FRONTEND_URL,
  },
  cache: 'no-store',
});
```

`lib/session/server.ts`、`lib/api/server.ts`、`lib/session/getApplicationStatus.ts` 三個 helper 同樣補。一個 PR diff 3 個檔,18 行加 0 行減。

修完再跑一次 curl 模擬 Next.js → backend:

```bash
curl -L -b /tmp/worker.jar http://localhost:3000/me
# Final-URL: http://localhost:3000/me  Status: 200 ✓
```

接著掃 phase-3 所有 protected route:

```
=== WORKER (approved) ===
  ✓ /me                         → 200 [歡迎]
  ✓ /worker/jobs                → 200 [工作機會]
  ✓ /worker/jobs/mine           → 200 [我的工作]

=== WORKER2 (no application) ===
  ✓ /me                         → 200 [歡迎]
  ✓ /worker/apply               → 200 [工人申請]

=== ADMIN ===
  ✓ /me                         → 200 [歡迎]
  ✓ /admin/worker-applications  → 200 [工人申請審核]
  ✓ /admin/job-reports          → 200 [工作回報審核]

=== NEGATIVE ===
  ✓ buyer → /worker/jobs            redirect → /worker/apply
  ✓ seller → /admin/worker-applications redirect → /me
  ✓ anonymous → /me                 redirect → /login
```

10 positive + 3 negative,全綠。

### 為什麼這個 bug 在 phase-1 / 2 都沒爆?

這是我 commit message 寫最細的一段:

> The latent bug existed since phase-1; phase-3 surfaced it because the new worker surfaces and the layout-level getApplicationStatusFromCookies were the first paths to exercise server-side cookie forwarding on a clean session.

phase-1 archive 時的驗證主要靠 Pest(testing client 自己 handle session,不走真實 RSC fetch) + client-side 的 axios(瀏覽器發 fetch 會自動帶 Origin)。phase-2 加了 `serverGet`,但 market / purchases / admin-review 我當時都是在已經登入很久的 session 上點進去,**Next.js dev server 的 fetch 偶爾會帶 `Referer`**(取決於 React Router 的 navigation 是 client-side 還是 RSC reload),測試覆蓋率剛好沒踩到「乾淨 session 的第一次 RSC fetch」這個 case。

phase-3 我新加的 `getApplicationStatusFromCookies` 是 **`(protected)/layout` 裡每個 navigation 都會跑** 的 RSC fetch。一登入就跑、清完 cookie 重登也跑、無痕視窗一開始就跑 — 完全沒給 latent bug 任何閃避空間。

### 心得

兩個:

1. **Latent bug 的特徵是「在受控環境跑很久才被特定路徑逼出來」**。phase-1 / 2 archive 時 Pest + tsc + 手動 click-through 都過,但「Pest 不走 RSC fetch、tsc 抓不到 runtime 401、手動 click-through 通常已經在 warm session 上」這三個盲點疊起來剛好讓 bug 躲過去
2. **Backend 跟 Frontend 中間的「server-side fetch」是新型態的 attack surface**。傳統 SPA 客戶端 fetch 拿 Origin 拿得很順,server-side RSC fetch 預設什麼都沒帶。Sanctum 預設規則是針對「瀏覽器 SPA」設計的,不是針對「Node 上的 RSC」設計的 — 中間那個 gap 就是這次踩到的雷

寫進 commit message,將來 phase-N 的 me 再翻 git log 不會再花一小時排查。

## apply 收尾:8 個 task group + 兩套 e2e

`/opsx:apply phase-3-jobs` 拆成 8 個 commit-bounded task group,跟 ep-5 同樣的紀律,scope 在 tasks.md 裡寫明:

| Group | scope | commit |
|---|---|---|
| 1 | 4 個 migrations(`needs_workers` + `worker_applications` + `worker_jobs` + `worker_job_reports`)+ `storage:link` | `feat(backend): add jobs migrations + needs_workers column + storage link` |
| 2 | 3 個 Model + state machines + `isWorker()` + 3 個 Factory | `feat(backend): add WorkerApplication/WorkerJob/WorkerJobReport models + state machines + isWorker helper` |
| 3 | `CarbonListing` MODIFY:`needs_workers` cast + 新 `saved` listener + 副作用 Pest | `feat(backend): add needs_workers to listings + sold→WorkerJob auto-create with rollback safety` |
| 4 | `/api/me` 加 `isWorker` flag | `feat(backend): /api/me returns isWorker flag` |
| 5 | Worker application endpoints + admin review + Pest | `feat(backend): add worker application endpoints + admin review with Pest coverage` |
| 6 | Worker job claim / report + admin report review + multipart + Pest | `feat(backend): add worker job claim/report + admin report review + race defense + multipart upload` |
| 7 | 前端:AppHeader 加 worker nav + 6 個 worker surface + seller form 加 `needs_workers` checkbox | `feat(frontend): add worker apply + jobs + report surfaces + needs_workers seller checkbox + AppHeader worker nav` |
| 8 | 前端:2 個 admin 審核 surface + 8 步驗證 | `feat(frontend): add admin worker-application + job-report review surfaces` |

加上中間半路修 spec + 抓到 Sanctum bug 的 fix,phase-3 一共 11 個 commit。

驗證這次有兩套 e2e,**因為 backend 的 Pest 跟 frontend 的 SSR rendering 是兩個獨立的 layer**:

- **Backend e2e:19 步**,bash 寫一個 cookie-jar-per-persona 的 driver,模擬完整 Sanctum SPA flow:csrf → login → 上架 → 審核 → 購買 → 自動建工作 → 申請工人 → 核准工人 → 看到工作 → 認領 → 提交回報(含真實 multipart 上傳兩張 PIL 生的 JPEG)→ 審核回報 → 退件 → 重新提交 → `needs_workers=false` 不建 job 驗證 → 非 admin 拒絕。19/19 全綠
- **Frontend e2e:13 步**,curl 直接打 `localhost:3000/<route>` 帶各 persona 的 cookie jar,檢查最終 URL + grep 渲染出來的 HTML 看是不是該渲染的 nav / 標題出現。修完 Referer 之後 10 positive + 3 negative redirect 全綠

兩套 e2e 加 Pest 133 passing,**比 phase-2 多 64 個 test**。multipart + 三個新 state machine + 跨 resource listener + race defense 這些是 phase-3 對測試成本的「合理累進」。

## archive 還沒按

寫到這裡 phase-3 還沒按 `/opsx:archive`,刻意留一晚等明天看 UI 是不是順 — Sanctum bug 抓到之後我已經不太信任「Pest + tsc + curl 全綠就代表 UX 順」這件事。明天起來把 worker / admin 兩條動線真的用瀏覽器點過一次,確認沒有第二個 latent bug,再按 archive。

按下去之後:

```
openspec/specs/
├── auth/spec.md              ← Current-Session Endpoint 多 isWorker flag
├── bootstrap/spec.md
├── carbon-listings/spec.md   ← needs_workers + sold 副作用 落地
└── jobs/spec.md              ← 全新 capability,10 條 ADDED requirement

openspec/changes/
├── archive/
│   ├── 2026-06-12-phase-0-bootstrap-monorepo/
│   ├── 2026-06-14-phase-1-auth-sanctum/
│   ├── 2026-06-14-phase-2-carbon-listings/
│   └── 2026-06-17-phase-3-jobs/
└── (空 — phase-4 槽位釋出)
```

四個 capability 落地,跟 CLAUDE.md 規劃的「auth / bootstrap / carbon-listings / jobs / web3」剛好差 web3 一條。

## phase-4 預告 + ep-7 題材

phase-4 鎖定 **`phase-4-web3-settlement`**,scope:

- `web3p/web3.php` 接 backend,平台錢包代發(buyer / worker 都不需要 MetaMask)
- `POST /api/carbon-listings/{id}/purchase` 包進 contract call(`mint` ERC-1155 + transfer to buyer)
- `POST /api/admin/job-reports/{id}/approve` 包進 contract call(把「這塊地的維護證明」mint 上鏈)
- nonce 管理(同時兩筆 buy,signed tx 的 nonce 怎麼不打架 — 跟 phase-2 那個 DB race 是同型異種)
- gas / tx revert 的 off-chain rollback
- 私鑰絕對不進 git(`.env` 跟 `.env.example` 嚴格分,CI 環境變數注入)

ep-7 大概會聚焦在「**平台錢包代發 vs MetaMask 簽** 的 trade-off」、「**chain reorg / tx revert 的 off-chain compensating transaction**」、「**signed URL + 私有 disk** 順手在 phase-4 落地」這三個點。如果中間還要切一個 `phase-3.5-storage` 把 multipart 從 local disk 搬上 S3,那是個獨立番外。

## 收尾

phase-3 寫起來的節奏跟 phase-2 完全不同。phase-2 是「Pest 推著 tsc 推著 OpenSpec 推著走,順得不像話」;phase-3 是「Pest 推進去到一半發現 spec 寫錯回頭改 spec,寫完全綠以為要 archive 結果在 SPA 登入這條被埋了一年半的 Sanctum bug 卡了一個下午」。**前者讓你信任流程,後者讓你信任 e2e**。

> Pest 綠不代表瀏覽器點得通。tsc clean 不代表 runtime 不會 401。背後永遠有「之前的 phase 沒踩到所以沒爆」的 latent bug 在等你。

ep-6 就到這。phase-4 propose 之後 ep-7 再開。
