import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function readdirOrEmpty(url) {
  try {
    return await readdir(url);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function faqSourceBlock(content, question) {
  const start = content.indexOf(`question: "${question}"`);
  assert.notEqual(start, -1, `FAQ source should contain “${question}”`);

  const end = content.indexOf("\n  },", start);
  assert.notEqual(end, -1, `FAQ source block should close after “${question}”`);
  return content.slice(start, end);
}

function visibleBodyText(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  return body
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the public non-official new-student guide", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(
    html,
    /<title>厦大马校（XMUM）2026级新生互助导航｜非学校官网<\/title>/i,
  );
  assert.match(html, /<meta name="robots" content="index, follow"\/?>/i);
  assert.match(html, /公开版/);
  assert.doesNotMatch(html, /受控预览/);
  assert.match(html, /非学校官网/);
  assert.match(html, /托管平台仍可能处理必要的访问与安全数据/);
  assert.match(html, /涉及正式办理事项，以本人当前系统为准/);
  assert.match(html, /查看我的下一步/);
  assert.doesNotMatch(html, /查询录取并查看下一步/);
  assert.match(html, /主体资料核对至 (?:<!-- -->)?2026-09-17/);
  assert.match(html, /保险专题核对至 (?:<!-- -->)?2026-10-04/);
  assert.match(html, /住宿候选核对至 (?:<!-- -->)?2026-10-05/);

  assert.match(html, /来源冲突时，以什么为准/);
  assert.match(html, /本人当前迎新系统页面/);
  assert.match(html, /不同官方页面冲突时并列展示，不替校方判断/);
  assert.match(html, /不采用“群友说”“老师好像说过”或“往届都是这样”的转述/);
  assert.match(html, /系统英文词速查/);
  for (const [acronym, expansion] of [
    ["VAL", "Visa Approval Letter"],
    ["SEV", "Single Entry Visa"],
    ["EMGS", "Education Malaysia Global Services"],
    ["SST", "Sales and Service Tax"],
    ["MDAC", "Malaysia Digital Arrival Card"],
  ]) {
    assert.match(html, new RegExp(`translate="no">${acronym}<`));
    assert.match(html, new RegExp(`translate="no">${expansion}<`));
  }

  assert.match(html, /8月10日前/);
  assert.match(html, /8月15日前/);
  assert.match(html, /节点自查/);
  assert.match(html, /逾期请直接联系校方确认补救/);
  assert.doesNotMatch(html, /最急的三件事/);
  assert.match(html, /收到通知后再购票/);
  assert.match(html, /9月28日是开课日，不是可以自行入境的日期/);
  assert.match(html, /入学后3个月内/);
  assert.match(html, /英语门槛与首年费用/);
  assert.match(html, /账户、付款入口与汇款备注不在本导航展示/);
  assert.match(html, /页面不一致时暂停操作/);
  assert.match(html, /仅限学生本人申请入群/);
  assert.match(html, /使用省份、真实姓名和录取专业，并在群内备注/);
  for (const paymentChannel of [
    "Flywire",
    "建设银行APP",
    "工银e缴费",
    "支持国际汇款的银行网点",
  ]) {
    assert.match(html, new RegExp(paymentChannel));
  }

  assert.match(html, /校园生活参考 · 2025经验/);
  assert.match(html, /厦大马校校园照片/);
  assert.match(html, /校园全景/);
  assert.match(html, /校园黄昏/);
  assert.match(html, /大学期间家庭预算参考/);
  assert.match(html, /这是一份家长互助预算，不是学校收费通知/);
  assert.match(html, /学制以学校 4 年制（中医学 5 年）为准/);
  assert.match(html, /SST 按（学费 \+ 国际学生手续费）×6% 计算/);
  assert.match(html, /家庭预算估算表/);
  assert.match(html, /具体作者未署名/);
  assert.match(html, /校园地图/);
  assert.match(html, /绘图：Wu Yilin（1909 Software Engineering）/);
  assert.ok(
    (html.match(/厦门大学马来西亚分校新生家长群家长/g) ?? []).length >= 3,
  );
  assert.ok(
    (
      html.match(/图片来源：XMUM 官方网站/g) ?? []
    ).length >= 2,
  );
  assert.doesNotMatch(html, /图片经授权使用/);
  assert.doesNotMatch(html, /本页两张校园照片已获使用授权/);
  assert.match(html, /2026使用前请核准/);
  assert.match(html, /LY区床铺/);
  assert.match(html, /约 1\.1 × 2 米/);
  assert.match(html, /报警 · 火警 · 救护车/);
  assert.match(html, /马来西亚统一紧急号码（MERS）/);
  assert.match(html, /校内事故 · 安全事件/);
  assert.match(html, /XMUM 24小时校园安保热线/);
  assert.match(html, /href="tel:999"/);
  assert.match(html, /href="tel:\+60193489999"/);
  assert.doesNotMatch(html, /class="emergency-sources"/);
  assert.match(html, /href="#contact"><span>联系<\/span><small>求助<\/small><\/a>/);

  assert.match(html, /录取结果查询 · 登录字段以当前页面为准/);
  assert.match(html, /本导航不展示或推断考生号、证件号与首次登录凭据规则/);
  assert.match(html, /zsdata\.xmu\.edu\.cn/);
  assert.match(html, /认准域名，再进行填报/);
  assert.match(html, /官方域名核对表/);
  assert.match(html, /yx\.xmu\.edu\.my/);
  assert.match(html, /zs\.xmu\.edu\.cn/);
  assert.match(html, /xmu\.edu\.my/);
  assert.doesNotMatch(html, /\bhref=["']https?:\/\//i);

  assert.doesNotMatch(html, /id="faq"|href="#faq"|name="faq-query"/);
  assert.doesNotMatch(html, /用你的话，直接搜|学校组织大学英语四、六级考试吗？/);
  for (const moduleName of ["现在做什么", "办理步骤", "联系与求助", "家长与校园", "官方核对"]) {
    assert.match(html, new RegExp(moduleName));
  }
  assert.match(html, /href="#contact"><span>联系<\/span><small>求助<\/small><\/a>/);
  assert.match(html, /2026官方原文/);
  assert.match(html, /role="region" aria-labelledby="progress-check-title"/);
  assert.match(html, /aria-controls="progress-next"/);
  assert.match(html, /class="contact-directory"/);
  assert.match(html, /class="parent-card"/);

  const visibleText = visibleBodyText(html);
  assert.doesNotMatch(visibleText, /受控预览/);
  assert.ok((visibleText.match(/非学校官网/g) ?? []).length <= 2);
  assert.match(html, /厦大马校2026级 · 湖南新同学收集整理/);
  assert.match(html, /资料来源与版权说明/);
  assert.doesNotMatch(html, /湖南人工智能小米同学|人工智能小米同学收集整理/);
  assert.doesNotMatch(
    html,
    /<(?:img|svg)\b[^>]*(?:school-logo|xmum-logo|校徽|crest)/i,
  );

  assert.doesNotMatch(
    html,
    /初始密码|14\s*位\s*考生编号|26\s*\+\s*省代码|18[\s-]*356[\s-]*3445|Tuition\s*fee[^。\n]{0,80}身份证号|Ms\.?\s*Vun/i,
  );
  assert.match(html, /PDF · 小于(?:<!-- -->)?3000KB · 26页/);
  assert.match(html, /JPG · 小于(?:<!-- -->)?66KB · 35mm×45mm · 217px×280px/);
  assert.match(html, /PDF · 小于(?:<!-- -->)?500KB/);
  assert.match(html, /护照 PDF 安全压缩/);
  assert.match(html, /本机处理 · 不上传/);
  assert.match(html, /严格不超过 2,900,000 字节/);
  assert.match(html, /第 3(?:<!-- -->)? 页直接复制原始页面，不重新编码/);
  assert.match(html, /选择一个或多个 PDF/);
  assert.match(html, /查看压缩与核验规则/);
  assert.match(html, /_压缩_2\.9MB内/);
  assert.match(html, /任何差异都拒绝保存/);
  assert.match(html, /健康表 PDF 压缩/);
  assert.match(html, /严格小于 500,000/);
  assert.match(html, /同名输出，不覆盖原件/);
  assert.match(html, /健康表_500KB内/);
  assert.match(html, /选择一个或多个健康表 PDF/);
  assert.match(html, /查看健康表压缩规则/);
  assert.match(html, /2026-07-22入学须知/);
  assert.match(html, /如与本人当前迎新系统不一致，以当前系统为准/);
  assert.doesNotMatch(html, /3\s*[—–-]\s*5\s*个工作日/);
  assert.match(html, /176558427/);
  assert.match(html, /1001326014/);
  assert.match(html, /610944491/);
  assert.doesNotMatch(html, /Your site is taking shape|SkeletonPreview|codex-preview/);

  const quickStart = html.indexOf('id="quick"');
  const guideStart = html.indexOf('id="guide"');
  const packingStart = html.indexOf('id="packing"');
  const contactStart = html.indexOf('id="contact"');
  const emergencyStart = html.indexOf('id="emergency"');
  const lifeStart = html.indexOf('id="life"');
  const parentStart = html.indexOf('id="parents"', lifeStart);
  const familyBudgetStart = html.indexOf('id="family-budget"', lifeStart);
  const campusLifeStart = html.indexOf('id="campus-life"');
  const diningStart = html.indexOf('id="dining"');
  const officialStart = html.indexOf('id="official"');
  const sourcePolicyStart = html.indexOf('id="source-policy"');
  for (const sectionStart of [
    quickStart,
    guideStart,
    packingStart,
    contactStart,
    emergencyStart,
    lifeStart,
    parentStart,
    familyBudgetStart,
    campusLifeStart,
    diningStart,
    officialStart,
    sourcePolicyStart,
  ]) {
    assert.notEqual(sectionStart, -1);
  }
  assert.ok(
    quickStart < guideStart &&
      guideStart < packingStart &&
      packingStart < contactStart &&
      contactStart < emergencyStart &&
      emergencyStart < lifeStart &&
      lifeStart < parentStart &&
      parentStart < familyBudgetStart &&
      familyBudgetStart < campusLifeStart &&
      campusLifeStart < diningStart &&
      diningStart < officialStart &&
      officialStart < sourcePolicyStart,
    "DOM order must follow the five-module information architecture",
  );

  const programStart = html.indexOf('class="program-panel"');
  const programEnd = html.indexOf('class="payment-guardrail"', programStart);
  const contactDefaultEnd = html.indexOf(
    '<details class="contact-directory">',
    contactStart,
  );
  assert.notEqual(programStart, -1);
  assert.notEqual(programEnd, -1);
  assert.notEqual(contactDefaultEnd, -1);

  const programDefault = html.slice(programStart, programEnd);
  const contactDefault = html.slice(contactStart, contactDefaultEnd);
  assert.match(
    programDefault,
    /非马来西亚籍学生须在一学年内达到录取专业英语要求，达标后才能正式开始学位课程/,
  );
  assert.match(
    programDefault,
    /英语专业以合格成绩作为学生签证前置条件；其他专业不以英语成绩作为启动学生签证的前置条件/,
  );
  assert.match(programDefault, /报名个人信息必须准确/);
  assert.match(programDefault, /考试官网共享给/);
  assert.match(programDefault, /<option value=""[^>]*>请选择专业<\/option>/);
  assert.match(programDefault, /请选择本人录取专业/);
  assert.doesNotMatch(programDefault, /第一学年合计/);
  assert.match(programDefault, /translate="no">EMGS<\/span>/);
  assert.match(
    programDefault,
    /translate="no">Xiamen University Malaysia<\/span>/,
  );
  assert.match(
    contactDefault,
    /后续学生签证办理及报到事宜均在省份QQ群内通知/,
  );
  assert.match(contactDefault, /仅限学生本人申请入群/);
  assert.match(
    contactDefault,
    /如群公告与本人当前迎新系统或更新的正式通知不一致，以后两者为准，群公告仅作补充/,
  );

  for (const [number, expectation] of [
    ["02", /英语达标会影响学位课程；英语专业还会影响签证启动/],
    ["04", /VAL必须彩色打印，SEV彩色或黑白均可/],
    ["05", /新生统一入住校内学生公寓、不准外宿/],
  ]) {
    const numberStart = html.indexOf(
      `<span class="stage-number">${number}</span>`,
      guideStart,
    );
    assert.notEqual(numberStart, -1, `stage ${number} should be rendered`);
    const summaryStart = html.lastIndexOf("<summary", numberStart);
    const summaryEnd = html.indexOf("</summary>", numberStart);
    assert.match(
      html.slice(summaryStart, summaryEnd),
      expectation,
      `stage ${number} qualifier must be in its default-visible summary`,
    );
  }

  const dormTitleStart = html.indexOf("<strong>宿舍生活</strong>", campusLifeStart);
  assert.notEqual(dormTitleStart, -1);
  const dormSummaryStart = html.lastIndexOf("<summary", dormTitleStart);
  const dormSummaryEnd = html.indexOf("</summary>", dormTitleStart);
  assert.match(
    html.slice(dormSummaryStart, dormSummaryEnd),
    /新生统一入住校内学生公寓、不准外宿/,
    "the dorm hard rule must be visible before expanding the topic",
  );

  const insuranceTitleStart = html.indexOf(
    "<strong>国际生医疗保险（EMGS·Etiqa）</strong>",
    campusLifeStart,
  );
  assert.notEqual(insuranceTitleStart, -1);
  const insuranceDetailsStart = html.lastIndexOf(
    '<details class="campus-life-topic"',
    insuranceTitleStart,
  );
  const insuranceSummaryEnd = html.indexOf("</summary>", insuranceTitleStart);
  const insuranceDetailsEnd = html.indexOf("</details>", insuranceTitleStart);
  assert.notEqual(insuranceDetailsStart, -1);
  assert.notEqual(insuranceSummaryEnd, -1);
  assert.notEqual(insuranceDetailsEnd, -1);
  const insuranceSummary = html.slice(insuranceDetailsStart, insuranceSummaryEnd);
  const insuranceDetails = html.slice(insuranceDetailsStart, insuranceDetailsEnd);
  assert.doesNotMatch(
    insuranceSummary,
    /<details[^>]*\bopen(?:\s|=|>)/,
    "the insurance topic should be collapsed by default",
  );
  assert.match(insuranceSummary, /通过 EMGS 选择 Etiqa/);
  assert.match(insuranceDetails, /建立承保关系/);
  assert.match(insuranceDetails, /以本人当前保单、EMGS 门户和校方通知为准/);
  assert.match(insuranceDetails, /Panel Clinic|Panel Provider/);
  assert.ok(insuranceTitleStart < diningStart, "insurance should stay before dining");
  assert.match(html, /校园照片、地图与五份主题整理/);
  assert.match(html, /主体资料最后核对：(?:<!-- -->)?2026-09-17(?:<!-- -->)?；国际生医疗保险专题核对：(?:<!-- -->)?2026-10-04/);
  assert.match(html, /住宿候选专题核对：(?:<!-- -->)?2026-10-05/);
  assert.doesNotMatch(html, /学校统一购买国际学生医疗保险/);

  // Timeline urgency is hydrated from the visitor's UTC+8 calendar day. SSR
  // must stay stable instead of baking a date-relative "past due" state.
  assert.doesNotMatch(html, /已截止|已过原定节点/);
});

test("source keeps content, safety, and interaction contracts", async () => {
  const [page, layout, content, styles, packageJson, passportCompressor, healthCompressor] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/content.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/PassportPdfCompressor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HealthPdfCompressor.tsx", import.meta.url), "utf8"),
  ]);
  const keyDatesSource = content.slice(
    content.indexOf("export const keyDates"),
    content.indexOf("export const submissionSpecs"),
  );

  assert.match(
    packageJson,
    /"test:single-browser": "node scripts\/verify-single-browser\.mjs && node scripts\/verify-single-compression\.mjs"/,
  );
  assert.match(packageJson, /tests\/release-readiness\.test\.mjs/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(packageJson, /"drizzle(?:-kit)?"|"db:generate"/);

  assert.match(layout, /title: "厦大马校（XMUM）2026级新生互助导航｜非学校官网"/);
  assert.match(layout, /robots:\s*\{\s*index: true,\s*follow: true,/s);
  assert.doesNotMatch(layout, /images:\s*\[/);
  assert.match(page, /aria-label="厦大马校（XMUM）2026级新生互助导航，返回页面顶部"/);
  assert.match(styles, /url\("\/images\/xmum-campus-aerial\.jpg"\)/);
  assert.match(styles, /url\("\/images\/xmum-campus-sunset\.jpeg"\)/);
  assert.match(page, /className="progress-check" role="region"/);
  assert.match(page, /aria-controls="progress-next"/);
  assert.match(page, /<details className="contact-directory">/);
  assert.match(page, /<details className="parent-card"/);
  assert.match(page, /className="program-rules" role="note"/);
  assert.doesNotMatch(page, /\bfaqs\b|\bfaqCategories\b|id="faq"|href="#faq"|name="faq-query"/);
  assert.match(page, /\{ id: "contact", label: "联系与求助", mobileLabel: "联系", detail: "求助" \}/);
  assert.match(page, /moduleNavItems\.map\(\(item\) =>/);
  assert.match(page, /params\.delete\("category"\)/);
  assert.match(page, /params\.delete\("audience"\)/);
  assert.match(page, /params\.delete\("query"\)/);
  assert.doesNotMatch(page, /params\.(?:get|set)\("(?:category|audience|query)"/);
  assert.doesNotMatch(page, /href=\{item\.sourceUrl\}/);
  assert.doesNotMatch(page, /href=["']https?:\/\//);
  assert.doesNotMatch(page, /target="_blank"/);
  assert.match(page, /getTimelineState\(item\.isoDate, currentUtc8Day\)/);
  assert.match(page, /<main id="main-content" tabIndex=\{-1\}>/);
  assert.match(page, /document\.getElementById\("main-content"\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(page, /<details className="system-glossary">/);
  assert.match(page, /<\/main>\s*\n\s*<footer>/);
  assert.doesNotMatch(page, /<footer>[\s\S]*<\/footer>[\s\S]*<\/main>/);

  assert.equal((content.match(/number: "0[1-5]"/g) ?? []).length, 5);
  assert.equal((content.match(/duration: "[45]年"/g) ?? []).length, 22);
  assert.equal((keyDatesSource.match(/isoDate: "2026-\d{2}-\d{2}"/g) ?? []).length, 4);
  assert.equal((keyDatesSource.match(/isoDate: undefined/g) ?? []).length, 4);
  assert.match(content, /export const lastReviewedAt = "2026-09-17"/);
  assert.match(content, /export const insuranceReviewedAt = "2026-10-04"/);
  const illnessFaq = faqSourceBlock(content, "在马来西亚生病了怎么办？");
  assert.match(illnessFaq, /本人当前记录确认通过 EMGS 选择 Etiqa/);
  assert.match(illnessFaq, /建立承保关系/);
  assert.doesNotMatch(illnessFaq, /学校统一购买国际学生医疗保险/);
  assert.match(content, /护照有效期至少至2028年3月31日/);
  assert.doesNotMatch(content, /2030年4月30日|2029年4月30日|三年制专业/);
  assert.match(content, /本导航不提供考生号组成规则/);
  assert.match(content, /不要使用或转发来源不明的登录规则/);
  assert.match(content, /按本人录取材料和当前迎新系统提示登录/);
  assert.match(content, /旧攻略曾提及诊所WhatsApp，但本导航不保留未经当届核验的号码/);
  assert.doesNotMatch(
    content,
    /初始密码|14\s*位\s*考生编号|26\s*\+\s*省代码|18[\s-]*356[\s-]*3445|Tuition\s*fee[^。\n]{0,80}身份证号|Ms\.?\s*Vun/i,
  );
  assert.doesNotMatch(content, /3\s*[—–-]\s*5\s*个工作日/);
  assert.doesNotMatch(content, /https:\/\/zs\.xmu\.edu\.cn\/info\/1172\/36582\.htm/);
  assert.match(content, /https:\/\/zs\.xmu\.edu\.cn\/info\/1042\/36572\.htm/);
  assert.equal((content.match(/\n    question:\s*"/g) ?? []).length, 69);
  assert.match(content, /PDF · 小于3000KB · 26页/);
  assert.match(content, /JPG · 小于66KB · 35mm×45mm · 217px×280px/);
  assert.match(content, /PDF · 小于500KB/);
  assert.ok((content.match(/来源：2026-07-22入学须知；如与本人当前迎新系统不一致，以当前系统为准/g) ?? []).length >= 3);
  assert.match(content, /Flywire/);
  assert.match(content, /建设银行APP/);
  assert.match(content, /工银e缴费/);
  assert.match(content, /支持国际汇款的银行网点/);
  assert.match(content, /学校食堂有清真餐吗？/);
  assert.match(content, /176558427/);
  assert.match(content, /1001326014/);
  assert.match(content, /610944491/);
  assert.match(content, /后续学生签证办理及报到事宜均在群内通知/);
  assert.match(content, /VAL必须彩色打印，SEV彩色或黑白均可/);
  assert.match(content, /学生签证批准信VAL必须彩色打印，单次入境签证SEV彩色或黑白均可/);
  assert.match(content, /新生统一入住校内学生公寓、不准外宿/);
  assert.match(content, /报名个人信息必须准确；出分后在考试官网把成绩共享给EMGS和Xiamen University Malaysia/);

  assert.doesNotMatch(page, /受控预览/);
  assert.ok((page.match(/非学校官网/g) ?? []).length <= 2);

  for (const question of [
    "课程全部使用英语授课吗？",
    "学生可以在校外租房吗？",
    "毕业后获得什么文凭？",
    "国际学生可以打工吗？",
    "学校组织大学英语四、六级考试吗？",
    "既往疾病会影响入学或签证吗？",
  ]) {
    const block = faqSourceBlock(content, question);
    assert.match(block, /sourceUrl: "https:\/\//);
    assert.match(block, /verifiedAt: "2026-07-23"/);
  }

  assert.match(
    content,
    /中国语言文学和中医学专业采用中英双语教学，其他专业采用全英文教学/,
  );
  assert.match(content, /由厦门大学颁发毕业证书/);
  assert.match(content, /由厦门大学授予学士学位/);
  assert.match(content, /在学期间统一入住校内学生公寓，不得退宿或在校外住宿/);
  assert.match(content, /新生抵达马来西亚后须参加体检/);
  assert.match(content, /从本人当前迎新系统下载空表/);

  assert.match(styles, /\.task-list\s*\{[^}]*list-style:\s*disc;/s);
  assert.match(styles, /\.site-header nav a\s*\{[^}]*min-width:\s*44px;/s);
  assert.match(styles, /\.official-section\s*\{[^}]*scroll-margin-top:\s*86px;/s);
  const compactTabletStyles =
    styles.match(/@media \(max-width: 820px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(compactTabletStyles, /\.mobile-nav\s*\{[\s\S]*?display:\s*grid;/);
  assert.match(compactTabletStyles, /padding-bottom:\s*calc\(70px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /\.official-domain-card strong\s*\{[^}]*white-space:\s*nowrap;/s);
  assert.match(styles, /\.hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.25fr\)\s+minmax\(480px,\s*1fr\);/s);
  assert.match(styles, /\.module-heading h2\s*\{[^}]*color:\s*var\(--navy\);/s);
  assert.match(styles, /\.module-heading-inverse h2\s*\{[^}]*color:\s*white;/s);
  assert.match(styles, /\.first-card p\s*\{[^}]*font-size:\s*14px;/s);
  assert.match(styles, /\.wechat-download-hint\s*\{/s);
  assert.match(passportCompressor, /WECHAT_DOWNLOAD_HINT/);
  assert.match(passportCompressor, /isWeChatUserAgent\(navigator\.userAgent\)/);
  assert.match(healthCompressor, /WECHAT_DOWNLOAD_HINT/);
  assert.match(healthCompressor, /isWeChatUserAgent\(navigator\.userAgent\)/);
  assert.match(styles, /\.trust-strip\s*\{[^}]*background:\s*var\(--surface\);/s);
  assert.doesNotMatch(styles, /var\(--font-serif\)/);
  assert.doesNotMatch(
    page + layout,
    /<(?:img|svg)\b[^>]*(?:school-logo|xmum-logo|校徽|crest)/i,
  );

  assert.deepEqual(await readdirOrEmpty(new URL("app/_sites-preview", templateRoot)), []);
  assert.equal(
    (await readdir(new URL("public", templateRoot))).includes("campus-students.jpg"),
    false,
  );
});
