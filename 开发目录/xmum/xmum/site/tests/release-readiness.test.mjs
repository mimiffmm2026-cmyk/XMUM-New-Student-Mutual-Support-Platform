import { loadBuiltWorker } from "../build/node-worker-runtime.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("release-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await loadBuiltWorker(workerUrl);

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

function getMetaContent(html, name) {
  const tag = (html.match(/<meta\b[^>]*>/gi) ?? []).find((candidate) =>
    new RegExp(`\\bname=["']${name}["']`, "i").test(candidate),
  );
  if (!tag) return "";
  return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? "";
}

function getVisibleBodyText(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  return body
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function count(text, pattern) {
  return text.match(pattern)?.length ?? 0;
}

test("release evidence register records the verified source without publishing sensitive details", async () => {
  const [register, distillation] = await Promise.all([
    readFile(
      new URL("../docs/release-evidence-register.md", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../docs/2026-admission-notice-distillation.md", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(register, /厦门大学马来西亚分校2026级本科生入学须知\.pdf/);
  assert.match(register, /8页/);
  assert.match(register, /5a345b1661c6fff00a4c994a608c1202ecfa90347bfb8b0c7cf0460f30570fe8/);
  assert.doesNotMatch(register, /原件缺失|未找到[^。\n]{0,30}原件/);
  assert.match(register, /41张迎新系统相关截图\s*\+\s*1张XMUM官网首页截图/);
  assert.doesNotMatch(register, /42张迎新系统截图/);
  assert.doesNotMatch(register, /https?:\/\//i, "证据登记不得包含网页跳转");
  assert.match(distillation, /原始通知用于核对2026级静态事实/);
  assert.doesNotMatch(
    distillation,
    /原始8页文件缺失|原件缺失|未找到[^。\n]{0,30}原件/,
    "蒸馏稿不得与已核验的原始8页PDF证据状态冲突",
  );
  assert.match(
    distillation,
    /后续学生签证办理及报到事宜均在省份QQ群内通知/,
  );
  assert.match(
    distillation,
    /学生签证批准信VAL必须彩色打印；单次入境签证SEV彩色或黑白均可/,
  );

  assert.match(register, /国际生医疗保险（EMGS·Etiqa）/);
  assert.match(register, /EMGS.*Insurance - New/s);
  assert.match(register, /不公开示例保单号、私人或高风险联系方式/);
  assert.doesNotMatch(register, /TGWH\d+|TOES\d+|THES\d+|TOPW\d+/);

  for (const forbidden of [
    /(?:初始密码|默认密码)[^。\n]{0,80}(?:身份证|出生日期|[0-9]{6,})/i,
    /(?:收款账号|银行账号|account\s*number)\s*[:：]?\s*[0-9][0-9 -]{7,}/i,
    /(?:QQ群|群号|联系电话|手机号|WhatsApp)\s*[:：]?\s*[0-9+][0-9 +()-]{5,}/i,
    /Tuition\s*fee\s*\+[^。\n]{0,80}(?:身份证号|身份证号码)/i,
    /\bMs\.?\s*Vun\b/i,
  ]) {
    assert.doesNotMatch(register, forbidden, "证据登记不得复述敏感凭据、号码或付款明细");
  }
});

test("public release is explicitly non-official, indexable, and has no web jump", async () => {
  const response = await render();
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /非学校官网/);
  assert.match(html, /公开版/);
  assert.doesNotMatch(html, /受控预览|尚未通过校方发布复核|暂不公开/);
  assert.match(
    getMetaContent(html, "robots"),
    /\bindex\b/i,
    "公开版本必须允许搜索引擎索引",
  );
  assert.match(
    getMetaContent(html, "robots"),
    /\bfollow\b/i,
    "公开版本使用标准索引策略",
  );
  assert.doesNotMatch(getMetaContent(html, "robots"), /\bnoindex\b|\bnofollow\b/i);

  const webHrefs = html.match(/\bhref=["']https?:\/\/[^"']*["']/gi) ?? [];
  assert.deepEqual(webHrefs, [], "页面不得提供 http/https 网页跳转");

  assert.match(html, /查看我的下一步/);
  assert.doesNotMatch(
    html,
    /查询录取并查看下一步/,
    "页内跳转不得伪装成录取结果查询功能",
  );

  const primaryNav =
    html.match(/<nav\b[^>]*aria-label=["']主要导航["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] ?? "";
  assert.equal(
    count(primaryNav, /<a\b/g),
    5,
    "桌面首屏主导航应收敛为五个核心入口",
  );
  assert.doesNotMatch(primaryNav, /href=["']#(?:parents|campus-life)["']/i);
  assert.doesNotMatch(primaryNav, /href=["']#faq["']/i);
  assert.match(primaryNav, /href=["']#contact["']/i);
  assert.match(primaryNav, /href=["']#life["']/i);
  assert.doesNotMatch(primaryNav, /href=["']#emergency["']/i);
  assert.doesNotMatch(html, /id=["']faq["']|name=["']faq-query["']|用你的话，直接搜/);

  for (const domain of [
    "xmu.edu.my",
    "yx.xmu.edu.my",
    "zs.xmu.edu.cn",
    "zsdata.xmu.edu.cn",
  ]) {
    assert.match(html, new RegExp(domain.replaceAll(".", "\\."), "i"));
  }
  assert.match(html, /href="tel:999"/i);
  assert.match(html, /href="tel:\+60193489999"/i);

  const visibleText = getVisibleBodyText(html);
  assert.doesNotMatch(visibleText, /受控预览/);
  assert.ok(
    count(visibleText, /非学校官网/g) <= 2,
    "“非学校官网”在可见正文中最多出现 2 次，避免重复免责声明",
  );
});

test("hash targets inside collapsed disclosures open their ancestor details", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(
    page,
    /function openDetails\(id: string\)\s*\{[\s\S]*?let details = element instanceof HTMLDetailsElement \? element : element\.closest\("details"\);[\s\S]*?while \(details\)[\s\S]*?details\.open = true;/,
    "哈希定位到折叠父级内的条目时，必须沿祖先 details 展开",
  );
  assert.match(page, /id=\{`guide-stage-\$\{stage\.number\}`\}/);
  assert.match(page, /<details className="timeline-disclosure" id="timeline">/);
});

test("repeated quick-progress links reopen a manually collapsed stage", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(
    page,
    /<a\s+href=\{selectedProgress\.href\}[\s\S]*?onClick=\{\(\) => openDetails\(selectedProgress\.href\.slice\(1\)\)\}[\s\S]*?>\s*去查看/,
    "同一 hash 再次点击快速进度入口时，必须直接重新展开目标阶段",
  );
});

test("release output excludes sensitive default credentials and unverified identifiers", async () => {
  const [response, page, content] = await Promise.all([
    render(),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/content.ts", import.meta.url), "utf8"),
  ]);
  const html = await response.text();
  const releaseSurface = `${html}\n${page}\n${content}`;

  assert.doesNotMatch(
    releaseSurface,
    /初始密码[^。\n]{0,80}(?:身份证|出生日期)|(?:身份证|出生日期)[^。\n]{0,80}初始密码|14\s*位\s*考生编号/i,
    "不得公开默认密码或精确账号字段格式",
  );
  assert.doesNotMatch(
    releaseSurface,
    /26\s*\+\s*省代码\s*\+\s*10\s*位准考证号/i,
    "不得公开未经当前官方材料佐证的考生号组成规则",
  );
  assert.doesNotMatch(
    releaseSurface,
    /\+?60[\s-]*18[\s-]*356[\s-]*3445/,
    "不得保留旧攻略中的历史 WhatsApp 精确号码",
  );
  assert.doesNotMatch(
    releaseSurface,
    /Tuition\s*fee\s*\+[^。\n]{0,80}(?:身份证号|身份证号码)|(?:身份证号|身份证号码)[^。\n]{0,80}Tuition\s*fee/i,
    "不得公开包含身份证号的付款备注模板",
  );
  assert.doesNotMatch(
    releaseSurface,
    /(?:收款账号|银行账号|account\s*number)\s*[:：]?\s*[0-9][0-9 -]{7,}/i,
    "不得公开可直接付款的银行账号",
  );
  assert.doesNotMatch(
    releaseSurface,
    /\bMs\.?\s*Vun\b/i,
    "不得公开历史材料中的个人联系人",
  );
  assert.doesNotMatch(
    page,
    /href=\{item\.sourceUrl\}|href=["']https?:\/\//,
    "公开页面不得动态生成网页外链",
  );
  assert.doesNotMatch(
    page,
    /(?:params|searchParams)\.get\(["']query["']\)|params\.set\(["']query["']/,
    "已停用的问答搜索文本不得持久化到 URL",
  );

  const insuranceStart = content.indexOf('id: "international-student-insurance"');
  assert.notEqual(insuranceStart, -1);
  const insuranceEnd = content.indexOf("\n  },", insuranceStart);
  assert.notEqual(insuranceEnd, -1);
  const insuranceBlock = content.slice(insuranceStart, insuranceEnd);
  assert.match(insuranceBlock, /通过 EMGS 选择 Etiqa/);
  assert.match(insuranceBlock, /以本人当前保单、EMGS 门户和校方通知为准/);
  assert.doesNotMatch(insuranceBlock, /TGWH\d+|TOES\d+|THES\d+|TOPW\d+/);
  assert.doesNotMatch(insuranceBlock, /google\.com|WhatsApp|[\w.-]+@[\w.-]+/i);
});

test("precise restored guidance remains sourced, qualified, and non-clickable", async () => {
  const [response, content] = await Promise.all([
    render(),
    readFile(new URL("../app/content.ts", import.meta.url), "utf8"),
  ]);
  const html = await response.text();
  const materialRegion =
    html.match(/id="visa-materials"[\s\S]*?<div class="program-panel">/i)?.[0] ?? "";

  assert.match(materialRegion, /PDF · 小于(?:<!-- -->)?3000KB · 26页/);
  assert.match(
    materialRegion,
    /JPG · 小于(?:<!-- -->)?66KB · 35mm×45mm · 217px×280px/,
  );
  assert.match(materialRegion, /PDF · 小于(?:<!-- -->)?500KB/);
  assert.ok(
    count(materialRegion, /2026-07-22入学须知/g) >= 3,
    "三组材料规格都必须带 2026-07-22 来源",
  );
  assert.ok(
    count(materialRegion, /如与本人当前迎新系统不一致，以当前系统为准/g) >= 3,
    "三组材料规格都必须提示当前迎新系统优先",
  );

  for (const channel of ["Flywire", "建设银行APP", "工银e缴费", "支持国际汇款的银行网点"]) {
    assert.match(content, new RegExp(channel));
  }
  const anchorTexts = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, " "));
  assert.equal(
    anchorTexts.some((text) => /Flywire|建设银行APP|工银e缴费|支持国际汇款的银行网点/.test(text)),
    false,
    "付款渠道名称只能作为文字，不能成为链接",
  );
  assert.doesNotMatch(
    content,
    /3\s*[—–-]\s*5\s*个工作日/,
    "没有可追溯来源时不得恢复固定 3—5 个工作日到账时效",
  );
  assert.match(content, /(?:不承诺|不提供|无法承诺|不固定)[^。\n]{0,40}(?:到账|时效)|(?:到账|时效)[^。\n]{0,40}(?:不承诺|不提供|无法承诺|不固定)/);

  assert.match(content, /学校食堂有清真餐吗？/);
  const halalBlock = content.slice(
    content.indexOf('question: "学校食堂有清真餐吗？"'),
    content.indexOf("\n  },", content.indexOf('question: "学校食堂有清真餐吗？"')),
  );
  assert.match(halalBlock, /往届截图|历史参考/);
  assert.match(halalBlock, /当届[^。\n]{0,20}核验|现场[^。\n]{0,20}为准/);
  assert.doesNotMatch(halalBlock, /status:\s*"2026官方原文"/);

  for (const groupNumber of ["176558427", "1001326014", "610944491"]) {
    assert.match(html, new RegExp(groupNumber));
  }
  const contactRegion =
    html.match(/id="contact"[\s\S]*?<details\b[^>]*id="parents"/i)?.[0] ?? "";
  assert.match(contactRegion, /核对|核验|以当前通知为准/);
  assert.match(contactRegion, /<details\b[^>]*class="contact-directory"/i);

  assert.equal(
    count(content, /\n    question:\s*"/g),
    69,
    "精准恢复后 FAQ 应回到 69 条",
  );
});

test("program table remains complete and internally consistent", async () => {
  const content = await readFile(
    new URL("../app/content.ts", import.meta.url),
    "utf8",
  );
  const programsStart = content.indexOf("export const programs");
  const programsEnd = content.indexOf("export const guideStages", programsStart);
  assert.ok(programsStart >= 0 && programsEnd > programsStart);

  const programSource = content.slice(programsStart, programsEnd);
  const rows = [
    ...programSource.matchAll(
      /\{\s*name:\s*"([^"]+)",\s*duration:\s*"([45])年",\s*english:\s*[^,]+,\s*tuition:\s*(\d+),\s*internationalFee:\s*(\d+),\s*sst:\s*(\d+),\s*total:\s*(\d+)\s*\}/g,
    ),
  ].map((match) => ({
    name: match[1],
    duration: Number(match[2]),
    tuition: Number(match[3]),
    internationalFee: Number(match[4]),
    sst: Number(match[5]),
    total: Number(match[6]),
  }));

  assert.equal(rows.length, 22, "招生专业应完整保留 22 项");
  assert.equal(new Set(rows.map((row) => row.name)).size, rows.length);
  assert.equal(rows.filter((row) => row.duration === 5).length, 1);
  assert.equal(rows.filter((row) => row.duration === 4).length, 21);
  for (const row of rows) {
    assert.equal(
      row.total,
      row.tuition + row.internationalFee + row.sst,
      `${row.name} 的首年总额必须等于学费、国际学生手续费和 SST 之和`,
    );
  }
  for (const requiredProgram of [
    "英语",
    "中医学",
    "人工智能",
    "网络空间安全",
    "数据科学",
  ]) {
    assert.ok(rows.some((row) => row.name === requiredProgram));
  }
});
