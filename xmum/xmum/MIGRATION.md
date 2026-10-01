# XMUM 资料与迁移说明

本说明记录网站代码与原始资料的边界，方便在另一台电脑上恢复开发环境。网站代码和资料均位于外层仓库的 `xmum/xmum/` 目录下；原始资料集中在 `materials/`，不再与网站源码混放。

## 目录分类

- `site/`：网站源码、测试、构建脚本和发布配置，必须保留。
- `materials/`：内容整理所依据的原始 JPG、PNG、PDF、XLSX、`pdf/`、`web-articles/` 和资料整理脚本，按需保留或使用受控存储传输。
- `site/node_modules/`：本机安装的依赖，可在目标电脑用 `npm ci` 重建，不迁移。
- `site/dist/`、`site/.vinext/`、`site/.wrangler/`、`site/export-single/`：可重建产物或本机状态，不迁移。
- `.DS_Store`、`site/*.tsbuildinfo`、`site/.impeccable/`：本机缓存或工作记录，不迁移。

## 目标电脑要求

- Node.js `22.13.0` 或更高的 Node.js 22 版本。
- npm 和 Git。
- 仅在运行真实浏览器回归测试时，才需要独立的 Chromium CDP 实例。

## 本地运行

```bash
cd xmum/xmum/site
node --version
npm ci
npm test
npm run lint
npm run dev
```

如果只需生成可离线打开的单文件版本，执行：

```bash
npm run test:single-export
```

生成文件位于 `site/export-single/index.html`。

## Git 与发布注意事项

- 外层仓库统一管理 `site/`、`materials/` 和本说明；`site/` 不包含独立的 Git 历史。请在仓库根目录使用当前 GitHub `origin` 远程进行分支、提交和同步操作。
- `site/.openai/hosting.json` 属于项目身份文件，发布到目标电脑时仍需使用有权限的账号重新登录发布服务。
- `.env*`、私钥和本机凭据不应放入仓库。真实值通过密码管理器单独传递。
- `materials/` 中的原始 PDF、截图、表格和提取稿属于私有取证资料，不直接作为站点发布素材；公开页面只能使用经过发布检查的整理内容和允许发布的资源。
- 原始资料可能包含个人或入学相关信息。通过网盘或移动介质传输时，优先使用加密压缩包或受控的私有存储，不要上传到公开仓库。

## 验收

1. `xmum/xmum/site/package.json` 和 `package-lock.json` 存在。
2. `materials/` 中保留需要复核的原始资料，网站文档中的相对路径指向 `materials/`。
3. 仓库中不存在迁移压缩包、`.DS_Store`、`.env`、`node_modules` 或构建缓存。
4. 在目标电脑执行 `npm ci`、`npm test` 和 `npm run lint`。
