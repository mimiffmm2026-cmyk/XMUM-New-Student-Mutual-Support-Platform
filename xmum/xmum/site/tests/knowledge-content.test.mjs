import assert from "node:assert/strict";
import test from "node:test";

import { faqs } from "../app/content.ts";
import {
  filterKnowledgeEntries,
  knowledgeCategories,
  knowledgeEntries,
} from "../app/knowledge-content.ts";

test("knowledge index is built from reviewed content with stable categories", () => {
  assert.deepEqual(knowledgeCategories, [
    "全部",
    "办理步骤",
    "材料与提交",
    "家长与校园",
    "校园生活",
  ]);
  assert.equal(knowledgeEntries.length, 23);
  assert.equal(new Set(knowledgeEntries.map((entry) => entry.id)).size, 23);
  assert.deepEqual(
    knowledgeCategories.slice(1).map((category) => [
      category,
      filterKnowledgeEntries(knowledgeEntries, { category }).length,
    ]),
    [
      ["办理步骤", 9],
      ["材料与提交", 3],
      ["家长与校园", 4],
      ["校园生活", 7],
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
    4,
  );
});

test("user-provided admission and visa materials never claim official evidence", () => {
  const userEntries = knowledgeEntries.filter((entry) => entry.id.startsWith("pdf-"));
  assert.equal(userEntries.length, 7);

  for (const entry of userEntries) {
    assert.equal(entry.status, "用户材料");
    assert.ok(entry.tags.includes("用户材料"));
    assert.match(entry.source, /用户提供/);
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
