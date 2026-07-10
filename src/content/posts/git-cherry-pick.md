---
title: "Git"
pubDate: 2024-03-14 11:40:12
description: "cherry-pick 指令用於將其他分支的一個或多個提交(commits)合併到目前的分支。它是 Git 提供的一種方便的整合方式,可以在不合併整個分支的情況下,只合併某些特定的 commit。"
author: "Peter"
tags: ["git"]
category: "git"
keywords: "git cherry-pick 教學, cherry-pick 用法, git 選擇性合併 commit, git 合併特定 commit, git 指令教學"
draft: false
---

## Cherry Pick

cherry-pick 指令用於將其他分支的一個或多個提交(commits)合併到目前的分支。它是 Git 提供的一種方便的整合方式,可以在不合併整個分支的情況下,只合併某些特定的 commit。

<!-- more -->

### 使用場景

當有兩個分支 A 和 B,如果 A 分支需要合併 B 分支的某個 commit,就可以使用 cherry-pick 指令,將 B 分支的指定 commit 合併到 A 分支上。

### 操作步驟

1. 先切換到 B 分支,使用`git log`指令找到需要 cherry-pick 的 commit 的雜湊值(Hash),並複製該雜湊值,或者使用`Fork、GitLens`等圖形化工具來更快的找到雜湊值(Hash)。

```bash
git checkout B
git log
```

2. 切換回 A 分支,執行`git cherry-pick`指令,並貼上前面複製的雜湊值。

```bash
git checkout A
git cherry-pick <commit-hash>
```

如果 cherry-pick 操作成功,Git 會將 B 分支的指定 commit 合併到 A 分支的最新 commit 上。如果出現衝突,需要手動解決衝突,然後使用`git cherry-pick --continue`繼續 cherry-pick 操作。

### 注意事項

- cherry-pick 會將指定 commit 合併到目前的分支,而不會合併該 commit 之前的任何 commit。
- cherry-pick 後,提交的作者仍然是原始 commit 的作者。
- cherry-pick 可以一次性合併多個 commit,只需在命令列中添加多個雜湊值即可。

透過 cherry-pick 指令,可以在不合併整個分支的情況下,靈活地合併其他分支的部分提交,使程式碼集成更加方便和精確。
