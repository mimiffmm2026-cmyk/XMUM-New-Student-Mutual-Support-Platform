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
- 浏览器本地护照 PDF 压缩：不超过 2,900,000 字节（为官方“小于3000KB”预留余量），第3页原始页面直拷并做内容流、图像流与渲染像素核验
- 浏览器本地健康表 PDF 压缩：每个文件严格小于 500,000 字节，同名输出、原件保留，并逐页核验尺寸、方向与渲染差异
- 22个专业的英语门槛和第一学年费用速查
- 食堂攻略：6个区域、38家商户的营业时间、休息日与特别停业（采集于2026.09，可能已变化），支持区域/状态/种类筛选与餐饮地图查看；来源与授权无法确认的商户照片已移除，餐饮地图为本站整理的位置示意
- 行李准备：67 项物品清单（按携带策略分组，支持视角/策略/分类筛选与本机勾选进度，所选视角会记住）、携带判断四问法、6 档采购地点整理与校内两处超市位置示意（校园导览图，标注 Uhub B1 B03 与 MyNews D6 G01）、海关/航空/宿舍三层合规速查与首晚床品提示；经验内容整理自公开攻略与家长整理资料并点名署名，动态信息标注“整理于 2026.09，可能已变化”，不提供外链
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
`9344`，不要使用日常浏览器配置；建议附加
`--disable-background-timer-throttling --disable-backgrounding-occluded-windows
--disable-renderer-backgrounding`，避免后台标签页节流影响本地压缩），再运行：

```bash
npm run test:single-browser
```

该命令依次执行两个脚本：`verify-single-browser.mjs` 验证页面结构、筛选、图片查看器、
键盘与触控目标、横向溢出、axe 无障碍与零外部请求；`verify-single-compression.mjs`
在 `file://` 下以微信 UA 用合成的 26 页护照夹具跑完整压缩链路，断言成品不超过
2,900,000 字节、微信下载兜底提示出现、无未预期的控制台错误或警告（pdf.js 在
`file://` 下的 worker 回退提示已显式豁免），且不发起任何网络请求。

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

2026-09-17 复核修复（详见 [发布证据登记](docs/release-evidence-register.md)）：

- 护照有效期已回退为原始入学须知口径“至少至2028年3月31日”，删除无来源的
  2030/2029 表述与“三年制专业”措辞；
- 来源与授权无法确认的 11 张食堂商户照片已从发布面移除，署名改为与实际一致；
- 首屏节点自查、专业速查默认未选择、家长预算表学制与 SST 口径提示、微信内
  下载兜底提示与食堂“采集时点”时限说明；
- 食堂停业列只保留明确停业记录，周休与时间调整移入对应列，消除同店矛盾信息；
- 新增 `file://` + 微信 UA 的真实压缩浏览器回归。

公开版本持续遵守：

- 保持“非学校官网”声明，正式办理始终以本人当前系统和最新官方通知为准；
- “需核验”和历史内容不得升级为无条件结论；
- 不提供网页外跳，不公开账号、凭据、付款明细或个人联系人；公开图片逐图标明可确认的作者与来源；
- 自动化测试、单文件导出测试和真实浏览器回归全部通过；
- 托管访问策略、隐私说明、搜索引擎收录策略与实际行为一致。

公开发布不改变本站的非官方性质，不得宣传为“学校官网”或“校方官方发布”。
