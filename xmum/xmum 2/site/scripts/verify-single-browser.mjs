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
  const response = await fetch(url, options);
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
  return result;
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
    message.method === "Log.entryAdded" &&
    ["error", "warning"].includes(message.params.entry.level)
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
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
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
  await send("Page.navigate", { url: outputUrl });
  await waitFor(
    `document.readyState === "complete" && Boolean(document.querySelector("#contact"))`,
    "单文件页面完成加载",
  );
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
  await evaluate(`window.scrollTo(0, 0)`);
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
      urgentCardTop: document.querySelector(".first-card")?.getBoundingClientRect().top ?? Infinity,
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
    mobile.urgentCardTop < 844,
    "移动端首屏必须开始呈现三项紧急任务，形成连续行动路径",
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
    await fetch(`${cdpBaseUrl}/json/close/${target.id}`).catch(() => {});
  }
}
