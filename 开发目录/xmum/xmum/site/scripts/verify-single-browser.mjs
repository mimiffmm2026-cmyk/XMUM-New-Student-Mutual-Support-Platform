import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const outputFile = path.join(projectRoot, "export-single", "index.html");
const outputUrl = pathToFileURL(outputFile).href;
const cdpBaseUrl = (process.env.CDP_URL ?? "http://127.0.0.1:9344").replace(/\/$/, "");
const axeSource = await readFile(
  path.join(projectRoot, "node_modules", "axe-core", "axe.min.js"),
  "utf8",
);

await access(outputFile);

async function fetchJson(url, options) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
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
  throw new Error(
    `无法连接浏览器调试端口 ${cdpBaseUrl}。请先启动专用 CDP 浏览器，再重试。\n${error}`,
  );
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const runtimeErrors = [];
const networkErrors = [];
const webRequests = [];
let commandId = 0;

function closeSocket() {
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    socket.close();
  }
}

function send(method, params = {}) {
  const id = ++commandId;
  const result = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
  socket.send(JSON.stringify({ id, method, params }));
  let timer = 0;
  return Promise.race([
    result.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`CDP 命令超时：${method}`)),
        60000,
      );
    }),
  ]);
}

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
    return;
  }

  if (message.method === "Runtime.exceptionThrown") {
    runtimeErrors.push(message.params.exceptionDetails.text);
  }
  if (
    message.method === "Runtime.consoleAPICalled" &&
    ["error", "warning"].includes(message.params.type)
  ) {
    const text = message.params.args
      .map((argument) => argument.value ?? argument.description ?? "")
      .join(" ");
    if (!/Setting up fake worker/.test(text)) {
      runtimeErrors.push(`console.${message.params.type}: ${text}`);
    }
  }
  if (
    message.method === "Log.entryAdded" &&
    ["error", "warning"].includes(message.params.entry.level) &&
    !/Refused to cross-origin redirects of the top-level worker script/.test(
      message.params.entry.text,
    )
  ) {
    runtimeErrors.push(message.params.entry.text);
  }
  if (
    message.method === "Network.requestWillBeSent" &&
    /^https?:\/\//i.test(message.params.request.url)
  ) {
    webRequests.push(message.params.request.url);
  }
  if (
    message.method === "Network.loadingFailed" &&
    !message.params.canceled
  ) {
    networkErrors.push(message.params.errorText);
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

async function evaluate(expression) {
  let timer = 0;
  const result = await Promise.race([
    send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }),
    new Promise((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `Runtime.evaluate 超时：${expression.replace(/\s+/g, " ").slice(0, 80)}`,
            ),
          ),
        30000,
      );
    }),
  ]).finally(() => clearTimeout(timer));
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitFor(expression, description, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
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
  const artifactDirectory = process.env.SINGLE_BROWSER_ARTIFACT_DIR;
  if (!artifactDirectory) return;
  await mkdir(artifactDirectory, { recursive: true });
  const result = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(path.join(artifactDirectory, name), result.data, "base64");
}

async function captureElementScreenshot(name, selector) {
  const artifactDirectory = process.env.SINGLE_BROWSER_ARTIFACT_DIR;
  if (!artifactDirectory) return;
  await mkdir(artifactDirectory, { recursive: true });
  const clip = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: window.scrollX + rect.left,
      y: window.scrollY + rect.top,
      width: rect.width,
      height: rect.height,
      scale: 1
    };
  })()`);
  if (!clip) throw new Error(`找不到截图元素：${selector}`);
  const result = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    fromSurface: true,
    clip,
  });
  await writeFile(path.join(artifactDirectory, name), result.data, "base64");
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const staleClock = await send("Page.addScriptToEvaluateOnNewDocument", { source: `{
    const NativeDate = Date;
    const startedAt = NativeDate.now();
    const start = NativeDate.parse("2026-11-04T23:59:50+08:00");
    const now = () => window.__xmumTestNow ?? start + NativeDate.now() - startedAt;
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [now()])); }
      static now() { return now(); }
    };
  }` });
  await send("Page.navigate", { url: outputUrl });
  await waitFor(`document.readyState === "complete" && document.querySelector(".timeline-state-past") !== null`,
    "客户端首次日期计算完成");
  assert.equal(await evaluate(`document.querySelectorAll("#accommodation .accommodation-freshness-stale, #knowledge .accommodation-freshness-stale").length`),
    0, "住宿资料在第 30 天仍不应提前标记过期");
  await waitFor(`document.querySelectorAll("#accommodation .accommodation-freshness-stale").length === 4`,
    "页面保持打开跨过 UTC+8 零点后更新住宿过期提示", 15000);
  assert.equal(await evaluate(`document.querySelectorAll("#knowledge .accommodation-freshness-stale").length`),
    4, "同一住宿资料在知识索引内也应提示需要重新核对");
  assert.equal(await evaluate(`document.querySelector("[data-knowledge-entry='campus-international-student-insurance'] .accommodation-freshness-stale") !== null`),
    false, "住宿的 30 天规则不应套用到保险资料");
  await evaluate(`window.__xmumTestNow = Date.parse("2026-11-04T12:00:00+08:00"); document.dispatchEvent(new Event("visibilitychange"))`);
  await waitFor(`document.querySelectorAll("#accommodation .accommodation-freshness-stale, #knowledge .accommodation-freshness-stale").length === 0`,
    "页面恢复时重新核对系统日期");
  await evaluate(`window.__xmumTestNow = Date.parse("2026-11-05T12:00:00+08:00"); window.dispatchEvent(new Event("focus"))`);
  await waitFor(`document.querySelectorAll("#accommodation .accommodation-freshness-stale, #knowledge .accommodation-freshness-stale").length === 8`,
    "跨日后切回页面同步刷新专题与索引");
  await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: staleClock.identifier });
  await send("Page.navigate", { url: outputUrl });
  await waitFor(
    `document.readyState === "complete" && Boolean(document.querySelector("#contact"))`,
    "单文件页面完成加载",
  );
  console.log("[single-browser] 页面加载完成，开始静态与交互检查");

  // Quick-progress links target content in the process section. The stage
  // disclosures must open themselves, while the material panel must be visible.
  for (const [label, target] of [
    ["刚收到录取", "#guide-stage-01"],
    ["准备签证材料", "#visa-materials"],
    ["材料费用已完成", "#guide-stage-03"],
  ]) {
    await evaluate(`document.querySelector("#timeline")?.open && document.querySelector("#timeline > summary")?.click()`);
    await waitFor(`document.querySelector("#timeline")?.open === false`, "收起时间轴以测试快速进度入口");
    await evaluate(`(() => {
      const button = [...document.querySelectorAll(".progress-options button")]
        .find((candidate) => candidate.textContent?.trim() === ${JSON.stringify(label)});
      button?.click();
    })()`);
    await waitFor(
      `document.querySelector(".progress-next a")?.getAttribute("href") === ${JSON.stringify(target)}`,
      `快速进度切换到${label}`,
    );
    await evaluate(`document.querySelector(".progress-next a")?.click()`);
    const targetVisibility = target.startsWith("#guide-stage-")
      ? `document.querySelector(${JSON.stringify(target)})?.open === true`
      : `(() => {
          const element = document.querySelector(${JSON.stringify(target)});
          const rect = element?.getBoundingClientRect();
          return Boolean(element && rect && rect.width > 0 && rect.height > 0);
        })()`;
    await waitFor(
      `location.hash === ${JSON.stringify(target)} && ${targetVisibility}`,
      `快速进度入口显示目标：${label}`,
    );
    if (target.startsWith("#guide-stage-")) {
      await evaluate(`(() => {
        const stage = document.querySelector(${JSON.stringify(target)});
        if (stage instanceof HTMLDetailsElement) stage.open = false;
      })()`);
      await waitFor(
        `document.querySelector(${JSON.stringify(target)})?.open === false`,
        `手动收起${label}阶段`,
      );
      await evaluate(`document.querySelector(".progress-next a")?.click()`);
      await waitFor(
        `location.hash === ${JSON.stringify(target)} && document.querySelector(${JSON.stringify(target)})?.open === true`,
        `同一锚点再次点击后重开：${label}`,
      );
    }
  }
  await evaluate(`(() => {
    document.querySelectorAll(".stage-card").forEach((details) => { details.open = false; });
    const timeline = document.querySelector("#timeline");
    if (timeline instanceof HTMLDetailsElement) timeline.open = false;
  })()`);
  await waitFor(`document.querySelector("#timeline")?.open === false`, "恢复时间轴默认折叠状态");

  await send("Runtime.evaluate", { expression: axeSource });

  const initial = await evaluate(`(() => ({
    protocol: location.protocol,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    footerInsideMain: Boolean(document.querySelector("main footer")),
    brandName: document.querySelector(".brand strong")?.textContent.trim(),
    nonOfficial: document.body.innerText.includes("非学校官网"),
    publicRelease: /公开版/.test(document.body.innerText),
    signaturePresent: document.body.innerText.includes("湖南新同学收集整理"),
    controlledPreviewCount: (document.body.innerText.match(/受控预览/g) ?? []).length,
    nonOfficialCount: (document.body.innerText.match(/非学校官网/g) ?? []).length,
    webHrefs: [...document.querySelectorAll('a[href^="http://"], a[href^="https://"]')]
      .map((anchor) => anchor.href),
    invalidHrefs: [...document.querySelectorAll("a[href]")]
      .map((anchor) => anchor.getAttribute("href") ?? "")
      .filter((href) => {
        if (href.startsWith("tel:")) {
          const phone = href.slice(4);
          return phone.length === 0 ||
            [...phone].some((character) => !"0123456789+ ()-".includes(character));
        }
        if (!href.startsWith("#")) return true;
        return href.length === 1 || !document.getElementById(href.slice(1));
      }),
    headingSkip: [...document.querySelectorAll("h1, h2, h3")]
      .map((heading) => Number(heading.tagName.slice(1)))
      .some((level, index, levels) => index > 0 && level > levels[index - 1] + 1),
    faqDisabled: !document.querySelector("#faq, [name='faq-query'], a[href='#faq']") &&
      !document.body.innerText.includes("用你的话，直接搜") &&
      !document.documentElement.innerHTML.includes("学校组织大学英语四、六级考试吗？"),
    contactNavCount: document.querySelectorAll('a[href="#contact"]').length,
    primaryPathOrdered: (() => {
      const selectors = [
        "#quick",
        "#guide",
        "#contact",
        "#emergency",
        "#life",
        "#official",
        "#source-policy"
      ];
      const elements = selectors.map((selector) => document.querySelector(selector));
      return elements.every(Boolean) && elements.every((element, index) =>
        index === elements.length - 1 ||
        Boolean(element.compareDocumentPosition(elements[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
    })(),
    robots: document.querySelector('meta[name="robots"]')?.content ?? ""
  }))()`);
  assert.equal(initial.protocol, "file:");
  assert.equal(initial.overflow, false);
  assert.equal(initial.footerInsideMain, false);
  assert.match(initial.brandName ?? "", /新生|互助|导航/);
  assert.equal(initial.nonOfficial, true);
  assert.equal(initial.publicRelease, true);
  assert.equal(initial.signaturePresent, true);
  assert.equal(initial.controlledPreviewCount, 0, "公开版本不得残留“受控预览”提示");
  assert.ok(initial.nonOfficialCount <= 2, "“非学校官网”可见次数不得超过 2");
  assert.deepEqual(initial.webHrefs, []);
  assert.deepEqual(initial.invalidHrefs, [], "全部链接必须是有效页内锚点或 tel: 电话");
  assert.equal(initial.headingSkip, false, "标题层级不得跨级");
  assert.equal(initial.faqDisabled, true, "问答入口、组件和问答正文必须从公开单文件移除");
  assert.ok(initial.contactNavCount >= 2, "桌面和移动导航应以联络与群组入口替代问答");
  assert.equal(initial.primaryPathOrdered, true, "主路径必须排在辅助规则与紧急参考之前");
  assert.match(initial.robots, /\bindex\b/i);
  assert.match(initial.robots, /\bfollow\b/i);
  assert.doesNotMatch(initial.robots, /\bnoindex\b|\bnofollow\b/i);

  const knowledgeCollapsed = await evaluate(`(() => {
    const details = document.querySelector("#knowledge");
    return Boolean(details) && details.open === false;
  })()`);
  assert.equal(knowledgeCollapsed, true, "知识资料索引默认折叠");
  await evaluate(`document.querySelector(".knowledge-entry-link")?.click()`);
  await waitFor(`location.hash === "#knowledge" && document.querySelector("[name='knowledge-query']")?.checkVisibility() === true`,
    "首页入口展开知识资料索引");
  await evaluate(`window.__knowledgeBeforeReload = true`);
  await send("Page.reload");
  await waitFor(`document.readyState === "complete" && !window.__knowledgeBeforeReload && document.querySelector("[name='knowledge-query']")?.checkVisibility() === true`,
    "刷新知识索引锚点后搜索框仍可见");
  await send("Page.navigate", { url: "about:blank" });
  await waitFor(`location.href === "about:blank"`, "离开单文件页面");
  await send("Page.navigate", { url: `${outputUrl}#knowledge` });
  await waitFor(`document.readyState === "complete" && document.querySelector("[name='knowledge-query']")?.checkVisibility() === true`,
    "直接打开知识索引锚点");
  await send("Runtime.evaluate", { expression: axeSource });
  await evaluate(`location.hash = "life"; document.querySelector("#knowledge > summary")?.click()`);
  await waitFor(`document.querySelector("#knowledge")?.open === false`, "手动收起知识索引");
  await evaluate(`location.hash = "knowledge"`);
  await waitFor(`document.querySelector("[name='knowledge-query']")?.checkVisibility() === true`,
    "页内锚点改变后重新展开知识索引");
  await evaluate(`location.hash = "accommodation"`);
  await waitFor(`document.querySelector("#accommodation")?.open === true`, "住宿锚点展开原专题");
  await evaluate(`document.querySelector("#accommodation > summary")?.click(); location.hash = "%E0%A4%A"`);
  await waitFor(`location.hash === "#%E0%A4%A"`, "错误编码的锚点不影响页面");
  await evaluate(`location.hash = "knowledge"`);
  const knowledgeInitial = await evaluate(`(() => ({
    entries: document.querySelectorAll("[data-knowledge-entry]").length,
    feedback: Boolean(document.querySelector(".feedback-draft")),
    localOnly: document.querySelector("#feedback-boundary")?.textContent?.includes("不会自动提交") === true,
  }))()`);
  assert.equal(knowledgeInitial.entries, 29, "知识索引默认应显示 29 条资料");
  assert.equal(knowledgeInitial.feedback, true);
  assert.equal(knowledgeInitial.localOnly, true);
  await evaluate(`(() => {
    const input = document.querySelector("input[name='knowledge-query']");
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "英语单科");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
  await waitFor(
    `document.querySelectorAll("[data-knowledge-entry]").length === 1 && document.querySelector("[data-knowledge-entry='pdf-admission-eligibility']") !== null`,
    "知识索引关键词筛选",
  );
  for (const [query, entryId, expectedText] of [
    ["Bell Suites @ Sunsuria City", "accommodation-bell-suites", "2026-10-05"],
    ["Horizon Suites, KLIA", "accommodation-horizon-suites", "仅项目资料，暂不推荐"],
    ["Etiqa", "campus-international-student-insurance", "2026-10-04"],
    ["6周", "stage-02", "签证审批时间无法保证"],
    ["私自入境", "stage-04", "最终航班日期和接机方式"],
    ["三个学期", "pdf-academic-calendar", "招生手册p8 FAQ"],
    ["转专业", "pdf-transfer-policy", "《厦大马校2026招生手册(1).pdf》p8"],
    ["校园卡", "student-card-replacement", "B1-109"],
    ["Lost ID Form", "student-card-replacement", "未标修订日期"],
  ]) {
    await evaluate(`(() => {
      const input = document.querySelector("input[name='knowledge-query']");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, ${JSON.stringify(query)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
    })()`);
    const entrySelector = `[data-knowledge-entry="${entryId}"]`;
    await waitFor(
      `Boolean(document.querySelector(${JSON.stringify(entrySelector)}))`,
      `知识索引搜索 ${query}`,
    );
    const entryText = await evaluate(
      `document.querySelector(${JSON.stringify(entrySelector)})?.textContent ?? ""`,
    );
    assert.ok(entryText.includes(expectedText), `${query} 必须保留专题日期或候选边界`);
  }
  await evaluate(`(() => {
    const input = document.querySelector("input[name='knowledge-query']");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  for (const [audience, expectedCount] of [["新生", 21], ["家长", 19], ["共同", 11]]) {
    await evaluate(`(() => {
      const select = document.querySelector("select[name='knowledge-audience']");
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, ${JSON.stringify(audience)});
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(`document.querySelectorAll("[data-knowledge-entry]").length === ${expectedCount}`,
      `知识索引 ${audience} 筛选包含共同适用资料`);
    assert.equal(await evaluate(`Boolean(document.querySelector("[data-knowledge-entry='campus-international-student-insurance']"))`),
      true, `${audience}筛选必须保留保险资料`);
  }
  await evaluate(`(() => {
    const input = document.querySelector("input[name='knowledge-query']");
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const select = document.querySelector("select[name='knowledge-category']");
    if (!(select instanceof HTMLSelectElement)) return false;
    const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    selectSetter?.call(select, "校园生活");
    select.dispatchEvent(new Event("change", { bubbles: true }));
    const audience = document.querySelector("select[name='knowledge-audience']");
    selectSetter?.call(audience, "全部");
    audience.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  await waitFor(
    `document.querySelectorAll("[data-knowledge-entry]").length === 9`,
    "知识索引分类筛选",
  );
  await evaluate(`document.querySelector(".feedback-draft > summary")?.click()`);
  await waitFor(`document.querySelector(".feedback-draft")?.open === true`, "展开本地反馈草稿");
  await evaluate(`(() => {
    const textarea = document.querySelector("textarea[aria-describedby='feedback-boundary']");
    if (!(textarea instanceof HTMLTextAreaElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, "需要重新核对截止日期");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
  await waitFor(
    `document.querySelector("#feedback-preview")?.value.includes("需要重新核对截止日期") === true`,
    "生成本地反馈草稿",
  );
  const feedbackPreview = await evaluate(`document.querySelector("#feedback-preview")?.value`);
  assert.match(feedbackPreview, /索引最近整理日期：2026-10-30/);
  assert.match(feedbackPreview, /各条资料的核对时点见对应条目/);
  assert.doesNotMatch(feedbackPreview, /资料核对至：/);
  // Use a disposable clipboard double so tests never modify the user's clipboard.
  await evaluate(`(() => {
    window.__feedbackClipboard = {
      original: Object.getOwnPropertyDescriptor(navigator, "clipboard"),
      calls: [], pending: [], mode: "success",
    };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText(text) {
        const state = window.__feedbackClipboard;
        state.calls.push(text);
        if (state.mode === "failure") return Promise.reject(new Error("Synthetic denial"));
        if (state.mode === "pending") return new Promise((resolve, reject) => state.pending.push({ resolve, reject }));
        return Promise.resolve();
      },
    }});
    document.querySelector(".feedback-draft .button")?.click();
  })()`);
  await waitFor(
    `document.querySelector(".feedback-copy-status")?.textContent?.includes("草稿已复制") === true`,
    "反馈草稿复制成功",
  );
  assert.equal(await evaluate(`window.__feedbackClipboard.calls[0]`),
    await evaluate(`document.querySelector("#feedback-preview")?.value`), "应复制完整的当前草稿");
  await evaluate(`window.__feedbackClipboard.mode = "failure"; document.querySelector(".feedback-draft .button")?.click()`);
  await waitFor(`document.querySelector(".feedback-copy-status")?.textContent?.includes("自动复制失败") === true`,
    "反馈复制失败的手动复制提示");
  assert.equal(await evaluate(`(() => {
    const preview = document.querySelector("#feedback-preview");
    return document.activeElement === preview && preview.selectionStart === 0 && preview.selectionEnd === preview.value.length;
  })()`), true, "复制失败应聚焦并选中完整草稿");
  for (const outcome of ["resolve", "reject"]) {
    await evaluate(`(() => {
      window.__feedbackClipboard.mode = "pending";
      document.querySelector(".feedback-draft .button")?.click();
    })()`);
    await waitFor(`window.__feedbackClipboard.pending.length === 1`, "等待延迟的复制请求");
    await evaluate(`(() => {
      ${outcome === "resolve" ? `
        const textarea = document.querySelector("textarea[aria-describedby='feedback-boundary']");
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, "复制期间编辑内容");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      ` : `
        const select = document.querySelector(".feedback-draft select");
        select.focus();
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, "补充");
        select.dispatchEvent(new Event("change", { bubbles: true }));
      `}
    })()`);
    await waitFor(`document.querySelector("#feedback-preview")?.value.includes(${JSON.stringify(outcome === "resolve" ? "复制期间编辑内容" : "补充")}) === true && document.querySelector(".feedback-copy-status")?.textContent === ""`,
      "编辑后更新草稿并清除旧复制结果");
    await evaluate(`window.__feedbackClipboard.pending.shift().${outcome}()`);
    await evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    assert.equal(await evaluate(`document.querySelector(".feedback-copy-status")?.textContent`), "",
      `旧草稿的复制${outcome === "resolve" ? "成功" : "失败"}不得覆盖编辑后的状态`);
    if (outcome === "reject") {
      assert.equal(await evaluate(`document.activeElement === document.querySelector(".feedback-draft select")`),
        true, "旧请求失败不得抢走正在编辑的焦点");
    }
  }
  await evaluate(`(() => {
    const original = window.__feedbackClipboard.original;
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else delete navigator.clipboard;
    delete window.__feedbackClipboard;
  })()`);
  await runAxe("桌面端");
  await captureScreenshot("single-desktop.png");

  const desktopOfficial = await evaluate(`(() => {
    const section = document.querySelector("#official");
    const rect = section?.getBoundingClientRect();
    const text = section?.innerText ?? "";
    return {
      width: rect?.width ?? 0,
      hasWelcomeDomain: text.includes("yx.xmu.edu.my"),
      hasAdmissionsDomain: text.includes("zs.xmu.edu.cn"),
      hasWebLink: Boolean(section?.querySelector('a[href^="http://"], a[href^="https://"]'))
    };
  })()`);
  assert.ok(desktopOfficial.width > 0);
  assert.equal(desktopOfficial.hasWelcomeDomain, true);
  assert.equal(desktopOfficial.hasAdmissionsDomain, true);
  assert.equal(desktopOfficial.hasWebLink, false);
  await captureElementScreenshot("single-desktop-official.png", "#official");

  const defaultVisibleRules = await evaluate(`(() => {
    const text = (selector) => document.querySelector(selector)?.innerText ?? "";
    const stageSummary = (title) => [...document.querySelectorAll(".stage-card")]
      .find((details) => details.querySelector(".stage-title")?.textContent.trim() === title)
      ?.querySelector("summary")?.innerText ?? "";
    const dormDetails = [...document.querySelectorAll(".campus-life-topic")]
      .find((details) => details.querySelector(".campus-life-title strong")?.textContent.trim() === "宿舍生活");
    return {
      contact: text("#contact .contact-intro"),
      program: text(".program-panel .program-rules"),
      stageVisa: stageSummary("签证与英语"),
      stageEntry: stageSummary("出发与入境当天"),
      stageArrival: stageSummary("到校第一周"),
      dorm: dormDetails?.querySelector("summary")?.textContent ?? "",
      closedByDefault: [...document.querySelectorAll(".stage-card, .campus-life-topic")]
        .every((details) => !details.open)
    };
  })()`);
  assert.match(
    defaultVisibleRules.contact,
    /后续学生签证办理及报到事宜均在省份QQ群内通知/,
  );
  assert.match(defaultVisibleRules.contact, /仅限学生本人申请入群/);
  assert.match(
    defaultVisibleRules.contact,
    /群公告仅作补充/,
  );
  assert.match(
    defaultVisibleRules.program,
    /非马来西亚籍学生须在一学年内达到录取专业英语要求，达标后才能正式开始学位课程/,
  );
  assert.match(
    defaultVisibleRules.program,
    /英语专业以合格成绩作为学生签证前置条件；其他专业不以英语成绩作为启动学生签证的前置条件/,
  );
  assert.match(defaultVisibleRules.program, /报名个人信息必须准确/);
  assert.match(defaultVisibleRules.program, /EMGS/);
  assert.match(defaultVisibleRules.program, /Xiamen University Malaysia/);
  assert.match(
    defaultVisibleRules.stageVisa,
    /英语达标会影响学位课程；英语专业还会影响签证启动/,
  );
  assert.match(
    defaultVisibleRules.stageEntry,
    /VAL必须彩色打印，SEV彩色或黑白均可/,
  );
  assert.match(
    defaultVisibleRules.stageArrival,
    /新生统一入住校内学生公寓、不准外宿/,
  );
  assert.match(
    defaultVisibleRules.dorm,
    /新生统一入住校内学生公寓、不准外宿/,
  );
  assert.equal(defaultVisibleRules.closedByDefault, true);

  const diningCollapsed = await evaluate(`(() => {
    const details = document.querySelector("#dining");
    return Boolean(details) && !details.open;
  })()`);
  assert.equal(diningCollapsed, true, "食堂攻略默认折叠");

  await evaluate(`document.querySelector("#dining > summary")?.click()`);
  await waitFor(`document.querySelector("#dining")?.open === true`, "展开食堂攻略");

  const diningInitial = await evaluate(`(() => ({
    rows: document.querySelectorAll("[data-dining-row]").length,
    visibleRows: [...document.querySelectorAll("[data-dining-row]")]
      .filter((row) => row.getBoundingClientRect().height > 0).length,
    photoButtons: document.querySelectorAll(".dining-photo-button").length,
    regionSections: document.querySelectorAll(".dining-region-section").length,
    mapButton: Boolean(document.querySelector(".dining-map-button")),
    hasWebLink: Boolean(document.querySelector("#dining a[href^='http'], #dining a[href^='https']"))
  }))()`);
  assert.equal(diningInitial.rows, 38);
  assert.equal(diningInitial.visibleRows, 38);
  assert.equal(diningInitial.photoButtons, 0);
  assert.equal(diningInitial.regionSections, 6);
  assert.equal(diningInitial.mapButton, true);
  assert.equal(diningInitial.hasWebLink, false);
  await runAxe("食堂模块展开");
  await captureElementScreenshot("single-dining.png", "#dining");

  const clickDiningFilter = (group, value) =>
    evaluate(`(() => {
      const button = document.querySelector('[data-dining-filter-group="${group}"][data-value="${value}"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
  const visibleDiningRows = () =>
    evaluate(`[...document.querySelectorAll("[data-dining-row]")]
      .filter((row) => row.getBoundingClientRect().height > 0).length`);
  const visibleDiningRegions = () =>
    evaluate(`[...document.querySelectorAll(".dining-region-section")]
      .filter((section) => section.getBoundingClientRect().height > 0)
      .map((section) => section.dataset.diningRegion)`);

  assert.equal(await clickDiningFilter("region", "D6"), true);
  assert.equal(await visibleDiningRows(), 17, "区域筛选后应只剩一期食堂");
  assert.deepEqual(await visibleDiningRegions(), ["D6"]);

  assert.equal(await clickDiningFilter("status", "coming_soon"), true);
  assert.equal(await visibleDiningRows(), 1, "D6 + 即将开业应只剩 1 家");

  assert.equal(await clickDiningFilter("category", "chinese"), true);
  assert.equal(await visibleDiningRows(), 0, "D6 + 即将开业 + 中式餐饮应为空");
  assert.equal(
    await evaluate(`(() => {
      const empty = document.querySelector(".dining-empty");
      return Boolean(empty) && empty.getBoundingClientRect().height > 0;
    })()`),
    true,
    "无匹配商户时必须显示空状态",
  );

  await evaluate(`document.querySelector(".dining-clear")?.click()`);
  assert.equal(await visibleDiningRows(), 38, "清除筛选后恢复全部商户");

  assert.equal(await clickDiningFilter("category", "chinese"), true);
  assert.equal(await visibleDiningRows(), 12, "中式餐饮共 12 家");
  await evaluate(`document.querySelector(".dining-clear")?.click()`);
  assert.equal(await visibleDiningRows(), 38);

  await evaluate(`document.querySelector(".dining-map-button")?.click()`);
  await waitFor(`Boolean(document.querySelector(".dining-viewer"))`, "打开地图查看器");
  assert.equal(
    await evaluate(`document.querySelectorAll(".dining-viewer-nav").length`),
    0,
    "单图地图不显示翻页按钮",
  );
  assert.equal(
    await evaluate(`Boolean(document.querySelector(".dining-viewer-count"))`),
    false,
  );
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`,
  );
  await waitFor(`!document.querySelector(".dining-viewer")`, "Esc 关闭地图查看器");
  assert.equal(
    await evaluate(
      `document.activeElement?.classList.contains("dining-map-button") === true`,
    ),
    true,
    "关闭查看器后焦点回到地图按钮",
  );

  const packingCollapsed = await evaluate(`(() => {
    const details = document.querySelector("#packing");
    return Boolean(details) && !details.open;
  })()`);
  assert.equal(packingCollapsed, true, "行李准备默认折叠");

  await evaluate(`document.querySelector("#packing > summary")?.click()`);
  await waitFor(`document.querySelector("#packing")?.open === true`, "展开行李准备");

  const packingInitial = await evaluate(`(() => ({
    rows: document.querySelectorAll("[data-packing-row]").length,
    groupSections: document.querySelectorAll(".packing-group-section").length,
    hasWebLink: Boolean(document.querySelector("#packing a[href^='http'], #packing a[href^='https']")),
    hasImage: Boolean(document.querySelector("#packing img"))
  }))()`);
  assert.equal(packingInitial.rows, 67);
  assert.equal(packingInitial.groupSections, 4);
  assert.equal(packingInitial.hasWebLink, false);
  assert.equal(packingInitial.hasImage, true);
  assert.equal(
    await evaluate(
      `document.querySelector("#packing .packing-map-figure img")?.src.startsWith("data:image/jpeg") === true`,
    ),
    true,
    "行李采购地图必须内嵌进单文件",
  );
  await runAxe("行李准备展开");
  await captureElementScreenshot("single-packing.png", "#packing");

  const clickPackingFilter = (group, value) =>
    evaluate(`(() => {
      const button = document.querySelector('[data-packing-filter-group="${group}"][data-value="${value}"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
  const visiblePackingRows = () =>
    evaluate(`[...document.querySelectorAll("[data-packing-row]")]
      .filter((row) => row.getBoundingClientRect().height > 0).length`);
  const visiblePackingGroups = () =>
    evaluate(`[...document.querySelectorAll(".packing-group-section")]
      .filter((section) => section.getBoundingClientRect().height > 0)
      .map((section) => section.dataset.packingGroupSection)`);

  assert.equal(await clickPackingFilter("audience", "女生侧重"), true);
  assert.equal(await visiblePackingRows(), 66, "女生视角应包含通用项并排除男生侧重项");
  assert.equal(
    await evaluate(
      `document.querySelector(".packing-active-filter-audience")?.textContent?.includes("女生视角") === true`,
    ),
    true,
    "视角令牌应显示女生视角",
  );

  assert.equal(await clickPackingFilter("category", "clothing"), true);
  assert.equal(await visiblePackingRows(), 13, "女生视角的衣物与鞋帽应为 13 项");

  assert.equal(await clickPackingFilter("strategy", "carry"), true);
  assert.equal(await visiblePackingRows(), 0, "随身携带 + 衣物与鞋帽应为空");
  assert.equal(
    await evaluate(`(() => {
      const empty = document.querySelector(".packing-empty");
      return Boolean(empty) && empty.getBoundingClientRect().height > 0;
    })()`),
    true,
    "无匹配物品时必须显示空状态",
  );

  await evaluate(`document.querySelector(".packing-clear")?.click()`);
  assert.equal(await visiblePackingRows(), 67, "清除筛选后恢复全部物品");

  assert.equal(await clickPackingFilter("strategy", "buyonsite"), true);
  assert.equal(await clickPackingFilter("category", "dorm"), true);
  assert.equal(await visiblePackingRows(), 5, "到校再买 + 床品与宿舍应为 5 项");
  assert.deepEqual(await visiblePackingGroups(), ["buyonsite"]);
  await evaluate(`document.querySelector(".packing-clear")?.click()`);
  assert.equal(await visiblePackingRows(), 67);

  await clickPackingFilter("strategy", "carry");
  await waitFor(
    `Boolean(document.querySelector(".packing-active-filter"))`,
    "筛选令牌出现",
  );
  assert.equal(
    await evaluate(
      `document.querySelector(".packing-active-filter")?.textContent?.includes("随身携带") === true`,
    ),
    true,
    "令牌应显示所选筛选",
  );
  await evaluate(
    `document.querySelector(".packing-active-filter-remove")?.click()`,
  );
  await waitFor(
    `!document.querySelector(".packing-active-filter")`,
    "移除令牌后恢复默认",
  );
  assert.equal(await visiblePackingRows(), 67);

  const clickPackingCheck = (id) =>
    evaluate(`(() => {
      const control = document.querySelector('[data-packing-check="${id}"]');
      if (!control) return false;
      control.click();
      return true;
    })()`);

  await evaluate(
    `(() => { try { localStorage.removeItem("xmum-packing-checks-v1"); } catch { return false; } return true; })()`,
  );
  await send("Page.reload");
  await waitFor(
    `document.readyState === "complete" && Boolean(document.querySelector("#packing"))`,
    "重置本机勾选后刷新",
  );
  await send("Runtime.evaluate", { expression: axeSource });
  await evaluate(`document.querySelector("#packing > summary")?.click()`);
  await waitFor(
    `document.querySelector("#packing")?.open === true`,
    "重新展开行李准备",
  );

  assert.equal(await clickPackingCheck("P01"), true, "找到并点击首项勾选控件");
  await waitFor(
    `document.querySelector('[data-packing-check="P01"]')?.getAttribute("aria-checked") === "true"`,
    "勾选首项生效",
  );
  assert.match(
    await evaluate(`document.querySelector(".packing-count")?.textContent ?? ""`),
    /已勾选 1 \/ 67/,
    "勾选后进度必须更新",
  );

  await send("Page.reload");
  await waitFor(
    `document.readyState === "complete" && Boolean(document.querySelector("#packing"))`,
    "刷新单文件页面",
  );
  await send("Runtime.evaluate", { expression: axeSource });
  await evaluate(`document.querySelector("#packing > summary")?.click()`);
  await waitFor(
    `document.querySelector("#packing")?.open === true`,
    "重新展开行李准备",
  );
  await waitFor(
    `document.querySelector('[data-packing-check="P01"]')?.getAttribute("aria-checked") === "true"`,
    "刷新后本机勾选状态恢复",
  );

  await evaluate(`document.querySelector(".packing-clear-checked")?.click()`);
  await waitFor(
    `document.querySelector('[data-packing-check="P01"]')?.getAttribute("aria-checked") === "false"`,
    "清空勾选恢复未勾选",
  );
  assert.match(
    await evaluate(`document.querySelector(".packing-count")?.textContent ?? ""`),
    /已勾选 0 \/ 67/,
    "清空后进度归零",
  );

  await evaluate(`document.querySelector(".skip-link")?.focus()`);
  await send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
  await waitFor(
    `location.hash === "#main-content" && document.activeElement?.id === "main-content"`,
    "跳到主要内容后主内容获得程序焦点",
  );

  const restoredContent = await evaluate(`(() => {
    const text = document.body.textContent ?? "";
    const paymentNames = ["Flywire", "建设银行APP", "工银e缴费", "支持国际汇款的银行网点"];
    return {
      passport: text.includes("PDF · 小于3000KB · 26页"),
      portrait: text.includes("JPG · 小于66KB · 35mm×45mm · 217px×280px"),
      health: text.includes("PDF · 小于500KB"),
      sourceCount: (text.match(/2026-07-22入学须知/g) ?? []).length,
      systemPriorityCount:
        (text.match(/如与本人当前迎新系统不一致，以当前系统为准/g) ?? []).length,
      paymentTextOnly: paymentNames.every((name) => text.includes(name)) &&
        [...document.querySelectorAll("a")].every((anchor) =>
          paymentNames.every((name) => !anchor.textContent.includes(name))
        ),
      fixedRemittancePromise: /3\\s*[—–-]\\s*5\\s*个工作日/.test(text),
      qqGroups: ["176558427", "1001326014", "610944491"].every((number) =>
        text.includes(number)
      ),
      dangerous: /初始密码|14\\s*位\\s*考生编号|26\\s*\\+\\s*省代码|18[\\s-]*356[\\s-]*3445|Tuition\\s*fee[^。\\n]{0,80}身份证号|Ms\\.?\\s*Vun/i.test(text)
    };
  })()`);
  assert.equal(restoredContent.passport, true);
  assert.equal(restoredContent.portrait, true);
  assert.equal(restoredContent.health, true);
  assert.ok(restoredContent.sourceCount >= 3);
  assert.ok(restoredContent.systemPriorityCount >= 3);
  assert.equal(restoredContent.paymentTextOnly, true);
  assert.equal(restoredContent.fixedRemittancePromise, false);
  assert.equal(restoredContent.qqGroups, true);
  assert.equal(restoredContent.dangerous, false);

  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await captureScreenshot("single-mobile.png");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await evaluate(`(() => {
    const select = document.querySelector(".program-select select");
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    setter.call(select, "人工智能");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(
    `document.querySelector(".program-title")?.innerText.includes("36,570")`,
    "专业切换至人工智能并更新费用",
  );

  const stageInitiallyOpen = await evaluate(`(() => {
    const summary = document.querySelector("#guide details summary");
    summary?.focus();
    return summary?.parentElement?.open ?? null;
  })()`);
  assert.equal(stageInitiallyOpen, false);
  await send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: " ",
    code: "Space",
    windowsVirtualKeyCode: 32,
    nativeVirtualKeyCode: 32,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: " ",
    code: "Space",
    windowsVirtualKeyCode: 32,
    nativeVirtualKeyCode: 32,
  });
  await waitFor(
    `document.querySelector("#guide details")?.open === true`,
    "键盘空格可展开办理阶段",
  );

  for (const [selector, description] of [
    [".contact-directory", "省份群记录"],
    [".parent-card", "家长说明"],
  ]) {
    await evaluate(`(() => {
      const details = document.querySelector(${JSON.stringify(selector)});
      const parentSection = details?.closest(".parent-section");
      if (parentSection) parentSection.open = true;
      details.open = false;
      details.querySelector("summary")?.focus();
    })()`);
    await send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: " ",
      code: "Space",
      windowsVirtualKeyCode: 32,
      nativeVirtualKeyCode: 32,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: " ",
      code: "Space",
      windowsVirtualKeyCode: 32,
      nativeVirtualKeyCode: 32,
    });
    await waitFor(
      `document.querySelector(${JSON.stringify(selector)})?.open === true`,
      `键盘空格可展开${description}`,
    );
    await evaluate(`(() => {
      const details = document.querySelector(${JSON.stringify(selector)});
      details.open = false;
      const parentSection = details.closest(".parent-section");
      if (parentSection) parentSection.open = false;
    })()`);
  }

  await send("Emulation.setDeviceMetricsOverride", {
    width: 1024,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const tabletTargets = await evaluate(`(() => {
    const elements = [...document.querySelectorAll(".site-header a, .site-header button, .spec-tool-link")]
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0);
    return elements
      .filter(({ rect }) => rect.width < 44 || rect.height < 44)
      .map(({ element, rect }) => ({
        label: element.textContent.trim().slice(0, 40),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }));
  })()`);
  assert.deepEqual(tabletTargets, [], "1024px 顶部导航与材料工具目标须至少达到 44×44px");
  assert.equal(
    await evaluate(
      `document.documentElement.scrollWidth > document.documentElement.clientWidth`,
    ),
    false,
    "1024px 平板横屏不得出现横向溢出",
  );

  await send("Emulation.setDeviceMetricsOverride", {
    width: 768,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: true,
  });
  const compactTabletNav = await evaluate(`(() => {
    const mobileNav = document.querySelector(".mobile-nav");
    const primaryNav = document.querySelector(".site-header nav");
    const rect = mobileNav?.getBoundingClientRect();
    return {
      mobileVisible: Boolean(
        mobileNav &&
        getComputedStyle(mobileNav).display !== "none" &&
        rect &&
        rect.width > 0 &&
        rect.height > 0
      ),
      primaryHidden: primaryNav ? getComputedStyle(primaryNav).display === "none" : false,
      links: mobileNav?.querySelectorAll("a").length ?? 0,
      shortSpecTools: [...document.querySelectorAll(".spec-tool-link")]
        .filter((element) => element.getBoundingClientRect().height < 44)
        .map((element) => Math.round(element.getBoundingClientRect().height))
    };
  })()`);
  assert.equal(compactTabletNav.mobileVisible, true, "768px 必须保留可见的全局导航");
  assert.equal(compactTabletNav.primaryHidden, true);
  assert.equal(compactTabletNav.links, 5);
  assert.deepEqual(compactTabletNav.shortSpecTools, []);
  assert.equal(
    await evaluate(
      `document.documentElement.scrollWidth > document.documentElement.clientWidth`,
    ),
    false,
    "768px 平板竖屏不得出现横向溢出",
  );

  await evaluate(`document.querySelector('.mobile-nav a[href="#official"]')?.click()`);
  await waitFor(
    `(() => {
      const section = document.querySelector("#official");
      const header = document.querySelector(".site-header");
      if (!section || !header) return false;
      return section.getBoundingClientRect().top >=
        header.getBoundingClientRect().bottom + 8;
    })()`,
    "域名核对锚点不被粘性页眉遮挡",
  );

  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await evaluate(`window.scrollTo({ top: 0, behavior: "instant" })`);
  const mobile = await evaluate(`(() => {
    const elements = [...document.querySelectorAll(
      "a, button, input:not([type='file']), select, summary, .passport-picker-primary"
    )]
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.bottom > 0);
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      smallTargets: elements
        .filter(({ element, rect }) =>
          !element.classList.contains("skip-link") &&
          (rect.width < 44 || rect.height < 44)
        )
        .map(({ element, rect }) => ({
          label: element.textContent.trim().slice(0, 40),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        })),
      brokenOfficialDomains: [...document.querySelectorAll(".official-domain-card strong")]
        .filter((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return [...range.getClientRects()].filter((rect) => rect.width > 0).length > 1;
        })
        .map((element) => element.textContent.trim()),
      primaryActionsBottom: Math.max(
        ...[...document.querySelectorAll(".hero-actions a")]
          .map((element) => element.getBoundingClientRect().bottom)
      ),
      firstCardTop: document.querySelector(".first-card")?.getBoundingClientRect().top ?? Infinity,
      pageHeight: document.documentElement.scrollHeight
    };
  })()`);
  assert.equal(mobile.overflow, false, "390px 移动端不得出现横向溢出");
  assert.deepEqual(mobile.smallTargets, [], "移动端交互目标须至少达到 44×44px");
  assert.deepEqual(mobile.brokenOfficialDomains, [], "移动端官方域名不得拆成多行");
  assert.ok(
    mobile.primaryActionsBottom <= 844,
    "移动端首屏必须完整显示两条主行动入口",
  );
  assert.ok(
    mobile.firstCardTop < 844,
    "移动端首屏必须开始呈现节点自查卡片，形成连续行动路径",
  );
  await runAxe("移动端");
  await captureElementScreenshot("single-mobile-official.png", "#official");

  await send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 568,
    deviceScaleFactor: 1,
    mobile: true,
  });
  const narrowMobile = await evaluate(`(() => ({
    overflow: document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
    shortSpecTools: [...document.querySelectorAll(".spec-tool-link")]
      .filter((element) => element.getBoundingClientRect().height < 44)
      .map((element) => Math.round(element.getBoundingClientRect().height)),
    brokenOfficialDomains: [...document.querySelectorAll(".official-domain-card strong")]
      .filter((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return [...range.getClientRects()].filter((rect) => rect.width > 0).length > 1;
      })
      .map((element) => element.textContent.trim())
  }))()`);
  assert.equal(narrowMobile.overflow, false, "320px 移动端不得出现横向溢出");
  assert.deepEqual(narrowMobile.shortSpecTools, [], "320px 材料工具目标须至少 44px 高");
  assert.deepEqual(
    narrowMobile.brokenOfficialDomains,
    [],
    "320px 移动端官方域名不得拆成多行",
  );

  assert.deepEqual(runtimeErrors, [], "控制台不得出现错误或警告");
  assert.deepEqual(networkErrors, [], "页面请求不得失败");
  assert.deepEqual(webRequests, [], "单文件不得发起 HTTP/HTTPS 请求");
  console.log(
    `[single-browser] file:// 真实交互回归通过（390×844 页面高度 ${mobile.pageHeight}px）`,
  );
} finally {
  closeSocket();
  if (target?.id) {
    await fetch(`${cdpBaseUrl}/json/close/${target.id}`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }
}
