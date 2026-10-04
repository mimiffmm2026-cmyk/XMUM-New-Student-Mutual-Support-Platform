# 国际生医疗保险（EMGS·Etiqa）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有校园生活医疗主题下增加一个默认折叠的“国际生医疗保险（EMGS·Etiqa）”资料卡，提供可追溯的行动入口并保留未核验边界。

**Architecture:** 复用 `CampusLifeTopic` 数据结构和页面统一渲染逻辑，只在 `content.ts` 新增主题；更新校园主题数量文案；通过 SSR 内容测试和发布证据登记测试锁定顺序、默认折叠、来源与敏感信息边界。

**Tech Stack:** TypeScript、React/Next/Vinext、Node test runner、Markdown evidence register。

**Spec:** GitHub Issue #8《内容：2026-10-03 国际生医疗保险（EMGS·Etiqa）资料入站》及其【Claude 复核】评论、项目负责人“批准”评论。

## Global Constraints

- 不新增顶级导航；主题放在现有“校园生活”折叠区域。
- 适用对象限定为通过 EMGS 选择 Etiqa 且已付款、并以本人当前记录确认的国际学生。
- “学校统一购买保险”与个人 Etiqa 计划关系必须明确保留核验边界。
- 不公开示例保单号、私人或高风险联系方式、未核验表单、冲突地址/邮箱或资料全文。
- 保险额度、计划、自付额、除外责任、Panel Provider、理赔时限和有效期以本人当前保单、EMGS 门户和校方通知为准。
- 页面不得新增外部网页跳转；界面文字使用中文。

## Review Focus

- 适用范围误读：未选择 Etiqa 的学生不应被页面暗示为同一计划。
- 版本冲突：EMGS/Etiqa 官方文件与讲座整理值不一致时，页面应停留在核验提示。
- 默认状态：新增主题应与其他校园主题一样默认折叠，摘要仍能显示标题与适用范围。
- 去重：999、校园安保、B1-G11 诊所、报到和基础保险概述不应复制成第二份长段落。
- 公开边界：HTML、源码和证据登记不得出现示例保单号、私人联系方式或未核验表单。

### Task 1: 新增保险主题并更新来源登记

**Files:**
- Modify: `xmum/xmum/site/app/content.ts`
- Modify: `xmum/xmum/site/app/page.tsx`
- Modify: `xmum/xmum/site/docs/release-evidence-register.md`
- Test: `xmum/xmum/site/tests/rendered-html.test.mjs`
- Test: `xmum/xmum/site/tests/release-readiness.test.mjs`

**Interfaces:**
- Consumes: 现有 `CampusLifeTopic` 数据结构与 `campusLifeTopics.map` 渲染。
- Produces: `id: "international-student-insurance"` 主题，包含标题、适用范围摘要、官方来源事实、核验清单和来源登记。

- [x] **Step 1: Write the failing tests**
  - 在 SSR 测试中断言主题标题、摘要、无 `open` 属性、`EMGS`/`Etiqa`、官方来源提示和“五份主题整理”。
  - 在源码/发布安全测试中断言主题来源登记存在，并排除示例保单号、私人联系方式、未核验表单和网页跳转。

- [x] **Step 2: Run the focused tests to verify they fail**

  Run: `npm run build && node --test tests/rendered-html.test.mjs tests/release-readiness.test.mjs`

  Expected: 新增保险主题和“五份主题整理”断言失败，基线其余断言保持可运行。

- [x] **Step 3: Implement the minimal content change**
  - 在 `healthcare` 主题后新增独立 `CampusLifeTopic`；只写 EMGS 2026保险页面、2026版 Etiqa 福利表和 Etiqa+ 官方指南已支持的高层信息。
  - 将自付额、个人保单号、当前 Panel 名单、除外责任和个人理赔字段放入“当届确认”提示，不把讲座整理直接升级为条款。
  - 将页面副标题的“四份主题整理”改为“五份主题整理”。
  - 在证据登记中加入来源名称、核验日期、支持范围和公开边界，不写外链或敏感字段。

- [x] **Step 4: Run focused tests to verify they pass**

  Run: `npm run build && node --test tests/rendered-html.test.mjs tests/release-readiness.test.mjs`

  Expected: focused tests pass，新增主题默认折叠、来源和安全断言均通过。

- [x] **Step 5: Run lint and commit**

  Run: `npm run lint`

  Commit: `git add xmum/xmum/site/app/content.ts xmum/xmum/site/app/page.tsx xmum/xmum/site/docs/release-evidence-register.md xmum/xmum/site/tests/rendered-html.test.mjs xmum/xmum/site/tests/release-readiness.test.mjs && git commit -m "feat: add EMGS Etiqa insurance guidance"`
