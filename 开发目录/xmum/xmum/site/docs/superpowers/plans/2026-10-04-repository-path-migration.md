# Repository Path Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task after the Issue is approved.

**Goal:** Move the tracked XMUM project from `xmum/xmum/` to `开发目录/xmum/` from the latest `origin/main`, preserving all merged product and CI behavior.

**Architecture:** Keep repository-level governance and workflows at the root. Relocate the complete tracked project subtree under `开发目录/xmum/`; update only path references and migration documentation. Reconcile the relocation against `origin/main` instead of importing the stale dirty checkout, and leave monitoring outputs and independent worktrees outside the commit.

**Tech Stack:** Git, GitHub Actions, Node.js 22.13.0, npm, vinext, existing Node and browser regression scripts.

**Spec:** `开发目录/xmum/xmum/site/docs/superpowers/specs/2026-10-04-repository-path-migration-design.md`

## Global Constraints

- Start from the latest `origin/main` and create a dedicated `codex/` branch only after the GitHub Issue receives the project owner's approval.
- Preserve the merged PR #7 background-color B changes and PR #9 EMGS·Etiqa content and evidence files.
- Keep `监测目录/` and the independent intake-status worktree out of the product migration.
- Do not commit `.env`, credentials, `node_modules`, build output, caches, `.DS_Store`, or migration archives.
- Do not change application behavior or user-facing copy except where a path reference must be updated.

## Review Focus

- Stale `origin/main` content must not be overwritten by the old dirty checkout; verify the insurance topic and B CSS after relocation.
- Relative links from the relocated site README and tests must still reach the moved evidence files.
- GitHub Actions must resolve the new Chinese path on a clean checkout.
- Generated directories must remain ignored and absent from the staged file list.
- The old project path must disappear from tracked files without leaving broken references in documentation or scripts.

### Task 1: Reconcile the source tree from latest main

**Files:**
- Move: every tracked path under `xmum/xmum/` to `开发目录/xmum/`.
- Exclude: `监测目录/`, the independent intake-status worktree, dependencies and generated output.

- [ ] Step 1: From a clean branch based on `origin/main`, inventory tracked paths and the current untracked migration source; record the 87 identical, 8 differing, and 3 missing files as reconciliation inputs.
- [ ] Step 2: Use `git mv` for the tracked project subtree and copy only source files that are missing from the latest main, resolving conflicts in favor of the latest merged main behavior.
- [ ] Step 3: Verify the staged tree contains the insurance content, evidence register, B CSS, and all required site assets, while generated directories remain ignored.

### Task 2: Update repository and project path references

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/browser-ci.yml`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `开发目录/xmum/xmum/MIGRATION.md`
- Modify: `开发目录/xmum/xmum/site/README.md`
- Modify: moved docs, scripts, and tests that still reference `xmum/xmum/`.

- [ ] Step 1: Search tracked files with `rg` for the old path and classify each hit as a runtime path, cache path, documentation link, or historical example.
- [ ] Step 2: Update runtime and documentation references to `开发目录/xmum/xmum/`; retain historical identifiers only when they describe prior state and cannot be mistaken for an active path.
- [ ] Step 3: Re-run the search and inspect all remaining matches before staging.

### Task 3: Validate the migrated project

**Files:**
- Test: existing `开发目录/xmum/xmum/site/tests/` suite and both root workflows.

- [ ] Step 1: Run `cd 开发目录/xmum/xmum/site && npm ci`.
- [ ] Step 2: Run `npm test`, `npm run lint`, `npm run test:single-export`, and `npm run build`; confirm the insurance topic, evidence register, and rendered HTML assertions remain present.
- [ ] Step 3: Run `git diff --check`, inspect `git status --short`, and confirm no generated or sensitive files are staged.
- [ ] Step 4: Push the branch and verify Site CI and Browser CI on the pull request.

### Task 4: Review and handoff

**Files:**
- PR description and Issue #N discussion.

- [ ] Step 1: Open a PR with a standalone `Closes #N` line and an `【Codex 自审】` section covering path reconciliation, tests, generated-file exclusions, and any remaining risks.
- [ ] Step 2: Do not merge; leave the PR for the project owner to review and decide.
