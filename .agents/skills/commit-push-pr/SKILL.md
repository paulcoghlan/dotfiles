---
name: commit-push-pr
description: Commit staged and unstaged changes, push to a branch, and open a draft pull request. Use when the user wants to commit work, push a branch, or open a PR.
---

# Commit, Push, and Open a PR

## Context

Gather current git state before proceeding:

```bash
git status
git diff HEAD
git branch --show-current
```

## Steps

Based on the changes:

1. Create a new branch if currently on `main` or `master`
2. Stage all changes and create a single commit with an appropriate message
3. Push the branch to origin
4. Create a **draft** pull request using `gh pr create -d`

Complete all steps in a single pass. Do not add unrelated changes or extra commentary.
