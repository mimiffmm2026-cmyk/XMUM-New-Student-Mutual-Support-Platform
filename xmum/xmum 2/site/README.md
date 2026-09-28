# 厦大马校（XMUM）2026级新生互助导航（非学校官网）

面向中国新生与家长的轻量入学信息整理页。内容依据2026级本科生入学须知原始PDF、41张迎新系统相关截图、1张学校官网截图及公开官方资料整理，负责解释、排序和提醒，不承接学校系统的登录、资料上传、审核或付款功能，也不代表厦门大学马来西亚分校。原件核验记录见 [发布证据登记](docs/release-evidence-register.md)。

## Prerequisites

- Node.js `>=22.13.0`
- npm（随 Node.js 安装）

## 本地运行

```bash
npm ci
npm run dev
npm run build
```

`node_modules`、`dist`、`.vinext`、`.wrangler`、`export-single` 和
`*.tsbuildinfo` 都是本机依赖或可重建产物，不应从旧电脑复制。迁移到新电脑后，
在本目录重新执行 `npm ci` 即可按 `package-lock.json` 恢复依赖。项目当前没有
Git 远程仓库；如不使用便携归档，应先配置私有远程仓库再迁移。

## 主要内容

- 五阶段入学时间线
- 2026级关键日期与签证材料规格
- 浏览器本地护照 PDF 压缩：严格不超过 2,900,000 字节，第3页原始页面直拷并做内容流、图像流与渲染像素核验
- 浏览器本地健康表 PDF 压缩：每个文件严格小于 500,000 字节，同名输出、原件保留，并逐页核验尺寸、方向与渲染差异
- 22个专业的英语门槛和第一学年费用速查
- 新生与家长双视角说明
- 已从公开页面移除问答模块；问答源数据仅保留在源码中，待逐条复核后再决定是否恢复
- 对政策、费用、日期等动态信息进行核验标记
- 学校迎新系统和官网域名的纯文本核对提示（不提供网页跳转）

## 验证

```bash
npm test
npm run lint
npm run test:single-export
```

单文件的真实交互回归需要先启动一个独立的 Chromium CDP 实例（默认端口
`9344`，不要使用日常浏览器配置），再运行：

```bash
npm run test:single-browser
```

护照压缩的合成文件回归可额外运行：

```bash
cdp-bridge.sh
npm run dev -- --port 4173
node tests/create-passport-fixture.mjs /tmp/passport-compressor-fixture.pdf
node tests/create-passport-fixture.mjs /tmp/passport-compressor-impossible.pdf --oversized-profile
python3 tests/passport-compressor-browser.py \
  /tmp/passport-compressor-fixture.pdf \
  /tmp/passport-compressor-impossible.pdf
```

该回归不使用真实护照数据；它同时验证可压缩文件能生成合格成品，以及第3页
本身超过预算时停止处理且不提供下载。

健康表压缩使用另一组无个人信息的合成文件：

```bash
node tests/create-health-form-fixture.mjs /tmp/health-form-compressor-fixture.pdf
node tests/create-health-form-fixture.mjs /tmp/health-form-compressor-impossible.pdf --impossible
python3 tests/health-compressor-browser.py \
  /tmp/health-form-compressor-fixture.pdf \
  /tmp/health-form-compressor-impossible.pdf
```

该回归验证每个成品严格小于 500,000 字节、下载文件名与原文件一致、原文件未被
改动，以及无法在安全清晰度内达标时不提供下载。

该检查会直接打开 `file://.../export-single/index.html`，验证移动端首屏行动路径、
主内容顺序、公开页面无问答入口或问答正文、专业费用切换、键盘折叠、全部 `href`、
桌面/平板/移动端触控目标与横向溢出，以及控制台和网络请求错误。
如使用其他端口，可通过 `CDP_URL` 指定调试地址。

## 发布门槛

当前结论：**原件核验与公开版内容复核已完成，允许公开发布。**

公开版本持续遵守：

- 保持“非学校官网”声明，正式办理始终以本人当前系统和最新官方通知为准；
- “需核验”和历史内容不得升级为无条件结论；
- 不提供网页外跳，不公开账号、凭据、付款明细或个人联系人；公开图片逐图标明可确认的作者与来源；
- 自动化测试、单文件导出测试和真实浏览器回归全部通过；
- 托管访问策略、隐私说明、搜索引擎收录策略与实际行为一致。

公开发布不改变本站的非官方性质，不得宣传为“学校官网”或“校方官方发布”。
