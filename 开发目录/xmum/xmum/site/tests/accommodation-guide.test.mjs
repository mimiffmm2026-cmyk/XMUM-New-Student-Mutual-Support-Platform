import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  accommodationCandidates,
  accommodationUpdatedAt,
  parentArrivalChecklist,
} from "../app/accommodation-content.ts";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("accommodation-test", `${process.pid}-${Date.now()}`);
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

test("accommodation candidates carry dated provenance and booking safeguards", () => {
  assert.equal(accommodationUpdatedAt, "2026-10-05");
  assert.deepEqual(
    accommodationCandidates.map((candidate) => candidate.id),
    ["bell-suites", "horizon-suites", "s8-boutique", "holiday-inn-sepang"],
  );
  assert.equal(new Set(accommodationCandidates.map((candidate) => candidate.id)).size, 4);

  for (const candidate of accommodationCandidates) {
    assert.ok(candidate.name, `${candidate.id} 缺少名称`);
    assert.ok(candidate.type, `${candidate.id} 缺少住宿类型`);
    assert.ok(candidate.area, `${candidate.id} 缺少区域`);
    assert.ok(candidate.suitableFor, `${candidate.id} 缺少适合人群说明`);
    assert.ok(candidate.distanceNote, `${candidate.id} 缺少距离口径`);
    assert.ok(candidate.priceNote, `${candidate.id} 缺少价格口径`);
    assert.match(candidate.priceNote, /预订前|价格|当前价|MYR/);
    assert.ok(candidate.depositCancellation, `${candidate.id} 缺少押金/取消说明`);
    assert.match(candidate.depositCancellation, /押金|取消/);
    assert.ok(candidate.checkInOut, `${candidate.id} 缺少入住时间说明`);
    assert.ok(candidate.source, `${candidate.id} 缺少来源名称`);
    assert.match(candidate.sourceUrl, /^https:\/\//, `${candidate.id} 来源必须为 HTTPS`);
    assert.match(candidate.verifiedAt, /^2026-10-05$/, `${candidate.id} 核验日期不一致`);
    assert.equal(candidate.status, "预订前复核");
  }
});

test("parent arrival checklist keeps school housing and family stay separate", () => {
  assert.equal(parentArrivalChecklist.length, 4);
  assert.match(parentArrivalChecklist[0].detail, /学生.*校内住宿|校内住宿.*学生/);
  assert.match(parentArrivalChecklist[0].detail, /家长.*短住|短住.*家长/);
  assert.match(parentArrivalChecklist[1].detail, /入住时间|行李|接机/);
  assert.match(parentArrivalChecklist[2].detail, /税费|押金|取消/);
  assert.match(parentArrivalChecklist[3].detail, /确认凭证|订单/);
});

test("parent lodging FAQ has provenance for the new accommodation entry point", async () => {
  const content = await readFile(new URL("../app/content.ts", import.meta.url), "utf8");
  const start = content.indexOf('question: "家长到学校后住哪里？"');
  assert.notEqual(start, -1);
  const end = content.indexOf("\n  },", start);
  const block = content.slice(start, end);

  assert.match(block, /source: "/);
  assert.match(block, /verifiedAt: "2026-10-05"/);
  assert.match(block, /本页.*住宿|住宿.*本页/);
});

test("packing documentation distinguishes the 54-item source workbook from the 67-item public release", async () => {
  const [plan, spec, master] = await Promise.all([
    readFile(new URL("../docs/superpowers/plans/2026-09-17-packing-guide-module.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/superpowers/specs/2026-09-17-packing-guide-module-design.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/packing-master-list-v4-distillation.md", import.meta.url), "utf8"),
  ]);

  assert.match(plan, /历史设计|当前公开实现.*67/);
  assert.match(spec, /历史设计|当前公开实现.*67/);
  assert.match(master, /源工作簿.*54.*公开实现.*67|54.*源工作簿.*67/);
});

test("server-renders the parent accommodation module without web jumps", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /id="accommodation"/);
  assert.match(html, /家长短住与校外住宿候选/);
  assert.match(html, /Bell Suites @ Sunsuria City/);
  assert.match(html, /S8 Boutique Hotel/);
  assert.match(html, /2026-10-05/);
  assert.match(html, /预订前复核/);
  assert.match(html, /学校不为家长提供住宿/);
  assert.doesNotMatch(html, /href=["']https?:\/\//i);
});
