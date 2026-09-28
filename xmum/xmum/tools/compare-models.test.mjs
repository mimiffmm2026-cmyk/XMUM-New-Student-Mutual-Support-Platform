import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseRunOutput,
  estimateCost,
  renderSummary,
} from "./compare-models.mjs";

function event(obj) {
  return JSON.stringify(obj);
}

test("parseRunOutput extracts text, tokens and cost from event lines", () => {
  const raw = [
    event({ type: "step_start", part: {} }),
    event({ type: "text", part: { text: "你好" } }),
    event({
      type: "step_finish",
      part: {
        tokens: {
          total: 11218,
          input: 9247,
          output: 3,
          reasoning: 48,
          cache: { write: 0, read: 1920 },
        },
        cost: 0,
      },
    }),
  ].join("\n");

  const result = parseRunOutput(raw);

  assert.equal(result.text, "你好");
  assert.equal(result.tokens.input, 9247);
  assert.equal(result.tokens.output, 3);
  assert.equal(result.tokens.reasoning, 48);
  assert.equal(result.tokens.cacheRead, 1920);
  assert.equal(result.tokens.cacheWrite, 0);
  assert.equal(result.tokens.total, 11218);
  assert.equal(result.cost, 0);
});

test("parseRunOutput joins multiple text parts and ignores junk lines", () => {
  const raw = [
    "not json at all",
    event({ type: "text", part: { text: "第一段" } }),
    event({ type: "unknown_future_type", part: { text: "忽略我" } }),
    event({ type: "text", part: { text: "第二段" } }),
  ].join("\n");

  const result = parseRunOutput(raw);

  assert.equal(result.text, "第一段\n第二段");
  assert.equal(result.tokens.total, 0);
  assert.equal(result.cost, 0);
});

test("estimateCost multiplies token counts by per-million pricing", () => {
  const cost = estimateCost(
    { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000 },
    { input: 0.14, output: 0.28, cacheRead: 0.028 },
  );

  assert.equal(cost, 0.448);
});

test("estimateCost is zero for free models", () => {
  const cost = estimateCost(
    { input: 500_000, output: 500_000, cacheRead: 0 },
    { input: 0, output: 0, cacheRead: 0 },
  );

  assert.equal(cost, 0);
});

test("renderSummary returns a markdown table with one row per result", () => {
  const md = renderSummary([
    {
      model: "opencode/ling-3.0-flash-fin-free",
      label: "Ling 3.0 Flash Fin Free",
      ok: true,
      ms: 1234,
      tokens: { input: 100, output: 20, reasoning: 0, cacheRead: 0 },
      cost: 0,
      outputFile: "results/x/ling.md",
      error: "",
    },
    {
      model: "deepseek/deepseek-v4-flash",
      label: "DeepSeek V4 Flash",
      ok: false,
      ms: 500,
      tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
      cost: 0,
      outputFile: "",
      error: "boom",
    },
  ]);

  assert.match(md, /\|.*模型.*\|/);
  assert.match(md, /Ling 3\.0 Flash Fin Free/);
  assert.match(md, /DeepSeek V4 Flash/);
  assert.match(md, /1\.23s/);
  assert.match(md, /boom/);
});

test("renderSummary counts cached input tokens in the input column", () => {
  const md = renderSummary([
    {
      model: "m",
      label: "M",
      ok: true,
      ms: 1000,
      tokens: { input: 100, output: 20, reasoning: 0, cacheRead: 900 },
      cost: 0,
      outputFile: "",
      error: "",
    },
  ]);

  assert.match(md, /\| 1000 \|/);
});
