# XMUM 目录迁移说明

本说明用于把 `/Users/denggui/2026code/xmum` 迁移到另一台电脑。迁移包应保留
源码、原始资料和 `site/.git` 历史，同时排除可在目标电脑重建的本机依赖、缓存
与构建产物。

## 目录分类

- `site/`：网站源码及 Git 历史，必须保留。
- 根目录的 JPG、PNG、PDF，以及 `pdf/`：内容整理所依据的原始资料，建议保留。
- `tmp/`：临时目录，目前为空，可不迁移。
- `site/node_modules/`：当前电脑安装的依赖，包含 macOS/ARM 原生文件，不迁移。
- `site/dist/`、`site/.vinext/`、`site/.wrangler/`、`site/export-single/`：
  可重建产物或本机状态，不迁移。
- `.DS_Store`、`site/*.tsbuildinfo`、`site/.impeccable/`：本机缓存或工作记录，
  不迁移。

## 目标电脑要求

- Node.js `22.13.0` 或更高的 Node.js 22 版本。
- npm 和 Git。
- 仅在运行真实浏览器回归测试时，才需要独立的 Chromium CDP 实例。

## 恢复步骤

解压迁移包后执行：

```bash
cd xmum/site
node --version
npm ci
npm test
npm run lint
npm run dev
```

浏览器打开终端显示的本地地址。如果只需生成可离线打开的单文件版本，执行：

```bash
npm run test:single-export
```

生成文件位于 `site/export-single/index.html`。

## Git 与发布注意事项

- `site/` 是 Git 仓库，但当前没有配置远程仓库。迁移包包含 `.git`，因此提交
  历史不会丢失；长期协作建议另行配置私有远程仓库并推送。
- `site/.openai/hosting.json` 属于项目身份文件，已纳入 Git 和迁移包；目标电脑
  仍需使用有权限的账号重新登录发布服务。
- `.env*`、私钥和本机凭据不应放入迁移包。当前盘点未发现这些文件；如果以后
  新增环境变量，请只迁移不含真实值的 `.env.example`，真实值通过密码管理器
  单独传递。
- 原始资料可能包含个人或入学相关信息。通过网盘或移动介质传输时，优先使用
  加密压缩包或受控的私有存储，不要上传到公开仓库。

## 便携包验收

迁移包应满足：

1. 包内存在 `xmum/MIGRATION.md`、`xmum/site/package.json`、
   `xmum/site/package-lock.json` 和 `xmum/site/.git/`。
2. 包内不存在 `node_modules`、`.DS_Store`、`.env`、构建缓存或部署缓存。
3. 校验文件中的 SHA-256 与迁移包重新计算的结果一致。
4. 在一个新目录解压后，`npm ci`、`npm test` 和 `npm run lint` 均通过。
