import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputDirectory = path.join(projectRoot, "export-single");
const outputFile = path.join(outputDirectory, "index.html");

test("single-file export is self-contained and preserves the public release gate", async () => {
  const files = await readdir(outputDirectory, { recursive: true });
  assert.deepEqual(files, ["index.html"]);

  const html = await readFile(outputFile, "utf8");
  assert.match(html, /^<!DOCTYPE html>/i);
  assert.match(html, /<style data-single-html="styles">/);
  assert.match(html, /<script type="module" data-single-html="client">/);
  assert.match(html, /<title>厦大马校（XMUM）2026级新生互助导航｜非学校官网<\/title>/);
  assert.match(html, /<meta name="robots" content="index, follow"\/?>/i);
  assert.match(html, /公开版/);
  assert.doesNotMatch(html, /受控预览/);
  assert.match(html, /非学校官网/);
  assert.match(html, /托管平台仍可能处理必要的访问与安全数据/);
  assert.doesNotMatch(html, /id="faq"|href="#faq"|name="faq-query"/);
  assert.doesNotMatch(
    html,
    /用你的话，直接搜|学校组织大学英语四、六级考试吗？|国际学生可以打工吗？/,
    "公开单文件不得包含问答入口、组件或问答正文",
  );
  assert.match(html, /href="#contact">联系与求助<\/a>/);
  assert.match(html, /href="#contact"><span>联系<\/span><small>求助<\/small><\/a>/);

  for (const moduleName of ["现在做什么", "办理步骤", "联系与求助", "家长与校园", "官方核对"]) {
    assert.match(html, new RegExp(moduleName));
  }
  assert.match(html, /查看我的下一步/);
  assert.doesNotMatch(html, /查询录取并查看下一步/);
  assert.match(html, /来源冲突时，以什么为准/);
  assert.match(html, /系统英文词速查/);
  assert.match(html, /录取结果查询 · 登录字段以当前页面为准/);
  assert.match(html, /认准域名，再进行填报/);
  for (const domain of [
    "xmu.edu.my",
    "yx.xmu.edu.my",
    "zs.xmu.edu.cn",
    "zsdata.xmu.edu.cn",
  ]) {
    assert.match(html, new RegExp(domain.replaceAll(".", "\\."), "i"));
  }

  assert.match(html, /href="tel:999"/);
  assert.match(html, /href="tel:\+60193489999"/);
  assert.match(html, /报警 · 火警 · 救护车/);
  assert.match(html, /XMUM 24小时校园安保热线/);
  assert.doesNotMatch(html, /class="emergency-sources"/);
  assert.match(html, /href="#contact"><span>联系<\/span><small>求助<\/small><\/a>/);
  assert.doesNotMatch(html, /\bhref=["']https?:\/\//i);
  assert.doesNotMatch(
    html,
    /初始密码|14\s*位\s*考生编号|26\s*\+\s*省代码|18[\s-]*356[\s-]*3445|Tuition\s*fee[^。\n]{0,80}身份证号|Ms\.?\s*Vun/i,
  );
  assert.match(html, /Flywire/);
  assert.match(html, /建设银行APP/);
  assert.match(html, /工银e缴费/);
  assert.match(html, /支持国际汇款的银行网点/);
  assert.match(html, /PDF · 小于(?:<!-- -->)?3000KB · 26页/);
  assert.match(html, /JPG · 小于(?:<!-- -->)?66KB · 35mm×45mm · 217px×280px/);
  assert.match(html, /PDF · 小于(?:<!-- -->)?500KB/);
  assert.match(html, /护照 PDF 安全压缩/);
  assert.match(html, /本机处理 · 不上传/);
  assert.match(html, /严格不超过 2,900,000 字节/);
  assert.match(html, /第 3(?:<!-- -->)? 页直接复制原始页面，不重新编码/);
  assert.match(html, /选择一个或多个 PDF/);
  assert.match(html, /查看压缩与核验规则/);
  assert.match(html, /健康表 PDF 压缩/);
  assert.match(html, /严格小于 500,000/);
  assert.match(html, /同名输出，不覆盖原件/);
  assert.match(html, /健康表_500KB内/);
  assert.match(html, /选择一个或多个健康表 PDF/);
  assert.match(html, /查看健康表压缩规则/);
  assert.match(html, /来源：2026-07-22入学须知/);
  assert.match(html, /如与本人当前迎新系统不一致，以当前系统为准/);
  assert.doesNotMatch(html, /3\s*[—–-]\s*5\s*个工作日/);
  assert.match(html, /176558427/);
  assert.match(html, /1001326014/);
  assert.match(html, /610944491/);
  assert.match(html, /仅限学生本人申请入群/);
  assert.match(html, /使用省份、真实姓名和录取专业，并在群内备注/);
  assert.match(html, /后续学生签证办理及报到事宜均在省份QQ群内通知/);
  assert.match(
    html,
    /如群公告与本人当前迎新系统或更新的正式通知不一致，以后两者为准，群公告仅作补充/,
  );
  assert.match(
    html,
    /非马来西亚籍学生须在一学年内达到录取专业英语要求，达标后才能正式开始学位课程/,
  );
  assert.match(
    html,
    /英语专业以合格成绩作为学生签证前置条件；其他专业不以英语成绩作为启动学生签证的前置条件/,
  );
  assert.match(html, /报名个人信息必须准确/);
  assert.match(html, /考试官网共享给/);
  assert.match(html, /VAL必须彩色打印，SEV彩色或黑白均可/);
  assert.match(
    html,
    /学生签证批准信VAL必须彩色打印，单次入境签证SEV彩色或黑白均可/,
  );
  assert.match(html, /新生统一入住校内学生公寓、不准外宿/);
  assert.match(html, /校园全景/);
  assert.match(html, /校园黄昏/);
  assert.match(html, /大学期间家庭预算参考/);
  assert.match(html, /家庭预算估算表/);
  assert.match(html, /校园地图/);
  assert.match(html, /绘图：Wu Yilin（1909 Software Engineering）/);
  assert.ok(
    (html.match(/图片来源：XMUM 官方网站/g) ?? []).length >= 2,
  );
  assert.doesNotMatch(html, /图片经授权使用/);
  assert.doesNotMatch(html, /本页两张校园照片已获使用授权/);
  assert.ok(
    (html.match(/data:image\/jpeg;base64,/g) ?? []).length >= 4,
    "两张校园照片、校园地图和家庭预算表必须内嵌进单 HTML",
  );

  assert.doesNotMatch(html, /<link\b[^>]*rel="(?:stylesheet|modulepreload)"/i);
  assert.doesNotMatch(html, /(?:href|src)=["']\/(?:assets\/|campus-students\.jpg)/i);
  assert.doesNotMatch(html, /url\(\s*["']?\/(?:assets\/|campus-students\.jpg)/i);
  assert.doesNotMatch(html, /url\(\s*["']?\/images\/xmum-campus-/i);
  assert.doesNotMatch(html, /url\(\s*["']?\/images\/xmum-family-budget-/i);
  assert.doesNotMatch(html, /_vinext|__VINEXT|\/assets\//);
});

test("single-file markup preserves primary interactions and accessible controls", async () => {
  const html = await readFile(outputFile, "utf8");

  assert.match(html, /role="region" aria-labelledby="progress-check-title"/);
  assert.match(html, /当前进度自查/);
  assert.match(html, /刚收到录取/);
  assert.match(html, /准备签证材料/);
  assert.match(html, /材料费用已完成/);
  assert.match(html, /已收到 VAL/);
  assert.match(html, /aria-controls="progress-next"/);
  assert.match(html, /class="contact-directory"/);
  assert.match(html, /class="parent-card"/);
  assert.match(html, /英语门槛与首年费用/);
  assert.match(html, /软件工程/);
  assert.match(html, /aria-pressed="true"/);
  assert.doesNotMatch(html, /id="faq"|href="#faq"|name="faq-query"|用你的话，直接搜/);
});
