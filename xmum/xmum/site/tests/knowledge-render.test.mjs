import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("knowledge-test", `${process.pid}-${Date.now()}`);
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

test("server-renders the local knowledge index and feedback boundary", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();

  const knowledgeStart = html.indexOf('id="knowledge"');
  const officialStart = html.indexOf('id="official"');
  assert.ok(knowledgeStart !== -1, "缺少资料索引");
  assert.ok(officialStart !== -1, "缺少官方核对");
  assert.ok(knowledgeStart < officialStart, "资料索引必须位于官方核对之前");

  assert.match(html, /知识资料索引/);
  assert.match(html, /name="knowledge-query"/);
  assert.match(html, /name="knowledge-category"/);
  assert.match(html, /name="knowledge-audience"/);
  assert.match(html, /全部/);
  assert.match(html, /办理步骤/);
  assert.match(html, /材料与提交/);
  assert.match(html, /家长与校园/);
  assert.match(html, /校园生活/);
  assert.equal((html.match(/data-knowledge-entry=/g) ?? []).length, 23);
  assert.match(html, /英语单科.*120|120.*英语单科/);
  assert.match(html, /CGPA.*2\.0|2\.0.*CGPA/);
  assert.match(html, /2026-09-17/);
  assert.match(html, /2026官方原文|需核验|参考/);
  assert.match(html, /本地反馈草稿/);
  assert.match(html, /不会自动提交/);
  assert.match(html, /复制反馈草稿/);
  assert.doesNotMatch(html, /href=["']https?:\/\//i);
});

test("knowledge shortcut keeps accessible contrast on the dark hero", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.hero \.knowledge-entry-link\s*\{[\s\S]*?color:\s*#ffd2c6;/);
});

test("knowledge controls keep mobile touch targets usable", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.knowledge-entry-link\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(styles, /\.knowledge-index > \.secondary-section-summary\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(styles, /\.knowledge-filters input,[\s\S]*?\.feedback-draft-body textarea\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(styles, /\.feedback-draft > summary\s*\{[\s\S]*?min-height:\s*44px;/);
});
