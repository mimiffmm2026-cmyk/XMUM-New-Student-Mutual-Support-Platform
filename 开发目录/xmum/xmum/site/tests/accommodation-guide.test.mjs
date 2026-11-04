import { loadBuiltWorker } from "../build/node-worker-runtime.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  accommodationBookingChecklist,
  accommodationCandidates,
  accommodationUpdatedAt,
  getAccommodationFreshness,
  parentArrivalDayPlan,
  parentArrivalChecklist,
} from "../app/accommodation-content.ts";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("accommodation-test", `${process.pid}-${Date.now()}`);
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
    assert.ok(candidate.distanceMeasurement, `${candidate.id} 缺少距离测量口径`);
    assert.ok(candidate.priceNote, `${candidate.id} 缺少价格口径`);
    assert.match(candidate.priceNote, /预订前|价格|当前价|MYR/);
    assert.equal(candidate.priceCheckedAt, "2026-10-05", `${candidate.id} 缺少价格查询日期`);
    assert.ok(candidate.taxNote, `${candidate.id} 缺少税费口径`);
    assert.ok(candidate.depositCancellation, `${candidate.id} 缺少押金/取消说明`);
    assert.match(candidate.depositCancellation, /押金|取消/);
    assert.ok(candidate.checkInOut, `${candidate.id} 缺少入住时间说明`);
    assert.ok(candidate.notes.length > 0, `${candidate.id} 缺少备注`);
    assert.ok(candidate.source, `${candidate.id} 缺少来源名称`);
    assert.match(candidate.sourceUrl, /^https:\/\//, `${candidate.id} 来源必须为 HTTPS`);
    assert.match(candidate.verifiedAt, /^2026-10-05$/, `${candidate.id} 核验日期不一致`);
    assert.ok(["预订前复核", "仅项目资料，暂不推荐"].includes(candidate.status));
  }
  assert.equal(
    accommodationCandidates.find((candidate) => candidate.id === "horizon-suites")?.status,
    "仅项目资料，暂不推荐",
  );
});

test("parent arrival checklist keeps school housing and family stay separate", () => {
  assert.equal(parentArrivalChecklist.length, 4);
  assert.match(parentArrivalChecklist[0].detail, /学生.*校内住宿|校内住宿.*学生/);
  assert.match(parentArrivalChecklist[0].detail, /家长.*短住|短住.*家长/);
  assert.match(parentArrivalChecklist[1].detail, /入住时间|行李|晚到入住/);
  assert.match(parentArrivalChecklist[2].detail, /税费|押金|取消/);
  assert.match(parentArrivalChecklist[3].detail, /确认凭证|订单/);
});

test("parent arrival details cover transport, check-in, and the first-day boundary", () => {
  assert.equal(accommodationBookingChecklist.length, 7);
  assert.match(accommodationBookingChecklist.join(" "), /房型.*人数/);
  assert.match(accommodationBookingChecklist.join(" "), /床型/);
  assert.match(accommodationBookingChecklist.join(" "), /押金/);
  assert.match(accommodationBookingChecklist.join(" "), /晚到入住/);
  assert.match(accommodationBookingChecklist.join(" "), /行李寄存/);
  assert.match(accommodationBookingChecklist.join(" "), /电梯/);
  assert.match(accommodationBookingChecklist.join(" "), /取消/);

  assert.equal(parentArrivalDayPlan.length, 5);
  const dayPlan = parentArrivalDayPlan.map((step) => `${step.title} ${step.detail}`).join(" ");
  assert.match(dayPlan, /当天查询/);
  assert.match(dayPlan, /学生首次入境.*统一接机/);
  assert.match(dayPlan, /陪同学生.*报到/);
  assert.match(dayPlan, /家长能否进入现场.*当天通知/);
  assert.doesNotMatch(dayPlan, /\d+\s*分钟|MYR|RM\s*\d/);
});

test("accommodation freshness expires only after the 30-day boundary", () => {
  const verifiedDay = Date.UTC(2026, 9, 5) / (24 * 60 * 60 * 1000);
  assert.equal(getAccommodationFreshness("2026-10-05", null), null);
  assert.equal(getAccommodationFreshness("2026-10-05", verifiedDay + 30), null);
  assert.equal(getAccommodationFreshness("2026-10-05", verifiedDay + 31), "stale");
  assert.equal(getAccommodationFreshness("2026-10-05", verifiedDay - 1), null);
  assert.equal(getAccommodationFreshness("not-a-date", verifiedDay + 31), null);
});

test("accommodation tags stay source-bounded and static", () => {
  const tagsById = Object.fromEntries(
    accommodationCandidates.map((candidate) => [candidate.id, candidate.tags]),
  );
  assert.deepEqual(tagsById["bell-suites"], ["公寓式空间（按房源）"]);
  assert.deepEqual(tagsById["s8-boutique"], ["家庭房型", "离校较近（平台距离）"]);
  assert.deepEqual(tagsById["holiday-inn-sepang"], ["机场接驳"]);
  assert.deepEqual(tagsById["horizon-suites"], []);
});

test("parent lodging FAQ has provenance for the new accommodation entry point", async () => {
  const content = await readFile(new URL("../app/content.ts", import.meta.url), "utf8");
  const start = content.indexOf('question: "家长到学校后住哪里？"');
  assert.notEqual(start, -1);
  const end = content.indexOf("\n  },", start);
  const block = content.slice(start, end);

  assert.match(block, /source: "/);
  assert.match(block, /verifiedAt: "2026-10-05"/);
  assert.match(block, /公开来源交叉核对/);
  assert.match(block, /家长短住与校外住宿候选|#accommodation/);
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
  assert.match(html, /仅项目资料，暂不推荐/);
  assert.match(html, /Bell Suites by Salaam/);
  assert.match(html, /学校不为家长提供住宿/);
  assert.match(html, /预订与入住前四步/);
  assert.doesNotMatch(html, /家长到校前四步/);
  assert.match(html, /家长到校一日流程/);
  assert.match(html, /入住前核对/);
  assert.match(html, /机场接驳/);
  assert.doesNotMatch(html, /需要重新核对/);
  assert.doesNotMatch(html, /href=["']https?:\/\//i);
});

test("page passes its existing UTC+8 day into the accommodation module", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /<AccommodationGuide currentUtc8Day=\{currentUtc8Day\} \/>/);
});
