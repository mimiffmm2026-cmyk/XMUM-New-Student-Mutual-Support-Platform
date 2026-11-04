import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const wrapper = fileURLToPath(new URL("../scripts/ci-browser-regressions.sh", import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "xmum-wrapper-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bin = path.join(root, "bin");
  const runner = path.join(root, "runner");
  const fixtures = path.join(root, "fixtures");
  await Promise.all([bin, runner, fixtures].map((directory) => mkdir(directory)));
  for (const [name, body] of Object.entries({
    chromium: `printf "%s\\n" "$@" > "$CHROME_TRACE"
if [ "$WRAPPER_SCENARIO" = chrome-exit ]; then exit 83; fi
printf 'DevTools listening on ws://127.0.0.1:9344/devtools/browser/11111111-1111-4111-8111-111111111111\\n' >&2
exec /bin/sleep 30`,
    curl: `for url; do :; done
case "$url" in
  */json/version)
    if [ "$WRAPPER_SCENARIO" != occupied-chrome ] && [ ! -s "$CHROME_TRACE" ]; then exit 7; fi
    uuid=11111111-1111-4111-8111-111111111111
    if [ "$WRAPPER_SCENARIO" = old-chrome ]; then uuid=22222222-2222-4222-8222-222222222222; fi
    printf '{"webSocketDebuggerUrl":"ws://127.0.0.1:9344/devtools/browser/%s"}\\n' "$uuid"
    ;;
  */images/xmum-campus-map.jpg)
    test -s "$DEV_TRACE" || exit 7
    token=$(cat "$DEV_TRACE")
    if [ "$WRAPPER_SCENARIO" = old-dev ]; then token=old-run-token; fi
    printf 'HTTP/1.1 200 OK\\r\\nX-XMUM-Browser-Run: %s\\r\\n\\r\\n' "$token"
    ;;
  *)
    if [ "$WRAPPER_SCENARIO" != occupied-dev ] && [ ! -s "$DEV_TRACE" ]; then exit 7; fi
    ;;
esac`,
    npm: `printf "%s\\n" "$*" >> "$NPM_TRACE"
case "$*" in
  "run dev "*)
    printf "%s\\n" "$XMUM_BROWSER_RUN_TOKEN" > "$DEV_TRACE"
    if [ "$WRAPPER_SCENARIO" = dev-exit ]; then exit 85; fi
    exec /bin/sleep 30
    ;;
  *)
    case "$WRAPPER_SCENARIO" in old-dev|dev-exit|owned-dev) exit 0;; esac
    exit 73
    ;;
esac`,
    node: 'printf "%s\\n" "$*" >> "$NODE_TRACE"\nexit 74',
    python3: "exit 71",
  })) {
    await writeFile(path.join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  }
  return { root, bin, runner, fixtures };
}

function run(context, label, { discoverChromium = false, scenario = "test-failure" } = {}) {
  const trace = path.join(context.root, `${label}-chrome.txt`);
  const npmTrace = path.join(context.root, `${label}-npm.txt`);
  const nodeTrace = path.join(context.root, `${label}-node.txt`);
  const devTrace = path.join(context.root, `${label}-dev.txt`);
  const result = spawnSync("/bin/bash", [wrapper], {
    cwd: context.root,
    encoding: "utf8",
    timeout: 15000,
    env: {
      ...process.env,
      PATH: `${context.bin}${path.delimiter}${process.env.PATH}`,
      RUNNER_TEMP: context.runner,
      BROWSER_ARTIFACT_DIR: path.join(context.root, "artifacts"),
      BROWSER_FIXTURE_DIR: context.fixtures,
      CHROMIUM_PATH: discoverChromium ? "" : path.join(context.bin, "chromium"),
      CHROME_TRACE: trace,
      NPM_TRACE: npmTrace,
      NODE_TRACE: nodeTrace,
      DEV_TRACE: devTrace,
      WRAPPER_SCENARIO: scenario,
    },
  });
  assert.ifError(result.error);
  return { result, trace, npmTrace, nodeTrace, devTrace };
}

async function readOrEmpty(file) {
  return readFile(file, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
}

async function artifactRunDirectory(context) {
  const entries = (await readdir(path.join(context.root, "artifacts")))
    .filter((name) => name.startsWith("xmum-browser-run."));
  assert.equal(entries.length, 1, "每次 wrapper 运行必须拥有独立 artifact 子目录");
  return path.join(context.root, "artifacts", entries[0]);
}

for (const scenario of ["occupied-chrome", "occupied-dev", "chrome-exit", "old-chrome"]) {
  test(`browser wrapper rejects ${scenario} before running browser tests`, async (t) => {
    const context = await fixture(t);
    const { result, npmTrace } = run(context, scenario, { scenario });
    assert.notEqual(result.status, 0, result.stdout);
    assert.equal(await readOrEmpty(npmTrace), "", "unowned endpoints must never start tests");
    assert.deepEqual(await readdir(context.fixtures), []);
  });
}

for (const scenario of ["dev-exit", "old-dev"]) {
  test(`browser wrapper rejects ${scenario} before creating PDF fixtures`, async (t) => {
    const context = await fixture(t);
    const { result, npmTrace, nodeTrace } = run(context, scenario, { scenario });
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(await readOrEmpty(npmTrace), /run dev /);
    assert.equal(await readOrEmpty(nodeTrace), "", "unowned dev endpoints must not reach fixtures");
    assert.deepEqual(await readdir(context.fixtures), []);
  });
}

test("browser wrapper verifies its own dev token and uses a strict port", async (t) => {
  const context = await fixture(t);
  const { result, npmTrace, nodeTrace, devTrace } = run(context, "owned-dev", { scenario: "owned-dev" });
  assert.equal(result.status, 74, result.stderr);
  assert.match(await readFile(npmTrace, "utf8"), /run dev .*--strictPort\b/);
  assert.match(await readFile(nodeTrace, "utf8"), /tests\/create-passport-fixture\.mjs/);
  assert.ok((await readFile(devTrace, "utf8")).trim(), "dev server must receive this run's identity");
  const artifacts = await artifactRunDirectory(context);
  assert.ok((await readdir(artifacts)).includes("create-passport-fixture.log"));
  assert.deepEqual(await readdir(context.fixtures), []);
});

test("browser wrapper failure preserves preexisting fixture and profile directories", async (t) => {
  const context = await fixture(t);
  const legacyProfiles = path.join(context.runner, "xmum-browser-chrome");
  await mkdir(legacyProfiles);
  await writeFile(path.join(context.fixtures, "keep.txt"), "existing fixture");
  await writeFile(path.join(legacyProfiles, "keep.txt"), "another run's profile");

  const { result } = run(context, "failed-test");
  assert.equal(result.status, 73, result.stderr);
  assert.deepEqual(await readdir(context.fixtures), ["keep.txt"]);
  assert.equal(await readFile(path.join(legacyProfiles, "keep.txt"), "utf8"), "another run's profile");
  const artifacts = await artifactRunDirectory(context);
  assert.ok((await readdir(artifacts)).includes("single-browser.log"));
  assert.match(
    await readFile(path.join(artifacts, "startup", "chromium-node.log"), "utf8"),
    /DevTools listening/,
  );
});

test("browser wrapper cleans owned scratch after Chromium discovery fails", async (t) => {
  const context = await fixture(t);
  const { result } = run(context, "failed-discovery", { discoverChromium: true });
  assert.equal(result.status, 71, result.stderr);
  assert.deepEqual(await readdir(context.fixtures), []);
  assert.deepEqual(await readdir(context.runner), []);
});

test("browser wrapper gives separate invocations distinct profile paths", async (t) => {
  const context = await fixture(t);
  const profiles = [];
  for (const label of ["first", "second"]) {
    const { result, trace } = run(context, label);
    assert.equal(result.status, 73, result.stderr);
    const profile = (await readFile(trace, "utf8")).split("\n")
      .find((argument) => argument.startsWith("--user-data-dir="));
    assert.ok(profile, "Chromium must receive a dedicated profile path");
    profiles.push(profile);
  }
  assert.notEqual(profiles[0], profiles[1]);
  const artifactRuns = (await readdir(path.join(context.root, "artifacts")))
    .filter((name) => name.startsWith("xmum-browser-run."));
  assert.equal(artifactRuns.length, 2, "连续运行也必须保留两个独立 artifact 子目录");
  assert.deepEqual(await readdir(context.fixtures), []);
  assert.deepEqual(await readdir(context.runner), []);
});

test("browser wrapper rejects an artifact root equal to scratch and preserves sentinels", async (t) => {
  const context = await fixture(t);
  await writeFile(path.join(context.fixtures, "sentinel.txt"), "keep");
  const trace = path.join(context.root, "same-root-npm.txt");
  const result = spawnSync("/bin/bash", [wrapper], {
    cwd: context.root,
    encoding: "utf8",
    timeout: 15000,
    env: {
      ...process.env,
      PATH: `${context.bin}${path.delimiter}${process.env.PATH}`,
      RUNNER_TEMP: context.runner,
      BROWSER_ARTIFACT_DIR: context.fixtures,
      BROWSER_FIXTURE_DIR: context.fixtures,
      CHROMIUM_PATH: path.join(context.bin, "chromium"),
      NPM_TRACE: trace,
      NODE_TRACE: path.join(context.root, "same-root-node.txt"),
      DEV_TRACE: path.join(context.root, "same-root-dev.txt"),
      CHROME_TRACE: path.join(context.root, "same-root-chrome.txt"),
      WRAPPER_SCENARIO: "test-failure",
    },
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, "同一目录配置必须在启动前失败");
  assert.equal(await readOrEmpty(trace), "", "拒绝配置时不得启动 npm 测试");
  assert.equal(await readFile(path.join(context.fixtures, "sentinel.txt"), "utf8"), "keep");
});
