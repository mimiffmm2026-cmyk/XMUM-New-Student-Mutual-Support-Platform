import { loadBuiltWorker } from "../build/node-worker-runtime.mjs";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  diningCategories,
  diningMap,
  diningMerchants,
  diningRegions,
  diningUpdatedAt,
  filterDiningMerchants,
} from "../app/dining-content.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("dining-test", `${process.pid}-${Date.now()}`);
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

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function publicFile(webPath) {
  return path.join(projectRoot, "public", webPath.replace(/^\//, ""));
}

const allFilters = {
  region: "all",
  status: "all",
  category: "all",
};

test("dining data keeps every region, merchant, and published hour from the source guide", () => {
  assert.equal(diningUpdatedAt, "2026.09");

  assert.deepEqual(
    diningRegions.map((region) => region.id),
    ["B1", "D6", "LY3", "音乐岛", "A3", "IAEC"],
  );
  assert.equal(new Set(diningRegions.map((region) => region.anchor)).size, 6);
  for (const region of diningRegions) {
    assert.match(region.color, /^#[0-9A-F]{6}$/i);
    assert.ok(region.name.length > 0);
    assert.ok(region.nameEn.length > 0);
  }

  assert.equal(diningMerchants.length, 38);
  assert.deepEqual(
    countBy(diningMerchants, (merchant) => merchant.region),
    { B1: 6, D6: 17, LY3: 11, 音乐岛: 1, A3: 1, IAEC: 2 },
  );
  assert.deepEqual(
    countBy(diningMerchants, (merchant) => merchant.status),
    { open: 34, coming_soon: 4 },
  );

  const uniqueLots = new Set(
    diningMerchants.map((merchant) => `${merchant.region}·${merchant.lot}`),
  );
  assert.equal(uniqueLots.size, 38, "同一区域内摊位号不得重复");

  for (const merchant of diningMerchants) {
    assert.ok(merchant.nameLines.length > 0, `${merchant.lot} 缺少商户名称`);
    for (const line of merchant.closureLines) {
      assert.match(
        line,
        /停业/,
        `${merchant.nameLines.join("")} 的“特别停业”列只能放明确的停业记录；周休与时间调整应放入休息日或营业时间，避免同一行信息互相矛盾`,
      );
    }
    if (merchant.status === "open") {
      assert.ok(
        merchant.hoursLines.length > 0,
        `${merchant.nameLines.join("")} 缺少营业时间`,
      );
      assert.ok(merchant.category, `${merchant.nameLines.join("")} 缺少类别`);
      assert.ok(
        merchant.categoryLabel,
        `${merchant.nameLines.join("")} 缺类别标签`,
      );
    } else {
      assert.equal(merchant.hoursLines.length, 0);
      assert.equal(merchant.category, null);
      assert.equal(merchant.categoryLabel, null);
    }
  }

  assert.deepEqual(
    countBy(diningMerchants, (merchant) => merchant.category ?? "(none)"),
    {
      chinese: 12,
      southeast_asian: 5,
      western_light: 4,
      coffee_drinks: 4,
      middle_east_central_asian: 3,
      convenience_retail: 2,
      snacks_desserts: 2,
      japanese_korean: 2,
      "(none)": 4,
    },
  );
  assert.equal(diningCategories.length, 8);
  for (const category of diningCategories) {
    assert.match(category.color, /^#[0-9A-F]{6}$/i, `类别 ${category.id} 缺少识别色`);
  }
  for (const category of diningCategories) {
    assert.ok(
      diningMerchants.some((merchant) => merchant.category === category.id),
      `类别 ${category.id} 必须至少有一个商户`,
    );
  }
});

test("dining release surface publishes only the site-made map, not unlicensed merchant photos", async () => {
  const photos = diningMerchants.flatMap((merchant) => merchant.photos);
  assert.equal(photos.length, 0, "来源与授权无法确认的商户照片不得发布");

  assert.match(diningMap.src, /^\/images\/dining\/[\w-]+\.jpg$/);
  assert.ok(diningMap.alt.length > 0);
  assert.ok(existsSync(publicFile(diningMap.src)), "餐饮地图文件必须存在");

  const diningFiles = (await readdir(
    path.join(projectRoot, "public", "images", "dining"),
  )).filter((name) => !name.startsWith("."));
  assert.deepEqual(
    diningFiles,
    ["campus-dining-map.jpg"],
    "发布目录只保留本站整理的地图，未授权商户照片必须删除",
  );

  const releaseSurface = JSON.stringify(diningMerchants) + diningMap.src;
  assert.doesNotMatch(releaseSurface, /https?:\/\//i, "数据不得包含外链");
});

test("dining filters narrow by region, status, and category", () => {
  const filter = (filters) =>
    filterDiningMerchants(diningMerchants, { ...allFilters, ...filters });

  assert.equal(filter({}).length, 38);
  assert.equal(filter({ region: "D6" }).length, 17);
  assert.equal(filter({ status: "coming_soon" }).length, 4);
  assert.equal(filter({ status: "open" }).length, 34);
  assert.equal(filter({ category: "chinese" }).length, 12);
  assert.equal(filter({ region: "D6", status: "open" }).length, 16);
  assert.equal(
    filter({ region: "B1", category: "middle_east_central_asian" }).length,
    2,
  );
  assert.equal(filter({ category: "coffee_drinks" }).length, 4);
  assert.equal(filter({ category: "chinese", status: "coming_soon" }).length, 0);
  assert.equal(filter({ region: "不存在的区域" }).length, 0);
});

test("server-renders the dining module inside the campus module, collapsed by default", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();

  const lifeStart = html.indexOf('id="life"');
  const campusLifeStart = html.indexOf('id="campus-life"');
  const diningStart = html.indexOf('id="dining"');
  const officialStart = html.indexOf('id="official"');
  assert.ok(lifeStart !== -1 && campusLifeStart !== -1 && officialStart !== -1);
  assert.ok(diningStart !== -1, "缺少食堂模块");
  assert.ok(
    lifeStart < campusLifeStart &&
      campusLifeStart < diningStart &&
      diningStart < officialStart,
    "食堂模块必须位于校园生活之后、官方核对之前",
  );

  const detailsTag = html
    .slice(html.lastIndexOf("<details", diningStart), diningStart + 40)
    .match(/^<details[^>]*>/)?.[0];
  assert.ok(detailsTag && !/\bopen\b/.test(detailsTag), "食堂默认折叠");

  assert.match(html, /食堂攻略/);
  assert.match(html, /6 个区域/);
  assert.match(html, /38 家商户/);
  assert.match(html, /34 家已公布营业信息/);
  assert.match(html, /4 家即将开业/);
  assert.match(html, /2026\.09/);
  assert.match(html, /采集时点信息、可能已变化/);
  assert.match(html, /以校方和商户最新通知为准/);

  assert.match(html, /data-dining-filter-group="region"/);
  assert.match(html, /data-dining-filter-group="status"/);
  assert.match(html, /data-dining-filter-group="category"/);
  assert.match(html, /aria-pressed="true"/);

  for (const value of ["B1", "D6", "LY3", "音乐岛", "A3", "IAEC"]) {
    assert.match(html, new RegExp(`data-dining-region="${value}"`));
  }
  assert.match(html, /Uhub 优合/);
  assert.match(html, /Astana 阿斯塔纳餐厅/);
  assert.match(html, /即将开业/);
  assert.match(html, /href="#dining-region-[a-z0-9-]+"/);

  assert.equal(
    (html.match(/data-dining-row=/g) ?? []).length,
    38,
    "全部 38 家商户都必须出现在服务端 HTML 中",
  );
  assert.equal(
    (html.match(/class="dining-photo-button"/g) ?? []).length,
    0,
    "未授权商户照片不得出现在页面中",
  );
  assert.match(html, /class="dining-map-button"/);
  assert.doesNotMatch(html, /商户照片|本站拍摄/);
  assert.doesNotMatch(html, /href="#"/);
  assert.doesNotMatch(html, /\bhref=["']https?:\/\//i);
});

test("dining source keeps release-gate copy and safe references", async () => {
  const [page, content, diningGuide, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dining-content.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/DiningGuide.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /tests\/dining-guide\.test\.mjs/);
  assert.match(page, /from "\.\/DiningGuide"/);
  assert.match(page, /<DiningGuide \/>/);
  assert.match(diningGuide, /id="dining"/);
  assert.doesNotMatch(content, /初始密码|考生编号|身份证|银行账号/);
  assert.doesNotMatch(content, /https?:\/\//i);
});
