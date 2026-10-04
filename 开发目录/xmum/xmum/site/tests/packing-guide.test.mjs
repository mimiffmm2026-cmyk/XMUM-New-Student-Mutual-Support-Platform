import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  filterPackingItems,
  groupPackingItems,
  packingCategories,
  packingGroups,
  packingItems,
  packingUpdatedAt,
} from "../app/packing-content.ts";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("packing-test", `${process.pid}-${Date.now()}`);
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

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

const allFilters = { strategy: "all", audience: "all", category: "all" };

test("packing data keeps all 67 items, groups, and strategies from the reviewed workbook", () => {
  assert.equal(packingUpdatedAt, "2026.09");
  assert.equal(packingItems.length, 67);
  const itemIds = packingItems.map((item) => item.id);
  assert.equal(new Set(itemIds).size, 67, "编号不得重复");
  assert.equal(itemIds[0], "P01");
  assert.ok(itemIds.includes("P54"), "缺少原清单末项");
  for (const id of ["P55", "P56", "P57", "P58", "P59", "P60", "P61", "P62", "P63", "P64"]) {
    assert.ok(itemIds.includes(id), `缺少补充条目 ${id}`);
  }
  for (const id of ["P65", "P66", "P67", "P68", "P69"]) {
    assert.ok(itemIds.includes(id), `缺少拆分条目 ${id}`);
  }

  assert.deepEqual(
    packingGroups.map((group) => group.id),
    ["carry", "domestic", "buyonsite", "skip"],
  );
  for (const group of packingGroups) {
    assert.match(group.color, /^#[0-9A-F]{6}$/i, `${group.id} 缺少识别色`);
  }
  assert.equal(packingCategories.length, 8);

  assert.deepEqual(countBy(packingItems, (item) => item.group), {
    carry: 14,
    domestic: 39,
    buyonsite: 11,
    skip: 3,
  });
  assert.deepEqual(countBy(packingItems, (item) => item.strategy), {
    随身携带: 14,
    国内带: 35,
    "国内带·可海运": 4,
    "先带旅行装·大瓶到校买": 1,
    到校再买: 10,
    不携带: 2,
    "按需·带小众特产": 1,
  });
  assert.deepEqual(countBy(packingItems, (item) => item.audience), {
    男女通用: 63,
    女生侧重: 3,
    男生侧重: 1,
  });
  assert.deepEqual(countBy(packingItems, (item) => item.category), {
    documents: 10,
    electronics: 6,
    clothing: 13,
    care: 14,
    dorm: 12,
    onhand: 5,
    minimal: 3,
    localbuy: 4,
  });

  const groupIds = new Set(packingGroups.map((group) => group.id));
  const categoryIds = new Set(packingCategories.map((category) => category.id));
  for (const item of packingItems) {
    assert.ok(item.name.length > 0, `${item.id} 缺少名称`);
    assert.ok(item.priority.length > 0, `${item.id} 缺少优先级`);
    assert.ok(item.quantity.length > 0, `${item.id} 缺少建议数量`);
    assert.ok(item.tip.length > 0, `${item.id} 缺少要点`);
    assert.doesNotMatch(
      item.tip,
      /\bP\d{2}\b/,
      `${item.id} 的要点残留 Pxx 编号引用；编号不在公开列表显示，须改写为物品名`,
    );
    assert.ok(groupIds.has(item.group), `${item.id} 分组非法`);
    assert.ok(categoryIds.has(item.category), `${item.id} 分类非法`);
  }

  const strategies = new Set(packingItems.map((item) => item.strategy));
  assert.deepEqual(
    [...strategies].sort(),
    [
      "不携带",
      "到校再买",
      "国内带",
      "国内带·可海运",
      "先带旅行装·大瓶到校买",
      "按需·带小众特产",
      "随身携带",
    ].sort(),
  );

  const grouped = groupPackingItems(packingItems);
  assert.deepEqual(
    grouped.map((entry) => [entry.group.id, entry.items.length]),
    [
      ["carry", 14],
      ["domestic", 39],
      ["buyonsite", 11],
      ["skip", 3],
    ],
  );
  assert.equal(grouped.flatMap((entry) => entry.items).length, 67);
});

test("packing filters narrow by strategy, audience, and category", () => {
  const filter = (filters) =>
    filterPackingItems(packingItems, { ...allFilters, ...filters });

  assert.equal(filter({}).length, 67);
  assert.equal(filter({ strategy: "carry" }).length, 14);
  assert.equal(filter({ strategy: "domestic" }).length, 39);
  assert.equal(filter({ strategy: "buyonsite" }).length, 11);
  assert.equal(filter({ strategy: "skip" }).length, 3);
  assert.equal(filter({ audience: "男女通用" }).length, 63);
  assert.equal(filter({ audience: "女生侧重" }).length, 66);
  assert.equal(filter({ audience: "男生侧重" }).length, 64);
  assert.equal(filter({ category: "care" }).length, 14);
  assert.equal(filter({ category: "clothing" }).length, 13);
  assert.equal(filter({ category: "dorm" }).length, 12);
  assert.equal(filter({ audience: "女生侧重", category: "care" }).length, 13);
  assert.equal(filter({ strategy: "carry", category: "clothing" }).length, 0);
  assert.equal(filter({ strategy: "buyonsite", category: "dorm" }).length, 5);
  assert.equal(filter({ category: "不存在" }).length, 0);
});

test("server-renders the packing module inside the guide module, collapsed by default", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();

  const guideStart = html.indexOf('id="guide"');
  const timelineStart = html.indexOf('id="timeline"');
  const materialsStart = html.indexOf('id="visa-materials"');
  const packingStart = html.indexOf('id="packing"');
  const contactStart = html.indexOf('id="contact"');
  assert.ok(guideStart !== -1 && packingStart !== -1, "缺少行李准备模块");
  assert.ok(
    guideStart < timelineStart &&
      timelineStart < materialsStart &&
      materialsStart < packingStart &&
      packingStart < contactStart,
    "行李准备必须位于入学时间线模块内、联系模块之前",
  );

  const stage03Start = html.indexOf('id="guide-stage-03"');
  const stage04Start = html.indexOf('id="guide-stage-04"');
  assert.ok(
    stage03Start !== -1 &&
      stage04Start !== -1 &&
      stage03Start < packingStart &&
      packingStart < stage04Start,
    "行李准备必须插在「缴费与出发准备」之后、「出发与入境当天」之前",
  );

  const detailsTag = html
    .slice(html.lastIndexOf("<details", packingStart), packingStart + 40)
    .match(/^<details[^>]*>/)?.[0];
  assert.ok(detailsTag && !/\bopen\b/.test(detailsTag), "行李准备默认折叠");

  const packingHtml = html.slice(
    html.lastIndexOf("<details", packingStart),
    contactStart,
  );
  assert.match(packingHtml, /行李准备：带什么、到哪买、怎么合规/);
  assert.match(packingHtml, /67 项按需选择/);
  assert.match(packingHtml, /6 档采购点/);
  assert.match(packingHtml, /微信公众号「大马口袋」/);
  assert.match(packingHtml, /仅供参考/);
  assert.match(packingHtml, /以航空、海关及学校最新规定为准/);
  assert.match(packingHtml, /整理于 2026\.09/);
  assert.match(packingHtml, /可能已变化/);
  assert.match(packingHtml, /不是必买清单/);
  assert.match(packingHtml, /不构成法律意见/);
  assert.match(packingHtml, /携带判断四问法/);
  assert.match(packingHtml, /采购地点（地图与店铺一览）/);
  assert.match(packingHtml, /合规速查/);
  assert.match(packingHtml, /首晚与床品提示/);
  assert.match(packingHtml, /packing-block-methods/);
  assert.match(packingHtml, /packing-block-compliance/);
  assert.match(packingHtml, /--packing-layer-color/);
  assert.match(packingHtml, /packing-verdict-go/, "缺少四问法结论语义色");
  assert.match(packingHtml, /packing-priority-essential/, "缺少优先级色码");
  assert.match(packingHtml, /packing-distance-near/, "缺少采购距离色阶");
  assert.match(packingHtml, /「校园生活」板块/);
  assert.match(packingHtml, /IOI City Mall/);
  assert.match(packingHtml, /≤100Wh/);
  assert.match(packingHtml, /肉干、肉类零食/);
  assert.match(packingHtml, /熊胆粉、牛黄解毒丸等/);

  assert.match(packingHtml, /女生视角/);
  assert.match(packingHtml, /男生视角/);
  assert.match(packingHtml, /data-value="女生侧重"/);
  assert.match(packingHtml, /packing-filter-actions/);
  assert.match(packingHtml, /packing-active-filters/);
  assert.doesNotMatch(
    packingHtml,
    /class="packing-active-filter[ "]/,
    "服务端初始不得显示筛选令牌",
  );
  assert.match(packingHtml, /data-packing-filter-group="strategy"/);
  assert.match(packingHtml, /data-packing-filter-group="audience"/);
  assert.match(packingHtml, /data-packing-filter-group="category"/);
  assert.match(packingHtml, /aria-pressed="true"/);
  for (const value of ["carry", "domestic", "buyonsite", "skip"]) {
    assert.match(packingHtml, new RegExp(`data-packing-group-section="${value}"`));
  }
  assert.equal(
    (packingHtml.match(/data-packing-row=/g) ?? []).length,
    67,
    "全部 67 项必须出现在服务端 HTML 中",
  );
  assert.equal(
    (packingHtml.match(/data-packing-check=/g) ?? []).length,
    67,
    "67 个勾选控件都必须出现在服务端 HTML 中",
  );
  assert.doesNotMatch(packingHtml, /aria-checked="true"/, "服务端初始一律未勾选");
  assert.match(packingHtml, /已勾选 0 \/ 67/);
  assert.match(packingHtml, /仅保存在本机浏览器，不上传、不同步/);
  assert.match(packingHtml, /aria-label="标记已打包：/);
  assert.equal(
    (packingHtml.match(/<img\b/g) ?? []).length,
    1,
    "行李准备只包含一张改绘地图",
  );
  assert.match(packingHtml, /\/images\/packing\/campus-shopping-map\.jpg/);
  assert.doesNotMatch(packingHtml, /href="#"/);
  assert.doesNotMatch(packingHtml, /\bhref=["']https?:\/\//i);
  assert.doesNotMatch(packingHtml, /\d+\s*kg/i, "渲染片段不得出现个人重量额度");
  assert.doesNotMatch(
    packingHtml,
    /身份证号|银行账号|护照号|初始密码|考生编号/,
    "渲染片段不得出现个人身份串",
  );
  assert.doesNotMatch(packingHtml, /https?:\/\//i, "渲染片段不得出现纯文本外链");
});

test("packing release surface keeps no links, no personal quota, and no personal identifiers", async () => {
  const content = await readFile(
    new URL("../app/packing-content.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(content, /https?:\/\//i, "数据不得包含外链");
  assert.doesNotMatch(content, /\d+\s*kg/i, "不得出现个人重量额度");
  assert.doesNotMatch(
    content,
    /身份证号|银行账号|护照号|初始密码|考生编号/,
    "不得出现个人身份串",
  );
});

test("packing source keeps release-gate wiring", async () => {
  const [page, guide, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PackingGuide.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /tests\/packing-guide\.test\.mjs/);
  assert.match(page, /from "\.\/PackingGuide"/);
  assert.match(page, /<PackingGuide \/>/);
  assert.match(guide, /id="packing"/);
});
