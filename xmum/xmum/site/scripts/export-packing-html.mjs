import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  complianceRules,
  controlledIngredients,
  firstNightNotes,
  packingCategories,
  packingGroups,
  packingItems,
  packingMethods,
  packingUpdatedAt,
  shoppingSpots,
} from "../app/packing-content.ts";

const outputFile = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(os.homedir(), "Desktop", "行李准备清单.html");

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const mapBase64 = readFileSync(
  path.join(projectRoot, "public", "images", "packing", "campus-shopping-map.jpg"),
).toString("base64");

const expectedGroupCounts = { carry: 14, domestic: 39, buyonsite: 11, skip: 3 };
const layerColors = {
  "海关/检疫": "#171f32",
  航空: "#14765e",
  宿舍: "#875b10",
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const priorityTones = {
  必需: "packing-priority-essential",
  建议: "packing-priority-suggested",
  首周建议: "packing-priority-suggested",
};

const verdictTones = {
  建议携带: "packing-verdict-go",
  可以不带: "packing-verdict-skip",
  本地都能买到: "packing-verdict-local",
};

function distanceTone(distance) {
  if (distance.includes("步行")) {
    return "packing-distance-near";
  }
  if (distance.includes("打车")) {
    return "packing-distance-mid";
  }
  return "packing-distance-far";
}

function assertParity() {
  const problems = [];
  const groupCounts = {};
  for (const item of packingItems) {
    groupCounts[item.group] = (groupCounts[item.group] ?? 0) + 1;
  }
  for (const [groupId, expected] of Object.entries(expectedGroupCounts)) {
    if (groupCounts[groupId] !== expected) {
      problems.push(`分组 ${groupId} 数量 ${groupCounts[groupId]} ≠ ${expected}`);
    }
  }
  if (packingItems.length !== 67) {
    problems.push(`条目总数 ${packingItems.length} ≠ 67`);
  }
  for (const item of packingItems) {
    if (/\bP\d{2}\b/.test(item.tip)) {
      problems.push(`${item.id} 要点残留 Pxx 编号引用`);
    }
  }
  if (packingMethods.length !== 4) problems.push("四问法行数不为 4");
  if (shoppingSpots.length !== 6) problems.push("采购点数量不为 6");
  if (complianceRules.length !== 13) problems.push("合规条目数量不为 13");
  if (controlledIngredients.length !== 6) problems.push("受控成分数量不为 6");
  if (firstNightNotes.length !== 6) problems.push("首晚提示数量不为 6");
  if (packingCategories.length !== 8) problems.push("分类数量不为 8");
  if (problems.length > 0) {
    throw new Error(`数据完整性核对失败：\n- ${problems.join("\n- ")}`);
  }
}

function renderMethodRows() {
  return packingMethods
    .map(
      (method) => `          <tr>
            <td data-label="情境">${escapeHtml(method.situation)}</td>
            <td data-label="结论" class="${verdictTones[method.verdict] ?? ""}">${escapeHtml(method.verdict)}</td>
            <td data-label="说明">${escapeHtml(method.note)}</td>
          </tr>`,
    )
    .join("\n");
}

function renderItemRow(item) {
  return `                  <tr class="packing-row" data-packing-row="${escapeHtml(item.id)}" data-group="${escapeHtml(item.group)}" data-category="${escapeHtml(item.category)}" data-audience="${escapeHtml(item.audience)}" data-strategy="${escapeHtml(item.strategy)}">
                    <td class="item" data-label="物品">
                      <button type="button" role="checkbox" aria-checked="false" aria-label="标记已打包：${escapeHtml(item.name)}" class="check" data-packing-check="${escapeHtml(item.id)}"><span class="check-box" aria-hidden="true"></span></button>
                      <span class="item-name">${escapeHtml(item.name)}</span>
                      <span class="badge">${escapeHtml(item.strategy)}</span>
                    </td>
                    <td data-label="人群">${escapeHtml(item.audience)}</td>
                    <td data-label="优先级·条件"><span class="${priorityTones[item.priority] ?? ""}">${escapeHtml(item.priority)}</span></td>
                    <td data-label="建议数量">${escapeHtml(item.quantity)}</td>
                    <td class="tip" data-label="要点">${escapeHtml(item.tip)}</td>
                  </tr>`;
}

function renderGroups() {
  return packingGroups
    .map((group) => {
      const items = packingItems.filter((item) => item.group === group.id);
      const rows = items.map(renderItemRow).join("\n");
      return `        <section class="group" data-group-section="${escapeHtml(group.id)}" id="group-${escapeHtml(group.anchor)}" style="--group-color:${escapeHtml(group.color)}">
          <header class="group-head">
            <div class="group-title">
              <h3>${escapeHtml(group.label)}</h3>
              <small>${escapeHtml(group.hint)}</small>
            </div>
            <span class="group-count" data-group-count>${items.length} 项 · 已勾选 0/${items.length}</span>
          </header>
          <table class="grid card-table">
            <thead>
              <tr>
                <th scope="col">物品</th>
                <th scope="col">人群</th>
                <th scope="col">优先级·条件</th>
                <th scope="col">建议数量</th>
                <th scope="col">要点</th>
              </tr>
            </thead>
            <tbody>
${rows}
            </tbody>
          </table>
        </section>`;
    })
    .join("\n");
}

function renderSpotRows() {
  return shoppingSpots
    .map(
      (spot) => `          <tr>
            <td data-label="采购点">${escapeHtml(spot.name)}</td>
            <td data-label="距离"><span class="${distanceTone(spot.distance)}">${escapeHtml(spot.distance)}</span></td>
            <td data-label="营业时间">${escapeHtml(spot.hours)}</td>
            <td data-label="店铺与特点">${escapeHtml(spot.shops)}</td>
            <td data-label="采购建议">${escapeHtml(spot.note)}</td>
          </tr>`,
    )
    .join("\n");
}

function renderComplianceLayers() {
  const layers = ["海关/检疫", "航空", "宿舍"]
    .map((layer) => {
      const rules = complianceRules.filter((rule) => rule.layer === layer);
      const rows = rules
        .map(
          (rule) => `            <tr>
              <td data-label="主题">${escapeHtml(rule.topic)}</td>
              <td data-label="整理提示">${escapeHtml(rule.guidance)}</td>
            </tr>`,
        )
        .join("\n");
      return `          <div class="layer" style="--layer-color:${escapeHtml(layerColors[layer])}">
            <h3>${escapeHtml(layer)}</h3>
            <table class="grid card-table">
              <thead>
                <tr>
                  <th scope="col">主题</th>
                  <th scope="col">整理提示</th>
                </tr>
              </thead>
              <tbody>
${rows}
              </tbody>
            </table>
          </div>`;
    })
    .join("\n");
  const drugRows = controlledIngredients
    .map(
      (ingredient) => `              <tr>
                <td data-label="受控成分">${escapeHtml(ingredient.ingredient)}</td>
                <td data-label="常见例子">${escapeHtml(ingredient.examples)}</td>
              </tr>`,
    )
    .join("\n");
  return `${layers}
          <div class="layer" style="--layer-color:#875b10">
            <h3>药物携带限制</h3>
            <p class="block-note">尽量不携带；确需携带请准备好相关医生证明与英文译件（经验整理，非完整清单）。</p>
            <table class="grid card-table">
              <thead>
                <tr>
                  <th scope="col">受控成分</th>
                  <th scope="col">常见例子</th>
                </tr>
              </thead>
              <tbody>
${drugRows}
              </tbody>
            </table>
          </div>`;
}

function renderFirstNightNotes() {
  return firstNightNotes
    .map((note) => `          <li>${escapeHtml(note)}</li>`)
    .join("\n");
}

function renderStrategyChips() {
  return [
    `            <button type="button" class="chip" aria-pressed="true" data-filter-group="strategy" data-value="all">全部策略</button>`,
    ...packingGroups.map(
      (group) =>
        `            <button type="button" class="chip" aria-pressed="false" data-filter-group="strategy" data-value="${escapeHtml(group.id)}">${escapeHtml(group.label)}</button>`,
    ),
  ].join("\n");
}

function renderAudienceChips() {
  return [
    `            <button type="button" class="chip" aria-pressed="true" data-filter-group="audience" data-value="all">全部</button>`,
    `            <button type="button" class="chip" aria-pressed="false" data-filter-group="audience" data-value="男女通用">男女通用</button>`,
    `            <button type="button" class="chip" aria-pressed="false" data-filter-group="audience" data-value="女生侧重">女生视角</button>`,
    `            <button type="button" class="chip" aria-pressed="false" data-filter-group="audience" data-value="男生侧重">男生视角</button>`,
  ].join("\n");
}

function renderCategoryChips() {
  return [
    `            <button type="button" class="chip" aria-pressed="true" data-filter-group="category" data-value="all">全部分类</button>`,
    ...packingCategories.map(
      (category) =>
        `            <button type="button" class="chip" aria-pressed="false" data-filter-group="category" data-value="${escapeHtml(category.id)}">${escapeHtml(category.label)}</button>`,
    ),
  ].join("\n");
}

function buildHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>行李准备清单｜厦大马校 2026</title>
<style>
  :root {
    --navy: #171f32;
    --ink: #202738;
    --muted: #5f6879;
    --subtle: #596476;
    --surface: #ffffff;
    --canvas: #f4f5f7;
    --line: #dfe2e8;
    --line-strong: #c9ced8;
    --coral: #f46a43;
    --coral-dark: #b83f21;
    --coral-soft: #fff0eb;
    --green: #14765e;
    --green-soft: #e6f5f0;
    --amber: #875b10;
    --radius-md: 12px;
    --radius-lg: 16px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--canvas);
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    line-height: 1.65;
  }
  .sticky {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--coral) 7%, white), color-mix(in srgb, var(--navy) 5%, white));
    border-bottom: 1px solid var(--line);
    color: var(--navy);
    font-size: 13px;
  }
  .sticky .bar { flex: 1 1 auto; height: 6px; border-radius: 999px; background: color-mix(in srgb, var(--navy) 14%, white); overflow: hidden; }
  .sticky .bar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, var(--coral), color-mix(in srgb, var(--coral) 45%, white)); transition: width 0.2s ease; }
  .sticky button {
    min-height: 44px;
    padding: 6px 12px;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--surface);
    color: var(--navy);
    font-size: 12px;
    cursor: pointer;
  }
  .sticky button:hover:not(:disabled) {
    border-color: var(--navy);
  }
  .sticky button:disabled { opacity: 0.5; cursor: default; }
  .page { width: min(1080px, 100%); margin: 0 auto; padding: 28px 20px 72px; display: grid; gap: 22px; }
  .hero h1 { margin: 6px 0 10px; font-size: clamp(22px, 3.4vw, 32px); color: var(--navy); line-height: 1.3; }
  .eyebrow { margin: 0; color: var(--coral-dark); font-size: 13px; font-weight: 700; }
  .sub { margin: 0; color: var(--muted); font-size: 14px; }
  .note {
    margin: 14px 0 0;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-left: 4px solid var(--coral);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--muted);
    font-size: 13px;
  }
  .block { --block-color: var(--line-strong); display: grid; gap: 12px; }
  .block > h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 17px; color: color-mix(in srgb, var(--block-color) 60%, var(--ink)); }
  .block > h2::before { content: ""; flex: 0 0 auto; width: 14px; height: 14px; border-radius: 4px; background: linear-gradient(135deg, var(--block-color), color-mix(in srgb, var(--block-color) 45%, white)); }
  .block-note { margin: 0; color: var(--muted); font-size: 12px; }
  .block-methods { --block-color: var(--coral); }
  .block-items { --block-color: var(--navy); }
  .block-spots { --block-color: var(--green); }
  .block-compliance { --block-color: var(--amber); }
  .block-firstnight { --block-color: #0ea5e9; }
  .map-figure { margin: 0; display: grid; gap: 8px; }
  .map-figure img { display: block; width: 100%; height: auto; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface); }
  .map-figure figcaption { color: var(--muted); font-size: 12px; line-height: 1.7; }
  table.grid {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface);
    font-size: 13px;
  }
  table.grid th,
  table.grid td { padding: 9px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
  table.grid thead th {
    background: linear-gradient(135deg, color-mix(in srgb, var(--block-color) 12%, white), color-mix(in srgb, var(--block-color) 5%, white));
    border-bottom: 1px solid color-mix(in srgb, var(--block-color) 30%, white);
    color: var(--navy);
    font-size: 12px;
    white-space: nowrap;
  }
  table.grid tbody tr:last-child td { border-bottom: 0; }
  .block-methods table.grid tbody td:nth-child(2) { font-weight: 700; }
  .packing-verdict-go { color: var(--green); }
  .packing-verdict-skip { color: var(--amber); }
  .packing-verdict-local { color: var(--navy); }
  .packing-priority-essential,
  .packing-priority-suggested { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .packing-priority-essential { background: var(--coral-soft); color: var(--coral-dark); }
  .packing-priority-suggested { background: var(--green-soft); color: var(--green); }
  .packing-distance-near,
  .packing-distance-mid,
  .packing-distance-far { font-weight: 700; }
  .packing-distance-near { color: var(--green); }
  .packing-distance-mid { color: var(--amber); }
  .packing-distance-far { color: var(--navy); }
  .filters { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); }
  .filter-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .filter-label { flex: 0 0 48px; color: var(--muted); font-size: 12px; font-weight: 700; }
  .chip {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 8px 13px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface);
    color: var(--subtle);
    font-size: 13px;
    cursor: pointer;
  }
  .chip[data-filter-group="strategy"][aria-pressed="true"] {
    border-color: var(--coral-dark);
    background: linear-gradient(135deg, color-mix(in srgb, var(--coral-dark) 24%, white), color-mix(in srgb, var(--coral-dark) 8%, white));
    color: color-mix(in srgb, var(--coral-dark) 70%, var(--ink));
    font-weight: 700;
  }
  .chip[data-filter-group="audience"][aria-pressed="true"] {
    border-color: var(--navy);
    background: linear-gradient(135deg, color-mix(in srgb, var(--navy) 24%, white), color-mix(in srgb, var(--navy) 8%, white));
    color: color-mix(in srgb, var(--navy) 70%, var(--ink));
    font-weight: 700;
  }
  .chip[data-filter-group="category"][aria-pressed="true"] {
    border-color: var(--green);
    background: linear-gradient(135deg, color-mix(in srgb, var(--green) 24%, white), color-mix(in srgb, var(--green) 8%, white));
    color: color-mix(in srgb, var(--green) 70%, var(--ink));
    font-weight: 700;
  }
  .chip[data-filter-unchecked][aria-pressed="true"] {
    border-color: var(--amber);
    background: linear-gradient(135deg, color-mix(in srgb, var(--amber) 24%, white), color-mix(in srgb, var(--amber) 8%, white));
    color: color-mix(in srgb, var(--amber) 70%, var(--ink));
    font-weight: 700;
  }
  .btn-clear {
    justify-self: start;
    min-height: 44px;
    padding: 8px 14px;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--surface);
    color: var(--muted);
    font-size: 13px;
    cursor: pointer;
  }
  .btn-clear:hover { color: var(--ink); }
  .filter-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .active-filters { display: flex; flex-wrap: wrap; gap: 8px; }
  .active-filter {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 0 0 14px;
    border: 1px solid color-mix(in srgb, var(--filter-token-color, var(--navy)) 30%, var(--line));
    border-radius: 999px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--filter-token-color, var(--navy)) 10%, white), color-mix(in srgb, var(--filter-token-color, var(--navy)) 4%, white));
    color: color-mix(in srgb, var(--filter-token-color, var(--navy)) 75%, var(--ink));
    font-size: 12px;
    font-weight: 700;
  }
  .active-filter-strategy { --filter-token-color: var(--coral-dark); }
  .active-filter-audience { --filter-token-color: var(--navy); }
  .active-filter-category { --filter-token-color: var(--green); }
  .active-filter-unchecked { --filter-token-color: var(--amber); }
  .active-filter-remove {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
  }
  .active-filter-remove:hover { background: color-mix(in srgb, var(--filter-token-color, var(--navy)) 10%, white); }
  .count { margin: 0; color: var(--muted); font-size: 13px; }
  .empty {
    margin: 0;
    padding: 12px 14px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-md);
    color: var(--muted);
    font-size: 13px;
  }
  .group { --group-color: var(--coral); display: grid; gap: 10px; margin-top: 6px; }
  .group-head {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px 12px;
    padding: 10px 14px 10px 20px;
    border-radius: var(--radius-md);
    background: linear-gradient(100deg, color-mix(in srgb, #f46a43 14%, white) 0%, color-mix(in srgb, #f2b705 13%, white) 34%, color-mix(in srgb, #14765e 12%, white) 66%, color-mix(in srgb, #0ea5e9 15%, white) 100%);
  }
  .group-head::before {
    content: "";
    position: absolute;
    left: 9px;
    top: 10px;
    bottom: 10px;
    width: 4px;
    border-radius: 999px;
    background: var(--group-color);
  }
  .group-title h3 { margin: 0; font-size: 14px; color: color-mix(in srgb, var(--group-color) 55%, var(--ink)); }
  .group-title small { display: block; margin-top: 2px; color: color-mix(in srgb, var(--group-color) 45%, var(--ink)); font-size: 12px; }
  .group-count { color: color-mix(in srgb, var(--group-color) 55%, var(--ink)); font-size: 12px; font-weight: 700; }
  .group table.grid thead th {
    background: linear-gradient(135deg, color-mix(in srgb, var(--group-color) 16%, white), color-mix(in srgb, var(--group-color) 7%, white));
    border-bottom-color: color-mix(in srgb, var(--group-color) 38%, white);
    color: color-mix(in srgb, var(--group-color) 55%, var(--ink));
  }
  .item-name { font-weight: 700; }
  .badge {
    display: inline-block;
    margin-left: 8px;
    padding: 2px 8px;
    border: 1px solid color-mix(in srgb, var(--group-color) 30%, var(--line));
    border-radius: 999px;
    background: color-mix(in srgb, var(--group-color) 12%, white);
    color: color-mix(in srgb, var(--group-color) 62%, var(--ink));
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .tip { max-width: 46ch; color: var(--muted); line-height: 1.7; }
  .check {
    width: 44px;
    height: 44px;
    margin: 0 4px 0 0;
    padding: 0;
    display: inline-grid;
    place-items: center;
    border: 0;
    background: transparent;
    vertical-align: middle;
    cursor: pointer;
  }
  .check-box { width: 20px; height: 20px; display: grid; place-items: center; border: 2px solid var(--line-strong); border-radius: 5px; background: var(--surface); }
  .check[aria-checked="true"] .check-box { border-color: var(--group-color); background: var(--group-color); }
  .check[aria-checked="true"] .check-box::after {
    content: "";
    width: 10px;
    height: 5px;
    border-left: 2px solid #fff;
    border-bottom: 2px solid #fff;
    transform: rotate(-45deg) translate(1px, -1px);
  }
  tr.is-checked .item-name { color: var(--muted); text-decoration: line-through; }
  .layer { --layer-color: var(--line-strong); display: grid; gap: 8px; }
  .layer h3 {
    margin: 6px 0 0;
    padding: 6px 10px;
    border-left: 4px solid var(--layer-color);
    border-radius: 6px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--layer-color) 16%, white), color-mix(in srgb, var(--layer-color) 6%, white));
    color: color-mix(in srgb, var(--layer-color) 72%, var(--ink));
    font-size: 13px;
  }
  .layer table.grid thead th { background: color-mix(in srgb, var(--layer-color) 8%, white); }
  .firstnight { margin: 0; padding: 0; display: grid; gap: 8px; list-style: none; color: var(--muted); font-size: 13px; line-height: 1.7; }
  .firstnight li { position: relative; padding-left: 16px; }
  .firstnight li::before { content: ""; position: absolute; left: 0; top: 0.6em; width: 6px; height: 6px; border-radius: 50%; background: var(--subtle); }
  footer.legal { color: var(--muted); font-size: 12px; line-height: 1.8; border-top: 1px solid var(--line); padding-top: 16px; display: grid; gap: 4px; }
  :focus-visible { outline: 3px solid #c44725; outline-offset: 2px; }
  @media (max-width: 820px) {
    .filter-label { flex-basis: 100%; }
    table.card-table,
    table.card-table tbody,
    table.card-table tr,
    table.card-table td { display: block; width: auto; }
    table.card-table thead { display: none; }
    table.card-table { border: 0; background: transparent; }
    table.card-table tbody tr {
      margin: 10px 0 0;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-left: 4px solid var(--group-color, var(--block-color));
      border-radius: var(--radius-md);
      background: var(--surface);
    }
    table.card-table td { padding: 2px 0; border: 0; font-size: 13px; }
    table.card-table td[data-label]::before { content: attr(data-label); display: block; color: var(--muted); font-size: 10px; font-weight: 700; }
    .tip { max-width: none; }
  }
  @media print {
    .sticky,
    .filters,
    .btn-clear { display: none !important; }
    body { background: #fff; }
    .block { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="sticky" role="region" aria-label="装箱进度">
  <span>已勾选 <b id="sticky-count">0</b> / ${packingItems.length}</span>
  <div class="bar" aria-hidden="true"><i id="sticky-bar"></i></div>
  <button type="button" id="clear-checks" disabled>清空勾选</button>
</div>

<main class="page">
  <header class="hero">
    <p class="eyebrow">厦大马校 2026 新生 · 独立交付版</p>
    <h1>行李准备</h1>
    <p class="sub">带什么、到哪买、怎么合规 · ${packingItems.length} 项按需选择 · ${shoppingSpots.length} 档采购点 · 经验整理于 ${packingUpdatedAt}</p>
    <p class="note" role="note">本文件为行李规划参考：经验内容整理自微信公众号「大马口袋」及家长整理资料，仅供参考；携带、申报与宿舍要求以航空、海关及学校最新规定为准。整理于 ${packingUpdatedAt}，店铺、营业时间与政策可能已变化。勾选结果仅保存在本机浏览器，不上传、不同步。</p>
  </header>

  <section class="block block-methods">
    <h2>携带判断四问法</h2>
    <table class="grid card-table">
      <thead>
        <tr>
          <th scope="col">情境</th>
          <th scope="col">结论</th>
          <th scope="col">说明</th>
        </tr>
      </thead>
      <tbody>
${renderMethodRows()}
      </tbody>
    </table>
  </section>

  <section class="block block-items">
    <h2>${packingItems.length} 项物品清单</h2>
    <p class="block-note">${packingItems.length} 项按需选择，不是必买清单；建议数量为首周参考，请按本人行李额度和实际需要取舍。</p>

    <div class="filters">
      <div class="filter-row">
        <span class="filter-label" id="filter-strategy-label">策略</span>
        <div role="group" aria-labelledby="filter-strategy-label" class="filter-row">
${renderStrategyChips()}
        </div>
      </div>
      <div class="filter-row">
        <span class="filter-label" id="filter-audience-label">视角</span>
        <div role="group" aria-labelledby="filter-audience-label" class="filter-row">
${renderAudienceChips()}
        </div>
      </div>
      <div class="filter-row">
        <span class="filter-label" id="filter-category-label">分类</span>
        <div role="group" aria-labelledby="filter-category-label" class="filter-row">
${renderCategoryChips()}
        </div>
      </div>
      <div class="filter-row">
        <span class="filter-label" id="filter-extra-label">快捷</span>
        <div role="group" aria-labelledby="filter-extra-label" class="filter-row">
          <button type="button" class="chip" aria-pressed="false" data-filter-unchecked>只看未勾选</button>
        </div>
      </div>
      <div class="filter-actions">
        <button type="button" class="btn-clear" data-clear-filters>清除筛选</button>
        <div class="active-filters" id="active-filters" aria-live="polite"></div>
      </div>
    </div>

    <p class="count" aria-live="polite">当前显示 ${packingItems.length} / ${packingItems.length} 项 · 已勾选 0 / ${packingItems.length}</p>
    <p class="empty" role="status" hidden>没有符合当前筛选的物品，请清除筛选后再试。</p>

${renderGroups()}
  </section>

  <section class="block block-spots">
    <h2>采购地点（地图与店铺一览）</h2>
    <p class="block-note">采购点、距离、营业时间与店铺信息整理于 ${packingUpdatedAt}，可能已变化，请以现场为准。</p>
    <figure class="map-figure">
      <img src="data:image/jpeg;base64,${mapBase64}" alt="校园超市位置示意：Uhub（B1 B03）与 MyNews（D6 G01）" loading="lazy">
      <figcaption>校内两处超市位置示意（Uhub B1 B03、MyNews D6 G01）｜底图：校园导览图；如与现场标识不一致，以现场为准。</figcaption>
    </figure>
    <table class="grid card-table">
      <thead>
        <tr>
          <th scope="col">采购点</th>
          <th scope="col">距离</th>
          <th scope="col">营业时间</th>
          <th scope="col">店铺与特点</th>
          <th scope="col">采购建议</th>
        </tr>
      </thead>
      <tbody>
${renderSpotRows()}
      </tbody>
    </table>
  </section>

  <section class="block block-compliance">
    <h2>合规速查（海关 · 航空 · 宿舍 · 药物）</h2>
    <p class="block-note">本区为整理提示，不构成法律意见；携带与申报以航空、海关及学校最新要求为准，不代答个案。</p>
${renderComplianceLayers()}
  </section>

  <section class="block block-firstnight">
    <h2>首晚与床品提示</h2>
    <p class="block-note">床架与床垫尺寸等宿舍信息以学校安排和现场实测为准。</p>
    <ul class="firstnight">
${renderFirstNightNotes()}
    </ul>
  </section>

  <footer class="legal">
    <p>来源与边界：经验内容整理自微信公众号「大马口袋」及家长整理资料；携带、申报与宿舍要求以航空、海关及学校最新规定为准；整理于 ${packingUpdatedAt}，店铺、营业时间与政策可能已变化。</p>
    <p>独立交付版 v1（2026-09-17），由项目数据源自动导出；勾选结果仅保存在本机浏览器，不上传、不同步。打印时筛选与进度栏会自动隐藏。</p>
  </footer>
</main>

<script>
(function () {
  var STORAGE_KEY = "xmum-packing-checks-v1";
  var VIEW_STORAGE_KEY = "xmum-packing-view-v1";
  var rows = Array.prototype.slice.call(document.querySelectorAll("[data-packing-row]"));
  var groups = Array.prototype.slice.call(document.querySelectorAll("[data-group-section]"));
  var chips = Array.prototype.slice.call(document.querySelectorAll("[data-filter-group]"));
  var uncheckedToggle = document.querySelector("[data-filter-unchecked]");
  var clearFiltersBtn = document.querySelector("[data-clear-filters]");
  var activeFiltersEl = document.getElementById("active-filters");
  var countEl = document.querySelector(".count");
  var emptyEl = document.querySelector(".empty");
  var stickyCount = document.getElementById("sticky-count");
  var stickyBar = document.getElementById("sticky-bar");
  var clearBtn = document.getElementById("clear-checks");
  var TOTAL = rows.length;
  var filters = { strategy: "all", audience: "all", category: "all", unchecked: false };
  try {
    var storedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (storedView === "男女通用" || storedView === "女生侧重" || storedView === "男生侧重") {
      filters.audience = storedView;
    }
  } catch (error) {
    filters.audience = "all";
  }
  var checked = {};
  var validIds = {};

  rows.forEach(function (row) { validIds[row.getAttribute("data-packing-row")] = true; });

  function readStored() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeStored() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.keys(checked)));
    } catch (error) {
      return;
    }
  }

  readStored().forEach(function (id) {
    if (typeof id === "string" && validIds[id]) checked[id] = true;
  });

  function checkedCount() { return Object.keys(checked).length; }

  function itemMatches(row) {
    var audience = row.getAttribute("data-audience");
    var strategyOk = filters.strategy === "all" || row.getAttribute("data-group") === filters.strategy;
    var audienceOk = filters.audience === "all" || audience === "男女通用" || audience === filters.audience;
    var categoryOk = filters.category === "all" || row.getAttribute("data-category") === filters.category;
    var checkedOk = !filters.unchecked || !checked[row.getAttribute("data-packing-row")];
    return strategyOk && audienceOk && categoryOk && checkedOk;
  }

  function render() {
    var visible = 0;
    rows.forEach(function (row) {
      var show = itemMatches(row);
      row.hidden = !show;
      if (show) visible += 1;
    });
    groups.forEach(function (section) {
      var groupRows = Array.prototype.slice.call(section.querySelectorAll("[data-packing-row]"));
      var shown = groupRows.filter(function (row) { return !row.hidden; }).length;
      var done = groupRows.filter(function (row) { return checked[row.getAttribute("data-packing-row")]; }).length;
      section.hidden = shown === 0;
      var countNode = section.querySelector("[data-group-count]");
      if (countNode) countNode.textContent = shown + " 项 · 已勾选 " + done + "/" + groupRows.length;
    });
    countEl.textContent = "当前显示 " + visible + " / " + TOTAL + " 项 · 已勾选 " + checkedCount() + " / " + TOTAL;
    emptyEl.hidden = visible > 0;
    stickyCount.textContent = String(checkedCount());
    stickyBar.style.width = (checkedCount() / TOTAL * 100) + "%";
    clearBtn.disabled = checkedCount() === 0;
    renderActiveFilters();
  }

  function syncChips() {
    chips.forEach(function (chip) {
      var group = chip.getAttribute("data-filter-group");
      var value = chip.getAttribute("data-value");
      chip.setAttribute("aria-pressed", filters[group] === value ? "true" : "false");
    });
    if (uncheckedToggle) {
      uncheckedToggle.setAttribute("aria-pressed", filters.unchecked ? "true" : "false");
    }
  }

  function filterLabel(group, value) {
    var chip = document.querySelector('[data-filter-group="' + group + '"][data-value="' + value + '"]');
    return chip ? chip.textContent.trim() : value;
  }

  function resetFilter(key) {
    if (key === "unchecked") {
      filters.unchecked = false;
    } else {
      filters[key] = "all";
      if (key === "audience") {
        try {
          window.localStorage.setItem(VIEW_STORAGE_KEY, "all");
        } catch (error) {
          return;
        }
      }
    }
    syncChips();
    render();
  }

  function renderActiveFilters() {
    if (!activeFiltersEl) return;
    activeFiltersEl.innerHTML = "";
    var entries = [];
    if (filters.strategy !== "all") entries.push({ key: "strategy", label: filterLabel("strategy", filters.strategy) });
    if (filters.audience !== "all") entries.push({ key: "audience", label: filterLabel("audience", filters.audience) });
    if (filters.category !== "all") entries.push({ key: "category", label: filterLabel("category", filters.category) });
    if (filters.unchecked && uncheckedToggle) entries.push({ key: "unchecked", label: uncheckedToggle.textContent.trim() });
    entries.forEach(function (entry) {
      var token = document.createElement("span");
      token.className = "active-filter active-filter-" + entry.key;
      token.textContent = entry.label;
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "active-filter-remove";
      remove.setAttribute("aria-label", "移除筛选：" + entry.label);
      remove.textContent = "×";
      remove.addEventListener("click", function () {
        resetFilter(entry.key);
      });
      token.appendChild(remove);
      activeFiltersEl.appendChild(token);
    });
  }

  function syncCheck(button) {
    var id = button.getAttribute("data-packing-check");
    var isChecked = Boolean(checked[id]);
    button.setAttribute("aria-checked", isChecked ? "true" : "false");
    var row = button.closest("[data-packing-row]");
    if (row) row.classList.toggle("is-checked", isChecked);
  }

  Array.prototype.slice.call(document.querySelectorAll("[data-packing-check]")).forEach(function (button) {
    syncCheck(button);
    button.addEventListener("click", function () {
      var id = button.getAttribute("data-packing-check");
      if (checked[id]) {
        delete checked[id];
      } else {
        checked[id] = true;
      }
      writeStored();
      syncCheck(button);
      render();
    });
  });

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var group = chip.getAttribute("data-filter-group");
      var value = chip.getAttribute("data-value");
      filters[group] = value;
      if (group === "audience") {
        try {
          window.localStorage.setItem(VIEW_STORAGE_KEY, value);
        } catch (error) {
          filters[group] = value;
        }
      }
      syncChips();
      render();
    });
  });

  if (uncheckedToggle) {
    uncheckedToggle.addEventListener("click", function () {
      filters.unchecked = !filters.unchecked;
      syncChips();
      render();
    });
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", function () {
      filters = { strategy: "all", audience: "all", category: "all", unchecked: false };
      try {
        window.localStorage.setItem(VIEW_STORAGE_KEY, "all");
      } catch (error) {
        filters.audience = "all";
      }
      syncChips();
      render();
    });
  }

  clearBtn.addEventListener("click", function () {
    checked = {};
    writeStored();
    Array.prototype.slice.call(document.querySelectorAll("[data-packing-check]")).forEach(syncCheck);
    render();
  });

  syncChips();
  render();
})();
</script>
</body>
</html>
`;
}

assertParity();

mkdirSync(path.dirname(outputFile), { recursive: true });
writeFileSync(outputFile, buildHtml(), "utf8");

console.log(`[export-packing] 已生成 ${outputFile}`);
console.log(
  `[export-packing] 条目 ${packingItems.length} · 分组 ${packingGroups.length} · 分类 ${packingCategories.length} · 四问法 ${packingMethods.length} · 采购点 ${shoppingSpots.length} · 合规 ${complianceRules.length} · 成分 ${controlledIngredients.length} · 首晚 ${firstNightNotes.length}`,
);
