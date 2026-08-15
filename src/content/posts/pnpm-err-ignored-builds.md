---
title: "ERR_PNPM_IGNORED_BUILDS 解法：pnpm approve-builds 完整教學"
pubDate: 2026-07-17 21:00:00
description: "pnpm install 出現 [ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: sharp 導致 Aborting installation？完整解法：pnpm approve-builds 用空白鍵勾選，含誤按 Enter 後救回的兩種方案，--force 和 rebuild 為什麼都沒用。"
author: "Peter"
tags: ["pnpm", "Next.js", "踩坑"]
category: "pnpm"
keywords: "ERR_PNPM_IGNORED_BUILDS, Ignored build scripts sharp, pnpm approve-builds, pnpm install has failed, Aborting installation, pnpm onlyBuiltDependencies, unrs-resolver"
draft: false
---

## 本篇重點

`pnpm install` 突然炸出這段，然後整個安裝被中止？

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: sharp@0.34.5, unrs-resolver@1.12.2

Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.

Aborting installation.
  pnpm install has failed.
```

這不是你的專案壞了，是 **pnpm 的安全政策在攔你**。這篇給你最短路徑的解法、解釋為什麼 `--force` 和 `pnpm rebuild` 都救不了，以及 `approve-builds` 本身藏的兩個地雷（很多人誤按 Enter 之後卡在「沒東西好選」）。

<!-- more -->

## 最短解法（30 秒版）

```bash
pnpm approve-builds   # 上下鍵移動、「空白鍵」打勾、Enter 確認
```

兩個關鍵，都是地雷：

1. **一定要用「空白鍵」勾選** sharp 和 unrs-resolver，不要直接按 Enter
2. 最後的 `(y/N)` 確認**要打 `y`**，預設是 N

跑完再 `pnpm install` 就會過了。這個 approval 是 user-level 的，**一台機器跑一次就夠**，之後 fresh clone 同一個 repo 不會再問。

## 為什麼會發生？

任何 npm package 都可以掛 `postinstall` script（編譯 native binary、下載資源），這也是**供應鏈攻擊的常見入口**。所以 pnpm 新版預設**不跑任何 dependency 的 build script**，要你明確允許。

以 Next.js 專案為例，有兩個依賴必須跑 native build：

| Package | 為什麼要 build |
|---|---|
| `sharp` | 圖片最佳化核心，要編 libvips（C++）。沒編好會 fallback 到純 JS 版，效能差 5~10 倍 |
| `unrs-resolver` | Next.js 16 的新 module resolver（Rust），要編出 `.node` binary |

## 為什麼 `--force`、`rebuild`、`onlyBuiltDependencies` 都沒用？

這是最容易鬼打牆的地方。pnpm 11 把 build approval 拉到**比 lockfile 更高的層級**：

- `package.json` 的 `pnpm.onlyBuiltDependencies` 是「**這個 repo** 同意跑哪些 build」
- `pnpm approve-builds` 是「**你這個人**同意**這台機器**跑那些 build」

**兩件事，缺一不可。** 所以就算 `package.json` 白名單列好了，沒過 `approve-builds` 這關，`pnpm install --force`、`pnpm rebuild sharp` 全部照樣顯示 `Ignored build scripts`。

repo 端的白名單還是要寫（讓 CI 和隊友的 fresh clone 直接吃到）：

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["sharp", "unrs-resolver"]
  }
}
```

> ⚠️ 不要圖快用 `pnpm config set ignore-scripts false`，那是 global 放行所有 package，把供應鏈防線整個拆掉。

## 誤按 Enter 之後：「There are no packages awaiting approval」

`approve-builds` 的 prompt 寫著 `Press <space> to select`，但很多人下意識直接按 Enter，pnpm 會把它解讀成「**看過名單、全部不准跑**」，並寫進 user-level state。之後再跑 `pnpm approve-builds` 只會回你：

```
There are no packages awaiting approval
```

因為決議已下，pnpm 不再問。兩種救法：

```bash
# 方案 A：直接指名重新互動（pnpm 11.1+）
pnpm approve-builds --interactive sharp unrs-resolver

# 方案 B：手動編輯 pnpm 的 user state，把 false 紀錄砍掉再重跑
# macOS 路徑在 ~/Library/pnpm/ 之下的 yaml 檔
```

## 只想跑 dev mode？可以先放生

如果你現階段只需要 `pnpm dev` 改東西，**可以完全跳過 approve-builds**：sharp 沒編譯只影響 production 的圖片最佳化，dev mode 跑得起來。等要跑 production build 再回來處理。

---

這個坑是我在用 OpenSpec 重構老專案、幫前端跑 `pnpm create next-app` 時踩到的，完整的踩坑過程（包含 `--frozen-lockfile` exit 0 但 build 沒跑的陷阱）記錄在 [OpenSpec 重構老專案 Ep-3](/posts/openspec-重構老專案-ep-3)。
