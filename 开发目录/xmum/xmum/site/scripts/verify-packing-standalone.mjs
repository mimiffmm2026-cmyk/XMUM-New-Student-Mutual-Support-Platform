import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const outputFile = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(os.homedir(), "Desktop", "行李准备清单.html");
const outputUrl = pathToFileURL(outputFile).href;
const cdpBaseUrl = (process.env.CDP_URL ?? "http://127.0.0.1:9344").replace(/\/$/, "");
const axeSource = await readFile(
  path.join(projectRoot, "node_modules", "axe-core", "axe.min.js"),
  "utf8",
);

await access(outputFile);

// ---------- 静态审计：数据完整性、发布边界、样式能力 ----------
{
  const html = await readFile(outputFile, "utf8");
  const count = (pattern) => (html.match(pattern) ?? []).length;

  assert.equal(count(/data-packing-row="/g), 67, "必须包含 67 个物品行");
  assert.equal(count(/data-packing-check="/g), 67, "必须包含 67 个勾选控件");
  assert.equal(count(/data-group-section="/g), 4, "必须包含 4 个策略分组");
  assert.equal(count(/role="checkbox"/g), 67, "勾选控件必须使用 checkbox 语义");
  assert.equal(count(/aria-checked="false"/g), 67, "静态文件初始必须全部未勾选");
  assert.equal(count(/(?<!\[)aria-checked="true"/g), 0, "静态文件不得预置勾选状态");
  assert.equal(count(/data-label="情境"/g), 4, "四问法必须为 4 行");
  assert.equal(count(/data-label="采购点"/g), 6, "采购点必须为 6 档");
  assert.equal(count(/data-label="整理提示"/g), 13, "合规条目必须为 13 条");
  assert.equal(count(/data-label="受控成分"/g), 6, "受控成分必须为 6 类");
  assert.equal(count(/<li>/g), 6, "首晚提示必须为 6 条");

  assert.doesNotMatch(html, /https?:\/\//i, "不得包含外链");
  assert.equal((html.match(/<img\b/g) ?? []).length, 1, "只允许一张内嵌改绘地图");
  assert.match(html, /src="data:image\/jpeg;base64,/, "地图必须内嵌为数据 URI");
  assert.doesNotMatch(html, /\/images\/packing\//, "不得保留外部图片路径");
  const htmlWithoutImages = html.replace(
    /data:image\/jpeg;base64,[A-Za-z0-9+/=]+/g,
    "data:image/jpeg;base64,…",
  );
  assert.doesNotMatch(htmlWithoutImages, /\d+\s*kg/i, "不得出现个人重量额度");
  assert.doesNotMatch(html, />P\d{2}[\s<]/, "列表不得显示 Pxx 编号");

  assert.match(html, /微信公众号「大马口袋」/, "缺少署名");
  assert.match(html, /仅供参考/, "缺少仅供参考说明");
  assert.match(html, /以航空、海关及学校最新规定为准/, "缺少官方为准说明");
  assert.match(html, /整理于 2026\.09/, "缺少整理时点");
  assert.match(html, /仅保存在本机浏览器，不上传、不同步/, "缺少本机存储说明");
  assert.match(html, /独立交付版 v1/, "缺少版本标识");
  assert.match(html, /id="active-filters"/, "缺少筛选令牌容器");
  assert.match(html, /女生视角/, "缺少视角预设标签");
  assert.match(html, /packing-verdict-go/, "缺少结论语义色");
  assert.match(html, /packing-priority-essential/, "缺少优先级色码");
  assert.match(html, /packing-distance-near/, "缺少距离色阶");

  assert.match(html, /@media \(max-width: 820px\)/, "缺少移动端适配");
  assert.match(html, /@media print/, "缺少打印适配");
  assert.match(html, /:focus-visible/, "缺少键盘焦点样式");
  console.log("[verify-packing] 静态审计通过：67 项 / 4 分组 / 4 四问法 / 6 采购点 / 13 合规 / 6 成分 / 6 首晚");
}

// ---------- CDP 连接 ----------
async function fetchJson(url, options) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

let target;
try {
  target = await fetchJson(
    `${cdpBaseUrl}/json/new?${encodeURIComponent("about:blank")}`,
    { method: "PUT" },
  );
} catch (error) {
  throw new Error(`无法连接浏览器调试端口 ${cdpBaseUrl}。请先启动专用 CDP 浏览器。\n${error}`);
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let commandId = 0;

function send(method, params = {}) {
  const id = ++commandId;
  const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  socket.send(JSON.stringify({ id, method, params }));
  return Promise.race([
    result,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`CDP 命令超时：${method}`)), 60000),
    ),
  ]);
}

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  if (message.error) handler.reject(new Error(message.error.message));
  else handler.resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, description, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error(`等待超时：${description}`);
}

async function runAxe(label) {
  const violations = await evaluate(
    `axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] }
    }).then((result) => result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length
    })))`,
  );
  assert.deepEqual(violations, [], `${label} WCAG 2 A/AA 不得有违规项`);
}

async function captureScreenshot(name) {
  const artifactDirectory = process.env.PACKING_ARTIFACT_DIR;
  if (!artifactDirectory) return;
  await mkdir(artifactDirectory, { recursive: true });
  const result = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(artifactDirectory, name), result.data, "base64");
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: outputUrl });
  await waitFor(
    `document.readyState === "complete" && Boolean(document.querySelector("[data-packing-row]"))`,
    "独立清单页面加载",
  );
  console.log("[verify-packing] 页面加载完成，开始交互检查");

  await evaluate(
    `(() => { try { localStorage.removeItem("xmum-packing-checks-v1"); } catch { return false; } return true; })()`,
  );
  await send("Page.reload");
  await waitFor(
    `document.readyState === "complete" && Boolean(document.querySelector("[data-packing-row]"))`,
    "重置本机勾选后刷新",
  );
  await send("Runtime.evaluate", { expression: axeSource });

  const visibleRows = () =>
    evaluate(
      `[...document.querySelectorAll("[data-packing-row]")]
        .filter((row) => row.getBoundingClientRect().height > 0).length`,
    );
  const visibleGroups = () =>
    evaluate(
      `[...document.querySelectorAll("[data-group-section]")]
        .filter((section) => section.getBoundingClientRect().height > 0)
        .map((section) => section.dataset.groupSection)`,
    );
  const clickFilter = (group, value) =>
    evaluate(`(() => {
      const chip = document.querySelector('[data-filter-group="${group}"][data-value="${value}"]');
      if (!chip) return false;
      chip.click();
      return true;
    })()`);

  assert.equal(await visibleRows(), 67, "初始必须显示全部 67 项");
  assert.deepEqual(await visibleGroups(), ["carry", "domestic", "buyonsite", "skip"]);
  assert.match(
    await evaluate(`document.querySelector(".count")?.textContent ?? ""`),
    /当前显示 67 \/ 67 项 · 已勾选 0 \/ 67/,
  );
  assert.equal(
    await evaluate(`document.getElementById("clear-checks")?.disabled`),
    true,
    "无勾选时清空按钮应禁用",
  );

  assert.equal(await clickFilter("strategy", "carry"), true);
  assert.equal(await visibleRows(), 14, "随身携带应为 14 项");
  assert.equal(await clickFilter("audience", "女生侧重"), true);
  assert.equal(await visibleRows(), 14, "随身携带与人群筛选叠加后仍为 14 项");
  assert.equal(await clickFilter("strategy", "all"), true);
  assert.equal(await visibleRows(), 66, "女生侧重视角应为 66 项");
  assert.equal(await clickFilter("audience", "all"), true);
  assert.equal(await clickFilter("category", "care"), true);
  assert.equal(await visibleRows(), 14, "洗护与健康应为 14 项");
  assert.equal(await clickFilter("strategy", "carry"), true);
  assert.equal(await visibleRows(), 1, "随身携带与洗护健康交集应为 1 项");
  assert.equal(await clickFilter("category", "clothing"), true);
  assert.equal(await visibleRows(), 0, "随身携带与衣物交集应为空");
  assert.equal(
    await evaluate(`(() => {
      const empty = document.querySelector(".empty");
      return Boolean(empty) && empty.getBoundingClientRect().height > 0;
    })()`),
    true,
    "空结果必须显示空状态",
  );
  await evaluate(`document.querySelector("[data-clear-filters]")?.click()`);
  assert.equal(await visibleRows(), 67, "清除筛选后恢复全部");

  await clickFilter("strategy", "carry");
  await waitFor(`Boolean(document.querySelector(".active-filter"))`, "筛选令牌出现");
  assert.equal(
    await evaluate(
      `document.querySelector(".active-filter")?.textContent?.includes("随身携带") === true`,
    ),
    true,
    "令牌应显示所选筛选",
  );
  await evaluate(`document.querySelector(".active-filter-remove")?.click()`);
  await waitFor(`!document.querySelector(".active-filter")`, "移除令牌后恢复默认");
  assert.equal(await visibleRows(), 67);

  await clickFilter("audience", "女生侧重");
  await waitFor(
    `document.querySelector('[data-filter-group="audience"][data-value="女生侧重"]')?.getAttribute("aria-pressed") === "true"`,
    "视角切换生效",
  );
  assert.equal(await visibleRows(), 66, "女生视角应为 66 项");
  await send("Page.reload");
  await waitFor(
    `document.readyState === "complete" && Boolean(document.querySelector("[data-packing-row]"))`,
    "刷新后重新加载",
  );
  await send("Runtime.evaluate", { expression: axeSource });
  await waitFor(
    `document.querySelector('[data-filter-group="audience"][data-value="女生侧重"]')?.getAttribute("aria-pressed") === "true"`,
    "刷新后记住女生视角",
  );
  assert.equal(await visibleRows(), 66, "刷新后仍为女生视角");
  await clickFilter("audience", "all");
  assert.equal(await visibleRows(), 67, "恢复全部视角");

  const checkState = (id) =>
    evaluate(
      `document.querySelector('[data-packing-check="${id}"]')?.getAttribute("aria-checked")`,
    );
  assert.equal(
    await evaluate(`(() => {
      const button = document.querySelector('[data-packing-check="P01"]');
      button?.click();
      return Boolean(button);
    })()`),
    true,
  );
  await waitFor(
    `document.querySelector('[data-packing-check="P01"]')?.getAttribute("aria-checked") === "true"`,
    "勾选首项生效",
  );
  assert.match(
    await evaluate(`document.querySelector(".count")?.textContent ?? ""`),
    /已勾选 1 \/ 67/,
  );
  assert.equal(
    await evaluate(`document.getElementById("sticky-count")?.textContent`),
    "1",
    "顶部进度应同步",
  );
  assert.equal(
    await evaluate(`document.getElementById("clear-checks")?.disabled`),
    false,
  );

  await evaluate(`document.querySelector("[data-filter-unchecked]")?.click()`);
  await waitFor(
    `[...document.querySelectorAll("[data-packing-row]")]
      .filter((row) => row.getBoundingClientRect().height > 0).length === 66`,
    "只看未勾选应隐藏已勾选条目",
  );
  await evaluate(`document.querySelector("[data-filter-unchecked]")?.click()`);
  assert.equal(await visibleRows(), 67);

  await send("Page.reload");
  await waitFor(
    `document.readyState === "complete" && Boolean(document.querySelector("[data-packing-row]"))`,
    "刷新后重新加载",
  );
  await send("Runtime.evaluate", { expression: axeSource });
  await waitFor(
    `document.querySelector('[data-packing-check="P01"]')?.getAttribute("aria-checked") === "true"`,
    "刷新后本机勾选状态恢复",
  );
  console.log("[verify-packing] 勾选持久化通过");

  await runAxe("独立清单页面");
  await captureScreenshot("packing-standalone-desktop.png");

  await evaluate(`document.getElementById("clear-checks")?.click()`);
  await waitFor(
    `document.querySelector('[data-packing-check="P01"]')?.getAttribute("aria-checked") === "false"`,
    "清空勾选恢复未勾选",
  );
  assert.equal(await checkState("P01"), "false");

  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await evaluate(`window.scrollTo({ top: 0, behavior: "instant" })`);
  const mobile = await evaluate(`(() => {
    const elements = [...document.querySelectorAll(
      "a, button, select, input:not([type='file']), summary"
    )]
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.bottom > 0);
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      smallTargets: elements
        .filter(({ rect }) => rect.width < 44 || rect.height < 44)
        .map(({ element, rect }) => ({
          label: element.textContent.trim().slice(0, 30),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }))
    };
  })()`);
  assert.equal(mobile.overflow, false, "390px 不得出现横向溢出");
  assert.deepEqual(mobile.smallTargets, [], "移动端交互目标须至少 44×44px");
  await runAxe("独立清单移动端");
  await captureScreenshot("packing-standalone-mobile.png");

  console.log("[verify-packing] 交互、可访问性与移动端审计全部通过");
} finally {
  socket.close();
}
