import assert from "node:assert/strict";
import test from "node:test";

import { campusLifeTopics, faqs, guideStages, insuranceReviewedAt } from "../app/content.ts";
import { accommodationCandidates } from "../app/accommodation-content.ts";
import {
  filterKnowledgeEntries,
  knowledgeCategories,
  knowledgeEntries,
  knowledgeLastReviewedAt,
} from "../app/knowledge-content.ts";

test("knowledge index is built from reviewed content with stable categories", () => {
  assert.equal(knowledgeLastReviewedAt, "2026-10-30");
  assert.deepEqual(knowledgeCategories, [
    "全部",
    "办理步骤",
    "材料与提交",
    "家长与校园",
    "校园生活",
  ]);
  assert.equal(knowledgeEntries.length, 29);
  assert.equal(new Set(knowledgeEntries.map((entry) => entry.id)).size, 29);
  assert.deepEqual(
    knowledgeCategories.slice(1).map((category) => [
      category,
      filterKnowledgeEntries(knowledgeEntries, { category }).length,
    ]),
    [
      ["办理步骤", 9],
      ["材料与提交", 3],
      ["家长与校园", 8],
      ["校园生活", 9],
    ],
  );

  for (const entry of knowledgeEntries) {
    assert.ok(entry.title);
    assert.ok(entry.summary);
    assert.ok(entry.body.length > 0);
    assert.ok(entry.source);
    assert.ok(entry.checkedAt);
    assert.ok(entry.status);
    assert.ok(entry.tags.length > 0);
  }
});

test("knowledge search ignores whitespace and matches all searchable fields", () => {
  assert.equal(
    filterKnowledgeEntries(knowledgeEntries, { query: "   " }).length,
    knowledgeEntries.length,
  );
  assert.ok(
    filterKnowledgeEntries(knowledgeEntries, { query: "护照" }).some(
      (entry) => entry.id === "material-passport",
    ),
  );
  assert.ok(
    filterKnowledgeEntries(knowledgeEntries, { query: "签证" }).some(
      (entry) => entry.id === "stage-02",
    ),
  );
  assert.ok(
    filterKnowledgeEntries(knowledgeEntries, { query: "2025攻略记录" }).every(
      (entry) => entry.category === "校园生活",
    ),
  );
  assert.ok(
    filterKnowledgeEntries(knowledgeEntries, { query: "英语单科" }).some(
      (entry) => entry.id === "pdf-admission-eligibility",
    ),
  );
  assert.ok(
    filterKnowledgeEntries(knowledgeEntries, { query: "CGPA" }).some(
      (entry) => entry.id === "pdf-visa-renewal",
    ),
  );
});

test("knowledge filters compose without mutating the source list", () => {
  const originalIds = knowledgeEntries.map((entry) => entry.id);
  const result = filterKnowledgeEntries(knowledgeEntries, {
    category: "校园生活",
    audience: "共同",
    query: "宿舍",
  });

  assert.deepEqual(result.map((entry) => entry.id), ["campus-dorm-life"]);
  assert.deepEqual(knowledgeEntries.map((entry) => entry.id), originalIds);
  assert.equal(
    filterKnowledgeEntries(knowledgeEntries, { audience: "家长" }).length,
    19,
  );
});

test("indexed stages retain source notes and make important warnings searchable", () => {
  for (const stage of guideStages) {
    const entry = knowledgeEntries.find((entry) => entry.id === `stage-${stage.number}`);
    assert.ok(entry?.body.includes(stage.note), `${stage.title}不能丢失原专题备注`);
  }
  for (const [query, id] of [["6周", "stage-02"], ["私自入境", "stage-04"], ["住宿费到校后另缴", "stage-03"]]) {
    assert.ok(filterKnowledgeEntries(knowledgeEntries, { query }).some((entry) => entry.id === id),
      `应能通过“${query}”找到对应办理提醒`);
  }
});

test("student and parent filters include shared guidance while shared-only stays exact", () => {
  for (const audience of ["新生", "家长"]) {
    assert.ok(
      filterKnowledgeEntries(knowledgeEntries, { audience, query: "Etiqa" })
        .some((entry) => entry.id === "campus-international-student-insurance"),
      `${audience}应能查到共同适用的保险资料`,
    );
  }
  assert.ok(
    filterKnowledgeEntries(knowledgeEntries, { audience: "共同" })
      .every((entry) => entry.audience === "共同"),
  );
  assert.equal(
    filterKnowledgeEntries(knowledgeEntries, { audience: "新生", query: "Bell Suites" }).length,
    0,
    "学生筛选仍应排除只面向家长的短住条目",
  );
});

test("user-provided admission and visa materials never claim official evidence", () => {
  const userEntries = knowledgeEntries.filter((entry) => entry.id.startsWith("pdf-"));
  assert.equal(userEntries.length, 7);

  for (const entry of userEntries) {
    assert.equal(entry.status, "用户材料");
    assert.ok(entry.tags.includes("用户材料"));
    assert.match(entry.source, /用户提供/);
    assert.match(entry.source, /p\d+/i, "用户材料条目必须保留来源页码");
    assert.notEqual(entry.status, "2026官方原文");
    assert.notEqual(entry.status, "公开来源交叉核对");
  }
});

test("FAQ entries sourced from user-provided admissions PDFs remain review-only", () => {
  const pdfFaqs = faqs.filter((faq) => /介绍册|招生手册/.test(faq.source ?? ""));
  assert.ok(pdfFaqs.length > 0);

  for (const faq of pdfFaqs) {
    assert.notEqual(faq.status, "2026官方原文");
    assert.notEqual(faq.status, "公开来源交叉核对");
    assert.match(faq.source ?? "", /用户提供|用户材料/);
  }
});

test("indexed insurance preserves its own review date and eligibility boundary", () => {
  const entry = filterKnowledgeEntries(knowledgeEntries, { query: "Etiqa" }).find(
    (item) => item.id === "campus-international-student-insurance",
  );
  assert.ok(entry);
  assert.equal(entry.checkedAt, insuranceReviewedAt);
  assert.match(entry.summary, /仅适用于通过 EMGS 选择 Etiqa 且已付款/);
  assert.equal(entry.status, "需核验");
  const topic = campusLifeTopics.find((topic) => topic.id === "international-student-insurance");
  assert.equal(entry.source, topic.source);
  for (const point of [...topic.referencePoints, ...topic.reviewPoints]) {
    assert.ok(entry.body.includes(point), "保险资料索引不能丢失原专题条款边界或当届核验项");
  }
});

test("insurance FAQ keeps its synthesis status and independent review date", () => {
  const faq = faqs.find((item) => item.question === "在马来西亚生病了怎么办？");
  assert.ok(faq);
  assert.equal(faq.status, "需核验", "混合保险整理不能标作入学须知原文");
  assert.equal(faq.verifiedAt, insuranceReviewedAt);
  assert.match(faq.source, /EMGS/);
  assert.match(faq.source, /Etiqa/);
  assert.match(faq.source, /交叉整理/);
});

test("calendar conflict keeps the two PDF identities distinct", () => {
  const calendar = knowledgeEntries.find((entry) => entry.id === "pdf-academic-calendar");
  assert.match(calendar.body.join(" "), /招生手册p8.*介绍册p38/);
  assert.doesNotMatch(calendar.body.join(" "), /同一介绍册p8/);
});

test("transfer policy cites the same source files as the reviewed FAQ", () => {
  const transfer = knowledgeEntries.find((entry) => entry.id === "pdf-transfer-policy");
  for (const citation of ["《厦大马校2026招生手册(1).pdf》p8", "《厦门大学马来西亚分校介绍2605(1)(3).pdf》p40"]) {
    assert.ok(transfer.source.includes(citation), `转专业条目应保留独立引文：${citation}`);
  }
});

test("parent accommodation is searchable without promoting project-only listings", () => {
  for (const candidate of accommodationCandidates) {
    const matches = filterKnowledgeEntries(knowledgeEntries, {
      query: candidate.name.toLowerCase(),
      category: "家长与校园",
      audience: "家长",
    });
    assert.equal(matches.length, 1, candidate.name);
    const [entry] = matches;
    assert.equal(entry.checkedAt, candidate.verifiedAt);
    assert.equal(entry.source, candidate.source);
    assert.equal(entry.status, "需核验");
    assert.ok(entry.body.includes(`收录状态：${candidate.status}`));
    assert.ok(entry.body.includes(`价格观察时点：${candidate.priceCheckedAt}；${candidate.priceNote}`));
    assert.match(entry.body.join(" "), /学生.*校内住宿|学生住宿/);
  }
});

test("registered PDF sources do not claim their evidence record is missing", () => {
  const visa = knowledgeEntries.find((entry) => entry.id === "pdf-visa-renewal");
  assert.ok(visa);
  assert.doesNotMatch(visa.source, /未纳入仓库证据登记/);
  assert.match(visa.source, /原始 PDF 未随站点发布/);
});

test("student card guidance retains the corrected office sequence and source caveats", () => {
  const entry = knowledgeEntries.find((item) => item.id === "student-card-replacement");
  assert.ok(entry, "学生卡补办指南必须进入整合索引");
  assert.equal(entry.status, "需核验");
  assert.equal(entry.audience, "新生");
  assert.equal(entry.checkedAt, "2026-10-30");
  const steps = entry.body.filter((point) => /^第[1-6]步/.test(point));
  assert.equal(steps.length, 6);
  for (const [index, pattern] of [
    /Finance.*冻结卡内余额/,
    /Lost ID Form.*电邮财务/,
    /B1-107.*Replacement of Card/,
    /A3.*Finance.*缴纳补办费.*回执/,
    /B1-109.*IT.*不是 A3 的 IT/,
    /等待 IT 邮件.*学生邮箱/,
  ].entries()) assert.match(steps[index], pattern);
  assert.match(entry.body.join(" "), /尚未经校方部门核验/);
  assert.match(steps[3], /未标修订日期.*金额以财务当天确认为准/);
  assert.match(entry.source, /同学提供.*Lost ID Form\.pdf.*p1/);
  assert.match(entry.source, /用户提供，未标修订日期/);
  assert.match(entry.source, /不代表校方确认/);
});

test("student card search is available to students without broadening parent or shared filters", () => {
  for (const query of ["校园卡", "Lost ID Form", "B1-109"]) {
    const result = filterKnowledgeEntries(knowledgeEntries, { query, category: "校园生活", audience: "新生" });
    assert.deepEqual(result.map((entry) => entry.id), ["student-card-replacement"]);
    for (const audience of ["家长", "共同"]) {
      assert.equal(filterKnowledgeEntries(knowledgeEntries, { query, audience }).length, 0);
    }
  }
});
