import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { knowledgeEntries } from "../app/knowledge-content.ts";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const server = createServer();
server.listen(0, "127.0.0.1");
await once(server, "listening");
const { port } = server.address();
await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [
  fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)),
  "dev", "--local", "--config", "dist/server/wrangler.json",
  "--port", String(port), "--ip", "127.0.0.1", "--log-level", "error",
], {
  cwd: projectRoot,
  env: {
    ...process.env,
    CI: "1",
    WRANGLER_SEND_METRICS: "false",
    WRANGLER_WRITE_LOGS: "false",
    WRANGLER_LOG_PATH: ".wrangler/logs",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
let spawnError;
child.on("error", (error) => { spawnError = error; });
for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (chunk) => { logs = (logs + chunk.toString()).slice(-16000); });
}
const finished = new Promise((resolve) => child.once("close", resolve));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(path) {
  return fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(5000),
    headers: { accept: path === "/" ? "text/html" : "image/jpeg" },
  });
}

try {
  let response;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Local Worker exited: ${child.exitCode}\n${logs}`);
    try {
      response = await get("/");
      break;
    } catch {
      await delay(200);
    }
  }
  assert.ok(response, `Local Worker did not start.\n${logs}`);
  assert.equal(response.status, 200, "本地 Worker 首页必须返回 200");
  const html = await response.text();
  assert.equal((html.match(/data-knowledge-entry=/g) ?? []).length, knowledgeEntries.length);
  for (const text of ["国际生医疗保险", "Bell Suites", "不会自动提交"]) {
    assert.ok(html.includes(text), text);
  }
  const image = await get("/_vinext/image?url=%2Fimages%2Fxmum-campus-map.jpg&w=640&q=75");
  assert.equal(image.status, 200, "真实 ASSETS 绑定必须支持图片回退");
  assert.match(image.headers.get("content-type") ?? "", /^image\/jpeg\b/i);
  assert.equal(image.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(
    Buffer.from(await image.arrayBuffer()),
    await readFile(new URL("../public/images/xmum-campus-map.jpg", import.meta.url)),
  );
  for (const [query, status] of [
    ["url=%2Fimages%2Fxmum-campus-map.jpg&w=123&q=75", 400],
    ["url=%2Fimages%2Fmissing.jpg&w=640&q=75", 404],
  ]) {
    const invalid = await get(`/_vinext/image?${query}`);
    assert.equal(invalid.status, status);
    await invalid.arrayBuffer();
  }
  console.log(`[built-worker] 本地原生 Worker 通过：首页 200、${knowledgeEntries.length} 条索引、图片原件回退、400/404 边界`);
} catch (error) {
  if (logs) console.error(logs);
  throw error;
} finally {
  child.kill("SIGTERM");
  let timeout;
  await Promise.race([
    finished,
    new Promise((resolve) => { timeout = setTimeout(resolve, 5000); }),
  ]);
  clearTimeout(timeout);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await finished;
  }
}
