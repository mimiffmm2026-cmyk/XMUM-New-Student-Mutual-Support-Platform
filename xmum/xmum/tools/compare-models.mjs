import { spawn } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(HERE, "prompts");
const RESULTS_DIR = path.join(HERE, "results");
const RUN_TIMEOUT_MS = 5 * 60 * 1000;

export const MODELS = [
  {
    id: "opencode/ling-3.0-flash-fin-free",
    label: "Ling 3.0 Flash Fin Free",
    pricing: { input: 0, output: 0, cacheRead: 0 },
  },
  {
    id: "opencode/mimo-v2.5-free",
    label: "MiMo V2.5 Free",
    pricing: { input: 0, output: 0, cacheRead: 0 },
  },
  {
    id: "opencode/muse-spark-1.3-contributor-free",
    label: "Muse Spark 1.3 Contributor Free",
    pricing: { input: 0, output: 0, cacheRead: 0 },
  },
  {
    id: "opencode/nemotron-3.5-lightning-free",
    label: "Nemotron 3.5 Lightning Free",
    pricing: { input: 0, output: 0, cacheRead: 0 },
  },
  {
    id: "deepseek/deepseek-v4-flash",
    label: "DeepSeek V4 Flash (baseline)",
    pricing: { input: 0.14, output: 0.28, cacheRead: 0.028 },
  },
];

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function parseRunOutput(raw) {
  const texts = [];
  let tokens = {
    total: 0,
    input: 0,
    output: 0,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
  };
  let cost = 0;

  for (const line of String(raw ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!event || typeof event !== "object") continue;

    if (event.type === "text" && typeof event.part?.text === "string") {
      texts.push(event.part.text);
      continue;
    }

    if (event.type === "step_finish" && event.part) {
      const step = event.part.tokens ?? {};
      tokens.total += step.total ?? 0;
      tokens.input += step.input ?? 0;
      tokens.output += step.output ?? 0;
      tokens.reasoning += step.reasoning ?? 0;
      tokens.cacheRead += step.cache?.read ?? 0;
      tokens.cacheWrite += step.cache?.write ?? 0;
      if (typeof event.part.cost === "number") cost += event.part.cost;
    }
  }

  return { text: texts.join("\n").trim(), tokens, cost };
}

export function estimateCost(tokens, pricing) {
  const input = ((tokens.input ?? 0) / 1e6) * (pricing.input ?? 0);
  const output = ((tokens.output ?? 0) / 1e6) * (pricing.output ?? 0);
  const cacheRead = ((tokens.cacheRead ?? 0) / 1e6) * (pricing.cacheRead ?? 0);
  return round(input + output + cacheRead, 6);
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${round(ms / 1000, 2)}s`;
}

export function renderSummary(rows) {
  const lines = [
    "| 模型 | 状态 | 耗时 | 输入tokens(含缓存) | 输出tokens | 成本(USD) | 输出文件 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const row of rows) {
    const status = row.ok ? "OK" : `失败: ${row.error}`;
    const input = (row.tokens.input ?? 0) + (row.tokens.cacheRead ?? 0);
    lines.push(
      `| ${row.label} | ${status} | ${formatDuration(row.ms)} | ${input} | ${row.tokens.output} | ${row.cost.toFixed(4)} | ${row.outputFile || "-"} |`,
    );
  }

  return lines.join("\n");
}

function loadPrompts() {
  let entries;
  try {
    entries = readdirSync(PROMPTS_DIR);
  } catch {
    return [];
  }

  return entries
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => ({
      name: name.replace(/\.md$/, ""),
      text: readFileSync(path.join(PROMPTS_DIR, name), "utf8").trim(),
    }))
    .filter((prompt) => prompt.text.length > 0);
}

function slug(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function runProcess(command, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      clearTimeout(flushTimer);
      resolve(result);
    };

    const killTimer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ code: null, stdout, stderr, timedOut: true });
    }, timeoutMs);

    let flushTimer = null;
    const scheduleFlush = (code) => {
      flushTimer = setTimeout(
        () => finish({ code, stdout, stderr, timedOut: false }),
        300,
      );
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      finish({ code: -1, stdout, stderr: stderr + String(error), timedOut: false });
    });
    child.on("exit", (code) => scheduleFlush(code));
    child.on("close", (code) => finish({ code, stdout, stderr, timedOut: false }));
  });
}

async function runOne(model, prompt) {
  const started = Date.now();
  const outcome = await runProcess(
    "opencode",
    ["run", "-m", model.id, "--format", "json", prompt.text],
    RUN_TIMEOUT_MS,
  );

  const parsed = parseRunOutput(outcome.stdout);
  const ok = !outcome.timedOut && outcome.code === 0;
  const error = outcome.timedOut
    ? `超时 ${RUN_TIMEOUT_MS}ms`
    : ok
      ? ""
      : String(outcome.stderr || `exit ${outcome.code}`).trim().slice(0, 500);

  return {
    model: model.id,
    label: model.label,
    ok,
    ms: Date.now() - started,
    tokens: parsed.tokens,
    cost:
      parsed.cost > 0
        ? round(parsed.cost, 6)
        : estimateCost(parsed.tokens, model.pricing),
    text: parsed.text,
    error,
  };
}

async function main() {
  const prompts = loadPrompts();
  if (prompts.length === 0) {
    console.error(`没有找到 prompt。请在 ${PROMPTS_DIR} 放入 .md 文件，每个文件一个 prompt。`);
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(RESULTS_DIR, stamp);
  mkdirSync(outDir, { recursive: true });

  const rows = [];

  for (const prompt of prompts) {
    for (const model of MODELS) {
      process.stdout.write(`跑 ${model.label} × ${prompt.name} ... `);
      const result = await runOne(model, prompt);
      console.log(result.ok ? `OK ${formatDuration(result.ms)}` : "失败");

      let outputFile = "";
      if (result.text) {
        outputFile = path.join(outDir, `${prompt.name}__${slug(model.id)}.md`);
        writeFileSync(outputFile, result.text, "utf8");
      }

      rows.push({
        prompt: prompt.name,
        model: result.model,
        label: result.label,
        ok: result.ok,
        ms: result.ms,
        tokens: result.tokens,
        cost: result.cost,
        outputFile: outputFile ? path.relative(HERE, outputFile) : "",
        error: result.error,
      });
    }
  }

  const summary = renderSummary(rows);
  const summaryPath = path.join(outDir, "summary.md");
  writeFileSync(summaryPath, `${summary}\n`, "utf8");

  console.log(`\n${summary}\n`);
  console.log(`结果目录: ${path.relative(HERE, outDir)}`);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
