import assert from "node:assert/strict";
import test from "node:test";

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
  assert.equal(knowledgeEntries.length, 16);
  assert.equal(new Set(knowledgeEntries.map((entry) => entry.id)).size, 16);
  assert.deepEqual(
    knowledgeCategories.slice(1).map((category) => [
      category,
      filterKnowledgeEntries(knowledgeEntries, { category }).length,
    ]),
    [
      ["办理步骤", 5],
      ["材料与提交", 3],
      ["家长与校园", 4],
      ["校园生活", 4],
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
