# 仓库项目路径迁移设计

## 目标

把 XMUM 项目的受版本控制内容从旧的 `xmum/xmum/` 统一迁移到 `开发目录/xmum/`，同时以最新 `origin/main` 为唯一基线，保留已经合并的浏览器 CI、背景色 B 方案和 EMGS·Etiqa 内容，不把当前脏工作区直接当作迁移源。

## 范围

- 仓库根目录继续保留 `.github/`、`.gitignore`、`AGENTS.md` 和根 `README.md`。
- 项目内容迁移到 `开发目录/xmum/xmum/`：`site/`、`materials/`、`MIGRATION.md` 及其受版本控制文件。
- GitHub Actions 的工作目录和缓存路径改为 `开发目录/xmum/xmum/site/`。
- 根说明、迁移说明、站点 README、站点文档和测试中的旧路径全部更新。
- `监测目录/` 是本地监测产物目录，不纳入本次产品迁移；`node_modules/`、构建产物、缓存和临时 worktree 不得进入提交。
- `开发目录/AI项目1-XMUM-New-Student-Mutual-Support-Platform-worktree-intake-status/` 是独立 worktree，不纳入迁移提交。

## 约束

- 实施分支必须从最新 `origin/main` 创建；当前 `codex/phase2-browser-ci` 的未提交删除/新增状态不能直接提交。
- 迁移不得回退 `origin/main` 已合并的 PR #7 和 PR #9 内容；保险主题、发布证据登记和 B 方案 CSS 必须仍在最终树中。
- 除路径、文档引用和迁移所需的忽略规则外，不改变站点行为、界面文字、内容来源边界或测试语义。
- 不提交密钥、`.env`、`node_modules`、`.DS_Store`、`dist`、`.next`、`export-single`、`.wrangler`、`tsconfig.tsbuildinfo` 或迁移压缩包。

## 验收

1. `git ls-files` 中所有项目文件位于 `开发目录/xmum/`，根级 CI 和说明文件仍在根目录，旧 `xmum/xmum/` 不再有跟踪文件。
2. `rg` 检查不存在指向旧项目路径的工作目录、缓存路径或文档链接；`监测目录/` 和独立 worktree 不在提交列表中。
3. `cd 开发目录/xmum/xmum/site && npm ci` 成功。
4. `npm test`、`npm run lint`、`npm run test:single-export` 和 `npm run build` 成功；单文件导出仍生成并通过现有校验。
5. 触发 GitHub Site CI 与 Browser CI，两个工作流使用新路径并通过。
6. 现有保险主题、当前阶段样式和发布证据文件仍可在迁移后的路径中读取。
