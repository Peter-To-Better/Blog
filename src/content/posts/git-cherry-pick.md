---
title: "Git"
pubDate: 2024-03-14 11:40:12
description: "Git cherry-pick 完整教學：不合併整個分支，只把指定 commit 搬到目前分支。附雜湊值查法、多個 commit 一次 cherry-pick、衝突處理步驟說明。"
author: "Peter"
tags: ["git"]
category: "git"
keywords: "git cherry-pick 教學, cherry-pick 用法, git 選擇性合併 commit, git 合併特定 commit, git 指令教學"
draft: false
---

## Cherry Pick

`git cherry-pick` 指令用於將其他分支的一個或多個指定 commit 合併到目前的分支，不需要合併整個分支。

<!-- more -->

### 什麼時候會用到？

**場景一：hotfix 需要同步到其他分支**

你在 `main` 上修了一個緊急 bug（commit `abc123`），但 `develop` 分支也需要這個修復，不想整個 merge，就可以用 cherry-pick 只把那一個 commit 搬過去。

**場景二：從廢棄分支救出某個功能**

某個功能分支因為方向改變被放棄了，但裡面有一兩個 commit 是獨立且有用的，可以用 cherry-pick 把它們挑出來。

**場景三：整理 commit 到 release 分支**

只想把 `develop` 上已驗證的特定 commit 放進 `release`，而不是全部合併進去。

---

### 基本用法

**Step 1**：在來源分支找到目標 commit 的雜湊值（Hash）

```bash
git checkout feature-branch
git log --oneline
```

輸出範例：
```
abc1234 fix: 修正登入驗證邏輯
def5678 feat: 新增使用者頭像上傳
```

**Step 2**：切換到目標分支，執行 cherry-pick

```bash
git checkout main
git cherry-pick abc1234
```

成功後，該 commit 會被複製到 `main`，產生一個新的 commit（hash 不同，但內容相同）。

---

### 一次 cherry-pick 多個 commit

**方法一：列出多個 hash**

```bash
git cherry-pick abc1234 def5678 ghi9012
```

**方法二：使用範圍語法 `A..B`**

cherry-pick `commit-A` 之後到 `commit-B` 之間的所有 commit（不包含 A，包含 B）：

```bash
git cherry-pick abc1234..ghi9012
```

---

### 常用選項

**`--no-commit`：只套用變更，不自動 commit**

適合需要先檢查或合併多個變更再一起 commit 的情況：

```bash
git cherry-pick abc1234 --no-commit
# 確認變更後手動 commit
git commit -m "chore: apply selected fixes"
```

**`--edit`：套用後開啟編輯器修改 commit message**

```bash
git cherry-pick abc1234 --edit
```

---

### 處理衝突

cherry-pick 時如果遇到衝突，Git 會暫停並提示你手動解決：

```bash
# 1. 解決衝突後，標記為已解決
git add <衝突的檔案>

# 2. 繼續 cherry-pick
git cherry-pick --continue

# 或者放棄這次 cherry-pick，回到執行前的狀態
git cherry-pick --abort
```

---

### 注意事項

- cherry-pick 後產生的 commit **hash 會不同**，但內容相同，原始 commit 的作者資訊會保留。
- 頻繁使用 cherry-pick 可能導致重複 commit，後續 merge 時產生衝突，建議只在明確需要的場景使用。
- 使用 `Fork`、`GitLens`、`SourceTree` 等圖形化工具能更直覺地找到 commit hash 並執行 cherry-pick。
