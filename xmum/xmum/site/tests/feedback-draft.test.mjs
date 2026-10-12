import assert from "node:assert/strict";
import test from "node:test";

import { buildFeedbackDraft } from "../app/feedback-draft.ts";

test("feedback draft trims user text and declares the local-only boundary", () => {
  const draft = buildFeedbackDraft({
    type: "纠错",
    message: "  这条材料的截止日期需要再次核对。  ",
    pageTitle: "资料索引",
    reviewedAt: "2026-09-17",
  });

  assert.match(draft, /类型：纠错/);
  assert.match(draft, /页面：资料索引/);
  assert.match(draft, /资料核对至：2026-09-17/);
  assert.match(draft, /内容：这条材料的截止日期需要再次核对。/);
  assert.match(draft, /只在本机生成和复制/);
  assert.match(draft, /不会自动提交/);
});

test("empty feedback does not create a misleading draft", () => {
  assert.equal(
    buildFeedbackDraft({
      type: "补充",
      message: "  \n  ",
      pageTitle: "资料索引",
      reviewedAt: "2026-09-17",
    }),
    "",
  );
});
