import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const outputFile = path.join(projectRoot, "export-single", "index.html");
const outputUrl = pathToFileURL(outputFile).href;
const cdpBaseUrl = (process.env.CDP_URL ?? "http://127.0.0.1:9344").replace(/\/$/, "");
const wechatUserAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003128) NetType/WIFI Language/zh_CN";

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
let fixtureDirectory;try {
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
const webRequests = [];
let commandId = 0;

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
      timer = setTimeout(() => reject(new Error(`CDP 命令超时：${method}`)), 60000);
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
        () => reject(new Error(`Runtime.evaluate 超时：${expression.slice(0, 80)}`)),
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
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`等待超时：${description}`);
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await send("Emulation.setUserAgentOverride", { userAgent: wechatUserAgent });
  await send("Page.navigate", { url: outputUrl });
  await waitFor(
    `document.readyState === "complete" && Boolean(document.querySelector("#passport-compressor"))`,
    "单文件页面完成加载",
  );
  assert.equal(
    await evaluate(`navigator.userAgent.includes("MicroMessenger")`),
    true,
    "必须模拟微信内置浏览器",
  );

  fixtureDirectory = await mkdtemp(
    path.join(tmpdir(), "xmum-single-compression-"),
  );
  const fixturePath = path.join(fixtureDirectory, "passport-compressor-fixture.pdf");
  await new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ["tests/create-passport-fixture.mjs", fixturePath],
      { cwd: projectRoot, timeout: 120000 },
      (error, _stdout, stderr) =>
        error
          ? reject(new Error(`生成护照夹具失败：${error.message}\n${stderr}`))
          : resolve(),
    );
  });

  const fileInput = await send("Runtime.evaluate", {
    expression: `document.querySelector("#passport-compressor input[type=file]")`,
  });
  assert.ok(fileInput.result.objectId, "必须找到护照压缩文件输入框");
  await send("DOM.setFileInputFiles", {
    files: [fixturePath],
    objectId: fileInput.result.objectId,
  });
  await waitFor(
    `document.querySelectorAll("#passport-compressor .passport-file").length === 1`,
    "夹具 PDF 加入护照队列",
  );
  assert.equal(
    await evaluate(
      `document.querySelector("#passport-compressor .passport-start")?.disabled === false`,
    ),
    true,
    "加入文件后必须可以开始压缩",
  );

  await evaluate(`document.querySelector("#passport-compressor .passport-start")?.click()`);
  let compressionState = null;
  const compressionDeadline = Date.now() + 240000;
  while (Date.now() < compressionDeadline) {
    try {
      compressionState = await evaluate(`(() => {
        const root = document.querySelector("#passport-compressor");
        return {
          status: root?.querySelector(".passport-file-status > span")?.textContent ?? null,
          error: root?.querySelector(".passport-error")?.textContent ?? null,
          download: Boolean(root?.querySelector(".passport-file-status a[download]"))
        };
      })()`);
      if (compressionState.error || compressionState.download) break;
    } catch (error) {
      if (process.env.DEBUG_COMPRESSION) {
        console.log(`[compression-debug] 状态读取暂不可用：${error.message}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  assert.ok(
    compressionState && (compressionState.download || compressionState.error),
    `file:// 下护照压缩超时，最后状态：${JSON.stringify(compressionState)}`,
  );

  const compression = await evaluate(`(() => {
    const root = document.querySelector("#passport-compressor");
    const sizeText = [...root.querySelectorAll(".passport-checks dd small")]
      .map((node) => node.textContent)
      .join(" ");
    const bytesMatch = sizeText.match(/([\\d,]+)\\s*字节/);
    return {
      hasDownload: Boolean(root.querySelector(".passport-file-status a[download]")),
      error: root.querySelector(".passport-error")?.textContent ?? null,
      outputBytes: bytesMatch ? Number(bytesMatch[1].replace(/,/g, "")) : null,
      wechatHint: Boolean(root.querySelector(".wechat-download-hint")),
      hintText: root.querySelector(".wechat-download-hint")?.textContent ?? ""
    };
  })()`);
  assert.equal(compression.error, null, `压缩不得失败：${compression.error}`);
  assert.equal(compression.hasDownload, true, "file:// 下压缩成功后必须提供下载");
  assert.ok(
    compression.outputBytes !== null && compression.outputBytes <= 2900000,
    `成品必须不超过 2,900,000 字节，实际 ${compression.outputBytes}`,
  );
  assert.equal(compression.wechatHint, true, "微信 UA 下必须显示下载兜底提示");
  assert.match(compression.hintText, /在浏览器打开/, "提示必须说明在浏览器打开");

  assert.deepEqual(runtimeErrors, [], "压缩期间不得出现未预期的控制台错误或警告");
  assert.deepEqual(webRequests, [], "file:// 压缩不得发起 HTTP/HTTPS 请求");
  console.log(
    `[single-compression] file:// + 微信 UA 护照压缩回归通过：成品 ${compression.outputBytes} 字节`,
  );
} finally {
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    socket.close();
  }
  if (target?.id) {
    await fetch(`${cdpBaseUrl}/json/close/${target.id}`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }
  if (fixtureDirectory) {
    await rm(fixtureDirectory, { recursive: true, force: true }).catch(() => {});
  }
}
