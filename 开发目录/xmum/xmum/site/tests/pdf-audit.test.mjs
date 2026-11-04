import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const audit = await readFile(
  new URL("../docs/2026-admissions-pdf-audit.md", import.meta.url),
  "utf8",
);
const register = await readFile(
  new URL("../docs/release-evidence-register.md", import.meta.url),
  "utf8",
);

test("user-provided admissions PDF audit remains traceable and bounded", () => {
  for (const filename of [
    "厦大马校2026招生手册(1).pdf",
    "厦门大学马来西亚分校介绍2605(1)(3).pdf",
  ]) {
    assert.match(audit, new RegExp(filename.replace(/[()[\]]/g, "\\$&")));
  }
  for (const digest of [
    "8dc965b9db624e67c732bae03c13107d3dd252ac2371258b213cef53f2457c35",
    "6847f3ce1d292cce789af58d25339591e7314e1dceaf4d8095dff35a1c92f508",
  ]) {
    assert.match(audit, new RegExp(digest));
    assert.match(register, new RegExp(digest), "证据登记必须复用审计文档的摘要");
  }
  assert.match(audit, /用户提供/);
  assert.match(audit, /原始 PDF 不复制进公开站点/);
  assert.match(register, /2026-10-12 用户提供招生资料反向审计/);
  assert.match(register, /2026-admissions-pdf-audit\.md/);
  assert.match(register, /项目本地 EMGS 材料仅作内部交叉核对/);
});
